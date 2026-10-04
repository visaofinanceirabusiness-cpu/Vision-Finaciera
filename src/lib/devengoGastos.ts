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
import { obtenerConfigAPagar, type ConfigAPagar } from './cuentaAPagar';
import {
  buscarCuentaCompromisoPorNombre,
  crearCuentaIndividual,
  crearGrupo,
  liberarCuentaSiCorresponde,
  moverCuentaAGrupo,
  reactivarCuentaCompromiso,
  renombrarCuentaCompromiso,
  resolverCuentaCompromiso,
  type CuentaCompromiso,
  type OpcionesActivacion,
} from './cuentasCompromiso';
import { nombreCuentaCompromiso } from './cuentasCompromisoNombres';
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
        cuenta_devengo_forma_pago_id: config.formaPagoId ?? null,
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
  // Cuenta general de la primera versión (solo para devengos viejos sin
  // cuenta propia); las plantillas nuevas traen la suya.
  const configGeneral = await obtenerConfigAPagar(empresaId);
  const configPorCuenta = new Map<string, ConfigAPagar>();

  async function configDe(cuentaFormaPagoId: string | null): Promise<ConfigAPagar | null> {
    if (!cuentaFormaPagoId) {
      return configGeneral;
    }

    const guardada = configPorCuenta.get(cuentaFormaPagoId);
    if (guardada) return guardada;

    const cuenta = await resolverCuentaCompromiso(cuentaFormaPagoId, 'PAGAR');
    const config: ConfigAPagar = { formaPagoId: cuenta.formaPagoId, formaPago: cuenta.formaPago, categoriaLiquidacion: cuenta.categoriaLiquidacion };
    configPorCuenta.set(cuentaFormaPagoId, config);
    return config;
  }

  const hoy = fechaLocalHoy();

  const { data, error } = await supabase
    .from(TABLA)
    .select(
      'id, periodo, fecha_vencimiento, estado, devengo_iniciado_en, evento_calendario_id, gastos_recurrentes!inner(nombre, categoria, monto_habitual, monto_fijo, devengar, activo, cuenta_a_pagar_forma_pago_id)'
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
      cuenta_a_pagar_forma_pago_id: string | null;
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

    const config = await configDe(plantilla.cuenta_a_pagar_forma_pago_id);

    if (!config) {
      console.warn(`"${plantilla.nombre}" no tiene cuenta a pagar: no se pudo devengar.`);
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
  const { data, error } = await supabase
    .from(TABLA)
    .select(
      'id, periodo, fecha_vencimiento, estado, devengo_iniciado_en, evento_calendario_id, gastos_recurrentes!inner(nombre, categoria, cuenta_a_pagar_forma_pago_id)'
    )
    .eq('id', recordatorioId)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.estado !== 'POR_CONFIRMAR') {
    throw new Error('Este gasto ya no está pendiente de confirmar.');
  }

  const plantilla = data.gastos_recurrentes as unknown as {
    nombre: string;
    categoria: string;
    cuenta_a_pagar_forma_pago_id: string | null;
  };

  let config: ConfigAPagar | null;

  if (plantilla.cuenta_a_pagar_forma_pago_id) {
    const cuenta = await resolverCuentaCompromiso(plantilla.cuenta_a_pagar_forma_pago_id, 'PAGAR');
    config = { formaPagoId: cuenta.formaPagoId, formaPago: cuenta.formaPago, categoriaLiquidacion: cuenta.categoriaLiquidacion };
  } else {
    config = await obtenerConfigAPagar(empresaId);
  }

  if (!config) {
    throw new Error('Este gasto no tiene cuenta a pagar: activá de nuevo "Mes a mes" para elegirla.');
  }

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

// Activa el devengo de una plantilla: deja lista su cuenta a pagar (la
// busca, la crea o usa la elegida), pasa a PROGRAMADA el recordatorio abierto
// (si no tiene pagos cargados a mano, para no contar el gasto dos veces),
// arma la ventana de 12 meses y devenga ya lo que corresponda.
export async function activarDevengo(empresaId: string, plantillaId: string, opciones: OpcionesActivacion) {
  if (!empresaTieneDevengo(empresaId)) {
    throw new Error('El devengo mes a mes todavía no está habilitado para esta empresa.');
  }

  const { data: plantilla, error: errorLeer } = await supabase
    .from('gastos_recurrentes')
    .select('nombre, empresa_id')
    .eq('id', plantillaId)
    .eq('empresa_id', empresaId)
    .single();

  if (errorLeer) {
    throw errorLeer;
  }

  let cuenta: CuentaCompromiso;

  if (opciones.cuenta.modo === 'EXISTENTE') {
    cuenta = await resolverCuentaCompromiso(opciones.cuenta.formaPagoId, 'PAGAR');
  } else {
    const existente = await buscarCuentaCompromisoPorNombre(empresaId, nombreCuentaCompromiso(plantilla.nombre, 'PAGAR'), 'PAGAR');

    if (existente) {
      if (existente.estabaInactiva) {
        await reactivarCuentaCompromiso(existente);
      }
      cuenta = existente;
    } else {
      let grupoId: string | null = null;

      if (opciones.grupo) {
        grupoId = 'id' in opciones.grupo ? opciones.grupo.id : (await crearGrupo(empresaId, 'PAGAR', opciones.grupo.nombre)).id;
      }

      cuenta = await crearCuentaIndividual(empresaId, 'PAGAR', plantilla.nombre, grupoId);
    }
  }

  const { error: errorPlantilla } = await supabase
    .from('gastos_recurrentes')
    .update({ devengar: true, monto_fijo: opciones.montoFijo, cuenta_a_pagar_forma_pago_id: cuenta.formaPagoId })
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

// Apaga el devengo y, si su cuenta ya no la usa nadie ni queda nada sin
// saldar, la desactiva (nunca se borra).
export async function desactivarDevengoYLiberar(empresaId: string, plantillaId: string) {
  const { data: plantilla } = await supabase
    .from('gastos_recurrentes')
    .select('cuenta_a_pagar_forma_pago_id')
    .eq('id', plantillaId)
    .maybeSingle();

  await desactivarDevengo(plantillaId);

  if (plantilla?.cuenta_a_pagar_forma_pago_id) {
    await liberarCuentaSiCorresponde(empresaId, plantilla.cuenta_a_pagar_forma_pago_id, 'PAGAR');
  }
}

// "Eliminar" un gasto recurrente que devenga: si todavía hay meses devengados
// sin pagar, no se pierde nada — se da de BAJA (deja de generar meses nuevos y
// lo ya devengado se sigue pudiendo pagar). Si no queda nada pendiente, se
// elimina como siempre. En ambos casos la cuenta no se borra: se desactiva
// cuando queda sin uso y sin saldo (ver liberarCuentaSiCorresponde).
export async function eliminarOBajaGastoRecurrente(
  empresaId: string,
  plantilla: { id: string; devengar: boolean }
): Promise<'ELIMINADA' | 'BAJA'> {
  if (!plantilla.devengar) {
    const { error } = await supabase.from('gastos_recurrentes').delete().eq('id', plantilla.id);

    if (error) {
      throw error;
    }

    return 'ELIMINADA';
  }

  const { data: fila } = await supabase
    .from('gastos_recurrentes')
    .select('cuenta_a_pagar_forma_pago_id')
    .eq('id', plantilla.id)
    .maybeSingle();

  const { count: sinPagar, error: errorConteo } = await supabase
    .from(TABLA)
    .select('id', { count: 'exact', head: true })
    .eq('gasto_recurrente_id', plantilla.id)
    .eq('estado', 'DEVENGADA')
    .eq('registrado', false);

  if (errorConteo) {
    throw errorConteo;
  }

  await desactivarDevengo(plantilla.id);

  let resultado: 'ELIMINADA' | 'BAJA';

  if ((sinPagar ?? 0) > 0) {
    const { error } = await supabase.from('gastos_recurrentes').update({ activo: false }).eq('id', plantilla.id);

    if (error) {
      throw error;
    }

    resultado = 'BAJA';
  } else {
    const { error } = await supabase.from('gastos_recurrentes').delete().eq('id', plantilla.id);

    if (error) {
      throw error;
    }

    resultado = 'ELIMINADA';
  }

  if (fila?.cuenta_a_pagar_forma_pago_id) {
    await liberarCuentaSiCorresponde(empresaId, fila.cuenta_a_pagar_forma_pago_id, 'PAGAR');
  }

  return resultado;
}

// Los gastos que se devengaron en la primera versión usan UNA cuenta general
// ("Cuentas a Pagar"). Esto la convierte en la cuenta propia de la plantilla:
// se RENOMBRA con el nombre de la plantilla (los asientos ya cargados la
// siguen, porque el renombrado actualiza el libro), opcionalmente se cuelga
// de un grupo y la plantilla y sus meses ya devengados pasan a apuntar a
// ella por id. Así no queda ninguna cuenta huérfana ni se toca ningún asiento.
export async function migrarCuentaGeneral(
  empresaId: string,
  plantillaId: string,
  grupo?: { id: string } | { nombre: string } | null
) {
  if (!empresaTieneDevengo(empresaId)) {
    throw new Error('El devengo mes a mes todavía no está habilitado para esta empresa.');
  }

  const { data: plantilla, error: errorPlantilla } = await supabase
    .from('gastos_recurrentes')
    .select('nombre, cuenta_a_pagar_forma_pago_id')
    .eq('id', plantillaId)
    .eq('empresa_id', empresaId)
    .single();

  if (errorPlantilla) {
    throw errorPlantilla;
  }

  if (plantilla.cuenta_a_pagar_forma_pago_id) {
    throw new Error('Este gasto ya tiene su cuenta propia.');
  }

  const general = await obtenerConfigAPagar(empresaId);

  if (!general) {
    throw new Error('No hay una cuenta general para migrar.');
  }

  const { data: forma, error: errorForma } = await supabase
    .from('formas_pago')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('nombre', general.formaPago)
    .single();

  if (errorForma) {
    throw errorForma;
  }

  // Si otro gasto tiene deuda sin saldar en esa misma cuenta general, renombrarla
  // le cambiaría el nombre a ese también: se migran de a uno solo cuando la
  // cuenta es de una sola plantilla.
  const { data: deOtros, error: errorOtros } = await supabase
    .from(TABLA)
    .select('id')
    .eq('empresa_id', empresaId)
    .is('cuenta_devengo_forma_pago_id', null)
    .eq('estado', 'DEVENGADA')
    .eq('registrado', false)
    .neq('gasto_recurrente_id', plantillaId)
    .limit(1);

  if (errorOtros) {
    throw errorOtros;
  }

  if ((deOtros ?? []).length > 0) {
    throw new Error('La cuenta general también la usa otro gasto con deuda sin pagar: pagalo o migralo primero.');
  }

  const cuenta = await resolverCuentaCompromiso(forma.id, 'PAGAR');

  await renombrarCuentaCompromiso(empresaId, cuenta, plantilla.nombre, 'PAGAR');

  if (grupo) {
    const grupoId = 'id' in grupo ? grupo.id : (await crearGrupo(empresaId, 'PAGAR', grupo.nombre)).id;
    await moverCuentaAGrupo(empresaId, cuenta.cuentaId, grupoId);
  }

  const { error: errorApuntar } = await supabase
    .from('gastos_recurrentes')
    .update({ cuenta_a_pagar_forma_pago_id: forma.id })
    .eq('id', plantillaId);

  if (errorApuntar) {
    throw errorApuntar;
  }

  const { error: errorMeses } = await supabase
    .from(TABLA)
    .update({ cuenta_devengo_forma_pago_id: forma.id })
    .eq('gasto_recurrente_id', plantillaId)
    .in('estado', ['DEVENGADA', 'SALDADA'])
    .is('cuenta_devengo_forma_pago_id', null);

  if (errorMeses) {
    throw errorMeses;
  }

  // La cuenta general dejó de existir con ese nombre: ya no hay a qué volver.
  await supabase.from('empresas').update({ forma_pago_a_pagar: null }).eq('id', empresaId);
}
