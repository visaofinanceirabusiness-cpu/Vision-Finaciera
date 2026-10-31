// lib/miLocalServicios.ts
//
// MI LOCAL PARA SERVICIOS. Un servicio es una categoría de Venta de servicios de la empresa (la misma que se crea en
// Configurações → Categorías de servicio: una cuenta de ingreso + una regla con stock NO y CMV NO). Mi Local la
// publica con precio, foto y descripción propios; al registrar la venta se usa el mismo motor, sin stock ni costo.
// Puro, sin acceso a datos.

import type { ItemVenta } from './miLocal';

// ¿La empresa vende servicios? Servicios siempre; Mixto solo si tildó ese componente; el resto no.
export function perfilVendeServicios(perfilCodigo: string | null | undefined, componentesMixto: string[] = []): boolean {
  if (perfilCodigo === 'SERVICIOS') return true;
  if (perfilCodigo === 'MIXTO') return componentesMixto.includes('SERVICIOS');
  return false;
}

// Un servicio solo se publica con precio.
export function precioServicioValido(precio: number): boolean {
  return Number.isFinite(precio) && precio > 0 && precio < 100_000_000;
}

export type LineaVenta = { producto: string; cantidad: number; monto: number };

// Líneas de una venta del motor para los ítems de UNA categoría.
// - Producto: lleva su id (el motor identifica el producto por id y mueve el stock).
// - Servicio: sin producto ('' — con la regla en stock NO el motor no lo usa); no puede mezclarse con productos.
export function lineasDeVenta(items: ItemVenta[], esServicio: boolean): LineaVenta[] {
  if (esServicio) {
    if (items.some((it) => it.producto_id)) throw new Error('ML_CATEGORIA_MEZCLADA');
    return items.map((it) => ({ producto: '', cantidad: it.cantidad, monto: Number(it.precio_unitario) }));
  }
  return items.map((it) => {
    if (!it.producto_id) throw new Error('El producto de este pedido ya no existe en Mercadería.');
    return { producto: it.producto_id, cantidad: it.cantidad, monto: Number(it.precio_unitario) };
  });
}

export type EstadoServicio = 'SIN_PRECIO' | 'BORRADOR' | 'PUBLICADO';

export function estadoDeServicio(pub: { precio: number; publicado: boolean } | null | undefined): EstadoServicio {
  if (!pub || !precioServicioValido(Number(pub.precio))) return 'SIN_PRECIO';
  return pub.publicado ? 'PUBLICADO' : 'BORRADOR';
}
