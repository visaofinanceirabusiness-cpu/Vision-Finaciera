import { NextRequest, NextResponse } from 'next/server';

// Extracción best-effort de datos de una publicación inmobiliaria a
// partir de su link, para precargar una tarjeta de Nuestro Sueño →
// Propuestas de Compra. Dos fuentes, en este orden:
//
//   1. Datos estructurados JSON-LD (schema.org) — cuando el portal los
//      publica, son los más confiables (precio, dirección, m2,
//      cuartos vienen tipados).
//   2. Etiquetas Open Graph (og:title, og:description, og:image) —
//      casi cualquier portal las tiene, aunque sean menos precisas.
//
// Ningún campo es obligatorio: lo que no se pueda sacar queda vacío y
// se completa a mano en el formulario — esta ruta nunca falla por
// "no encontré tal dato", solo por no poder acceder al link.
//
// force-dynamic: es un POST que depende del link recibido, nunca debe
// cachearse.
export const dynamic = 'force-dynamic';

type DatosExtraidos = {
  titulo: string | null;
  descripcion: string | null;
  imagenUrl: string | null;
  precio: number | null;
  moneda: string | null;
  direccion: string | null;
  m2: number | null;
  cuartos: number | null;
  banos: number | null;
  lat: number | null;
  lng: number | null;
};

function vacio(): DatosExtraidos {
  return {
    titulo: null,
    descripcion: null,
    imagenUrl: null,
    precio: null,
    moneda: null,
    direccion: null,
    m2: null,
    cuartos: null,
    banos: null,
    lat: null,
    lng: null,
  };
}

function metaTag(html: string, propiedad: string): string | null {
  // Cubre tanto property="og:x" como name="og:x", en cualquier orden
  // de atributos.
  const patrones = [
    new RegExp(`<meta[^>]+property=["']${propiedad}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${propiedad}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${propiedad}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${propiedad}["']`, 'i'),
  ];

  for (const patron of patrones) {
    const coincidencia = html.match(patron);
    if (coincidencia) return decodificarEntidades(coincidencia[1]);
  }

  return null;
}

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function numeroDesde(valor: unknown): number | null {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const limpio = valor.replace(/[^\d.,]/g, '').replace(',', '.');
    const n = parseFloat(limpio);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function direccionDesdeJsonLd(direccion: unknown): string | null {
  if (typeof direccion === 'string') return direccion;
  if (direccion && typeof direccion === 'object') {
    const d = direccion as Record<string, unknown>;
    const partes = [d.streetAddress, d.addressLocality, d.addressRegion].filter(Boolean);
    return partes.length > 0 ? partes.join(', ') : null;
  }
  return null;
}

// Recorre cualquier bloque JSON-LD buscando las propiedades típicas
// de un aviso inmobiliario (RealEstateListing, Product, Offer), sin
// asumir una estructura fija — cada portal anida distinto.
function extraerDeJsonLd(nodo: unknown, resultado: DatosExtraidos) {
  if (!nodo || typeof nodo !== 'object') return;

  if (Array.isArray(nodo)) {
    nodo.forEach((item) => extraerDeJsonLd(item, resultado));
    return;
  }

  const obj = nodo as Record<string, unknown>;

  if (!resultado.titulo && typeof obj.name === 'string') resultado.titulo = obj.name;
  if (!resultado.descripcion && typeof obj.description === 'string') resultado.descripcion = obj.description;
  if (!resultado.direccion && obj.address) resultado.direccion = direccionDesdeJsonLd(obj.address);

  if (!resultado.imagenUrl) {
    if (typeof obj.image === 'string') resultado.imagenUrl = obj.image;
    else if (Array.isArray(obj.image) && typeof obj.image[0] === 'string') resultado.imagenUrl = obj.image[0];
  }

  if (obj.geo && typeof obj.geo === 'object') {
    const geo = obj.geo as Record<string, unknown>;
    if (resultado.lat === null) resultado.lat = numeroDesde(geo.latitude);
    if (resultado.lng === null) resultado.lng = numeroDesde(geo.longitude);
  }

  const ofertas = obj.offers && typeof obj.offers === 'object' ? (obj.offers as Record<string, unknown>) : obj;
  if (resultado.precio === null && ofertas.price !== undefined) resultado.precio = numeroDesde(ofertas.price);
  if (resultado.moneda === null && typeof ofertas.priceCurrency === 'string') resultado.moneda = ofertas.priceCurrency;

  if (resultado.m2 === null) {
    const area = obj.floorSize as Record<string, unknown> | undefined;
    if (area?.value !== undefined) resultado.m2 = numeroDesde(area.value);
  }

  if (resultado.cuartos === null && obj.numberOfRooms !== undefined) resultado.cuartos = numeroDesde(obj.numberOfRooms);
  if (resultado.cuartos === null && obj.numberOfBedroomsTotal !== undefined) {
    resultado.cuartos = numeroDesde(obj.numberOfBedroomsTotal);
  }
  if (resultado.banos === null && obj.numberOfBathroomsTotal !== undefined) {
    resultado.banos = numeroDesde(obj.numberOfBathroomsTotal);
  }

  // Sigue buscando en las sub-propiedades comunes por si el dato está
  // anidado un nivel más adentro (ej. mainEntity, itemOffered).
  for (const clave of ['mainEntity', 'itemOffered', '@graph']) {
    if (obj[clave]) extraerDeJsonLd(obj[clave], resultado);
  }
}

export async function POST(request: NextRequest) {
  const { link } = await request.json();

  if (!link || typeof link !== 'string') {
    return NextResponse.json({ error: 'Falta el link.' }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
  }

  let html: string;
  try {
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 10_000);

    const respuesta = await fetch(url.toString(), {
      signal: controlador.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VisaoFinanceiraBot/1.0; +https://vision-finaciera.vercel.app)',
        Accept: 'text/html',
      },
    });

    clearTimeout(timeout);

    if (!respuesta.ok) {
      return NextResponse.json({ error: `No se pudo acceder al link (${respuesta.status}).` }, { status: 502 });
    }

    html = await respuesta.text();
  } catch {
    return NextResponse.json({ error: 'No se pudo acceder al link.' }, { status: 502 });
  }

  const resultado = vacio();

  // 1. JSON-LD — el más confiable cuando está.
  const bloquesJsonLd = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const bloque of bloquesJsonLd) {
    try {
      const json = JSON.parse(bloque[1]);
      extraerDeJsonLd(json, resultado);
    } catch {
      // JSON-LD mal formado en el portal de origen — se ignora ese bloque.
    }
  }

  // 2. Open Graph — completa lo que JSON-LD no trajo.
  resultado.titulo = resultado.titulo ?? metaTag(html, 'og:title');
  resultado.descripcion = resultado.descripcion ?? metaTag(html, 'og:description');
  resultado.imagenUrl = resultado.imagenUrl ?? metaTag(html, 'og:image');

  if (resultado.precio === null) {
    resultado.precio = numeroDesde(
      metaTag(html, 'product:price:amount') ?? metaTag(html, 'og:price:amount')
    );
  }
  resultado.moneda = resultado.moneda ?? metaTag(html, 'product:price:currency') ?? metaTag(html, 'og:price:currency');

  return NextResponse.json({ datos: resultado });
}
