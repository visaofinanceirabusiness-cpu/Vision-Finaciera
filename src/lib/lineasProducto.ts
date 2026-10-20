// lib/lineasProducto.ts
//
// Lógica común de Mini-Juego y Central de Lanzamientos para operaciones con productos:
// cómo se ordenan/agrupan los productos al elegirlos y cómo se manejan varias líneas
// en una misma operación. Solo lógica pura (testeada); no toca el motor contable.

export const MAX_LINEAS_JUEGO = 10;

export type ProductoAgrupable = {
  id: string;
  nombre: string;
  unidad_medida: string | null;
  tipo_producto?: string | null;
};

export type GrupoProductos<P extends ProductoAgrupable> = {
  clave: 'TERMINADOS' | 'INSUMOS';
  conSaldo: P[];
  sinSaldo: P[];
  abiertoPorDefecto: boolean;
};

// Terminados primero, insumos aparte; dentro de cada grupo, los que tienen saldo arriba y
// los que no en un desplegable. En Compra (o sin datos de saldo) no hay "sin saldo": se
// puede comprar lo que no tiene stock, así que todo queda visible.
export function agruparProductos<P extends ProductoAgrupable>(
  productos: P[],
  saldos: Record<string, number>,
  opciones: { operacion: string; ignorarSaldo?: boolean }
): GrupoProductos<P>[] {
  const todoVisible = opciones.operacion === 'COMPRA' || Boolean(opciones.ignorarSaldo);
  const porNombre = (a: P, b: P) => a.nombre.localeCompare(b.nombre, 'es');

  const armar = (clave: GrupoProductos<P>['clave'], lista: P[]): GrupoProductos<P> => {
    const ordenada = lista.slice().sort(porNombre);
    const conSaldo = todoVisible ? ordenada : ordenada.filter((p) => (saldos[p.id] ?? 0) > 0);
    const sinSaldo = todoVisible ? [] : ordenada.filter((p) => (saldos[p.id] ?? 0) <= 0);
    return { clave, conSaldo, sinSaldo, abiertoPorDefecto: true };
  };

  const insumos = productos.filter((p) => p.tipo_producto === 'INSUMO');
  const terminados = productos.filter((p) => p.tipo_producto !== 'INSUMO');
  const grupos: GrupoProductos<P>[] = [];

  if (terminados.length > 0) grupos.push(armar('TERMINADOS', terminados));

  if (insumos.length > 0) {
    const grupo = armar('INSUMOS', insumos);
    // Con terminados a la vista, los insumos quedan plegados (salvo en Compra, donde todo se ve).
    grupo.abiertoPorDefecto = todoVisible || terminados.length === 0;
    grupos.push(grupo);
  }

  return grupos;
}

export type LineaJuego = {
  productoId: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  // Total de la línea (no por unidad), como se carga en el Mini-Juego.
  monto: number;
};

// Un producto repetido se suma a su línea: así el motor valida el stock sobre el total pedido.
export function sumarLinea(lineas: LineaJuego[], nueva: LineaJuego): LineaJuego[] {
  const indice = lineas.findIndex((l) => l.productoId === nueva.productoId);
  if (indice < 0) return [...lineas, nueva];
  return lineas.map((l, i) => (i === indice ? { ...l, cantidad: l.cantidad + nueva.cantidad, monto: l.monto + nueva.monto } : l));
}

export function reemplazarLinea(lineas: LineaJuego[], indice: number, nueva: LineaJuego): LineaJuego[] {
  const otraIgual = lineas.findIndex((l, i) => i !== indice && l.productoId === nueva.productoId);
  if (otraIgual < 0) return lineas.map((l, i) => (i === indice ? nueva : l));
  return sumarLinea(lineas.filter((_, i) => i !== indice), nueva);
}

export function totalLineas(lineas: LineaJuego[]): number {
  return Math.round(lineas.reduce((suma, l) => suma + l.monto, 0) * 100) / 100;
}

export function puedeAgregarLinea(lineas: LineaJuego[]): boolean {
  return lineas.length < MAX_LINEAS_JUEGO;
}

export function textoLinea(l: LineaJuego): string {
  return `${l.nombre} (${l.cantidad} ${l.unidad})`.replace(' )', ')');
}
