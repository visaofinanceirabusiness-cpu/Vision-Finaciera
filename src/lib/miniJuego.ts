// lib/miniJuego.ts
//
// Datos para el Mini-Juego — mismas fuentes que ya usa Contabilidad
// (matriz_operaciones), pero acá solo interesan las combinaciones
// válidas para armar las tarjetas, no todo el resto del formulario.

import { supabase } from './supabase';
import { fechaLocalHoy } from './fecha';

export type CategoriaJuego = { nombre: string; stock: string | null };

export async function obtenerCategoriasJuego(empresaId: string, operacion: string): Promise<CategoriaJuego[]> {
  const { data, error } = await supabase
    .from('matriz_operaciones')
    .select('categoria, stock')
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion);

  if (error) throw error;

  const porNombre = new Map<string, string | null>();
  for (const fila of data ?? []) {
    if (fila.categoria) porNombre.set(fila.categoria, fila.stock ?? null);
  }

  return Array.from(porNombre.entries()).map(([nombre, stock]) => ({ nombre, stock }));
}

export type ProductoJuego = { id: string; nombre: string; categoria: string | null; unidad_medida: string | null };

export async function obtenerProductosJuego(empresaId: string): Promise<ProductoJuego[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, categoria, unidad_medida')
    .eq('empresa_id', empresaId);

  if (error) throw error;

  return (data ?? []) as ProductoJuego[];
}

export async function obtenerFormasPagoJuego(empresaId: string, operacion: string, categoria: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('matriz_operaciones')
    .select('forma_pago')
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion)
    .eq('categoria', categoria);

  if (error) throw error;

  return Array.from(new Set((data ?? []).map((f) => f.forma_pago).filter(Boolean))) as string[];
}

// Cuántas jugadas van cargadas hoy — le da sensación de racha a la
// celebración de cada una ("van 3 hoy 🔥"). Cuenta por creado_en (el
// momento real en que se cargó), no por la fecha elegida en la
// operación, que puede ser de ayer.
export async function contarJugadasHoy(empresaId: string): Promise<number> {
  const { count, error } = await supabase
    .from('registro_operaciones')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .gte('creado_en', `${fechaLocalHoy()}T00:00:00`);

  if (error) throw error;

  return count ?? 0;
}
