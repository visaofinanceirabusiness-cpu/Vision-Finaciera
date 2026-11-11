// lib/whatsapp.ts
//
// Envío de comprobantes por WhatsApp a los CLIENTES del emprendedor
// (no confundir con las notificaciones push internas de la
// plataforma, ver lib/notificarPush.ts). No hay integración de
// WhatsApp Business API — es un enlace "wa.me" que abre WhatsApp con
// el mensaje ya armado; el emprendedor solo tiene que tocar Enviar.
// Reutiliza el mismo teléfono que ya se carga en Configurações
// (empresa) y en Recursos Humanos (cliente) — no hay un campo
// "WhatsApp" aparte.

import { supabase } from './supabase';

// Deja solo dígitos — wa.me no acepta "+", espacios ni guiones. El
// número debe incluir código de país (se le pide así al cargarlo).
export function telefonoParaWhatsapp(telefono: string): string {
  return telefono.replace(/\D/g, '');
}

export function empresaTieneTelefonoValido(telefono: string | null | undefined): boolean {
  return telefonoParaWhatsapp(telefono ?? '').length >= 8;
}

export function enlaceWhatsapp(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefonoParaWhatsapp(telefono)}?text=${encodeURIComponent(mensaje)}`;
}

export async function buscarTelefonoCliente(empresaId: string, nombreCliente: string): Promise<string | null> {
  if (!nombreCliente.trim()) return null;

  const { data } = await supabase
    .from('clientes')
    .select('telefono')
    .eq('empresa_id', empresaId)
    .eq('nombre', nombreCliente.trim())
    .maybeSingle();

  return data?.telefono?.trim() || null;
}

function fechaDisplay(fecha: string, idioma?: string | null): string {
  const [anio, mes, dia] = fecha.split('-');
  if (!anio || !mes || !dia) return fecha;
  // dd/mm/aaaa en ambos idiomas — es el formato de fecha, no texto a traducir.
  return `${dia}/${mes}/${anio}`;
}

// unitario/total null: operación anterior al detalle guardado con varios productos (no se sabe cuánto costó cada uno).
export type LineaComprobante = { cantidad: number; producto: string; unitario: number | null; total: number | null };

function numeroDisplay(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

export function armarMensajeComprobante(datos: {
  idioma?: string | null;
  nombreEmpresa: string;
  numeroComprobante: string;
  fecha: string;
  cliente: string;
  detalle: string;
  formaPago: string;
  total: number;
  simboloMoneda: string;
  // Detalle completo de la venta: cantidad, producto, precio por unidad y precio de la línea.
  lineas?: LineaComprobante[];
}): string {
  const esPT = datos.idioma === 'PT';
  const totalFormateado = `${datos.simboloMoneda} ${datos.total.toFixed(2)}`;
  const dinero = (n: number) => `${datos.simboloMoneda} ${n.toFixed(2)}`;
  const lineas = (datos.lineas ?? []).filter((l) => l.producto && l.cantidad > 0);
  const bloqueLineas = lineas.length
    ? [
        '',
        esPT ? '*Itens:*' : '*Detalle:*',
        ...lineas.map((l) => (l.unitario === null || l.total === null ? `• ${numeroDisplay(l.cantidad)} × ${l.producto}` : `• ${numeroDisplay(l.cantidad)} × ${l.producto} — ${dinero(l.unitario)} ${esPT ? 'cada' : 'c/u'} = ${dinero(l.total)}`)),
        '',
      ]
    : null;

  if (esPT) {
    return [
      `🧾 Comprovante #${datos.numeroComprobante} — ${datos.nombreEmpresa}`,
      `Data: ${fechaDisplay(datos.fecha, datos.idioma)}`,
      `Cliente: ${datos.cliente}`,
      ...(bloqueLineas ?? [`Detalhe: ${datos.detalle}`]),
      `Forma de pagamento: ${datos.formaPago}`,
      `Total: ${totalFormateado}`,
      '',
      'Obrigado pela preferência! 🙌',
    ].join('\n');
  }

  return [
    `🧾 Comprobante #${datos.numeroComprobante} — ${datos.nombreEmpresa}`,
    `Fecha: ${fechaDisplay(datos.fecha, datos.idioma)}`,
    `Cliente: ${datos.cliente}`,
    ...(bloqueLineas ?? [`Detalle: ${datos.detalle}`]),
    `Forma de pago: ${datos.formaPago}`,
    `Total: ${totalFormateado}`,
    '',
    '¡Gracias por tu compra! 🙌',
  ].join('\n');
}
