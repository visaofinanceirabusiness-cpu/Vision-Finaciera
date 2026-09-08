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
//
// Idioma: el texto del bot se traduce con la misma lógica que ya usa
// el resto de la app (empresas.idioma). Los nombres de categoría,
// forma de pago, producto y contacto son datos que el usuario ya
// cargó en su idioma (o vienen del plan maestro) y NUNCA se
// traducen acá — mismo criterio que el formulario web (ver
// lib/i18n.ts). Lo único que sí tiene traducción propia es el
// nombre de la operación (VENTA/COBRO/etc.), vía
// nombreOperacionDisplay, igual que en Contabilidad.

import { supabase } from './supabase';
import { registrarOperacion } from './motor';
import { fechaLocalHoy } from './fecha';
import { simboloMoneda, formatearNumeroEntero } from './moneda';
import { saldoDeFormaDePago } from './saldoCuenta';
import { nombreOperacionDisplay } from './i18n';
import { crearOUsarClientePorTelefono } from './clientes';

type Paso =
  | 'OPERACION'
  | 'CATEGORIA'
  | 'FORMA_PAGO'
  | 'CONTACTO'
  | 'CONTACTO_TELEFONO'
  | 'PRODUCTO'
  | 'CANTIDAD'
  | 'PRECIO'
  | 'DETALLE'
  | 'CONFIRMAR';

type Datos = {
  idioma?: string;
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
  // Nombre del cliente nuevo, mientras se espera el teléfono (paso
  // CONTACTO_TELEFONO) — solo se usa para Venta/Cobro, igual que el
  // modal "Nuevo cliente" de Contabilidad (ver avanzarAContactoNuevo).
  contactoNombreNuevo?: string;
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

const CANCELAR = new Set(['cancelar', '0', 'salir', 'sair']);
const REINICIAR = new Set(['reiniciar', 'empezar', 'inicio', 'começar', 'início']);

// Traducción mínima del texto propio del bot (no de datos del
// usuario) — mismo criterio que crearTraductor de lib/i18n, pero acá
// alcanza con un helper chico porque son mensajes sueltos, no un
// diccionario de pantalla.
function t(idioma: string | undefined, es: string, pt: string): string {
  return idioma === 'PT' ? pt : es;
}

// Solo Venta/Cobro dan de alta un cliente nuevo pidiendo también el
// teléfono (igual que el modal "Nuevo cliente" de Contabilidad, para
// poder mandarle el comprobante por WhatsApp después) — Compra/Pago
// (proveedor) y el resto (socio) siguen con nombre libre nomás, sin
// pedir teléfono, igual que antes.
function esContactoCliente(operacion: string): boolean {
  return operacion === 'VENTA' || operacion === 'COBRO';
}

function etiquetaContacto(idioma: string | undefined, operacion: string): string {
  if (operacion === 'VENTA' || operacion === 'COBRO') return t(idioma, 'cliente', 'cliente');
  if (operacion === 'COMPRA' || operacion === 'PAGO') return t(idioma, 'proveedor', 'fornecedor');
  return t(idioma, 'socio/a', 'sócio(a)');
}

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
    supabase.from('empresas').select('moneda, idioma, perfiles_empresa(codigo)').eq('id', empresaId).maybeSingle(),
    supabase.from('operaciones').select('nombre').eq('empresa_id', empresaId).eq('activo', true),
  ]);

  const esFamiliar =
    (empresa as unknown as { perfiles_empresa?: { codigo: string } | null } | null)?.perfiles_empresa?.codigo ===
    'FAMILIAR';

  const idioma = empresa?.idioma ?? 'ES';
  const opciones = (ops ?? []).map((o) => o.nombre);
  const opcionesDisplay = opciones.map((o) => nombreOperacionDisplay(idioma, o));

  const datos: Datos = {
    idioma,
    esFamiliar,
    simbolo: simboloMoneda(empresa?.moneda),
    opciones,
  };

  await guardarConversacion(empresaId, 'OPERACION', datos);

  return `🦉 ${t(idioma, '¡Hola! Soy el Sabio Bot. ¿Qué operación querés registrar?', 'Olá! Eu sou o Sabio Bot. Qual operação você quer registrar?')}\n\n${numerarLista(opcionesDisplay)}\n\n${t(idioma, '(Escribí "cancelar" en cualquier momento para salir)', '(Digite "cancelar" a qualquer momento para sair)')}`;
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
  const idioma = datos.idioma;

  if (!datos.esStock) {
    await guardarConversacion(empresaId, 'DETALLE', { ...datos, opciones: [] });
    return t(
      idioma,
      'Contame el detalle y el monto, separados por coma.\nEj: "Uber al centro, 25"',
      'Me conte o detalhe e o valor, separados por vírgula.\nEx: "Uber para o centro, 25"'
    );
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
    return t(
      idioma,
      `No hay productos cargados en "${datos.categoria}" todavía. Contame el detalle y el monto, separados por coma.\nEj: "Uber al centro, 25"`,
      `Ainda não há produtos cadastrados em "${datos.categoria}". Me conte o detalhe e o valor, separados por vírgula.\nEx: "Uber para o centro, 25"`
    );
  }

  const { data: saldos } = await supabase
    .from('saldo_stock')
    .select('producto_id, saldo')
    .eq('empresa_id', empresaId)
    .in('producto_id', delaCategoria.map((p) => p.id));

  const saldoPorProducto = Object.fromEntries((saldos ?? []).map((s) => [s.producto_id, Number(s.saldo ?? 0)]));
  const esSalida = datos.operacion === 'VENTA' || datos.operacion === 'PERDIDA';

  const opcionesTexto = delaCategoria.map(
    (p) => `${p.nombre}${esSalida ? ` (${t(idioma, 'stock', 'estoque')}: ${saldoPorProducto[p.id] ?? 0})` : ''}`
  );

  await guardarConversacion(empresaId, 'PRODUCTO', {
    ...datos,
    opciones: opcionesTexto,
    idsOpciones: delaCategoria.map((p) => p.id),
  });

  return `${t(idioma, '¿Qué producto?', 'Qual produto?')}\n\n${numerarLista(opcionesTexto)}`;
}

// Línea de saldo en vivo (mismo cálculo que ya usa registrarOperacion
// para bloquear una operación que dejaría la cuenta en negativo) —
// igual que se muestra el stock al elegir un producto. Devuelve '' si
// esa forma de pago no tiene una cuenta detrás (ej. no es un medio
// financiero real).
async function lineaSaldo(empresaId: string, nombreFormaPago: string, simbolo: string, idioma: string | undefined): Promise<string> {
  const resultado = await saldoDeFormaDePago(empresaId, nombreFormaPago, fechaLocalHoy());
  if (!resultado) return '';
  return `\n💰 ${t(idioma, `Saldo en ${resultado.cuenta} hoy`, `Saldo em ${resultado.cuenta} hoje`)}: ${simbolo} ${formatearNumeroEntero(resultado.saldo)}`;
}

// En el resumen final, Transferencia usa "Hacia/Desde" en vez de
// "Categoría/Forma de pago" — mismo criterio que el título de cada
// paso (ver arriba) y que el formulario web.
function etiquetaCategoria(idioma: string | undefined, operacion?: string): string {
  return operacion === 'TRANSFERENCIA' ? t(idioma, 'Hacia', 'Para') : t(idioma, 'Categoría', 'Categoria');
}

function etiquetaFormaPago(idioma: string | undefined, operacion?: string): string {
  return operacion === 'TRANSFERENCIA' ? t(idioma, 'Desde', 'De') : t(idioma, 'Forma de pago', 'Forma de pagamento');
}

export async function procesarMensajeSabioBot(empresaId: string, textoOriginal: string): Promise<string> {
  const texto = textoOriginal.trim();
  const textoNormalizado = texto.toLowerCase();

  if (REINICIAR.has(textoNormalizado)) {
    return iniciar(empresaId);
  }

  const conversacion = await obtenerConversacion(empresaId);

  if (!conversacion) {
    return iniciar(empresaId);
  }

  const { paso, datos } = conversacion;
  const idioma = datos.idioma;

  if (CANCELAR.has(textoNormalizado)) {
    await borrarConversacion(empresaId);
    return t(
      idioma,
      '❌ Operación cancelada. Escribí cualquier cosa para empezar de nuevo.',
      '❌ Operação cancelada. Digite qualquer coisa para começar de novo.'
    );
  }

  // ---------------------------------------------------
  // 1. OPERACIÓN
  // ---------------------------------------------------
  if (paso === 'OPERACION') {
    const opciones = datos.opciones ?? [];
    const opcionesDisplay = opciones.map((o) => nombreOperacionDisplay(idioma, o));
    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `${t(idioma, 'No entendí. Elegí un número de la lista:', 'Não entendi. Escolha um número da lista:')}\n\n${numerarLista(opcionesDisplay)}`;
    }

    const operacion = opciones[n - 1];

    const { data: filasMatriz, error } = await supabase
      .from('matriz_operaciones')
      .select('categoria, stock')
      .eq('empresa_id', empresaId)
      .eq('operacion', operacion);

    if (error || !filasMatriz || filasMatriz.length === 0) {
      return t(
        idioma,
        `No encontré categorías configuradas para "${nombreOperacionDisplay(idioma, operacion)}". Probá con otra operación o cargala desde la app.`,
        `Não encontrei categorias configuradas para "${nombreOperacionDisplay(idioma, operacion)}". Tente outra operação ou cadastre pelo aplicativo.`
      );
    }

    const categorias = Array.from(new Set(filasMatriz.map((f) => f.categoria).filter(Boolean))) as string[];
    const stockPorCategoria = Object.fromEntries(filasMatriz.map((f) => [f.categoria, f.stock]));

    const nuevosDatos: Datos = { ...datos, operacion, opciones: categorias, stockPorCategoria };
    await guardarConversacion(empresaId, 'CATEGORIA', nuevosDatos);

    // En Transferencia no hay "categoría" en el sentido habitual —
    // esto es la cuenta DESTINO (a dónde va la plata), no un rubro de
    // gasto/ingreso. Usa el mismo lenguaje "Hacia/Desde" que ya usa
    // el formulario web, para no confundir con la operación
    // "Transferencia" en sí.
    const titulo =
      operacion === 'TRANSFERENCIA'
        ? t(idioma, '¿Hacia qué cuenta transferís?', 'Para qual conta você quer transferir?')
        : t(idioma, `Categoría para ${nombreOperacionDisplay(idioma, operacion)}:`, `Categoria para ${nombreOperacionDisplay(idioma, operacion)}:`);

    return `${titulo}\n\n${numerarLista(categorias)}`;
  }

  // ---------------------------------------------------
  // 2. CATEGORÍA
  // ---------------------------------------------------
  if (paso === 'CATEGORIA') {
    const opciones = datos.opciones ?? [];
    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `${t(idioma, 'No entendí. Elegí un número:', 'Não entendi. Escolha um número:')}\n\n${numerarLista(opciones)}`;
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
      return t(
        idioma,
        `No encontré formas de pago para esa categoría. Escribí "cancelar" y probá de nuevo.`,
        `Não encontrei formas de pagamento para essa categoria. Digite "cancelar" e tente de novo.`
      );
    }

    const nuevosDatos: Datos = { ...datos, categoria, esStock, opciones: formasPago };
    await guardarConversacion(empresaId, 'FORMA_PAGO', nuevosDatos);

    // En Transferencia, "categoría" es la cuenta destino — mostrar su
    // saldo acá (si tiene una cuenta real detrás; Plazo Fijo/
    // Inversiones no la tienen y simplemente no agrega nada).
    const esTransferenciaCategoria = datos.operacion === 'TRANSFERENCIA';
    const saldoDestino = esTransferenciaCategoria
      ? await lineaSaldo(empresaId, categoria, datos.simbolo ?? 'R$', idioma)
      : '';
    const tituloFormaPago = esTransferenciaCategoria
      ? t(idioma, '¿Desde qué cuenta sale la plata?', 'De qual conta sai o dinheiro?')
      : t(idioma, 'Forma de pago:', 'Forma de pagamento:');

    return `${tituloFormaPago}\n\n${numerarLista(formasPago)}${saldoDestino}`;
  }

  // ---------------------------------------------------
  // 3. FORMA DE PAGO
  // ---------------------------------------------------
  if (paso === 'FORMA_PAGO') {
    const opciones = datos.opciones ?? [];
    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `${t(idioma, 'No entendí. Elegí un número:', 'Não entendi. Escolha um número:')}\n\n${numerarLista(opciones)}`;
    }

    const formaPago = opciones[n - 1];
    const operacion = datos.operacion ?? '';
    const esTransferencia = operacion === 'TRANSFERENCIA';

    const saldoOrigen =
      operacion === 'PAGO' || operacion === 'COMPRA' || esTransferencia
        ? await lineaSaldo(empresaId, formaPago, datos.simbolo ?? 'R$', idioma)
        : '';

    if (esTransferencia || datos.esFamiliar) {
      const siguiente = await avanzarAProductoODetalle(empresaId, { ...datos, formaPago });
      return `${siguiente}${saldoOrigen}`;
    }

    const contactos = await pedirContactos(empresaId, operacion);
    const etiqueta = etiquetaContacto(idioma, operacion);

    if (contactos.length === 0) {
      const nuevosDatos: Datos = { ...datos, formaPago, opciones: [], pidiendoContactoLibre: true };
      await guardarConversacion(empresaId, 'CONTACTO', nuevosDatos);
      return `${t(idioma, `¿Cuál es el nombre del/de la ${etiqueta}?`, `Qual é o nome do(a) ${etiqueta}?`)}${saldoOrigen}`;
    }

    const nuevosDatos: Datos = { ...datos, formaPago, opciones: contactos };
    await guardarConversacion(empresaId, 'CONTACTO', nuevosDatos);

    const etiquetaTitulo = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);

    return `${t(idioma, `¿${etiquetaTitulo}?`, `${etiquetaTitulo}?`)}\n\n${numerarLista(contactos)}\n\n${t(idioma, '0) Escribir otro nombre', '0) Digitar outro nome')}${saldoOrigen}`;
  }

  // ---------------------------------------------------
  // 4. CONTACTO (cliente/proveedor/socio)
  // ---------------------------------------------------
  if (paso === 'CONTACTO') {
    if (datos.pidiendoContactoLibre) {
      // Venta/Cobro: dar de alta el cliente de verdad (nombre +
      // teléfono), igual que "Nuevo cliente" en Contabilidad — no
      // alcanza con guardar el nombre suelto como texto libre.
      if (esContactoCliente(datos.operacion ?? '')) {
        const nuevosDatos: Datos = { ...datos, pidiendoContactoLibre: false, contactoNombreNuevo: texto };
        await guardarConversacion(empresaId, 'CONTACTO_TELEFONO', nuevosDatos);
        return t(idioma, '¿Cuál es el teléfono (con código de país)? Ej: +54 9 11 2233-4455', 'Qual é o telefone (com código do país)? Ex: +55 48 99999-9999');
      }

      return avanzarAProductoODetalle(empresaId, { ...datos, contacto: texto, pidiendoContactoLibre: false });
    }

    const opciones = datos.opciones ?? [];

    if (texto === '0') {
      const nuevosDatos: Datos = { ...datos, pidiendoContactoLibre: true };
      await guardarConversacion(empresaId, 'CONTACTO', nuevosDatos);
      return t(idioma, '¿Cuál es el nombre?', 'Qual é o nome?');
    }

    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `${t(idioma, 'No entendí. Elegí un número de la lista, o "0" para escribir otro nombre:', 'Não entendi. Escolha um número da lista, ou "0" para digitar outro nome:')}\n\n${numerarLista(opciones)}`;
    }

    return avanzarAProductoODetalle(empresaId, { ...datos, contacto: opciones[n - 1] });
  }

  // ---------------------------------------------------
  // 4.a CONTACTO_TELEFONO (solo Venta/Cobro, cliente nuevo)
  // ---------------------------------------------------
  if (paso === 'CONTACTO_TELEFONO') {
    try {
      const cliente = await crearOUsarClientePorTelefono(empresaId, datos.contactoNombreNuevo ?? '', texto);
      return avanzarAProductoODetalle(empresaId, { ...datos, contacto: cliente.nombre, contactoNombreNuevo: undefined });
    } catch (errorTelefono) {
      return t(
        idioma,
        `No pude registrar el teléfono: ${(errorTelefono as Error).message}\n\nProbá de nuevo.`,
        `Não consegui registrar o telefone: ${(errorTelefono as Error).message}\n\nTente de novo.`
      );
    }
  }

  // ---------------------------------------------------
  // 4.b PRODUCTO (solo categorías con stock)
  // ---------------------------------------------------
  if (paso === 'PRODUCTO') {
    const opciones = datos.opciones ?? [];
    const ids = datos.idsOpciones ?? [];
    const n = parseNumero(texto, opciones.length);

    if (n === null) {
      return `${t(idioma, 'No entendí. Elegí un número:', 'Não entendi. Escolha um número:')}\n\n${numerarLista(opciones)}`;
    }

    const nuevosDatos: Datos = {
      ...datos,
      productoId: ids[n - 1],
      productoNombre: opciones[n - 1].replace(/\s*\((stock|estoque):.*\)$/, ''),
      opciones: [],
    };
    await guardarConversacion(empresaId, 'CANTIDAD', nuevosDatos);

    return t(idioma, '¿Cuántas unidades?', 'Quantas unidades?');
  }

  // ---------------------------------------------------
  // 4.c CANTIDAD (solo categorías con stock)
  // ---------------------------------------------------
  if (paso === 'CANTIDAD') {
    const cantidad = Number(texto.replace(',', '.'));

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return t(idioma, 'No entendí. Escribí solo el número de unidades (ej: 2).', 'Não entendi. Digite só o número de unidades (ex: 2).');
    }

    const nuevosDatos: Datos = { ...datos, cantidad };
    await guardarConversacion(empresaId, 'PRECIO', nuevosDatos);

    return t(idioma, '¿A qué precio unitario (por unidad)?', 'Qual o preço unitário (por unidade)?');
  }

  // ---------------------------------------------------
  // 4.d PRECIO UNITARIO (solo categorías con stock)
  // ---------------------------------------------------
  if (paso === 'PRECIO') {
    const monto = Number(texto.replace(',', '.'));

    if (!Number.isFinite(monto) || monto <= 0) {
      return t(idioma, 'No entendí el precio. Escribí solo el número (ej: 5.50).', 'Não entendi o preço. Digite só o número (ex: 5.50).');
    }

    const nuevosDatos: Datos = { ...datos, monto, historico: datos.productoNombre };
    await guardarConversacion(empresaId, 'CONFIRMAR', nuevosDatos);

    const simbolo = datos.simbolo ?? 'R$';
    const total = (datos.cantidad ?? 1) * monto;
    const etiquetaContactoTexto = etiquetaContacto(idioma, datos.operacion ?? '');
    const etiquetaContactoTitulo = etiquetaContactoTexto.charAt(0).toUpperCase() + etiquetaContactoTexto.slice(1);
    const contactoLinea = datos.contacto ? `\n${etiquetaContactoTitulo}: ${datos.contacto}` : '';

    return (
      `${t(idioma, 'Confirmá los datos:', 'Confirme os dados:')}\n\n` +
      `${t(idioma, 'Operación', 'Operação')}: ${nombreOperacionDisplay(idioma, datos.operacion ?? '')}\n` +
      `${etiquetaCategoria(idioma, datos.operacion)}: ${datos.categoria}\n` +
      `${etiquetaFormaPago(idioma, datos.operacion)}: ${datos.formaPago}${contactoLinea}\n` +
      `${t(idioma, 'Producto', 'Produto')}: ${datos.productoNombre} x${datos.cantidad}\n` +
      `${t(idioma, 'Precio unitario', 'Preço unitário')}: ${simbolo} ${formatearNumeroEntero(monto)}\n` +
      `Total: ${simbolo} ${formatearNumeroEntero(total)}\n\n` +
      `1) ${t(idioma, 'Confirmar', 'Confirmar')}\n2) ${t(idioma, 'Cancelar', 'Cancelar')}`
    );
  }

  // ---------------------------------------------------
  // 5. DETALLE + MONTO
  // ---------------------------------------------------
  if (paso === 'DETALLE') {
    const ultimaComa = texto.lastIndexOf(',');

    if (ultimaComa === -1) {
      return t(
        idioma,
        'No entendí. Escribí el detalle y el monto separados por coma. Ej: "Uber al centro, 25"',
        'Não entendi. Digite o detalhe e o valor separados por vírgula. Ex: "Uber para o centro, 25"'
      );
    }

    const detalle = texto.slice(0, ultimaComa).trim();
    const montoTexto = texto.slice(ultimaComa + 1).trim().replace(',', '.');
    const monto = Number(montoTexto);

    if (!detalle || !Number.isFinite(monto) || monto <= 0) {
      return t(
        idioma,
        'No entendí el monto. Escribí el detalle y el monto separados por coma. Ej: "Uber al centro, 25"',
        'Não entendi o valor. Digite o detalhe e o valor separados por vírgula. Ex: "Uber para o centro, 25"'
      );
    }

    const nuevosDatos: Datos = { ...datos, historico: detalle, monto };
    await guardarConversacion(empresaId, 'CONFIRMAR', nuevosDatos);

    const simbolo = datos.simbolo ?? 'R$';
    const etiquetaContactoTexto = etiquetaContacto(idioma, datos.operacion ?? '');
    const etiquetaContactoTitulo = etiquetaContactoTexto.charAt(0).toUpperCase() + etiquetaContactoTexto.slice(1);
    const contactoLinea = datos.contacto ? `\n${etiquetaContactoTitulo}: ${datos.contacto}` : '';

    return (
      `${t(idioma, 'Confirmá los datos:', 'Confirme os dados:')}\n\n` +
      `${t(idioma, 'Operación', 'Operação')}: ${nombreOperacionDisplay(idioma, datos.operacion ?? '')}\n` +
      `${etiquetaCategoria(idioma, datos.operacion)}: ${datos.categoria}\n` +
      `${etiquetaFormaPago(idioma, datos.operacion)}: ${datos.formaPago}${contactoLinea}\n` +
      `${t(idioma, 'Detalle', 'Detalhe')}: ${detalle}\n` +
      `${t(idioma, 'Monto', 'Valor')}: ${simbolo} ${formatearNumeroEntero(monto)}\n\n` +
      `1) ${t(idioma, 'Confirmar', 'Confirmar')}\n2) ${t(idioma, 'Cancelar', 'Cancelar')}`
    );
  }

  // ---------------------------------------------------
  // 6. CONFIRMAR
  // ---------------------------------------------------
  if (paso === 'CONFIRMAR') {
    if (texto === '2') {
      await borrarConversacion(empresaId);
      return t(
        idioma,
        '❌ Operación cancelada. Escribí cualquier cosa para empezar de nuevo.',
        '❌ Operação cancelada. Digite qualquer coisa para começar de novo.'
      );
    }

    if (texto !== '1') {
      return t(idioma, 'Respondé "1" para confirmar o "2" para cancelar.', 'Responda "1" para confirmar ou "2" para cancelar.');
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

      return t(
        idioma,
        `✅ ¡Listo! Registré ${resultado.idOperacion}. Escribí cualquier cosa para cargar otra operación.`,
        `✅ Pronto! Registrei ${resultado.idOperacion}. Digite qualquer coisa para carregar outra operação.`
      );
    } catch (errorRegistrar) {
      await borrarConversacion(empresaId);
      return t(
        idioma,
        `⚠️ No se pudo registrar: ${(errorRegistrar as Error).message}\n\nEscribí cualquier cosa para volver a intentar.`,
        `⚠️ Não foi possível registrar: ${(errorRegistrar as Error).message}\n\nDigite qualquer coisa para tentar novamente.`
      );
    }
  }

  // Estado desconocido (no debería pasar) — reinicia limpio.
  return iniciar(empresaId);
}
