// lib/devengoVencimientos.ts
//
// Si cambia el día del mes de un gasto/ingreso recurrente que devenga mes a
// mes, hay que mover el vencimiento de TODOS sus meses todavía abiertos (la
// ventana de 12 meses ya está armada con el día viejo), y el evento del
// Calendário de los que ya lo tienen. Los meses ya saldados no se tocan.

import { supabase } from './supabase';
import { fechaVencimientoDe } from './devengo';

export async function reprogramarVencimientosAbiertos(
  lado: 'GASTO' | 'INGRESO',
  plantillaId: string,
  diaMes: number
) {
  const tabla = lado === 'GASTO' ? 'gastos_recurrentes_recordatorios' : 'ingresos_recurrentes_recordatorios';
  const columna = lado === 'GASTO' ? 'gasto_recurrente_id' : 'ingreso_recurrente_id';

  const { data: abiertos, error } = await supabase
    .from(tabla)
    .select('id, periodo, fecha_vencimiento, evento_calendario_id')
    .eq(columna, plantillaId)
    .eq('registrado', false)
    .not('estado', 'is', null);

  if (error) {
    throw error;
  }

  for (const fila of abiertos ?? []) {
    const nuevaFecha = fechaVencimientoDe(fila.periodo, diaMes);

    if (nuevaFecha === fila.fecha_vencimiento) {
      continue;
    }

    const { error: errorFecha } = await supabase.from(tabla).update({ fecha_vencimiento: nuevaFecha }).eq('id', fila.id);

    if (errorFecha) {
      throw errorFecha;
    }

    if (fila.evento_calendario_id) {
      await supabase.from('eventos_calendario').update({ fecha: nuevaFecha }).eq('id', fila.evento_calendario_id);
    }
  }
}
