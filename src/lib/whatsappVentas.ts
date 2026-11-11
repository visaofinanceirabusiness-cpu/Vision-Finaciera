// lib/whatsappVentas.ts
//
// WhatsApp como herramienta de la empresa: el comprobante que sale solo después de cada venta y la lista de ventas de /whatsapp.
// No hay WhatsApp Business API: todo es un enlace «wa.me» con el mensaje ya armado, y la persona toca «Enviar» dentro de WhatsApp.
// La parte pura (armar la lista) se prueba en whatsappVentas.test.ts; la lectura de la base va aparte.

import { supabase } from './supabase';
import { armarMensajeComprobante, type LineaComprobante, empresaTieneTelefonoValido, enlaceWhatsapp, telefonoParaWhatsapp } from './whatsapp';

export type ComprobanteListo = { cliente: string; telefono: string; mensaje: string; enlace: string };

export type VentaWhatsapp = {
  idOperacion: string;
  fecha: string;
  operacion: string;
  cliente: string;
  detalle: string;
  formaPago: string;
  total: number;
  telefono: string | null;
  lineas: LineaComprobante[];
};

type LineaGuardada = { p: string; c: number; u: number };

type FilaVenta = { id_operacion: string; fecha: string; operacion: string; cliente_proveedor: string | null; historico: string | null; forma_pago: string | null; total: number | string; parte?: number | null; lineas_detalle?: LineaGuardada[] | null };

// Un pago dividido tiene una fila por parte: la venta es una sola, con el total sumado y todos los medios.
export function agruparVentas(filas: FilaVenta[], telefonos: Map<string, string>, productos: Map<string, string> = new Map()): VentaWhatsapp[] {
  const porId = new Map<string, VentaWhatsapp & { _medios: string[] }>();

  for (const f of [...filas].sort((a, b) => (a.parte ?? 1) - (b.parte ?? 1))) {
    const previa = porId.get(f.id_operacion);
    if (previa) {
      previa.total += Number(f.total);
      if (f.forma_pago && !previa._medios.includes(f.forma_pago)) previa._medios.push(f.forma_pago);
      continue;
    }
    const cliente = (f.cliente_proveedor ?? '').trim();
    porId.set(f.id_operacion, {
      idOperacion: f.id_operacion,
      fecha: f.fecha,
      operacion: f.operacion,
      cliente,
      detalle: f.historico ?? '',
      formaPago: '',
      total: Number(f.total),
      telefono: telefonos.get(cliente) ?? null,
      lineas: (f.lineas_detalle ?? []).map((l) => ({ cantidad: Number(l.c), producto: productos.get(l.p) ?? l.p, unitario: Number(l.u), total: Number(l.c) * Number(l.u) })),
      _medios: f.forma_pago ? [f.forma_pago] : [],
    });
  }

  return [...porId.values()]
    .map(({ _medios, ...v }) => ({ ...v, formaPago: _medios.join(' + ') }))
    .sort((a, b) => (a.fecha === b.fecha ? b.idOperacion.localeCompare(a.idOperacion, undefined, { numeric: true }) : b.fecha.localeCompare(a.fecha)));
}

export function mensajeDeVenta(v: VentaWhatsapp, nombreEmpresa: string, idioma: string | null | undefined, simbolo: string): string {
  return armarMensajeComprobante({
    idioma,
    nombreEmpresa: nombreEmpresa || (idioma === 'PT' ? 'Meu Negócio' : 'Mi Negocio'),
    numeroComprobante: v.idOperacion,
    fecha: v.fecha,
    cliente: v.cliente,
    detalle: v.detalle || v.operacion,
    formaPago: v.formaPago,
    total: v.total,
    simboloMoneda: simbolo,
    lineas: v.lineas,
  });
}

// Chat sin mensaje armado: abre la conversación con el cliente para escribirle lo que quiera.
export function enlaceChat(telefono: string): string {
  return `https://wa.me/${telefonoParaWhatsapp(telefono)}`;
}

export async function telefonosDeClientes(empresaId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('clientes').select('nombre, telefono').eq('empresa_id', empresaId);
  if (error) throw error;
  const mapa = new Map<string, string>();
  for (const c of data ?? []) {
    if (c.nombre && empresaTieneTelefonoValido(c.telefono)) mapa.set((c.nombre as string).trim(), (c.telefono as string).trim());
  }
  return mapa;
}

async function nombresDeProductos(empresaId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from('productos').select('id, nombre').eq('empresa_id', empresaId);
  return new Map((data ?? []).map((p) => [p.id as string, p.nombre as string]));
}

export async function listarVentasWhatsapp(empresaId: string, desde: string | null): Promise<VentaWhatsapp[]> {
  let consulta = supabase
    .from('registro_operaciones')
    .select('id_operacion, fecha, operacion, cliente_proveedor, historico, forma_pago, total, parte, lineas_detalle')
    .eq('empresa_id', empresaId)
    .in('operacion', ['VENTA', 'COBRO'])
    .order('fecha', { ascending: false })
    .limit(1000);
  if (desde) consulta = consulta.gte('fecha', desde);

  const [{ data, error }, telefonos, productos] = await Promise.all([consulta, telefonosDeClientes(empresaId), nombresDeProductos(empresaId)]);
  if (error) throw error;
  return agruparVentas((data ?? []) as FilaVenta[], telefonos, productos);
}

// Comprobante recién generado de una venta o cobro: null si no hay cliente o no tiene teléfono cargado.
export async function prepararComprobante(
  empresaId: string,
  datos: { idioma: string | null | undefined; nombreEmpresa: string; simbolo: string; idOperacion: string; fecha: string; cliente: string; detalle: string; formaPago: string; total: number; lineas?: LineaComprobante[] }
): Promise<ComprobanteListo | null> {
  const cliente = datos.cliente.trim();
  if (!cliente) return null;
  const telefonos = await telefonosDeClientes(empresaId);
  const telefono = telefonos.get(cliente);
  if (!telefono) return null;

  const mensaje = mensajeDeVenta(
    { idOperacion: datos.idOperacion, fecha: datos.fecha, operacion: 'VENTA', cliente, detalle: datos.detalle, formaPago: datos.formaPago, total: datos.total, telefono, lineas: datos.lineas ?? [] },
    datos.nombreEmpresa,
    datos.idioma,
    datos.simbolo
  );
  return { cliente, telefono, mensaje, enlace: enlaceWhatsapp(telefono, mensaje) };
}

// Intenta abrir WhatsApp sin que la persona toque nada. Si el navegador lo bloquea (ventanas emergentes) devuelve false y el aviso
// muestra el botón de siempre.
export function abrirWhatsappAutomatico(enlace: string): boolean {
  try {
    const ventana = window.open(enlace, '_blank', 'noopener,noreferrer');
    return Boolean(ventana);
  } catch {
    return false;
  }
}

// Una sola venta/cobro por su número (Libro Diario): con el detalle completo y el teléfono del cliente, si lo tiene.
export async function ventaPorId(empresaId: string, idOperacion: string): Promise<VentaWhatsapp | null> {
  const [{ data, error }, telefonos, productos] = await Promise.all([
    supabase
      .from('registro_operaciones')
      .select('id_operacion, fecha, operacion, cliente_proveedor, historico, forma_pago, total, parte, lineas_detalle')
      .eq('empresa_id', empresaId)
      .eq('id_operacion', idOperacion),
    telefonosDeClientes(empresaId),
    nombresDeProductos(empresaId),
  ]);
  if (error) throw error;
  return agruparVentas((data ?? []) as FilaVenta[], telefonos, productos)[0] ?? null;
}
