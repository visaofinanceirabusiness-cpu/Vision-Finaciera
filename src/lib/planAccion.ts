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
export async function completarDia(empresaId: string, diaId: string, diaNumero: number): Promise<void> {
  const { error: errorCompletar } = await supabase
    .from('plan_accion_dias')
    .update({ estado: 'COMPLETADO', fecha_completado: new Date().toISOString() })
    .eq('id', diaId);

  if (errorCompletar) {
    throw new Error(errorCompletar.message);
  }

  const { error: errorDesbloquear } = await supabase
    .from('plan_accion_dias')
    .update({ estado: 'DISPONIBLE' })
    .eq('empresa_id', empresaId)
    .eq('dia_numero', diaNumero + 1)
    .eq('estado', 'BLOQUEADO');

  if (errorDesbloquear) {
    throw new Error(errorDesbloquear.message);
  }
}
