// lib/devengoGastos.ts
//
// DEVENGO MES A MES DE GASTOS RECURRENTES (Compromisos Fase 2)
// =====================================================
//
// Una plantilla con `devengar` activo se reconoce cada mes en su
// período, sin esperar al pago:
//
//   día 1 del mes   Gasto (ej. Vivienda)  /  Cuentas a Pagar     ← devengo
//   al pagar        Cuentas a Pagar       /  Banco               ← saldado
//
// Cada plantilla tiene una ventana móvil de 12 meses de recordatorios
// (estado PROGRAMADA, sin asiento). Al abrir la app, los que ya
// llegaron al día 1 se devengan solos si el monto es fijo, o quedan
// "Por confirmar" si es variable (luz, agua). Es el único lugar donde
// el sistema crea asientos sin que alguien los cargue a mano — por eso
// es opt-in por plantilla y por empresa (ver devengoEmpresas.ts), y
// cada paso es idempotente: la fila se "reclama" (estado DEVENGANDO)
// antes de registrar, así dos pestañas abiertas a la vez no duplican.

import { supabase } from './supabase';
import { registrarOperacion } from './motor';
import { fechaLocalHoy } from './fecha';
import { EMPRESAS_CON_DEVENGO } from './devengoEmpresas';
import { asegurarCuentaAPagar, obtenerConfigAPagar, type ConfigAPagar } from './cuentaAPagar';
import {
  periodosFaltantes,
  fechaVencimientoDe,
  correspondeDevengar,
  devengoTrabado,
  historicoDevengo,
  type EstadoDevengo,
} from './devengo';

const TABLA = 'gastos_recurrentes_recordatorios';

type FilaADevengar = {
  id: string;
  periodo: string;
  fecha_vencimiento: string;
  estado: EstadoDevengo;
  devengo_iniciado_en: string | null;
  evento_calendario_id: string | null;
  nombre: string;
  categoria: string;
};

export function empresaTieneDevengo(empresaId: string | null | undefined): boolean {
  return Boolean(empresaId) && EMPRESAS_CON_DEVENGO.includes(empresaId as string);
}

// Reconoce el gasto de una fila: la reclama, registra el asiento (o
// adopta uno que un intento anterior sí llegó a registrar) y la deja
// DEVENGADA. Si algo falla, la devuelve a su estado de origen.
async function devengarFila(empresaId: string, config: ConfigAPagar, fila: FilaADevengar, monto: number) {
  if (!(monto > 0)) {
    throw new Error('El monto a devengar tiene que ser mayor que cero.');
  }

  let reclamo = supabase
    .from(TABLA)
    .update({ estado: 'DEVENGANDO', devengo_iniciado_en: new Date().toISOString() })
    .eq('id', fila.id)
    .eq('estado', fila.estado);

  if (fila.estado === 'DEVENGANDO') {
    reclamo = fila.devengo_iniciado_en
      ? reclamo.eq('devengo_iniciado_en', fila.devengo_iniciado_en)
      : reclamo.is('devengo_iniciado_en', null);
  }

  const { data: reclamada, error: errorReclamo } = await reclamo.select('id');

  if (errorReclamo) {
    throw errorReclamo;
  }

  // Otra pestaña (u otra llamada) se adelantó: no se hace nada.
  if (!reclamada || reclamada.length === 0) {
    return false;
  }

  const estadoOrigen: EstadoDevengo = fila.estado === 'DEVENGANDO' ? 'PROGRAMADA' : fila.estado;

  try {
    const historico = historicoDevengo(fila.nombre, fila.periodo);

    const { data: existente, error: errorExistente } = await supabase
      .from('registro_operaciones')
      .select('id_operacion')
      .eq('empresa_id', empresaId)
      .eq('operacion', 'PAGO')
      .eq('categoria', fila.categoria)
      .eq('historico', historico)
      .eq('fecha', fila.periodo)
      .limit(1)
      .maybeSingle();

    if (errorExistente) {
      throw errorExistente;
    }

    let idOperacion = existente?.id_operacion as string | undefined;

    if (!idOperacion) {
      const resultado = await registrarOperacion(empresaId, {
        fecha: fila.periodo,
        operacion: 'PAGO',
        categoria: fila.categoria,
        formaPago: config.formaPago,
        historico,
        clienteProveedor: '',
        lineas: [{ producto: '', cantidad: 1, monto }],
      });

      idOperacion = resultado.idOperacion;
    }

    let eventoId = fila.evento_calendario_id;

    if (!eventoId) {
      const { data: evento, error: errorEvento } = await supabase
        .from('eventos_calendario')
        .insert({
          empresa_id: empresaId,
          creado_por: null,
          titulo: `Vence: ${fila.nombre}`,
          categoria: 'FINANCEIRO',
          fecha: fila.fecha_vencimiento,
          hora: '09:00:00',
          notas: null,
          notificar: true,
          antelacion_minutos: 1440,
        })
        .select('id')
        .single();

      if (errorEvento) {
        throw errorEvento;
      }

      eventoId = evento.id;
    }

    const { error: errorFinal } = await supabase
      .from(TABLA)
      .update({
        estado: 'DEVENGADA',
        monto_devengado: monto,
        id_operacion_devengo: idOperacion,
        devengo_iniciado_en: null,
        evento_calendario_id: eventoId,
      })
      .eq('id', fila.id);

    if (errorFinal) {
      throw errorFinal;
    }

    return true;
  } catch (e) {
    await supabase.from(TABLA).update({ estado: estadoOrigen, devengo_iniciado_en: null }).eq('id', fila.id);
    throw e;
  }
}

// Completa la ventana de 12 meses de cada plantilla que devenga.
export async function mantenerVentana(empresaId: string) {
  const { data: plantillas, error } = await supabase
    .from('gastos_recurrentes')
    .select('id, dia_mes')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .eq('devengar', true);

  if (error) {
    throw error;
  }

  if (!plantillas || plantillas.length === 0) {
    return;
  }

  const hoy = fechaLocalHoy();

  const { data: existentes, error: errorExistentes } = await supabase
    .from(TABLA)
    .select('gasto_recurrente_id, periodo')
    .eq('empresa_id', empresaId)
    .in('gasto_recurrente_id', plantillas.map((p) => p.id));

  if (errorExistentes) {
    throw errorExistentes;
  }

  const filas: Record<string, unknown>[] = [];

  for (const plantilla of plantillas) {
    const periodos = (existentes ?? []).filter((e) => e.gasto_recurrente_id === plantilla.id).map((e) => e.periodo as string);

    for (const periodo of periodosFaltantes(periodos, hoy)) {
      filas.push({
        gasto_recurrente_id: plantilla.id,
        empresa_id: empresaId,
        periodo,
        fecha_vencimiento: fechaVencimientoDe(periodo, plantilla.dia_mes),
        registrado: false,
        estado: 'PROGRAMADA',
        evento_calendario_id: null,
      });
    }
  }

  if (filas.length === 0) {
    return;
  }

  // ignoreDuplicates: la restricción única (plantilla, período) hace de
  // red de seguridad si dos llamadas se cruzan.
  const { error: errorInsertar } = await supabase
    .from(TABLA)
    .upsert(filas, { onConflict: 'gasto_recurrente_id,periodo', ignoreDuplicates: true });

  if (errorInsertar) {
    throw errorInsertar;
  }
}

// Devenga lo que ya llegó al día 1: monto fijo → asiento directo;
// variable → queda "Por confirmar". Devuelve cuántos devengó.
export async function devengarPendientes(empresaId: string): Promise<number> {
  const config = await obtenerConfigAPagar(empresaId);

  if (!config) {
    return 0;
  }

  const hoy = fechaLocalHoy();

  const { data, error } = await supabase
    .from(TABLA)
    .select(
      'id, periodo, fecha_vencimiento, estado, devengo_iniciado_en, evento_calendario_id, gastos_recurrentes!inner(nombre, categoria, monto_habitual, monto_fijo, devengar, activo)'
    )
    .eq('empresa_id', empresaId)
    .eq('registrado', false)
    .in('estado', ['PROGRAMADA', 'DEVENGANDO'])
    .lte('periodo', hoy);

  if (error) {
    throw error;
  }

  let devengados = 0;

  for (const fila of data ?? []) {
    const plantilla = fila.gastos_recurrentes as unknown as {
      nombre: string;
      categoria: string;
      monto_habitual: number | string;
      monto_fijo: boolean;
      devengar: boolean;
      activo: boolean;
    };

    if (!plantilla.devengar || !plantilla.activo || !correspondeDevengar(fila.periodo, hoy)) {
      continue;
    }

    // Un devengo en curso solo se retoma si quedó trabado.
    if (fila.estado === 'DEVENGANDO' && !devengoTrabado(fila.devengo_iniciado_en)) {
      continue;
    }

    if (!plantilla.monto_fijo) {
      await supabase.from(TABLA).update({ estado: 'POR_CONFIRMAR' }).eq('id', fila.id).in('estado', ['PROGRAMADA', 'DEVENGANDO']);
      continue;
    }

    const hecho = await devengarFila(
      empresaId,
      config,
      {
        id: fila.id,
        periodo: fila.periodo,
        fecha_vencimiento: fila.fecha_vencimiento,
        estado: fila.estado as EstadoDevengo,
        devengo_iniciado_en: fila.devengo_iniciado_en,
        evento_calendario_id: fila.evento_calendario_id,
        nombre: plantilla.nombre,
        categoria: plantilla.categoria,
      },
      Number(plantilla.monto_habitual)
    );

    if (hecho) devengados += 1;
  }

  return devengados;
}

// Punto de entrada al abrir la app / Compromisos: completa la ventana
// y devenga lo que corresponde. Solo corre en las empresas piloto.
export async function ejecutarDevengo(empresaId: string) {
  if (!empresaTieneDevengo(empresaId)) {
    return;
  }

  await mantenerVentana(empresaId);
  await devengarPendientes(empresaId);
}

// Confirma el monto real de un gasto variable (luz, agua) y lo devenga.
export async function confirmarDevengo(empresaId: string, recordatorioId: string, monto: number) {
  const config = await obtenerConfigAPagar(empresaId);

  if (!config) {
    throw new Error('No se encontró la cuenta "Cuentas a Pagar" de esta empresa.');
  }

  const { data, error } = await supabase
    .from(TABLA)
    .select('id, periodo, fecha_vencimiento, estado, devengo_iniciado_en, evento_calendario_id, gastos_recurrentes!inner(nombre, categoria)')
    .eq('id', recordatorioId)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.estado !== 'POR_CONFIRMAR') {
    throw new Error('Este gasto ya no está pendiente de confirmar.');
  }

  const plantilla = data.gastos_recurrentes as unknown as { nombre: string; categoria: string };

  await devengarFila(
    empresaId,
    config,
    {
      id: data.id,
      periodo: data.periodo,
      fecha_vencimiento: data.fecha_vencimiento,
      estado: 'POR_CONFIRMAR',
      devengo_iniciado_en: data.devengo_iniciado_en,
      evento_calendario_id: data.evento_calendario_id,
      nombre: plantilla.nombre,
      categoria: plantilla.categoria,
    },
    monto
  );
}

// Activa el devengo de una plantilla: crea la cuenta "Cuentas a Pagar"
// si falta, pasa a PROGRAMADA el recordatorio abierto (si no tiene
// pagos cargados a mano, para no contar el gasto dos veces), arma la
// ventana de 12 meses y devenga ya lo que corresponda.
export async function activarDevengo(empresaId: string, plantillaId: string, montoFijo: boolean) {
  if (!empresaTieneDevengo(empresaId)) {
    throw new Error('El devengo mes a mes todavía no está habilitado para esta empresa.');
  }

  await asegurarCuentaAPagar(empresaId);

  const { error: errorPlantilla } = await supabase
    .from('gastos_recurrentes')
    .update({ devengar: true, monto_fijo: montoFijo })
    .eq('id', plantillaId);

  if (errorPlantilla) {
    throw errorPlantilla;
  }

  const { error: errorAbierto } = await supabase
    .from(TABLA)
    .update({ estado: 'PROGRAMADA' })
    .eq('gasto_recurrente_id', plantillaId)
    .eq('registrado', false)
    .eq('monto_pagado', 0)
    .is('estado', null);

  if (errorAbierto) {
    throw errorAbierto;
  }

  await ejecutarDevengo(empresaId);
}

// Apaga el devengo: se borran las filas que todavía no tienen asiento
// (programadas / por confirmar). Lo ya devengado queda como está.
export async function desactivarDevengo(plantillaId: string) {
  const { error } = await supabase.from('gastos_recurrentes').update({ devengar: false }).eq('id', plantillaId);

  if (error) {
    throw error;
  }

  const { data: sinAsiento, error: errorSinAsiento } = await supabase
    .from(TABLA)
    .select('id, evento_calendario_id')
    .eq('gasto_recurrente_id', plantillaId)
    .in('estado', ['PROGRAMADA', 'POR_CONFIRMAR']);

  if (errorSinAsiento) {
    throw errorSinAsiento;
  }

  const eventos = (sinAsiento ?? []).map((f) => f.evento_calendario_id).filter(Boolean) as string[];

  const { error: errorBorrar } = await supabase
    .from(TABLA)
    .delete()
    .eq('gasto_recurrente_id', plantillaId)
    .in('estado', ['PROGRAMADA', 'POR_CONFIRMAR']);

  if (errorBorrar) {
    throw errorBorrar;
  }

  if (eventos.length > 0) {
    await supabase.from('eventos_calendario').delete().in('id', eventos);
  }
}
