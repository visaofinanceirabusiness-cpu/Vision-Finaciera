// lib/devengoIngresos.ts
//
// DEVENGO MES A MES DE INGRESOS RECURRENTES (Compromisos Fase 2D)
// =====================================================
//
// Espejo exacto de lib/devengoGastos.ts, del lado del cobro. Una
// plantilla con `devengar` activo se reconoce cada mes en su período,
// sin esperar al cobro:
//
//   día 1 del mes   Cuenta a Cobrar  /  Ingreso (ej. Alquiler)   ← devengo
//   al cobrar       Banco            /  Cuenta a Cobrar          ← saldado
//
// Todas las salvaguardas son las mismas: opt-in por plantilla y por
// empresa (empresaTieneDevengo, la misma lista piloto), filas
// reclamadas antes de registrar para no duplicar, y el cobro de un
// ingreso devengado usa la categoría de liquidación y nunca supera lo
// que falta (ver registrarCobroRecordatorio).

import { supabase } from './supabase';
import { registrarOperacion } from './motor';
import { fechaLocalHoy } from './fecha';
import { empresaTieneDevengo } from './devengoGastos';
import { asegurarCuentaACobrar, obtenerConfigACobrar, type ConfigACobrar } from './cuentaACobrar';
import {
  periodosFaltantes,
  fechaVencimientoDe,
  correspondeDevengar,
  devengoTrabado,
  historicoDevengo,
  type EstadoDevengo,
} from './devengo';

const TABLA = 'ingresos_recurrentes_recordatorios';

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

// Reconoce el ingreso de una fila: la reclama, registra el asiento (o
// adopta uno que un intento anterior sí llegó a registrar) y la deja
// DEVENGADA. Si algo falla, la devuelve a su estado de origen.
async function devengarFilaIngreso(empresaId: string, config: ConfigACobrar, fila: FilaADevengar, monto: number) {
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
      .eq('operacion', 'COBRO')
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
        operacion: 'COBRO',
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
export async function mantenerVentanaIngresos(empresaId: string) {
  const { data: plantillas, error } = await supabase
    .from('ingresos_recurrentes')
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
    .select('ingreso_recurrente_id, periodo')
    .eq('empresa_id', empresaId)
    .in('ingreso_recurrente_id', plantillas.map((p) => p.id));

  if (errorExistentes) {
    throw errorExistentes;
  }

  const filas: Record<string, unknown>[] = [];

  for (const plantilla of plantillas) {
    const periodos = (existentes ?? []).filter((e) => e.ingreso_recurrente_id === plantilla.id).map((e) => e.periodo as string);

    for (const periodo of periodosFaltantes(periodos, hoy)) {
      filas.push({
        ingreso_recurrente_id: plantilla.id,
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
    .upsert(filas, { onConflict: 'ingreso_recurrente_id,periodo', ignoreDuplicates: true });

  if (errorInsertar) {
    throw errorInsertar;
  }
}

// Devenga lo que ya llegó al día 1: monto fijo → asiento directo;
// variable → queda "Por confirmar". Devuelve cuántos devengó.
export async function devengarPendientesIngresos(empresaId: string): Promise<number> {
  const config = await obtenerConfigACobrar(empresaId);

  if (!config) {
    return 0;
  }

  const hoy = fechaLocalHoy();

  const { data, error } = await supabase
    .from(TABLA)
    .select(
      'id, periodo, fecha_vencimiento, estado, devengo_iniciado_en, evento_calendario_id, ingresos_recurrentes!inner(nombre, categoria, monto_habitual, monto_fijo, devengar, activo)'
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
    const plantilla = fila.ingresos_recurrentes as unknown as {
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

    const hecho = await devengarFilaIngreso(
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
export async function ejecutarDevengoIngresos(empresaId: string) {
  if (!empresaTieneDevengo(empresaId)) {
    return;
  }

  await mantenerVentanaIngresos(empresaId);
  await devengarPendientesIngresos(empresaId);
}

// Confirma el monto real de un ingreso variable (ej. un sueldo con comisiones) y lo devenga.
export async function confirmarDevengoIngreso(empresaId: string, recordatorioId: string, monto: number) {
  const config = await obtenerConfigACobrar(empresaId);

  if (!config) {
    throw new Error('No se encontró la cuenta a cobrar de esta empresa.');
  }

  const { data, error } = await supabase
    .from(TABLA)
    .select('id, periodo, fecha_vencimiento, estado, devengo_iniciado_en, evento_calendario_id, ingresos_recurrentes!inner(nombre, categoria)')
    .eq('id', recordatorioId)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.estado !== 'POR_CONFIRMAR') {
    throw new Error('Este ingreso ya no está pendiente de confirmar.');
  }

  const plantilla = data.ingresos_recurrentes as unknown as { nombre: string; categoria: string };

  await devengarFilaIngreso(
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

// Activa el devengo de una plantilla: deja lista la cuenta a cobrar
// si falta, pasa a PROGRAMADA el recordatorio abierto (si no tiene
// cobros cargados a mano, para no contar el ingreso dos veces), arma la
// ventana de 12 meses y devenga ya lo que corresponda.
export async function activarDevengoIngreso(empresaId: string, plantillaId: string, montoFijo: boolean) {
  if (!empresaTieneDevengo(empresaId)) {
    throw new Error('El devengo mes a mes todavía no está habilitado para esta empresa.');
  }

  await asegurarCuentaACobrar(empresaId);

  const { error: errorPlantilla } = await supabase
    .from('ingresos_recurrentes')
    .update({ devengar: true, monto_fijo: montoFijo })
    .eq('id', plantillaId);

  if (errorPlantilla) {
    throw errorPlantilla;
  }

  const { error: errorAbierto } = await supabase
    .from(TABLA)
    .update({ estado: 'PROGRAMADA' })
    .eq('ingreso_recurrente_id', plantillaId)
    .eq('registrado', false)
    .eq('monto_cobrado', 0)
    .is('estado', null);

  if (errorAbierto) {
    throw errorAbierto;
  }

  await ejecutarDevengoIngresos(empresaId);
}

// Apaga el devengo: se borran las filas que todavía no tienen asiento
// (programadas / por confirmar). Lo ya devengado queda como está.
export async function desactivarDevengoIngreso(plantillaId: string) {
  const { error } = await supabase.from('ingresos_recurrentes').update({ devengar: false }).eq('id', plantillaId);

  if (error) {
    throw error;
  }

  const { data: sinAsiento, error: errorSinAsiento } = await supabase
    .from(TABLA)
    .select('id, evento_calendario_id')
    .eq('ingreso_recurrente_id', plantillaId)
    .in('estado', ['PROGRAMADA', 'POR_CONFIRMAR']);

  if (errorSinAsiento) {
    throw errorSinAsiento;
  }

  const eventos = (sinAsiento ?? []).map((f) => f.evento_calendario_id).filter(Boolean) as string[];

  const { error: errorBorrar } = await supabase
    .from(TABLA)
    .delete()
    .eq('ingreso_recurrente_id', plantillaId)
    .in('estado', ['PROGRAMADA', 'POR_CONFIRMAR']);

  if (errorBorrar) {
    throw errorBorrar;
  }

  if (eventos.length > 0) {
    await supabase.from('eventos_calendario').delete().in('id', eventos);
  }
}
