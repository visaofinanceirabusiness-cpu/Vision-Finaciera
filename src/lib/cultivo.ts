// lib/cultivo.ts
//
// MI CULTIVO — acceso a datos de cultivo_producciones (ver
// cultivoTomate.ts para las fases y el calendario). Feature a medida
// de Buenaventura (ver empresaTieneCultivo en perfilCapacidades.ts).

import { supabase } from './supabase';
import { FaseProduccion } from './cultivoTomate';

export type ProduccionCultivo = {
  id: string;
  empresa_id: string;
  nombre: string;
  variedad: string | null;
  cantidad_plantas: number | null;
  fecha_inicio: string;
  fases: FaseProduccion[];
  tareas_hechas: string[];
  kilos_cosechados: number;
  notas: string | null;
  cerrada: boolean;
};

const COLUMNAS =
  'id, empresa_id, nombre, variedad, cantidad_plantas, fecha_inicio, fases, tareas_hechas, kilos_cosechados, notas, cerrada';

export async function listarProducciones(empresaId: string): Promise<ProduccionCultivo[]> {
  const { data, error } = await supabase
    .from('cultivo_producciones')
    .select(COLUMNAS)
    .eq('empresa_id', empresaId)
    .order('fecha_inicio', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProduccionCultivo[];
}

export async function crearProduccion(
  nueva: Pick<ProduccionCultivo, 'empresa_id' | 'nombre' | 'variedad' | 'cantidad_plantas' | 'fecha_inicio' | 'fases'>
): Promise<void> {
  const { error } = await supabase.from('cultivo_producciones').insert(nueva);
  if (error) throw error;
}

export async function actualizarProduccion(
  id: string,
  cambios: Partial<Pick<ProduccionCultivo, 'nombre' | 'variedad' | 'cantidad_plantas' | 'fecha_inicio' | 'fases' | 'tareas_hechas' | 'kilos_cosechados' | 'notas' | 'cerrada'>>
): Promise<void> {
  const { error } = await supabase.from('cultivo_producciones').update(cambios).eq('id', id);
  if (error) throw error;
}

export async function eliminarProduccion(id: string): Promise<void> {
  const { error } = await supabase.from('cultivo_producciones').delete().eq('id', id);
  if (error) throw error;
}
