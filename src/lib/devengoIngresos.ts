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
// Cada plantilla tiene su PROPIA cuenta a cobrar ("Casita a cobrar"),
// opcionalmente colgada de un grupo ("Alquileres a cobrar") — ver
// cuentasCompromiso.ts. Todas las salvaguardas son las mismas que en
// gastos: opt-in por plantilla (empresaTieneDevengo ya no limita por
// empresa), filas reclamadas antes de registrar para no
// duplicar, y el cobro de un ingreso devengado usa la categoría de
// liquidación y nunca supera lo que falta (ver registrarCobroRecordatorio).

import { supabase } from './supabase';
import { editarOperacion, registrarOperacion } from './motor';
import { fechaLocalHoy } from './fecha';
import { empresaTieneDevengo } from './devengoGastos';
import { obtenerConfigACobrar, type ConfigACobrar } from './cuentaACobrar';
import {
  buscarCuentaCompromisoPorNombre,
  crearCuentaIndividual,
  crearGrupo,
  liberarCuentaSiCorresponde,
  reactivarCuentaCompromiso,
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
  // Cuenta general de la primera versión (solo para devengos viejos sin
  // cuenta propia); las plantillas nuevas traen la suya.
  const configGeneral = await obtenerConfigACobrar(empresaId);
  const configPorCuenta = new Map<string, ConfigACobrar>();

  async function configDe(cuentaFormaPagoId: string | null): Promise<ConfigACobrar | null> {
    if (!cuentaFormaPagoId) {
      return configGeneral;
    }

    const guardada = configPorCuenta.get(cuentaFormaPagoId);
    if (guardada) return guardada;

    const cuenta = await resolverCuentaCompromiso(cuentaFormaPagoId, 'COBRAR');
    const config: ConfigACobrar = { formaPagoId: cuenta.formaPagoId, formaPago: cuenta.formaPago, categoriaLiquidacion: cuenta.categoriaLiquidacion };
    configPorCuenta.set(cuentaFormaPagoId, config);
    return config;
  }

  const hoy = fechaLocalHoy();

  const { data, error } = await supabase
    .from(TABLA)
    .select(
      'id, periodo, fecha_vencimiento, estado, devengo_iniciado_en, evento_calendario_id, ingresos_recurrentes!inner(nombre, categoria, monto_habitual, monto_fijo, devengar, activo, cuenta_a_cobrar_forma_pago_id)'
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
      cuenta_a_cobrar_forma_pago_id: string | null;
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

    const config = await configDe(plantilla.cuenta_a_cobrar_forma_pago_id);

    if (!config) {
      console.warn(`"${plantilla.nombre}" no tiene cuenta a cobrar: no se pudo devengar.`);
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
// y devenga lo que corresponde. Solo actúa sobre plantillas con devengo activado.
export async function ejecutarDevengoIngresos(empresaId: string) {
  if (!empresaTieneDevengo(empresaId)) {
    return;
  }

  await mantenerVentanaIngresos(empresaId);
  await devengarPendientesIngresos(empresaId);
}

// Confirma el monto real de un ingreso variable (ej. un sueldo con comisiones) y lo devenga.
export async function confirmarDevengoIngreso(empresaId: string, recordatorioId: string, monto: number) {
  const { data, error } = await supabase
    .from(TABLA)
    .select(
      'id, periodo, fecha_vencimiento, estado, devengo_iniciado_en, evento_calendario_id, ingresos_recurrentes!inner(nombre, categoria, cuenta_a_cobrar_forma_pago_id)'
    )
    .eq('id', recordatorioId)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.estado !== 'POR_CONFIRMAR') {
    throw new Error('Este ingreso ya no está pendiente de confirmar.');
  }

  const plantilla = data.ingresos_recurrentes as unknown as {
    nombre: string;
    categoria: string;
    cuenta_a_cobrar_forma_pago_id: string | null;
  };

  let config: ConfigACobrar | null;

  if (plantilla.cuenta_a_cobrar_forma_pago_id) {
    const cuenta = await resolverCuentaCompromiso(plantilla.cuenta_a_cobrar_forma_pago_id, 'COBRAR');
    config = { formaPagoId: cuenta.formaPagoId, formaPago: cuenta.formaPago, categoriaLiquidacion: cuenta.categoriaLiquidacion };
  } else {
    config = await obtenerConfigACobrar(empresaId);
  }

  if (!config) {
    throw new Error('Este ingreso no tiene cuenta a cobrar: activá de nuevo "Mes a mes" para elegirla.');
  }

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

// Activa el devengo de una plantilla: deja lista su cuenta a cobrar (la
// busca, la crea o usa la elegida), pasa a PROGRAMADA el recordatorio abierto
// (si no tiene pagos cargados a mano, para no contar el ingreso dos veces),
// arma la ventana de 12 meses y devenga ya lo que corresponda.
export async function activarDevengoIngreso(empresaId: string, plantillaId: string, opciones: OpcionesActivacion) {
  if (!empresaTieneDevengo(empresaId)) {
    throw new Error('El devengo mes a mes todavía no está habilitado para esta empresa.');
  }

  const { data: plantilla, error: errorLeer } = await supabase
    .from('ingresos_recurrentes')
    .select('nombre, empresa_id')
    .eq('id', plantillaId)
    .eq('empresa_id', empresaId)
    .single();

  if (errorLeer) {
    throw errorLeer;
  }

  let cuenta: CuentaCompromiso;

  if (opciones.cuenta.modo === 'EXISTENTE') {
    cuenta = await resolverCuentaCompromiso(opciones.cuenta.formaPagoId, 'COBRAR');
  } else {
    const existente = await buscarCuentaCompromisoPorNombre(empresaId, nombreCuentaCompromiso(plantilla.nombre, 'COBRAR'), 'COBRAR');

    if (existente) {
      if (existente.estabaInactiva) {
        await reactivarCuentaCompromiso(existente);
      }
      cuenta = existente;
    } else {
      let grupoId: string | null = null;

      if (opciones.grupo) {
        grupoId = 'id' in opciones.grupo ? opciones.grupo.id : (await crearGrupo(empresaId, 'COBRAR', opciones.grupo.nombre)).id;
      }

      cuenta = await crearCuentaIndividual(empresaId, 'COBRAR', plantilla.nombre, grupoId);
    }
  }

  const { error: errorPlantilla } = await supabase
    .from('ingresos_recurrentes')
    .update({ devengar: true, monto_fijo: opciones.montoFijo, cuenta_a_cobrar_forma_pago_id: cuenta.formaPagoId })
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

// Apaga el devengo y, si su cuenta ya no la usa nadie ni queda nada sin
// saldar, la desactiva (nunca se borra).
export async function desactivarDevengoIngresoYLiberar(empresaId: string, plantillaId: string) {
  const { data: plantilla } = await supabase
    .from('ingresos_recurrentes')
    .select('cuenta_a_cobrar_forma_pago_id')
    .eq('id', plantillaId)
    .maybeSingle();

  await desactivarDevengoIngreso(plantillaId);

  if (plantilla?.cuenta_a_cobrar_forma_pago_id) {
    await liberarCuentaSiCorresponde(empresaId, plantilla.cuenta_a_cobrar_forma_pago_id, 'COBRAR');
  }
}

// "Eliminar" un ingreso recurrente que devenga: si todavía hay meses devengados
// sin cobrar, no se pierde nada — se da de BAJA (deja de generar meses nuevos y
// lo ya devengado se sigue pudiendo cobrar). Si no queda nada pendiente, se
// elimina como siempre. En ambos casos la cuenta no se borra: se desactiva
// cuando queda sin uso y sin saldo (ver liberarCuentaSiCorresponde).
export async function eliminarOBajaIngresoRecurrente(
  empresaId: string,
  plantilla: { id: string; devengar: boolean }
): Promise<'ELIMINADA' | 'BAJA'> {
  if (!plantilla.devengar) {
    const { error } = await supabase.from('ingresos_recurrentes').delete().eq('id', plantilla.id);

    if (error) {
      throw error;
    }

    return 'ELIMINADA';
  }

  const { data: fila } = await supabase
    .from('ingresos_recurrentes')
    .select('cuenta_a_cobrar_forma_pago_id')
    .eq('id', plantilla.id)
    .maybeSingle();

  const { count: sinCobrar, error: errorConteo } = await supabase
    .from(TABLA)
    .select('id', { count: 'exact', head: true })
    .eq('ingreso_recurrente_id', plantilla.id)
    .eq('estado', 'DEVENGADA')
    .eq('registrado', false);

  if (errorConteo) {
    throw errorConteo;
  }

  await desactivarDevengoIngreso(plantilla.id);

  let resultado: 'ELIMINADA' | 'BAJA';

  if ((sinCobrar ?? 0) > 0) {
    const { error } = await supabase.from('ingresos_recurrentes').update({ activo: false }).eq('id', plantilla.id);

    if (error) {
      throw error;
    }

    resultado = 'BAJA';
  } else {
    const { error } = await supabase.from('ingresos_recurrentes').delete().eq('id', plantilla.id);

    if (error) {
      throw error;
    }

    resultado = 'ELIMINADA';
  }

  if (fila?.cuenta_a_cobrar_forma_pago_id) {
    await liberarCuentaSiCorresponde(empresaId, fila.cuenta_a_cobrar_forma_pago_id, 'COBRAR');
  }

  return resultado;
}

// Los ingresos que se devengaron en la primera versión usan la cuenta a cobrar
// GENERAL de la empresa ("Cuentas a cobrar"), que es la del plan (la usa
// Contabilidad para las ventas a crédito): esa nunca se renombra ni se
// desactiva. Esto pasa una plantilla a su cuenta propia: se crea (con grupo
// opcional) y se MUEVEN los asientos de devengo de sus meses sin cobrar con
// editarOperacion (el mismo camino de "Editar Registros": mismo número de
// operación, solo cambia la cuenta). Un mes con cobros parciales no se mueve
// hasta terminar de cobrarlo: el cobro quedaría en una cuenta y el ingreso en otra.
export async function migrarCuentaGeneralIngreso(
  empresaId: string,
  plantillaId: string,
  grupo?: { id: string } | { nombre: string } | null
) {
  if (!empresaTieneDevengo(empresaId)) {
    throw new Error('El devengo mes a mes todavía no está habilitado para esta empresa.');
  }

  const { data: plantilla, error: errorPlantilla } = await supabase
    .from('ingresos_recurrentes')
    .select('nombre, cuenta_a_cobrar_forma_pago_id')
    .eq('id', plantillaId)
    .eq('empresa_id', empresaId)
    .single();

  if (errorPlantilla) {
    throw errorPlantilla;
  }

  if (plantilla.cuenta_a_cobrar_forma_pago_id) {
    throw new Error('Este ingreso ya tiene su cuenta propia.');
  }

  const { data: meses, error: errorMeses } = await supabase
    .from(TABLA)
    .select('id, periodo, monto_cobrado, id_operacion_devengo')
    .eq('ingreso_recurrente_id', plantillaId)
    .eq('estado', 'DEVENGADA')
    .eq('registrado', false)
    .is('cuenta_devengo_forma_pago_id', null);

  if (errorMeses) {
    throw errorMeses;
  }

  if ((meses ?? []).some((mes) => Number(mes.monto_cobrado) > 0)) {
    throw new Error('Este ingreso tiene un mes devengado con cobros parciales: terminá de cobrarlo antes de pasarlo a su cuenta propia.');
  }

  const operaciones = new Map<string, { fecha: string; categoria: string; historico: string | null; total: number; cliente_proveedor: string | null }>();

  for (const mes of meses ?? []) {
    if (!mes.id_operacion_devengo) {
      throw new Error(`El mes ${mes.periodo.slice(0, 7)} no tiene registrado su asiento de devengo.`);
    }

    const { data: operacion, error: errorOperacion } = await supabase
      .from('registro_operaciones')
      .select('fecha, categoria, historico, total, cliente_proveedor')
      .eq('empresa_id', empresaId)
      .eq('id_operacion', mes.id_operacion_devengo)
      .maybeSingle();

    if (errorOperacion) {
      throw errorOperacion;
    }

    if (!operacion) {
      throw new Error(`No se encontró el asiento ${mes.id_operacion_devengo} de ${mes.periodo.slice(0, 7)}.`);
    }

    operaciones.set(mes.id, { ...operacion, total: Number(operacion.total) });
  }

  let grupoId: string | null = null;

  if (grupo) {
    grupoId = 'id' in grupo ? grupo.id : (await crearGrupo(empresaId, 'COBRAR', grupo.nombre)).id;
  }

  const nueva = await crearCuentaIndividual(empresaId, 'COBRAR', plantilla.nombre, grupoId);

  for (const mes of meses ?? []) {
    const operacion = operaciones.get(mes.id)!;

    await editarOperacion(empresaId, mes.id_operacion_devengo as string, {
      fecha: operacion.fecha,
      operacion: 'COBRO',
      categoria: operacion.categoria,
      formaPago: nueva.formaPago,
      historico: operacion.historico ?? '',
      clienteProveedor: operacion.cliente_proveedor ?? '',
      lineas: [{ producto: '', cantidad: 1, monto: operacion.total }],
    });

    const { error: errorMes } = await supabase.from(TABLA).update({ cuenta_devengo_forma_pago_id: nueva.formaPagoId }).eq('id', mes.id);

    if (errorMes) {
      throw errorMes;
    }
  }

  const { error: errorApuntar } = await supabase
    .from('ingresos_recurrentes')
    .update({ cuenta_a_cobrar_forma_pago_id: nueva.formaPagoId })
    .eq('id', plantillaId);

  if (errorApuntar) {
    throw errorApuntar;
  }
}
