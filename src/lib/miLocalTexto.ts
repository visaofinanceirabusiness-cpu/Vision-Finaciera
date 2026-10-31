// lib/miLocalTexto.ts
//
// Textos y formatos de la TIENDA PÚBLICA de Mi Local (/loja/[slug]). La tienda se muestra en el idioma y la moneda de la
// empresa dueña (empresas.idioma / empresas.moneda, que la RPC mi_local_tienda_publica devuelve): quien compra no tiene
// sesión ni preferencia propia. Puro, sin acceso a datos.

import { simboloMoneda } from './moneda';

export type IdiomaTienda = 'ES' | 'PT';

export function idiomaDeTienda(valor: string | null | undefined): IdiomaTienda {
  return valor === 'ES' ? 'ES' : 'PT';
}

// Con ARS/USD se usa el separador de miles/decimales de cada país; BRL (o sin dato) sigue como siempre, coma decimal.
export function formatearPrecio(valor: number, moneda?: string | null): string {
  const v = Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  const local = moneda === 'ARS' ? 'es-AR' : 'pt-BR';
  return `${simboloMoneda(moneda)} ${v.toLocaleString(local, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type TextosTienda = {
  cargando: string;
  noEncontrada: string;
  noCarga: string;
  linkInexistente: string;
  pedidoRecibido: string;
  numeroPedido: string;
  total: string;
  contactoPronto: (tienda: string) => string;
  hablarTienda: string;
  volverTienda: string;
  sinProductos: string;
  verCarrito: (n: number, total: string) => string;
  tuCarrito: string;
  carritoVacio: string;
  cadaUno: string;
  disminuir: string;
  aumentar: string;
  quitar: string;
  seguirComprando: string;
  continuar: string;
  tusDatos: string;
  tuNombre: string;
  whatsappConArea: string;
  observaciones: string;
  volver: string;
  revisarPedido: string;
  revisaTuPedido: string;
  avisoPago: string;
  enviando: string;
  enviarPedido: string;
  cerrar: string;
  agregar: (total: string) => string;
  errNombre: string;
  errWhatsapp: string;
  errCarritoVacio: string;
  errLimite: string;
  errNoDisponible: string;
  errEnviar: string;
  descripcionPorDefecto: (tienda: string) => string;
  titulo404: string;
  localeOg: string;
};

const PT: TextosTienda = {
  cargando: 'Carregando…',
  noEncontrada: 'Loja não encontrada',
  noCarga: 'Não foi possível carregar a loja agora.',
  linkInexistente: 'Este link não existe ou a loja está fechada no momento.',
  pedidoRecibido: 'Pedido recebido!',
  numeroPedido: 'Número do pedido:',
  total: 'Total:',
  contactoPronto: (t) => `${t} vai entrar em contato pelo WhatsApp para confirmar. Nenhum pagamento foi feito agora.`,
  hablarTienda: 'Falar com a loja',
  volverTienda: 'Voltar à loja',
  sinProductos: 'Nenhum produto disponível no momento.',
  verCarrito: (n, t) => `🛒 Ver carrinho (${n}) · ${t}`,
  tuCarrito: 'Seu carrinho',
  carritoVacio: 'Carrinho vazio.',
  cadaUno: 'cada',
  disminuir: 'Diminuir',
  aumentar: 'Aumentar',
  quitar: 'Remover',
  seguirComprando: 'Continuar comprando',
  continuar: 'Continuar',
  tusDatos: 'Seus dados',
  tuNombre: 'Seu nome',
  whatsappConArea: 'WhatsApp',
  observaciones: 'Observações (opcional)',
  volver: 'Voltar',
  revisarPedido: 'Revisar pedido',
  revisaTuPedido: 'Revise seu pedido',
  avisoPago: 'O pedido será enviado à loja; o pagamento é combinado direto com ela.',
  enviando: 'Enviando…',
  enviarPedido: 'Enviar pedido',
  cerrar: 'Fechar',
  agregar: (t) => `Adicionar · ${t}`,
  errNombre: 'Informe seu nome.',
  errWhatsapp: 'Informe um WhatsApp válido: país, DDD e número.',
  errCarritoVacio: 'Seu carrinho está vazio.',
  errLimite: 'Muitos pedidos em pouco tempo. Tente novamente em alguns minutos.',
  errNoDisponible: 'Algum produto não está mais disponível. Atualize a página e revise o carrinho.',
  errEnviar: 'Não foi possível enviar o pedido. Tente novamente.',
  descripcionPorDefecto: (t) => `Conheça os produtos de ${t} e faça seu pedido online.`,
  titulo404: 'Loja',
  localeOg: 'pt_BR',
};

const ES: TextosTienda = {
  cargando: 'Cargando…',
  noEncontrada: 'Tienda no encontrada',
  noCarga: 'No se pudo cargar la tienda en este momento.',
  linkInexistente: 'Este link no existe o la tienda está cerrada por el momento.',
  pedidoRecibido: '¡Pedido recibido!',
  numeroPedido: 'Número de pedido:',
  total: 'Total:',
  contactoPronto: (t) => `${t} se va a comunicar con vos por WhatsApp para confirmar. Todavía no se realizó ningún pago.`,
  hablarTienda: 'Hablar con la tienda',
  volverTienda: 'Volver a la tienda',
  sinProductos: 'No hay productos disponibles por el momento.',
  verCarrito: (n, t) => `🛒 Ver carrito (${n}) · ${t}`,
  tuCarrito: 'Tu carrito',
  carritoVacio: 'Carrito vacío.',
  cadaUno: 'c/u',
  disminuir: 'Disminuir',
  aumentar: 'Aumentar',
  quitar: 'Quitar',
  seguirComprando: 'Seguir comprando',
  continuar: 'Continuar',
  tusDatos: 'Tus datos',
  tuNombre: 'Tu nombre',
  whatsappConArea: 'WhatsApp',
  observaciones: 'Observaciones (opcional)',
  volver: 'Volver',
  revisarPedido: 'Revisar pedido',
  revisaTuPedido: 'Revisá tu pedido',
  avisoPago: 'El pedido se envía a la tienda; el pago se acuerda directamente con ella.',
  enviando: 'Enviando…',
  enviarPedido: 'Enviar pedido',
  cerrar: 'Cerrar',
  agregar: (t) => `Agregar · ${t}`,
  errNombre: 'Ingresá tu nombre.',
  errWhatsapp: 'Ingresá un WhatsApp válido: país, característica y número.',
  errCarritoVacio: 'Tu carrito está vacío.',
  errLimite: 'Demasiados pedidos en poco tiempo. Probá de nuevo en unos minutos.',
  errNoDisponible: 'Algún producto ya no está disponible. Actualizá la página y revisá el carrito.',
  errEnviar: 'No se pudo enviar el pedido. Probá de nuevo.',
  descripcionPorDefecto: (t) => `Conocé los productos de ${t} y hacé tu pedido online.`,
  titulo404: 'Tienda',
  localeOg: 'es_AR',
};

export function textosTienda(idioma: IdiomaTienda): TextosTienda {
  return idioma === 'ES' ? ES : PT;
}
