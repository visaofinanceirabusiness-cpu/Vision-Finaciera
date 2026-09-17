// lib/gastosRecurrentes.ts
//
// GASTOS RECURRENTES (Alquiler, Servicios, Suscripciones...)
// =====================================================
//
// A diferencia de una cuota (ver lib/cuotas.ts), acá el gasto real
// TODAVÍA NO SE CARGÓ — cada mes hay que registrarlo a mano, porque
// el monto puede variar (luz, agua) o simplemente porque cargar solo
// un asiento sin que nadie lo revise es más riesgoso que un
// recordatorio. Por eso esto NO genera ningún asiento contable por sí
// mismo: solo arma, mes a mes, un recordatorio en el Calendário del
// lobby (mismo mecanismo que las cuotas) con los datos ya
// precargados para registrar el pago con un toque.

import { supabase } from './supabase';
import { registrarOperacion } from './motor';
import { fechaLocalHoy } from './fecha';

export type GastoRecurrente = {
  id: string;
  nombre: string;
  categoria: string;
  forma_pago: string;
  monto_habitual: number;
  dia_mes: number;
  activo: boolean;
};

export type RecordatorioGastoRecurrente = {
  id: string;
  gasto_recurrente_id: string;
  periodo: string;
  fecha_vencimiento: string;
  registrado: boolean;
  id_operacion: string | null;
  nombre: string;
  categoria: string;
  forma_pago: string;
  monto_habitual: number;
  monto_pagado: number;
};

// Lo que falta pagar de este recordatorio — puede ser menor a
// monto_habitual si ya se cargó uno o más pagos parciales contra él
// (ver registrarPagoParcial). Nunca negativo: un pago que se pasa del
// monto habitual simplemente deja el recordatorio cumplido, sin
// arrastrar saldo a favor al período siguiente.
export function saldoPendiente(recordatorio: RecordatorioGastoRecurrente): number {
  return Math.max(0, recordatorio.monto_habitual - recordatorio.monto_pagado);
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

export async function crearGastoRecurrente(
  empresaId: string,
  datos: { nombre: string; categoria: string; formaPago: string; montoHabitual: number; diaMes: number }
) {
  const nombre = datos.nombre.trim();

  if (!nombre) {
    throw new Error('El nombre no puede estar vacío.');
  }

  if (!datos.categoria || !datos.formaPago) {
    throw new Error('Elegí la categoría y la forma de pago.');
  }

  if (!Number.isInteger(datos.diaMes) || datos.diaMes < 1 || datos.diaMes > 28) {
    throw new Error('El día del mes tiene que ser entre 1 y 28 (para que exista en todos los meses).');
  }

  const { error } = await supabase.from('gastos_recurrentes').insert({
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

export async function listarGastosRecurrentes(empresaId: string): Promise<GastoRecurrente[]> {
  const { data, error } = await supabase
    .from('gastos_recurrentes')
    .select('id, nombre, categoria, forma_pago, monto_habitual, dia_mes, activo')
    .eq('empresa_id', empresaId)
    .order('nombre');

  if (error) {
    throw error;
  }

  return (data ?? []) as GastoRecurrente[];
}

export async function cambiarActivoGastoRecurrente(id: string, activo: boolean) {
  const { error } = await supabase.from('gastos_recurrentes').update({ activo }).eq('id', id);
  if (error) throw error;
}

export async function actualizarGastoRecurrente(
  id: string,
  datos: { nombre: string; categoria: string; formaPago: string; montoHabitual: number; diaMes: number }
) {
  const nombre = datos.nombre.trim();

  if (!nombre) {
    throw new Error('El nombre no puede estar vacío.');
  }

  if (!datos.categoria || !datos.formaPago) {
    throw new Error('Elegí la categoría y la forma de pago.');
  }

  if (!Number.isInteger(datos.diaMes) || datos.diaMes < 1 || datos.diaMes > 28) {
    throw new Error('El día del mes tiene que ser entre 1 y 28 (para que exista en todos los meses).');
  }

  const { error } = await supabase
    .from('gastos_recurrentes')
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

  // Si cambia el día del mes y todavía hay un recordatorio sin
  // resolver, se actualiza (y su evento en el Calendário) para
  // reflejar la nueva fecha — sin esto, quedaba con la fecha vieja
  // hasta que se resolviera y se generara el siguiente, mostrando un
  // vencimiento que ya no correspondía.
  const { data: pendiente, error: errorPendiente } = await supabase
    .from('gastos_recurrentes_recordatorios')
    .select('id, periodo, fecha_vencimiento, evento_calendario_id')
    .eq('gasto_recurrente_id', id)
    .eq('registrado', false)
    .order('periodo', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errorPendiente) {
    throw errorPendiente;
  }

  if (!pendiente) {
    return;
  }

  const [anio, mes] = pendiente.periodo.split('-').map(Number);
  const nuevaFecha = fechaDelMes(new Date(anio, mes - 1, 1), datos.diaMes);

  if (nuevaFecha === pendiente.fecha_vencimiento) {
    return;
  }

  const { error: errorFecha } = await supabase
    .from('gastos_recurrentes_recordatorios')
    .update({ fecha_vencimiento: nuevaFecha })
    .eq('id', pendiente.id);

  if (errorFecha) {
    throw errorFecha;
  }

  if (pendiente.evento_calendario_id) {
    await supabase.from('eventos_calendario').update({ fecha: nuevaFecha }).eq('id', pendiente.evento_calendario_id);
  }
}

export async function eliminarGastoRecurrente(id: string) {
  const { error } = await supabase.from('gastos_recurrentes').delete().eq('id', id);
  if (error) throw error;
}

// Por cada plantilla activa, se asegura de que exista un recordatorio
// para el período que corresponde — se puede llamar todas las veces
// que haga falta (al abrir Mis Vencimientos, desde el lobby), la
// constraint unique (gasto_recurrente_id, periodo) evita duplicar.
//
// El período nunca se decide solo mirando la fecha de hoy: se mira el
// ÚLTIMO recordatorio ya generado para esa plantilla. Si todavía está
// sin resolver (no se registró ni se vinculó un pago), no se avanza
// al mes que viene — quedaría "salteado" un período sin cerrar. Recién
// cuando ese último queda registrado se genera el siguiente, un mes
// después del que se cerró. La primera vez (todavía no hay ningún
// recordatorio) se usa el mes actual, aunque el día ya haya pasado —
// así se puede vincular un pago que ya se hizo este mes (ver "Ya lo
// pagué").
export async function generarRecordatoriosPendientes(empresaId: string, idioma: string | null | undefined) {
  const { data: plantillas, error: errorPlantillas } = await supabase
    .from('gastos_recurrentes')
    .select('id, nombre, categoria, forma_pago, monto_habitual, dia_mes')
    .eq('empresa_id', empresaId)
    .eq('activo', true);

  if (errorPlantillas) {
    throw errorPlantillas;
  }

  const hoy = new Date();

  for (const plantilla of plantillas ?? []) {
    const { data: ultimo, error: errorUltimo } = await supabase
      .from('gastos_recurrentes_recordatorios')
      .select('periodo, registrado')
      .eq('gasto_recurrente_id', plantilla.id)
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

    // Se inserta el recordatorio ANTES de crear el evento de
    // calendario, apoyándose en la constraint unique (gasto_recurrente_id,
    // periodo) para que la verificación sea atómica a nivel de base de
    // datos: un select-y-después-insert por separado deja una ventana
    // donde dos llamadas simultáneas (p. ej. el efecto del lobby
    // disparándose dos veces al resolver empresa/perfil) pasan el
    // chequeo antes de que la primera termine de insertar, y las dos
    // terminan creando su propio evento de calendario duplicado.
    const { data: recordatorioInsertado, error: errorRecordatorio } = await supabase
      .from('gastos_recurrentes_recordatorios')
      .insert({
        gasto_recurrente_id: plantilla.id,
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
        // Ya existía (constraint unique) — otra llamada se adelantó.
        continue;
      }
      throw errorRecordatorio;
    }

    const titulo = esPT(idioma) ? `Vence: ${plantilla.nombre}` : `Vence: ${plantilla.nombre}`;

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
      .from('gastos_recurrentes_recordatorios')
      .update({ evento_calendario_id: evento.id })
      .eq('id', recordatorioInsertado.id);

    if (errorUpdate) {
      throw errorUpdate;
    }
  }
}

const SELECT_RECORDATORIO =
  'id, gasto_recurrente_id, periodo, fecha_vencimiento, registrado, id_operacion, monto_pagado, gastos_recurrentes!inner(nombre, categoria, forma_pago, monto_habitual, empresa_id)';

function mapearFilaRecordatorio(fila: {
  id: string;
  gasto_recurrente_id: string;
  periodo: string;
  fecha_vencimiento: string;
  registrado: boolean;
  id_operacion: string | null;
  monto_pagado: number;
  gastos_recurrentes: unknown;
}): RecordatorioGastoRecurrente {
  const plantilla = fila.gastos_recurrentes as unknown as {
    nombre: string;
    categoria: string;
    forma_pago: string;
    monto_habitual: number;
  };

  return {
    id: fila.id,
    gasto_recurrente_id: fila.gasto_recurrente_id,
    periodo: fila.periodo,
    fecha_vencimiento: fila.fecha_vencimiento,
    registrado: fila.registrado,
    id_operacion: fila.id_operacion,
    monto_pagado: Number(fila.monto_pagado ?? 0),
    nombre: plantilla.nombre,
    categoria: plantilla.categoria,
    forma_pago: plantilla.forma_pago,
    monto_habitual: plantilla.monto_habitual,
  };
}

export async function listarRecordatoriosPendientes(empresaId: string): Promise<RecordatorioGastoRecurrente[]> {
  const { data, error } = await supabase
    .from('gastos_recurrentes_recordatorios')
    .select(SELECT_RECORDATORIO)
    .eq('empresa_id', empresaId)
    .eq('registrado', false)
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapearFilaRecordatorio);
}

// Trae pendientes Y ya pagados (acotado a los últimos ~3 meses) —
// para el botón "Mostrar pagados" de Mis Vencimientos, que permite
// revisar/verificar lo que ya se saldó sin mezclarlo por default con
// lo que todavía falta.
export async function listarRecordatoriosConHistorial(empresaId: string): Promise<RecordatorioGastoRecurrente[]> {
  const hace90Dias = new Date();
  hace90Dias.setDate(hace90Dias.getDate() - 90);
  const desde = hace90Dias.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('gastos_recurrentes_recordatorios')
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
// botón "Registrar" (ver /contabilidad?gastoRecurrenteRecordatorioId=).
export async function obtenerRecordatorio(recordatorioId: string): Promise<RecordatorioGastoRecurrente | null> {
  const { data, error } = await supabase
    .from('gastos_recurrentes_recordatorios')
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

export type ResultadoPagoParcial = {
  montoPagado: number;
  saldoPendiente: number;
  cumplido: boolean;
};

// Núcleo compartido de todo pago (total o parcial) contra un
// recordatorio: registra el aporte en gastos_recurrentes_recordatorios_pagos
// (queda el historial de cada pago, con su propio asiento), actualiza
// el acumulado monto_pagado y, solo si con este aporte el saldo llega
// a cero, marca el recordatorio como cumplido y borra el evento del
// calendario (ya hizo su trabajo) — si todavía queda saldo, el
// recordatorio sigue apareciendo como pendiente, con el saldo
// restante, para completarlo con un pago posterior.
export async function registrarPagoParcial(
  empresaId: string,
  recordatorio: RecordatorioGastoRecurrente,
  idOperacion: string,
  monto: number,
  fecha: string
): Promise<ResultadoPagoParcial> {
  const { error: errorPago } = await supabase.from('gastos_recurrentes_recordatorios_pagos').insert({
    recordatorio_id: recordatorio.id,
    empresa_id: empresaId,
    id_operacion: idOperacion,
    monto,
    fecha,
  });

  if (errorPago) {
    throw errorPago;
  }

  // Number(...) explícito acá: si algún dato numérico llegara como
  // string (puede pasar con columnas `numeric` de Postgres según cómo
  // se serialicen), un "+" entre string y number concatena en vez de
  // sumar, y quedaba un monto_pagado corrupto silenciosamente.
  const nuevoMontoPagado = Number(recordatorio.monto_pagado) + Number(monto);
  const nuevoSaldo = Math.max(0, Number(recordatorio.monto_habitual) - nuevoMontoPagado);
  const cumplido = nuevoSaldo <= 0.01;

  const { data: fila, error: errorRecordatorio } = await supabase
    .from('gastos_recurrentes_recordatorios')
    .select('evento_calendario_id')
    .eq('id', recordatorio.id)
    .single();

  if (errorRecordatorio) {
    throw errorRecordatorio;
  }

  const { error } = await supabase
    .from('gastos_recurrentes_recordatorios')
    .update({ monto_pagado: nuevoMontoPagado, registrado: cumplido, id_operacion: idOperacion })
    .eq('id', recordatorio.id);

  if (error) {
    throw error;
  }

  if (cumplido && fila.evento_calendario_id) {
    await supabase.from('eventos_calendario').delete().eq('id', fila.evento_calendario_id);
  }

  return { montoPagado: nuevoMontoPagado, saldoPendiente: nuevoSaldo, cumplido };
}

// Registra el Pago real (vía el motor contable) con el monto que el
// usuario confirme o ajuste — pensado para el mini-diálogo de Sabio
// en Panel de Controle, que permite hacer esto sin entrar a
// Contabilidad. Usa la misma categoría/forma de pago con la que se
// cargó la plantilla. Si el monto es menor al saldo pendiente (pagó
// de menos), el recordatorio queda con el saldo restante para
// completar después — no se marca cumplido hasta llegar a cero.
export async function registrarPagoRecordatorio(
  empresaId: string,
  recordatorio: RecordatorioGastoRecurrente,
  monto: number
): Promise<string> {
  if (!(monto > 0)) {
    throw new Error('El monto tiene que ser mayor que cero.');
  }

  const fecha = fechaLocalHoy();

  const resultado = await registrarOperacion(empresaId, {
    fecha,
    operacion: 'PAGO',
    categoria: recordatorio.categoria,
    formaPago: recordatorio.forma_pago,
    historico: recordatorio.nombre,
    clienteProveedor: '',
    lineas: [{ producto: '', cantidad: 1, monto }],
  });

  await registrarPagoParcial(empresaId, recordatorio, resultado.idOperacion, monto, fecha);

  return resultado.idOperacion;
}

export type PagoCandidato = {
  idOperacion: string;
  fecha: string;
  total: number;
  historico: string | null;
};

// Para el gasto que ya se pagó y se cargó "a mano" en Contabilidad
// (típicamente los primeros meses, antes de que existiera este
// recordatorio) — en vez de registrar el Pago de nuevo y duplicarlo,
// se busca el asiento ya cargado en el Libro Diario con la misma
// categoría y forma de pago, para vincularlo directamente. Se excluye
// cualquier asiento que ya esté vinculado a otro recordatorio.
export async function buscarPagosCandidatos(
  empresaId: string,
  categoria: string,
  formaPago: string
): Promise<PagoCandidato[]> {
  // La forma de pago se puede renombrar (ej. "Transferencia" →
  // "Naranja X" en Configurações → Formas de Pago) — cuando eso pasa,
  // las operaciones YA registradas quedan con el nombre viejo
  // congelado en `forma_pago` (es una foto de texto del momento, no
  // una referencia viva), así que filtrar por ese nombre exacto deja
  // afuera cualquier pago hecho antes del renombre. La cuenta contable
  // real (`cuenta_credito`, el medio de pago) no tiene ese problema:
  // vía matriz_operaciones se resuelve siempre a la cuenta ACTUAL de
  // la forma de pago elegida, y esa es la que de verdad importa para
  // saber "con qué se pagó" — matcheamos por ahí en vez de por nombre.
  const { data: reglaFormaPago } = await supabase
    .from('matriz_operaciones')
    .select('cuenta_credito')
    .eq('empresa_id', empresaId)
    .eq('operacion', 'PAGO')
    .eq('forma_pago', formaPago)
    .limit(1)
    .maybeSingle();

  const cuentaCredito = reglaFormaPago?.cuenta_credito ?? formaPago;

  const [{ data: pagos, error }, { data: vinculados }] = await Promise.all([
    supabase
      .from('registro_operaciones')
      .select('id_operacion, fecha, total, historico')
      .eq('empresa_id', empresaId)
      .eq('operacion', 'PAGO')
      .eq('categoria', categoria)
      .eq('cuenta_credito', cuentaCredito)
      .order('fecha', { ascending: false })
      .limit(30),
    supabase
      .from('gastos_recurrentes_recordatorios_pagos')
      .select('id_operacion')
      .eq('empresa_id', empresaId),
  ]);

  if (error) {
    throw error;
  }

  const yaVinculados = new Set((vinculados ?? []).map((v) => v.id_operacion));

  return (pagos ?? [])
    .filter((p) => p.id_operacion && !yaVinculados.has(p.id_operacion))
    .map((p) => ({
      idOperacion: p.id_operacion as string,
      fecha: p.fecha,
      total: Number(p.total),
      historico: p.historico,
    }));
}

// Vincula un recordatorio a un asiento YA cargado (ver
// buscarPagosCandidatos) — mismo aporte parcial que registrarPagoParcial,
// pero sin pasar por el motor contable porque el asiento ya existe.
// El monto del asiento elegido (candidato.total) es el que se resta
// del saldo pendiente.
export async function vincularRecordatorioAPago(
  empresaId: string,
  recordatorio: RecordatorioGastoRecurrente,
  candidato: PagoCandidato
): Promise<ResultadoPagoParcial> {
  return registrarPagoParcial(empresaId, recordatorio, candidato.idOperacion, candidato.total, candidato.fecha);
}
