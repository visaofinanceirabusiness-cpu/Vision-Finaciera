// lib/miLocal.ts
//
// Lógica pura de MI LOCAL (tienda pública de una empresa): slug, formato
// R$, carrito y estados del pedido. Sin acceso a datos — lo que habla con
// Supabase vive en miLocalDatos.ts. Los totales que se muestran acá son
// solo informativos: el servidor (RPC mi_local_crear_pedido) vuelve a
// consultar los precios y calcula el total real.

export type EstadoPedido = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export const ESTADOS_PEDIDO: EstadoPedido[] = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

// Debe coincidir con mi_local_cambiar_estado en la base.
const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function transicionesValidas(estado: EstadoPedido): EstadoPedido[] {
  return TRANSICIONES[estado] ?? [];
}

export function puedeTransicionar(desde: EstadoPedido, hacia: EstadoPedido): boolean {
  return transicionesValidas(desde).includes(hacia);
}

// Solo un pedido ya confirmado (y no cancelado) puede convertirse en venta contable.
export function puedeRegistrarVenta(estado: EstadoPedido, ventaEstado: string): boolean {
  return (estado === 'confirmed' || estado === 'preparing' || estado === 'ready' || estado === 'delivered') && ventaEstado !== 'REGISTRADA';
}

export function etiquetaEstado(estado: EstadoPedido, esPT: boolean): string {
  const t: Record<EstadoPedido, [string, string]> = {
    pending: ['Pendiente', 'Pendente'],
    confirmed: ['Confirmado', 'Confirmado'],
    preparing: ['En preparación', 'Em preparação'],
    ready: ['Listo', 'Pronto'],
    delivered: ['Entregado', 'Entregue'],
    cancelled: ['Cancelado', 'Cancelado'],
  };
  return t[estado][esPT ? 1 : 0];
}

export const LIMITE_CANTIDAD_ITEM = 99;
export const LIMITE_ITEMS_PEDIDO = 30;

export function formatearReales(valor: number): string {
  const v = Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SLUG_RESERVADOS = new Set(['admin', 'api', 'login', 'demo', 'mi-local', 'loja']);

export function generarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function validarSlug(slug: string): string | null {
  if (slug.length < 3) return 'min3';
  if (slug.length > 40) return 'max40';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'formato';
  if (SLUG_RESERVADOS.has(slug)) return 'reservado';
  return null;
}

export function mensajeSlug(codigo: string, esPT: boolean): string {
  const m: Record<string, [string, string]> = {
    min3: ['Mínimo 3 caracteres.', 'Mínimo 3 caracteres.'],
    max40: ['Máximo 40 caracteres.', 'Máximo 40 caracteres.'],
    formato: ['Solo letras minúsculas, números y guiones (sin espacios).', 'Apenas letras minúsculas, números e hífens (sem espaços).'],
    reservado: ['Ese nombre está reservado, elegí otro.', 'Esse nome é reservado, escolha outro.'],
  };
  return (m[codigo] ?? m.formato)[esPT ? 1 : 0];
}

export function normalizarWhatsapp(texto: string): string {
  return texto.replace(/\D/g, '');
}

// 10-13 dígitos: DDD + número (con o sin 55).
export function whatsappValido(texto: string): boolean {
  const d = normalizarWhatsapp(texto);
  return d.length >= 10 && d.length <= 13;
}

export function urlWhatsapp(texto: string, mensaje?: string): string {
  let d = normalizarWhatsapp(texto);
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
}

export function rutaTienda(slug: string): string {
  return `/loja/${slug}`;
}

// ---------------- carrito ----------------

export type ItemCarrito = { id: string; titulo: string; precio: number; cantidad: number };

export function cantidadValida(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= LIMITE_CANTIDAD_ITEM;
}

export function agregarAlCarrito(carrito: ItemCarrito[], item: Omit<ItemCarrito, 'cantidad'>, cantidad: number): ItemCarrito[] {
  const existente = carrito.find((i) => i.id === item.id);
  const nuevaCantidad = Math.min(LIMITE_CANTIDAD_ITEM, (existente?.cantidad ?? 0) + Math.max(1, Math.floor(cantidad)));
  if (existente) return carrito.map((i) => (i.id === item.id ? { ...i, cantidad: nuevaCantidad } : i));
  if (carrito.length >= LIMITE_ITEMS_PEDIDO) return carrito;
  return [...carrito, { ...item, cantidad: nuevaCantidad }];
}

export function cambiarCantidad(carrito: ItemCarrito[], id: string, cantidad: number): ItemCarrito[] {
  if (cantidad <= 0) return quitarDelCarrito(carrito, id);
  return carrito.map((i) => (i.id === id ? { ...i, cantidad: Math.min(LIMITE_CANTIDAD_ITEM, Math.floor(cantidad)) } : i));
}

export function quitarDelCarrito(carrito: ItemCarrito[], id: string): ItemCarrito[] {
  return carrito.filter((i) => i.id !== id);
}

export function totalCarrito(carrito: ItemCarrito[]): number {
  const centavos = carrito.reduce((s, i) => s + Math.round(i.precio * 100) * i.cantidad, 0);
  return centavos / 100;
}

export function cantidadTotal(carrito: ItemCarrito[]): number {
  return carrito.reduce((s, i) => s + i.cantidad, 0);
}

export function validarPedido(nombre: string, whatsapp: string, carrito: ItemCarrito[]): string | null {
  if (carrito.length === 0) return 'carrito_vacio';
  if (nombre.trim().length < 2) return 'nombre';
  if (!whatsappValido(whatsapp)) return 'whatsapp';
  return null;
}

// ---------------- venta: agrupar items por categoría de producto ----------------

export type ItemVenta = { producto_id: string | null; categoria: string | null; cantidad: number; precio_unitario: number; nombre: string };

// El motor registra una VENTA por categoría de producto. El orden es
// determinista porque ids_operacion del pedido se corresponde por posición.
export function agruparItemsPorCategoria(items: ItemVenta[]): { categoria: string; items: ItemVenta[] }[] {
  const mapa = new Map<string, ItemVenta[]>();
  for (const it of items) {
    const clave = it.categoria ?? '';
    mapa.set(clave, [...(mapa.get(clave) ?? []), it]);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoria, lista]) => ({ categoria, items: lista }));
}

// Precio sugerido = costo + margen%, a centavos. Sin costo no hay base para sugerir: null.
export function precioConMargen(costo: number, margenPct: number): number | null {
  if (!(costo > 0) || !(margenPct >= 0) || !Number.isFinite(margenPct)) return null;
  return Math.round(costo * (1 + margenPct / 100) * 100) / 100;
}

// Catálogo agrupado por categoría (alfabético, "sin categoría" al final). Dentro de cada una:
// primero los que tienen saldo, de mayor a menor; después los sin saldo, por nombre.
export function agruparCatalogo<T extends { id: string; nombre: string; categoria: string | null }>(
  productos: T[],
  saldos: Map<string, number>
): { categoria: string; lista: T[] }[] {
  const mapa = new Map<string, T[]>();
  for (const p of productos) {
    const clave = p.categoria?.trim() || '';
    mapa.set(clave, [...(mapa.get(clave) ?? []), p]);
  }
  const saldo = (p: T) => saldos.get(p.id) ?? 0;
  return Array.from(mapa.entries())
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([categoria, lista]) => ({
      categoria,
      lista: [...lista].sort((x, y) => {
        const cx = saldo(x) > 0;
        const cy = saldo(y) > 0;
        if (cx !== cy) return cx ? -1 : 1;
        if (cx) return saldo(y) - saldo(x) || x.nombre.localeCompare(y.nombre);
        return x.nombre.localeCompare(y.nombre);
      }),
    }));
}
