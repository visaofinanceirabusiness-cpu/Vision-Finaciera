// lib/miLocalDatos.ts
//
// Acceso a datos de MI LOCAL. La parte pública (tienda y pedido) usa solo
// RPCs concedidas a `anon`; la administración usa tablas con RLS por empresa.
// La venta contable NO se hace sola al recibir un pedido: el comerciante la
// dispara a mano (registrarVentaDelPedido) y recién ahí pasa por el motor.

import { supabase } from './supabase';
import { registrarOperacion, generarIdOperacion, traerTodo } from './motor';
import { fechaLocalHoy } from './fecha';
import { agruparItemsPorCategoria, type EstadoPedido, type ItemVenta } from './miLocal';

export type Tienda = {
  empresa_id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  portada_url: string | null;
  whatsapp: string | null;
  activa: boolean;
};

export type Publicacion = {
  id: string;
  empresa_id: string;
  producto_id: string;
  titulo: string;
  descripcion: string | null;
  precio: number;
  foto_url: string | null;
  publicado: boolean;
  disponible: boolean;
  controla_stock: boolean;
  orden: number;
};

export type PedidoItem = { id: string; nombre: string; precio_unitario: number; cantidad: number; subtotal: number };

export type Pedido = {
  id: string;
  numero: number;
  estado: EstadoPedido;
  cliente_nombre: string;
  cliente_whatsapp: string;
  observaciones: string | null;
  subtotal: number;
  total: number;
  venta_estado: string;
  ids_operacion: string[];
  creado_en: string;
  mi_local_pedido_items: PedidoItem[];
};

export type TiendaPublica = {
  nombre: string;
  descripcion: string | null;
  portada_url: string | null;
  whatsapp: string | null;
  productos: { id: string; titulo: string; descripcion: string | null; precio: number; foto_url: string | null }[];
};

// ---------- público ----------

export async function cargarTiendaPublica(slug: string): Promise<TiendaPublica | null> {
  const { data, error } = await supabase.rpc('mi_local_tienda_publica', { p_slug: slug });
  if (error) throw error;
  return (data as TiendaPublica | null) ?? null;
}

export async function crearPedidoPublico(args: {
  slug: string;
  nombre: string;
  whatsapp: string;
  observaciones: string;
  items: { id: string; cantidad: number }[];
  clave: string;
}): Promise<{ numero: number; total: number }> {
  const { data, error } = await supabase.rpc('mi_local_crear_pedido', {
    p_slug: args.slug,
    p_nombre: args.nombre,
    p_whatsapp: args.whatsapp,
    p_observaciones: args.observaciones,
    p_items: args.items,
    p_clave: args.clave,
  });
  if (error) throw error;
  return data as { numero: number; total: number };
}

// ---------- administración ----------

export async function cargarMiTienda(empresaId: string): Promise<Tienda | null> {
  const { data, error } = await supabase.from('mi_local_tiendas').select('*').eq('empresa_id', empresaId).maybeSingle();
  if (error) throw error;
  return (data as Tienda | null) ?? null;
}

export async function guardarTienda(t: Omit<Tienda, 'activa'> & { activa: boolean }): Promise<void> {
  const { error } = await supabase.from('mi_local_tiendas').upsert({ ...t, actualizado_en: new Date().toISOString() }, { onConflict: 'empresa_id' });
  if (error?.code === '23505') throw new Error('ML_SLUG_EN_USO');
  if (error) throw error;
}

export async function listarPublicaciones(empresaId: string): Promise<Publicacion[]> {
  const { data, error } = await supabase.from('mi_local_publicaciones').select('*').eq('empresa_id', empresaId).order('orden').order('titulo');
  if (error) throw error;
  return (data ?? []) as Publicacion[];
}

export async function guardarPublicacion(p: Partial<Publicacion> & { empresa_id: string; producto_id: string; titulo: string; precio: number }): Promise<void> {
  const { error } = await supabase
    .from('mi_local_publicaciones')
    .upsert({ ...p, actualizado_en: new Date().toISOString() }, { onConflict: 'empresa_id,producto_id' });
  if (error) throw error;
}

export async function saldosStock(empresaId: string): Promise<Map<string, number>> {
  const { data } = await supabase.from('saldo_stock').select('producto_id, saldo').eq('empresa_id', empresaId);
  const m = new Map<string, number>();
  for (const f of data ?? []) m.set(f.producto_id as string, (m.get(f.producto_id as string) ?? 0) + Number(f.saldo ?? 0));
  return m;
}

// Mismo costo promedio ponderado que muestra Mercadería: entradas suman, salidas restan.
export async function costosPromedio(empresaId: string): Promise<Map<string, number>> {
  const movs = await traerTodo<{ producto_id: string; tipo: string; cantidad: number | string; costo_unitario: number | string | null }>((d, h) =>
    supabase.from('movimientos_stock').select('producto_id, tipo, cantidad, costo_unitario').eq('empresa_id', empresaId).order('id').range(d, h)
  );
  const acum = new Map<string, { cantidad: number; valor: number }>();
  for (const m of movs) {
    if (m.tipo !== 'ENTRADA' && m.tipo !== 'SALIDA') continue;
    const a = acum.get(m.producto_id) ?? { cantidad: 0, valor: 0 };
    const signo = m.tipo === 'ENTRADA' ? 1 : -1;
    a.cantidad += signo * Number(m.cantidad ?? 0);
    a.valor += signo * Number(m.cantidad ?? 0) * Number(m.costo_unitario ?? 0);
    acum.set(m.producto_id, a);
  }
  return new Map(Array.from(acum.entries()).map(([id, a]) => [id, a.cantidad > 0 ? a.valor / a.cantidad : 0]));
}

export async function listarPedidos(empresaId: string): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from('mi_local_pedidos')
    .select('id, numero, estado, cliente_nombre, cliente_whatsapp, observaciones, subtotal, total, venta_estado, ids_operacion, creado_en, mi_local_pedido_items(id, nombre, precio_unitario, cantidad, subtotal)')
    .eq('empresa_id', empresaId)
    .order('numero', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Pedido[];
}

export async function cambiarEstadoPedido(pedidoId: string, estado: EstadoPedido): Promise<void> {
  const { error } = await supabase.rpc('mi_local_cambiar_estado', { p_pedido: pedidoId, p_estado: estado });
  if (error) throw error;
}

// Contabiliza el pedido en el motor. Idempotente: el pedido se "reclama" en la
// base (bloqueo de 3 min, un solo registrador a la vez), cada id de operación
// se anota ANTES de registrarla, y al reintentar se salta lo que ya existe.
export async function registrarVentaDelPedido(args: { empresaId: string; pedidoId: string; formaPagoPorCategoria: Record<string, string>; fecha?: string }): Promise<string[]> {
  const { data: reclamo, error } = await supabase.rpc('mi_local_reclamar_venta', { p_pedido: args.pedidoId });
  if (error) throw error;

  const r = reclamo as { numero: number; ids_operacion: string[]; items: ItemVenta[]; cliente: string };
  const grupos = agruparItemsPorCategoria(r.items);
  const ids = [...(r.ids_operacion ?? [])];

  try {
    for (let i = 0; i < grupos.length; i++) {
      const grupo = grupos[i];
      if (!grupo.categoria) throw new Error('ML_SIN_CATEGORIA');

      let idOperacion = ids[i];
      if (!idOperacion) {
        idOperacion = await generarIdOperacion(args.empresaId);
        const { error: errorAnotar } = await supabase.rpc('mi_local_anotar_operacion', { p_pedido: args.pedidoId, p_id_operacion: idOperacion });
        if (errorAnotar) throw errorAnotar;
        ids[i] = idOperacion;
      }

      const { count } = await supabase.from('registro_operaciones').select('id', { count: 'exact', head: true }).eq('empresa_id', args.empresaId).eq('id_operacion', idOperacion);
      if ((count ?? 0) > 0) continue;

      const formaPago = args.formaPagoPorCategoria[grupo.categoria];
      if (!formaPago) throw new Error('ML_SIN_FORMA_PAGO');

      await registrarOperacion(
        args.empresaId,
        {
          fecha: args.fecha ?? fechaLocalHoy(),
          operacion: 'VENTA',
          categoria: grupo.categoria,
          formaPago,
          historico: `Mi Local #${r.numero} · ${grupo.categoria}`,
          clienteProveedor: r.cliente,
          lineas: grupo.items.map((it) => ({ producto: it.nombre, cantidad: it.cantidad, monto: Number(it.precio_unitario) })),
        },
        idOperacion
      );
    }
  } catch (e) {
    // Libera el bloqueo para reintentar; lo ya registrado queda anotado y no se duplica.
    await supabase.rpc('mi_local_liberar_venta', { p_pedido: args.pedidoId });
    throw e;
  }

  const { error: errorCerrar } = await supabase.rpc('mi_local_cerrar_venta', { p_pedido: args.pedidoId });
  if (errorCerrar) throw errorCerrar;
  return ids;
}

// ---------- fotos ----------

// Reduce la foto en el navegador (lado mayor 1200 px, JPEG) antes de subirla.
export async function subirFoto(empresaId: string, archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('ML_NO_IMAGEN');
  if (archivo.size > 15 * 1024 * 1024) throw new Error('ML_IMAGEN_GRANDE');
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('ML_IMAGEN'))), 'image/jpeg', 0.82));
  const ruta = `${empresaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('mi-local').upload(ruta, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from('mi-local').getPublicUrl(ruta).data.publicUrl;
}
