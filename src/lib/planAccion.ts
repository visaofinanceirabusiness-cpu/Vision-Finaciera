// lib/planAccion.ts
//
// PLAN DE ACCIÓN DE 30 DÍAS — feature a medida para Buenaventura (ver
// empresaTienePlanAccion en perfilCapacidades.ts). Un objetivo
// general dividido en 30 tarjetas diarias (plan_accion_dias), cada
// una con sus tareas (plan_accion_tareas, turno EJECUCION o CIERRE).
// La regla de negocio central: el día N+1 arranca en estado
// BLOQUEADO y recién pasa a DISPONIBLE cuando el día N se marca
// COMPLETADO (ver completarDia) — nunca se salta un día sin cerrar
// el anterior.

import { supabase } from './supabase';
import { fechaLocalHoy, diasEntre } from './fecha';

export type EstadoDia = 'BLOQUEADO' | 'DISPONIBLE' | 'COMPLETADO' | 'NO_COMPLETADO';

export type DiaPlanAccion = {
  id: string;
  dia_numero: number;
  fase: number;
  objetivo: string;
  resultado_esperado: string;
  estado: EstadoDia;
  ingresos_generados: number;
  ingresos_recurrentes: number;
  contactos: number;
  conversaciones: number;
  propuestas: number;
  ventas: number;
  notas: string | null;
  fecha_completado: string | null;
};

// Cada vez que un día pasa a DISPONIBLE se le crea un evento en el
// Calendário Organizador (eventos_calendario) fechado HOY — no en una
// fecha fija asumida de antemano — y se guarda su id en
// plan_accion_dias.evento_calendario_id para poder reprogramarlo (ver
// api/plan-accion/resumen-diario, que lo pospone un día más cada vez
// que el cron diario lo encuentra sin completar) o cerrarlo cuando se
// complete. Se inserta directo acá (no vía lib/calendario.ts) porque
// no hace falta nada de la UI manual (repetición, etc.), es un
// insert simple sistema → sistema.
async function crearEventoDia(
  empresaId: string,
  dia: { dia_numero: number; objetivo: string; resultado_esperado: string }
): Promise<string> {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .insert({
      empresa_id: empresaId,
      creado_por: null,
      titulo: `Día ${dia.dia_numero} — ${dia.objetivo}`,
      categoria: 'COMERCIAL',
      fecha: fechaLocalHoy(),
      hora: null,
      notas: dia.resultado_esperado,
      notificar: false,
      antelacion_minutos: 0,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'No se pudo crear el evento del Plan de Acción en el calendario.');
  }

  return data.id as string;
}

export type TareaPlanAccion = {
  id: string;
  dia_id: string;
  turno: 'EJECUCION' | 'CIERRE';
  texto: string;
  orden: number;
  completada: boolean;
};

export async function listarDiasPlanAccion(empresaId: string): Promise<DiaPlanAccion[]> {
  const { data, error } = await supabase
    .from('plan_accion_dias')
    .select(
      'id, dia_numero, fase, objetivo, resultado_esperado, estado, ingresos_generados, ingresos_recurrentes, contactos, conversaciones, propuestas, ventas, notas, fecha_completado'
    )
    .eq('empresa_id', empresaId)
    .order('dia_numero', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DiaPlanAccion[];
}

export async function listarTareasDia(diaId: string): Promise<TareaPlanAccion[]> {
  const { data, error } = await supabase
    .from('plan_accion_tareas')
    .select('id, dia_id, turno, texto, orden, completada')
    .eq('dia_id', diaId)
    .order('turno', { ascending: true })
    .order('orden', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TareaPlanAccion[];
}

export async function alternarTarea(tareaId: string, completada: boolean): Promise<void> {
  const { error } = await supabase
    .from('plan_accion_tareas')
    .update({ completada, completada_en: completada ? new Date().toISOString() : null })
    .eq('id', tareaId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function guardarMetricasDia(
  diaId: string,
  metricas: {
    ingresos_generados: number;
    ingresos_recurrentes: number;
    contactos: number;
    conversaciones: number;
    propuestas: number;
    ventas: number;
    notas: string;
  }
): Promise<void> {
  const { error } = await supabase.from('plan_accion_dias').update(metricas).eq('id', diaId);

  if (error) {
    throw new Error(error.message);
  }
}

// Cierra el día actual (COMPLETADO) y habilita el siguiente
// (BLOQUEADO → DISPONIBLE) en la misma operación. Si no hay día
// siguiente (dia_numero === 30), el ciclo completo queda cerrado.
//
// Además mantiene sincronizado el Calendário: deja registrado en el
// evento del día recién completado cuántos días tardó (0 si se cerró
// el mismo día que se habilitó) y crea el evento del día siguiente
// fechado HOY, nunca en una fecha fija asumida de antemano — así el
// Calendário siempre refleja el progreso real del plan, no un
// cronograma ideal que se desincroniza apenas hay un atraso.
export async function completarDia(empresaId: string, diaId: string, diaNumero: number): Promise<void> {
  const { data: diaActual } = await supabase
    .from('plan_accion_dias')
    .select('objetivo, evento_calendario_id, fecha_iniciado')
    .eq('id', diaId)
    .maybeSingle();

  const { error: errorCompletar } = await supabase
    .from('plan_accion_dias')
    .update({ estado: 'COMPLETADO', fecha_completado: new Date().toISOString() })
    .eq('id', diaId);

  if (errorCompletar) {
    throw new Error(errorCompletar.message);
  }

  if (diaActual?.evento_calendario_id) {
    const atraso = diaActual.fecha_iniciado ? diasEntre(diaActual.fecha_iniciado) : 0;
    const marca = atraso > 0 ? ` (✅ completado con ${atraso} día${atraso === 1 ? '' : 's'} de atraso)` : ' (✅ completado en el día)';

    await supabase
      .from('eventos_calendario')
      .update({ titulo: `Día ${diaNumero} — ${diaActual.objetivo}${marca}` })
      .eq('id', diaActual.evento_calendario_id);
  }

  const { data: diaSiguiente, error: errorBuscar } = await supabase
    .from('plan_accion_dias')
    .select('id, dia_numero, objetivo, resultado_esperado')
    .eq('empresa_id', empresaId)
    .eq('dia_numero', diaNumero + 1)
    .eq('estado', 'BLOQUEADO')
    .maybeSingle();

  if (errorBuscar) {
    throw new Error(errorBuscar.message);
  }

  if (!diaSiguiente) {
    return;
  }

  const eventoId = await crearEventoDia(empresaId, diaSiguiente);

  const { error: errorDesbloquear } = await supabase
    .from('plan_accion_dias')
    .update({ estado: 'DISPONIBLE', fecha_iniciado: new Date().toISOString(), evento_calendario_id: eventoId })
    .eq('id', diaSiguiente.id);

  if (errorDesbloquear) {
    throw new Error(errorDesbloquear.message);
  }
}
