// lib/comprasPorTarjetas.ts
//
// En Compras, la lista de categorías mezclaba mercadería (categorías de producto, con stock) con bienes
// de uso (equipos, muebles, vehículos de la empresa). Las tarjetas separan primero "qué se compra":
// Mercadería (y dentro, Terminados o Insumos) o Bienes de uso. Piloto: solo la empresa demo, por pedido
// del dueño; para abrirlo a más empresas alcanza con sumar su id acá.

const EMPRESAS_CON_TARJETAS = new Set<string>(['c887a052-cbab-47f2-8ec7-a2102af43295']);

export function empresaUsaTarjetasDeCompra(empresaId: string | null | undefined): boolean {
  return Boolean(empresaId) && EMPRESAS_CON_TARJETAS.has(empresaId as string);
}

export type GrupoCompra = '' | 'MERCADERIA' | 'BIENES';
export type TipoMercaderia = '' | 'TERMINADO' | 'INSUMO';

export function grupoDeCategoria(stock: string | undefined): GrupoCompra {
  return stock === 'SI' ? 'MERCADERIA' : 'BIENES';
}

type ProductoLigero = { categoria: string | null; tipo_producto: string | null };

// Qué categorías se ofrecen según las tarjetas elegidas. Si ya hay una categoría cargada (se edita una
// operación), se muestran todas para no esconderla.
export function categoriasDeTarjeta(args: {
  categorias: string[];
  stockPorCategoria: Record<string, string>;
  productos: ProductoLigero[];
  grupo: GrupoCompra;
  tipo: TipoMercaderia;
  categoriaActual: string;
}): string[] {
  const { categorias, stockPorCategoria, productos, grupo, tipo, categoriaActual } = args;
  if (categoriaActual) return categorias;
  if (grupo === 'BIENES') return categorias.filter((c) => stockPorCategoria[c] !== 'SI');
  if (grupo === 'MERCADERIA' && tipo) {
    return categorias.filter(
      (c) => stockPorCategoria[c] === 'SI' && productos.some((p) => (p.categoria ?? '').toUpperCase() === c.toUpperCase() && p.tipo_producto === tipo)
    );
  }
  return [];
}
