// lib/eventosDePlantilla.ts
//
// Cada recordatorio de un gasto o ingreso recurrente tiene su evento en el Calendário ("Vence: X" / "Cobrar: X"). Al borrar la
// plantilla, la base borra en cascada sus recordatorios pero NO esos eventos: quedaban avisos fantasma (incluso con notificación
// push futura) de algo que ya no existe. Se llama justo ANTES de borrar la plantilla.

import { supabase } from './supabase';

export async function borrarEventosDeRecordatorios(lado: 'gastos' | 'ingresos', plantillaId: string) {
  const tabla = lado === 'gastos' ? 'gastos_recurrentes_recordatorios' : 'ingresos_recurrentes_recordatorios';
  const columna = lado === 'gastos' ? 'gasto_recurrente_id' : 'ingreso_recurrente_id';

  const { data, error } = await supabase.from(tabla).select('evento_calendario_id').eq(columna, plantillaId);

  if (error) throw error;

  const ids = (data ?? []).map((f) => f.evento_calendario_id).filter((id): id is string => Boolean(id));

  if (ids.length > 0) {
    const { error: errorBorrar } = await supabase.from('eventos_calendario').delete().in('id', ids);
    if (errorBorrar) throw errorBorrar;
  }
}
