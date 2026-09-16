// lib/ingresosRecurrentes.ts
//
// INGRESOS RECURRENTES (Sueldo, Alquiler que cobrás, Suscripciones de
// un cliente...) — espejo exacto de lib/gastosRecurrentes.ts, del
// lado del ingreso: acá el cobro real TODAVÍA NO SE CARGÓ — cada mes
// hay que registrarlo a mano, porque el monto puede variar o
// simplemente porque cargar solo un asiento sin que nadie lo revise
// es más riesgoso que un recordatorio. Por eso esto NO genera ningún
// asiento contable por sí mismo: solo arma, mes a mes, un
// recordatorio en el Calendário del lobby (mismo mecanismo que
// gastos recurrentes y cuotas) con los datos ya precargados para
// registrar el cobro con un toque.

import { supabase } from './supabase';
import { registrarOperacion } from './motor';
import { fechaLocalHoy } from './fecha';

export type IngresoRecurrente = {
  id: string;
  nombre: string;
  categoria: string;
  forma_pago: string;
  monto_habitual: number;
  dia_mes: number;
  activo: boolean;
};

export type RecordatorioIngresoRecurrente = {
  id: string;
  ingreso_recurrente_id: string;
  periodo: string;
  fecha_vencimiento: string;
  registrado: boolean;
  id_operacion: string | null;
  nombre: string;
  categoria: string;
  forma_pago: string;
  monto_habitual: number;
  monto_cobrado: number;
};

// Lo que falta cobrar de este recordatorio — puede ser menor a
// monto_habitual si ya se cargó uno o más cobros parciales contra él
// (ver registrarCobroParcial). Nunca negativo.
export function saldoPendienteCobro(recordatorio: RecordatorioIngresoRecurrente): number {
  return Math.max(0, recordatorio.monto_habitual - recordatorio.monto_cobrado);
}

function esPT(idioma: string | null | undefined) {
  return idioma === 'PT';
}

function primerDiaDelMes(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
}

function fechaDelMes(fecha: Date, dia: number): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export async function crearIngresoRecurrente(
  empresaId: string,
  datos: { nombre: string; categoria: string; formaPago: string; montoHabitual: number; diaMes: number }
) {
  const nombre = datos.nombre.trim();

  if (!nombre) {
    throw new Error('El nombre no puede estar vacío.');
  }

  if (!datos.categoria || !datos.formaPago) {
    throw new Error('Elegí la categoría y la forma de cobro.');
  }

  if (!Number.isInteger(datos.diaMes) || datos.diaMes < 1 || datos.diaMes > 28) {
    throw new Error('El día del mes tiene que ser entre 1 y 28 (para que exista en todos los meses).');
  }

  const { error } = await supabase.from('ingresos_recurrentes').insert({
    empresa_id: empresaId,
    nombre,
    categoria: datos.categoria,
    forma_pago: datos.formaPago,
    monto_habitual: datos.montoHabitual,
    dia_mes: datos.diaMes,
    activo: true,
  });

  if (error) {
    throw error;
  }
}

export async function listarIngresosRecurrentes(empresaId: string): Promise<IngresoRecurrente[]> {
  const { data, error } = await supabase
    .from('ingresos_recurrentes')
    .select('id, nombre, categoria, forma_pago, monto_habitual, dia_mes, activo')
    .eq('empresa_id', empresaId)
    .order('nombre');

  if (error) {
    throw error;
  }

  return (data ?? []) as IngresoRecurrente[];
}

export async function cambiarActivoIngresoRecurrente(id: string, activo: boolean) {
  const { error } = await supabase.from('ingresos_recurrentes').update({ activo }).eq('id', id);
  if (error) throw error;
}

export async function actualizarIngresoRecurrente(
  id: string,
  datos: { nombre: string; categoria: string; formaPago: string; montoHabitual: number; diaMes: number }
) {
  const nombre = datos.nombre.trim();

  if (!nombre) {
    throw new Error('El nombre no puede estar vacío.');
  }

  if (!datos.categoria || !datos.formaPago) {
    throw new Error('Elegí la categoría y la forma de cobro.');
  }

  if (!Number.isInteger(datos.diaMes) || datos.diaMes < 1 || datos.diaMes > 28) {
    throw new Error('El día del mes tiene que ser entre 1 y 28 (para que exista en todos los meses).');
  }

  const { error } = await supabase
    .from('ingresos_recurrentes')
    .update({
      nombre,
      categoria: datos.categoria,
      forma_pago: datos.formaPago,
      monto_habitual: datos.montoHabitual,
      dia_mes: datos.diaMes,
    })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function eliminarIngresoRecurrente(id: string) {
  const { error } = await supabase.from('ingresos_recurrentes').delete().eq('id', id);
  if (error) throw error;
}

// Por cada plantilla activa, se asegura de que exista un recordatorio
// para el período que corresponde — mismo mecanismo que
// generarRecordatoriosPendientes de gastos recurrentes: se mira el
// ÚLTIMO recordatorio ya generado, y solo se avanza al mes siguiente
// una vez que ese quedó cobrado. Mientras esté pendiente, no se
// genera ninguno nuevo (ver los comentarios completos allá).
export async function generarRecordatoriosIngresosPendientes(empresaId: string, idioma: string | null | undefined) {
  const { data: plantillas, error: errorPlantillas } = await supabase
    .from('ingresos_recurrentes')
    .select('id, nombre, categoria, forma_pago, monto_habitual, dia_mes')
    .eq('empresa_id', empresaId)
    .eq('activo', true);

  if (errorPlantillas) {
    throw errorPlantillas;
  }

  const hoy = new Date();

  for (const plantilla of plantillas ?? []) {
    const { data: ultimo, error: errorUltimo } = await supabase
      .from('ingresos_recurrentes_recordatorios')
      .select('periodo, registrado')
      .eq('ingreso_recurrente_id', plantilla.id)
      .order('periodo', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errorUltimo) {
      throw errorUltimo;
    }

    if (ultimo && !ultimo.registrado) {
      continue;
    }

    let mesDestino: Date;

    if (!ultimo) {
      mesDestino = hoy;
    } else {
      const [anioUltimo, mesUltimo] = ultimo.periodo.split('-').map(Number);
      mesDestino = new Date(anioUltimo, mesUltimo, 1);
    }

    const periodo = primerDiaDelMes(mesDestino);
    const fechaVencimiento = fechaDelMes(mesDestino, plantilla.dia_mes);

    const { data: recordatorioInsertado, error: errorRecordatorio } = await supabase
      .from('ingresos_recurrentes_recordatorios')
      .insert({
        ingreso_recurrente_id: plantilla.id,
        empresa_id: empresaId,
        periodo,
        fecha_vencimiento: fechaVencimiento,
        registrado: false,
        evento_calendario_id: null,
      })
      .select('id')
      .single();

    if (errorRecordatorio) {
      if (errorRecordatorio.code === '23505') {
        continue;
      }
      throw errorRecordatorio;
    }

    const titulo = esPT(idioma) ? `Cobrar: ${plantilla.nombre}` : `Cobrar: ${plantilla.nombre}`;

    const { data: evento, error: errorEvento } = await supabase
      .from('eventos_calendario')
      .insert({
        empresa_id: empresaId,
        creado_por: null,
        titulo,
        categoria: 'FINANCEIRO',
        fecha: fechaVencimiento,
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

    const { error: errorUpdate } = await supabase
      .from('ingresos_recurrentes_recordatorios')
      .update({ evento_calendario_id: evento.id })
      .eq('id', recordatorioInsertado.id);

    if (errorUpdate) {
      throw errorUpdate;
    }
  }
}

const SELECT_RECORDATORIO =
  'id, ingreso_recurrente_id, periodo, fecha_vencimiento, registrado, id_operacion, monto_cobrado, ingresos_recurrentes!inner(nombre, categoria, forma_pago, monto_habitual, empresa_id)';

function mapearFilaRecordatorio(fila: {
  id: string;
  ingreso_recurrente_id: string;
  periodo: string;
  fecha_vencimiento: string;
  registrado: boolean;
  id_operacion: string | null;
  monto_cobrado: number;
  ingresos_recurrentes: unknown;
}): RecordatorioIngresoRecurrente {
  const plantilla = fila.ingresos_recurrentes as unknown as {
    nombre: string;
    categoria: string;
    forma_pago: string;
    monto_habitual: number;
  };

  return {
    id: fila.id,
    ingreso_recurrente_id: fila.ingreso_recurrente_id,
    periodo: fila.periodo,
    fecha_vencimiento: fila.fecha_vencimiento,
    registrado: fila.registrado,
    id_operacion: fila.id_operacion,
    monto_cobrado: Number(fila.monto_cobrado ?? 0),
    nombre: plantilla.nombre,
    categoria: plantilla.categoria,
    forma_pago: plantilla.forma_pago,
    monto_habitual: plantilla.monto_habitual,
  };
}

export async function listarRecordatoriosIngresosPendientes(empresaId: string): Promise<RecordatorioIngresoRecurrente[]> {
  const { data, error } = await supabase
    .from('ingresos_recurrentes_recordatorios')
    .select(SELECT_RECORDATORIO)
    .eq('empresa_id', empresaId)
    .eq('registrado', false)
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapearFilaRecordatorio);
}

// Trae pendientes Y ya cobrados (acotado a los últimos ~3 meses) —
// para el botón "Mostrar cobrados" de Mis Ingresos.
export async function listarRecordatoriosIngresosConHistorial(empresaId: string): Promise<RecordatorioIngresoRecurrente[]> {
  const hace90Dias = new Date();
  hace90Dias.setDate(hace90Dias.getDate() - 90);
  const desde = hace90Dias.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('ingresos_recurrentes_recordatorios')
    .select(SELECT_RECORDATORIO)
    .eq('empresa_id', empresaId)
    .gte('fecha_vencimiento', desde)
    .order('fecha_vencimiento', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapearFilaRecordatorio);
}

// Trae un recordatorio puntual con los datos de su plantilla — para
// precargar el formulario de Contabilidad cuando se llega desde el
// botón "Registrar" (ver /contabilidad?ingresoRecurrenteRecordatorioId=).
export async function obtenerRecordatorioIngreso(recordatorioId: string): Promise<RecordatorioIngresoRecurrente | null> {
  const { data, error } = await supabase
    .from('ingresos_recurrentes_recordatorios')
    .select(SELECT_RECORDATORIO)
    .eq('id', recordatorioId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapearFilaRecordatorio(data);
}

export type ResultadoCobroParcial = {
  montoCobrado: number;
  saldoPendiente: number;
  cumplido: boolean;
};

// Núcleo compartido de todo cobro (total o parcial) contra un
// recordatorio — espejo de registrarPagoParcial en gastosRecurrentes.
export async function registrarCobroParcial(
  empresaId: string,
  recordatorio: RecordatorioIngresoRecurrente,
  idOperacion: string,
  monto: number,
  fecha: string
): Promise<ResultadoCobroParcial> {
  const { error: errorCobro } = await supabase.from('ingresos_recurrentes_recordatorios_cobros').insert({
    recordatorio_id: recordatorio.id,
    empresa_id: empresaId,
    id_operacion: idOperacion,
    monto,
    fecha,
  });

  if (errorCobro) {
    throw errorCobro;
  }

  const nuevoMontoCobrado = recordatorio.monto_cobrado + monto;
  const nuevoSaldo = Math.max(0, recordatorio.monto_habitual - nuevoMontoCobrado);
  const cumplido = nuevoSaldo <= 0.01;

  const { data: fila, error: errorRecordatorio } = await supabase
    .from('ingresos_recurrentes_recordatorios')
    .select('evento_calendario_id')
    .eq('id', recordatorio.id)
    .single();

  if (errorRecordatorio) {
    throw errorRecordatorio;
  }

  const { error } = await supabase
    .from('ingresos_recurrentes_recordatorios')
    .update({ monto_cobrado: nuevoMontoCobrado, registrado: cumplido, id_operacion: idOperacion })
    .eq('id', recordatorio.id);

  if (error) {
    throw error;
  }

  if (cumplido && fila.evento_calendario_id) {
    await supabase.from('eventos_calendario').delete().eq('id', fila.evento_calendario_id);
  }

  return { montoCobrado: nuevoMontoCobrado, saldoPendiente: nuevoSaldo, cumplido };
}

// Registra el Cobro real (vía el motor contable) con el monto que el
// usuario confirme o ajuste — espejo de registrarPagoRecordatorio.
export async function registrarCobroRecordatorio(
  empresaId: string,
  recordatorio: RecordatorioIngresoRecurrente,
  monto: number
): Promise<string> {
  if (!(monto > 0)) {
    throw new Error('El monto tiene que ser mayor que cero.');
  }

  const fecha = fechaLocalHoy();

  const resultado = await registrarOperacion(empresaId, {
    fecha,
    operacion: 'COBRO',
    categoria: recordatorio.categoria,
    formaPago: recordatorio.forma_pago,
    historico: recordatorio.nombre,
    clienteProveedor: '',
    lineas: [{ producto: '', cantidad: 1, monto }],
  });

  await registrarCobroParcial(empresaId, recordatorio, resultado.idOperacion, monto, fecha);

  return resultado.idOperacion;
}

export type CobroCandidato = {
  idOperacion: string;
  fecha: string;
  total: number;
  historico: string | null;
};

// Para el ingreso que ya se cobró y se cargó "a mano" en Contabilidad
// antes de que existiera este recordatorio — se busca el asiento ya
// cargado en el Libro Diario con la misma categoría y forma de cobro,
// para vincularlo directamente en vez de duplicarlo.
export async function buscarCobrosCandidatos(
  empresaId: string,
  categoria: string,
  formaPago: string
): Promise<CobroCandidato[]> {
  const [{ data: cobros, error }, { data: vinculados }] = await Promise.all([
    supabase
      .from('registro_operaciones')
      .select('id_operacion, fecha, total, historico')
      .eq('empresa_id', empresaId)
      .eq('operacion', 'COBRO')
      .eq('categoria', categoria)
      .eq('forma_pago', formaPago)
      .order('fecha', { ascending: false })
      .limit(30),
    supabase
      .from('ingresos_recurrentes_recordatorios_cobros')
      .select('id_operacion')
      .eq('empresa_id', empresaId),
  ]);

  if (error) {
    throw error;
  }

  const yaVinculados = new Set((vinculados ?? []).map((v) => v.id_operacion));

  return (cobros ?? [])
    .filter((c) => c.id_operacion && !yaVinculados.has(c.id_operacion))
    .map((c) => ({
      idOperacion: c.id_operacion as string,
      fecha: c.fecha,
      total: Number(c.total),
      historico: c.historico,
    }));
}

// Vincula un recordatorio a un asiento YA cargado (ver
// buscarCobrosCandidatos) — mismo aporte parcial que
// registrarCobroParcial, sin pasar por el motor contable.
export async function vincularRecordatorioACobro(
  empresaId: string,
  recordatorio: RecordatorioIngresoRecurrente,
  candidato: CobroCandidato
): Promise<ResultadoCobroParcial> {
  return registrarCobroParcial(empresaId, recordatorio, candidato.idOperacion, candidato.total, candidato.fecha);
}
