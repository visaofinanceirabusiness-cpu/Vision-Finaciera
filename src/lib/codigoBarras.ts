// lib/codigoBarras.ts
//
// CÓDIGO DE BARRAS DE PRODUCTOS
// =====================================================
// Dos usos: dar de alta un producto escaneando (evita tipear y
// detecta duplicados) y, en Venta, encontrar el producto ya cargado a
// partir de lo que la cámara leyó, para agregar la línea sola.

import { supabase } from './supabase';

export type ProductoPorCodigoBarras = {
  id: string;
  nombre: string;
  codigo: string | null;
};

export async function buscarProductoPorCodigoBarras(
  empresaId: string,
  codigoBarras: string
): Promise<ProductoPorCodigoBarras | null> {
  const codigoLimpio = codigoBarras.trim();

  if (!codigoLimpio) return null;

  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, codigo')
    .eq('empresa_id', empresaId)
    .eq('codigo_barras', codigoLimpio)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function asignarCodigoBarras(productoId: string, codigoBarras: string): Promise<void> {
  const { error } = await supabase
    .from('productos')
    .update({ codigo_barras: codigoBarras.trim() })
    .eq('id', productoId);

  if (error) {
    throw error;
  }
}
