// lib/precioSugerido.ts
//
// Precio sugerido de venta por unidad (solo informativo: no genera asientos ni toca el motor).
// El costo es el mismo promedio ponderado del stock que usa lib/motor.ts al vender, tomado hasta
// la fecha de la operación — por eso cubre igual a un producto terminado y a uno con receta
// (la producción deja su costo en las ENTRADAS de movimientos_stock).

import { supabase } from '@/lib/supabase';

export type MovimientoCosto = { tipo: string; cantidad: number | string | null; costo_unitario: number | string | null };

export const PORCENTAJE_INICIAL = 30;
const CLAVE_PORCENTAJE = 'precioSugerido:porcentaje';

export function costoPromedioUnitario(movimientos: MovimientoCosto[]): number | null {
  let cantidad = 0;
  let valor = 0;

  for (const m of movimientos) {
    const cant = Number(m.cantidad ?? 0);
    const costo = Number(m.costo_unitario ?? 0);
    if (m.tipo === 'ENTRADA') {
      cantidad += cant;
      valor += cant * costo;
    } else if (m.tipo === 'SALIDA') {
      cantidad -= cant;
      valor -= cant * costo;
    }
  }

  if (cantidad <= 0 || valor <= 0) return null;
  return valor / cantidad;
}

// Markup sobre costo: costo × (1 + %/100).
export function precioConMarkup(costoUnitario: number, porcentaje: number): number {
  return Math.round(costoUnitario * (1 + porcentaje / 100) * 100) / 100;
}

export async function obtenerCostoUnitario(empresaId: string, productoId: string, fecha: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('movimientos_stock')
    .select('tipo, cantidad, costo_unitario')
    .eq('empresa_id', empresaId)
    .eq('producto_id', productoId)
    .in('tipo', ['ENTRADA', 'SALIDA'])
    .lte('fecha', fecha);

  if (error) throw error;
  return costoPromedioUnitario(data ?? []);
}

export function leerPorcentajeGuardado(): number {
  try {
    const guardado = Number(window.localStorage.getItem(CLAVE_PORCENTAJE));
    return guardado > 0 ? guardado : PORCENTAJE_INICIAL;
  } catch {
    return PORCENTAJE_INICIAL;
  }
}

export function guardarPorcentaje(porcentaje: number) {
  try {
    window.localStorage.setItem(CLAVE_PORCENTAJE, String(porcentaje));
  } catch {
    // sin almacenamiento: se usa el valor en memoria nomás
  }
}
