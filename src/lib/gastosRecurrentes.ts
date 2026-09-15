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
};

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
}

export async function eliminarGastoRecurrente(id: string) {
  const { error } = await supabase.from('gastos_recurrentes').delete().eq('id', id);
  if (error) throw error;
}

// Por cada plantilla activa, se asegura de que exista un recordatorio
// para el período que corresponde (el mes actual si el día todavía no
// pasó, o el que viene si ya pasó) — se puede llamar todas las veces
// que haga falta (al abrir "Gastos Fijos", desde el cron diario del
// calendario), la constraint unique (gasto_recurrente_id, periodo)
// evita duplicar.
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
  const diaActual = hoy.getDate();

  for (const plantilla of plantillas ?? []) {
    // Si el día ya pasó este mes, el período que corresponde es el
    // próximo mes — no tiene sentido armar un recordatorio con fecha
    // pasada.
    const mesDestino = diaActual > plantilla.dia_mes ? new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1) : hoy;
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

export async function listarRecordatoriosPendientes(empresaId: string): Promise<RecordatorioGastoRecurrente[]> {
  const { data, error } = await supabase
    .from('gastos_recurrentes_recordatorios')
    .select(
      'id, gasto_recurrente_id, periodo, fecha_vencimiento, registrado, id_operacion, gastos_recurrentes!inner(nombre, categoria, forma_pago, monto_habitual, empresa_id)'
    )
    .eq('empresa_id', empresaId)
    .eq('registrado', false)
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((fila) => {
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
      nombre: plantilla.nombre,
      categoria: plantilla.categoria,
      forma_pago: plantilla.forma_pago,
      monto_habitual: plantilla.monto_habitual,
    };
  });
}

// Trae un recordatorio puntual con los datos de su plantilla — para
// precargar el formulario de Contabilidad cuando se llega desde el
// botón "Registrar" (ver /contabilidad?gastoRecurrenteRecordatorioId=).
export async function obtenerRecordatorio(recordatorioId: string): Promise<RecordatorioGastoRecurrente | null> {
  const { data, error } = await supabase
    .from('gastos_recurrentes_recordatorios')
    .select(
      'id, gasto_recurrente_id, periodo, fecha_vencimiento, registrado, id_operacion, gastos_recurrentes!inner(nombre, categoria, forma_pago, monto_habitual)'
    )
    .eq('id', recordatorioId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const plantilla = data.gastos_recurrentes as unknown as {
    nombre: string;
    categoria: string;
    forma_pago: string;
    monto_habitual: number;
  };

  return {
    id: data.id,
    gasto_recurrente_id: data.gasto_recurrente_id,
    periodo: data.periodo,
    fecha_vencimiento: data.fecha_vencimiento,
    registrado: data.registrado,
    id_operacion: data.id_operacion,
    nombre: plantilla.nombre,
    categoria: plantilla.categoria,
    forma_pago: plantilla.forma_pago,
    monto_habitual: plantilla.monto_habitual,
  };
}

// Se llama después de registrar el pago real en Contabilidad — marca
// el recordatorio como cumplido y borra el evento del calendario (ya
// hizo su trabajo), igual que al pagar una cuota.
export async function marcarRecordatorioRegistrado(recordatorioId: string, idOperacion: string) {
  const { data: recordatorio, error: errorRecordatorio } = await supabase
    .from('gastos_recurrentes_recordatorios')
    .select('evento_calendario_id')
    .eq('id', recordatorioId)
    .single();

  if (errorRecordatorio) {
    throw errorRecordatorio;
  }

  const { error } = await supabase
    .from('gastos_recurrentes_recordatorios')
    .update({ registrado: true, id_operacion: idOperacion })
    .eq('id', recordatorioId);

  if (error) {
    throw error;
  }

  if (recordatorio.evento_calendario_id) {
    await supabase.from('eventos_calendario').delete().eq('id', recordatorio.evento_calendario_id);
  }
}
