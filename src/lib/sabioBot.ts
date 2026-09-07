// lib/sabioBot.ts
//
// EL SABIO BOT — motor de conversación para cargar una operación
// contestando un menú numerado, paso a paso (pensado para WhatsApp,
// pero la lógica es independiente del canal: hoy se prueba desde el
// simulador interno /sabio-bot, más adelante un webhook real de
// WhatsApp le pasaría el texto a esta misma función).
//
// Reutiliza matriz_operaciones como única fuente de verdad para los
// menús (operación → categoría → forma de pago) — los mismos datos
// que ya arman los <select> de Contabilidad — y llama a
// registrarOperacion (motor.ts) para grabar, así el bot nunca puede
// calcular distinto a la app.
//
// Las categorías con control de stock (productos) piden además qué
// producto y cuánta cantidad — igual que hace el <select> de producto
// en Contabilidad. La validación de que no se venda/pierda más
// cantidad de la que hay disponible, y de que ninguna cuenta quede
// con saldo negativo, NO está acá: vive en registrarOperacion
// (motor.ts) y corre igual sin importar quién la llame — así que el
// bot la hereda automáticamente, sin duplicar nada.
//
// Todavía no arma carritos de varias líneas: una operación = un solo
// producto (o un solo monto, si la categoría no maneja stock).

import { supabase } from './supabase';
import { registrarOperacion } from './motor';
import { fechaLocalHoy } from './fecha';
import { simboloMoneda, formatearNumeroEntero } from './moneda';

type Paso =
  | 'OPERACION'
  | 'CATEGORIA'
  | 'FORMA_PAGO'
  | 'CONTACTO'
  | 'PRODUCTO'
  | 'CANTIDAD'
  | 'PRECIO'
  | 'DETALLE'
  | 'CONFIRMAR';

type Datos = {
  esFamiliar?: boolean;
  simbolo?: string;
  operacion?: string;
  categoria?: string;
  formaPago?: string;
  contacto?: string;
  historico?: string;
  monto?: number;
  opciones?: string[];
  stockPorCategoria?: Record<string, string>;
  pidiendoContactoLibre?: boolean;
  esStock?: boolean;
  productoId?: string;
  productoNombre?: string;
  cantidad?: number;
  idsOpciones?: string[];
};

type Conversacion = {
  empresa_id: string;
  paso: Paso;
  datos: Datos;
};

const CANCELAR = new Set(['cancelar', '0', 'salir']);
const REINICIAR = new Set(['reiniciar', 'empezar', 'inicio']);

function numerarLista(items: string[]): string {
  return items.map((item, i) => `${i + 1}) ${item}`).join('\n');
}

function parseNumero(texto: string, cantidadOpciones: number): number | null {
  const n = parseInt(texto.trim(), 10);
  if (Number.isNaN(n) || n < 1 || n > cantidadOpciones) return null;
  return n;
}

async function obtenerConversacion(empresaId: string): Promise<Conversacion | null> {
  const { data } = await supabase
    .from('sabiobot_conversaciones')
    .select('empresa_id, paso, datos')
    .eq('empresa_id', empresaId)
    .maybeSingle();

  return (data as Conversacion | null) ?? null;
}

async function guardarConversacion(empresaId: string, paso: Paso, datos: Datos) {
  await supabase.from('sabiobot_conversaciones').upsert({
    empresa_id: empresaId,
    paso,
    datos,
    actualizado_en: new Date().toISOString(),
  });
}

async function borrarConversacion(empresaId: string) {
  await supabase.from('sabiobot_conversaciones').delete().eq('empresa_id', empresaId);
}

export async function iniciarConversacionSabioBot(empresaId: string): Promise<string> {
  return iniciar(empresaId);
}

async function iniciar(empresaId: string): Promise<string> {
  const [{ data: empresa }, { data: ops }] = await Promise.all([
    supabase.from('empresas').select('moneda, perfiles_empresa(codigo)').eq('id', empresaId).maybeSingle(),
    supabase.from('operaciones').select('nombre').eq('empresa_id', empresaId).eq('activo', true),
  ]);

  const esFamiliar =
    (empresa as unknown as { perfiles_empresa?: { codigo: string } | null } | null)?.perfiles_empresa?.codigo ===
    'FAMILIAR';

  const opciones = (ops ?? []).map((o) => o.nombre);

  const datos: Datos = {
    esFamiliar,
    simbolo: simboloMoneda(empresa?.moneda),
    opciones,
  };

  await guardarConversacion(empresaId, 'OPERACION', datos);

  return `🦉 ¡Hola! Soy el Sabio Bot. ¿Qué operación querés registrar?\n\n${numerarLista(opciones)}\n\n(Escribí "cancelar" en cualquier momento para salir)`;
}

async function pedirContactos(empresaId: string, operacion: string): Promise<string[]> {
  if (['VENTA', 'COBRO'].includes(operacion)) {
    const { data } = await supabase.from('clientes').select('nombre').eq('empresa_id', empresaId).limit(15);
    return (data ?? []).map((c) => c.nombre);
  }

  if (['COMPRA', 'PAGO'].includes(operacion)) {
    const { data } = await supabase.from('proveedores').select('nombre').eq('empresa_id', empresaId).limit(15);
    return (data ?? []).map((p) => p.nombre);
  }

  if (['INVERSION', 'EXTRACCION', 'PERDIDA'].includes(operacion)) {
    const { data } = await supabase.from('socios').select('nombre').eq('empresa_id', empresaId).eq('activo', true);
    return (data ?? []).map((s) => s.nombre);
  }

  return [];
}

// Punto de bifurcación común: después de resolver forma de pago y
// contacto, si la categoría maneja stock hay que elegir producto; si
// no, se pide directamente el detalle + monto en un solo mensaje.
async function avanzarAProductoODetalle(empresaId: string, datos: Datos): Promise<string> {
  if (!datos.esStock) {
    await guardarConversacion(empresaId, 'DETALLE', { ...datos, opciones: [] });
    return 'Contame el detalle y el monto, separados por coma.\nEj: "Uber al centro, 25"';
  }

  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, categoria')
    .eq('empresa_id', empresaId);

  const delaCategoria = (productos ?? []).filter(
    (p) => (p.categoria ?? '').toUpperCase() === (datos.categoria ?? '').toUpperCase()
  );

  if (delaCategoria.length === 0) {
    await guardarConversacion(empresaId, 'DETALLE', { ...datos, esStock: false, opciones: [] });
    return `No hay productos cargados en "${datos.categoria}" todavía. Contame el detalle y el monto, separados por coma.\nEj: "Uber al centro, 25"`;
  }

  const { data: saldos } = await supabase
    .from('saldo_stock')
    .select('producto_id, saldo')
    .eq('empresa_id', empresaId)
    .in('producto_id', delaCategoria.map((p) => p.id));

  const saldoPorProducto = Object.fromEntries((saldos ?? []).map((s) => [s.producto_id, Number(s.saldo ?? 0)]));
  const esSalida = datos.operacion === 'VENTA' || datos.operacion === 'PERDIDA';

  const opcionesTexto = delaCategoria.map(
    (p) => `${p.nombre}${esSalida ? ` (stock: ${saldoPorProducto[p.id] ?? 0})` : ''}`
  );

  await guardarConversacion(empresaId, 'PRODUCTO', {
    ...datos,
    opciones: opcionesTexto,
    idsOpciones: delaCategoria.map((p) => p.id),
  });

  return `¿Qué producto?\n\n${numerarLista(opcionesTexto)}`;
}

function etiquetaContacto(operacion: string): string {
  if (operacion === 'VENTA' || operacion === 'COBRO') return 'cliente';
  if (operacion === 'COMPRA' || operacion === 'PAGO') return 'proveedor';
  return 'socio/a';
}

export async function procesarMensajeSabioBot(empresaId: string, textoOriginal: string): Promise<string> {
  const texto = textoOriginal.trim();
  const textoNormalizado = texto.toLowerCase();

  if (REINICIAR.has(textoNormalizado)) {
    return iniciar(empresaId);
  }

  let conversacion = await obtenerConversacion(empresaId);

  if (!conversacion) {
    return iniciar(empresaId);
  }

  if (CANCELAR.has(textoNormalizado)) {
    await borrarConversacion(empresaId);
    return '❌ Operación cancelada. Escribí cualquier cosa para empezar de nuevo.';
  }

  const { paso, datos } = conversacion;

  // ---------------------------------------------------
  // 1. OPERACIÓN
  // ---------------------------------------------------
  if (paso === 'OPERACION') {
    const opciones = datos.opciones ?? [];
    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `No entendí. Elegí un número de la lista:\n\n${numerarLista(opciones)}`;
    }

    const operacion = opciones[n - 1];

    const { data: filasMatriz, error } = await supabase
      .from('matriz_operaciones')
      .select('categoria, stock')
      .eq('empresa_id', empresaId)
      .eq('operacion', operacion);

    if (error || !filasMatriz || filasMatriz.length === 0) {
      return `No encontré categorías configuradas para "${operacion}". Probá con otra operación o cargala desde la app.`;
    }

    const categorias = Array.from(new Set(filasMatriz.map((f) => f.categoria).filter(Boolean))) as string[];
    const stockPorCategoria = Object.fromEntries(filasMatriz.map((f) => [f.categoria, f.stock]));

    const nuevosDatos: Datos = { ...datos, operacion, opciones: categorias, stockPorCategoria };
    await guardarConversacion(empresaId, 'CATEGORIA', nuevosDatos);

    return `Categoría para ${operacion}:\n\n${numerarLista(categorias)}`;
  }

  // ---------------------------------------------------
  // 2. CATEGORÍA
  // ---------------------------------------------------
  if (paso === 'CATEGORIA') {
    const opciones = datos.opciones ?? [];
    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `No entendí. Elegí un número:\n\n${numerarLista(opciones)}`;
    }

    const categoria = opciones[n - 1];
    const esStock = datos.stockPorCategoria?.[categoria] === 'SI';

    const { data: filasFormaPago } = await supabase
      .from('matriz_operaciones')
      .select('forma_pago')
      .eq('empresa_id', empresaId)
      .eq('operacion', datos.operacion ?? '')
      .eq('categoria', categoria);

    const formasPago = Array.from(new Set((filasFormaPago ?? []).map((f) => f.forma_pago).filter(Boolean))) as string[];

    if (formasPago.length === 0) {
      return `No encontré formas de pago para esa categoría. Escribí "cancelar" y probá de nuevo.`;
    }

    const nuevosDatos: Datos = { ...datos, categoria, esStock, opciones: formasPago };
    await guardarConversacion(empresaId, 'FORMA_PAGO', nuevosDatos);

    return `Forma de pago:\n\n${numerarLista(formasPago)}`;
  }

  // ---------------------------------------------------
  // 3. FORMA DE PAGO
  // ---------------------------------------------------
  if (paso === 'FORMA_PAGO') {
    const opciones = datos.opciones ?? [];
    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `No entendí. Elegí un número:\n\n${numerarLista(opciones)}`;
    }

    const formaPago = opciones[n - 1];
    const operacion = datos.operacion ?? '';
    const esTransferencia = operacion === 'TRANSFERENCIA';

    if (esTransferencia || datos.esFamiliar) {
      return avanzarAProductoODetalle(empresaId, { ...datos, formaPago });
    }

    const contactos = await pedirContactos(empresaId, operacion);
    const etiqueta = etiquetaContacto(operacion);

    if (contactos.length === 0) {
      const nuevosDatos: Datos = { ...datos, formaPago, opciones: [], pidiendoContactoLibre: true };
      await guardarConversacion(empresaId, 'CONTACTO', nuevosDatos);
      return `¿Cuál es el nombre del/de la ${etiqueta}?`;
    }

    const nuevosDatos: Datos = { ...datos, formaPago, opciones: contactos };
    await guardarConversacion(empresaId, 'CONTACTO', nuevosDatos);

    return `¿${etiqueta === 'cliente' ? 'Cliente' : etiqueta === 'proveedor' ? 'Proveedor' : 'Socio/a'}?\n\n${numerarLista(contactos)}\n\n0) Escribir otro nombre`;
  }

  // ---------------------------------------------------
  // 4. CONTACTO (cliente/proveedor/socio)
  // ---------------------------------------------------
  if (paso === 'CONTACTO') {
    if (datos.pidiendoContactoLibre) {
      return avanzarAProductoODetalle(empresaId, { ...datos, contacto: texto, pidiendoContactoLibre: false });
    }

    const opciones = datos.opciones ?? [];

    if (texto === '0') {
      const nuevosDatos: Datos = { ...datos, pidiendoContactoLibre: true };
      await guardarConversacion(empresaId, 'CONTACTO', nuevosDatos);
      return '¿Cuál es el nombre?';
    }

    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `No entendí. Elegí un número de la lista, o "0" para escribir otro nombre:\n\n${numerarLista(opciones)}`;
    }

    return avanzarAProductoODetalle(empresaId, { ...datos, contacto: opciones[n - 1] });
  }

  // ---------------------------------------------------
  // 4.b PRODUCTO (solo categorías con stock)
  // ---------------------------------------------------
  if (paso === 'PRODUCTO') {
    const opciones = datos.opciones ?? [];
    const ids = datos.idsOpciones ?? [];
    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `No entendí. Elegí un número:\n\n${numerarLista(opciones)}`;
    }

    const nuevosDatos: Datos = {
      ...datos,
      productoId: ids[n - 1],
      productoNombre: opciones[n - 1].replace(/\s*\(stock:.*\)$/, ''),
      opciones: [],
    };
    await guardarConversacion(empresaId, 'CANTIDAD', nuevosDatos);

    return '¿Cuántas unidades?';
  }

  // ---------------------------------------------------
  // 4.c CANTIDAD (solo categorías con stock)
  // ---------------------------------------------------
  if (paso === 'CANTIDAD') {
    const cantidad = Number(texto.replace(',', '.'));

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return 'No entendí. Escribí solo el número de unidades (ej: 2).';
    }

    const nuevosDatos: Datos = { ...datos, cantidad };
    await guardarConversacion(empresaId, 'PRECIO', nuevosDatos);

    return `¿A qué precio unitario (por unidad)?`;
  }

  // ---------------------------------------------------
  // 4.d PRECIO UNITARIO (solo categorías con stock)
  // ---------------------------------------------------
  if (paso === 'PRECIO') {
    const monto = Number(texto.replace(',', '.'));

    if (!Number.isFinite(monto) || monto <= 0) {
      return 'No entendí el precio. Escribí solo el número (ej: 5.50).';
    }

    const nuevosDatos: Datos = { ...datos, monto, historico: datos.productoNombre };
    await guardarConversacion(empresaId, 'CONFIRMAR', nuevosDatos);

    const simbolo = datos.simbolo ?? 'R$';
    const total = (datos.cantidad ?? 1) * monto;
    const contactoLinea = datos.contacto
      ? `\n${etiquetaContacto(datos.operacion ?? '')[0].toUpperCase()}${etiquetaContacto(datos.operacion ?? '').slice(1)}: ${datos.contacto}`
      : '';

    return (
      `Confirmá los datos:\n\n` +
      `Operación: ${datos.operacion}\n` +
      `Categoría: ${datos.categoria}\n` +
      `Forma de pago: ${datos.formaPago}${contactoLinea}\n` +
      `Producto: ${datos.productoNombre} x${datos.cantidad}\n` +
      `Precio unitario: ${simbolo} ${formatearNumeroEntero(monto)}\n` +
      `Total: ${simbolo} ${formatearNumeroEntero(total)}\n\n` +
      `1) Confirmar\n2) Cancelar`
    );
  }

  // ---------------------------------------------------
  // 5. DETALLE + MONTO
  // ---------------------------------------------------
  if (paso === 'DETALLE') {
    const ultimaComa = texto.lastIndexOf(',');

    if (ultimaComa === -1) {
      return 'No entendí. Escribí el detalle y el monto separados por coma. Ej: "Uber al centro, 25"';
    }

    const detalle = texto.slice(0, ultimaComa).trim();
    const montoTexto = texto.slice(ultimaComa + 1).trim().replace(',', '.');
    const monto = Number(montoTexto);

    if (!detalle || !Number.isFinite(monto) || monto <= 0) {
      return 'No entendí el monto. Escribí el detalle y el monto separados por coma. Ej: "Uber al centro, 25"';
    }

    const nuevosDatos: Datos = { ...datos, historico: detalle, monto };
    await guardarConversacion(empresaId, 'CONFIRMAR', nuevosDatos);

    const simbolo = datos.simbolo ?? 'R$';
    const contactoLinea = datos.contacto ? `\n${etiquetaContacto(datos.operacion ?? '')[0].toUpperCase()}${etiquetaContacto(datos.operacion ?? '').slice(1)}: ${datos.contacto}` : '';

    return (
      `Confirmá los datos:\n\n` +
      `Operación: ${datos.operacion}\n` +
      `Categoría: ${datos.categoria}\n` +
      `Forma de pago: ${datos.formaPago}${contactoLinea}\n` +
      `Detalle: ${detalle}\n` +
      `Monto: ${simbolo} ${formatearNumeroEntero(monto)}\n\n` +
      `1) Confirmar\n2) Cancelar`
    );
  }

  // ---------------------------------------------------
  // 6. CONFIRMAR
  // ---------------------------------------------------
  if (paso === 'CONFIRMAR') {
    if (texto === '2') {
      await borrarConversacion(empresaId);
      return '❌ Operación cancelada. Escribí cualquier cosa para empezar de nuevo.';
    }

    if (texto !== '1') {
      return 'Respondé "1" para confirmar o "2" para cancelar.';
    }

    try {
      const lineas = datos.esStock
        ? [{ producto: datos.productoId ?? '', cantidad: datos.cantidad ?? 1, monto: datos.monto ?? 0 }]
        : [{ producto: datos.historico ?? '', cantidad: 1, monto: datos.monto ?? 0 }];

      const resultado = await registrarOperacion(empresaId, {
        fecha: fechaLocalHoy(),
        operacion: datos.operacion ?? '',
        categoria: datos.categoria ?? '',
        formaPago: datos.formaPago ?? '',
        historico: datos.historico ?? '',
        clienteProveedor: datos.contacto ?? '',
        socio: '',
        lineas,
      });

      await borrarConversacion(empresaId);

      return `✅ ¡Listo! Registré ${resultado.idOperacion}. Escribí cualquier cosa para cargar otra operación.`;
    } catch (errorRegistrar) {
      await borrarConversacion(empresaId);
      return `⚠️ No se pudo registrar: ${(errorRegistrar as Error).message}\n\nEscribí cualquier cosa para volver a intentar.`;
    }
  }

  // Estado desconocido (no debería pasar) — reinicia limpio.
  return iniciar(empresaId);
}
