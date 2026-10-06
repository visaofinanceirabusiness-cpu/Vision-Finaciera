// lib/noticias.ts
//
// Noticias del día (fase 1): solo TITULARES de feeds RSS públicos, con fuente
// y enlace a la nota original. No se guarda nada ni se usa IA (cero costo).
// Lógica pura: la lectura de red vive en app/api/noticias/route.ts.

export type Bloque = 'mundo' | 'brasil' | 'argentina';

export type FuenteNoticias = { id: string; nombre: string; bloque: Bloque; url: string };

export type Titular = { titulo: string; enlace: string; fuente: string; fecha: number | null };

// URLs de feeds públicos conocidos; si alguno deja de responder simplemente se
// omite (el endpoint informa cuáles fallaron). Editar acá para sumar o sacar.
export const FUENTES_NOTICIAS: FuenteNoticias[] = [
  { id: 'bbc', nombre: 'BBC Business', bloque: 'mundo', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { id: 'cnbc', nombre: 'CNBC', bloque: 'mundo', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147' },
  { id: 'marketwatch', nombre: 'MarketWatch', bloque: 'mundo', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { id: 'elpais', nombre: 'El País Economía', bloque: 'mundo', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada' },
  { id: 'infomoney', nombre: 'InfoMoney', bloque: 'brasil', url: 'https://www.infomoney.com.br/feed/' },
  { id: 'g1', nombre: 'G1 Economia', bloque: 'brasil', url: 'https://g1.globo.com/rss/g1/economia/' },
  { id: 'folha', nombre: 'Folha Mercado', bloque: 'brasil', url: 'https://feeds.folha.uol.com.br/mercado/rss091.xml' },
  { id: 'exame', nombre: 'Exame', bloque: 'brasil', url: 'https://exame.com/feed/' },
  { id: 'ambito', nombre: 'Ámbito', bloque: 'argentina', url: 'https://www.ambito.com/rss/pages/economia.xml' },
  { id: 'infobae', nombre: 'Infobae Economía', bloque: 'argentina', url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/economia/' },
  { id: 'lanacion', nombre: 'La Nación Economía', bloque: 'argentina', url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/' },
  { id: 'cronista', nombre: 'El Cronista', bloque: 'argentina', url: 'https://www.cronista.com/files/rss/economia.xml' },
];

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function limpiarTexto(crudo: string): string {
  return crudo
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const codigo = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(codigo) && codigo > 0 && codigo < 0x110000 ? String.fromCodePoint(codigo) : m;
      }
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function primero(bloque: string, etiqueta: string): string | null {
  const m = bloque.match(new RegExp(`<${etiqueta}(?:\\s[^>]*)?>([\\s\\S]*?)</${etiqueta}>`, 'i'));
  return m ? limpiarTexto(m[1]) : null;
}

// Solo enlaces http(s): lo que venga de un feed ajeno no se confía.
export function enlaceSeguro(valor: string | null | undefined): string | null {
  if (!valor) return null;
  try {
    const u = new URL(valor.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

// RSS 2.0 (<item>) y Atom (<entry>).
export function parsearFeed(xml: string, fuente: string, limite = 10): Titular[] {
  const items = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const resultado: Titular[] = [];

  for (const item of items) {
    const titulo = primero(item, 'title');
    const enlace =
      enlaceSeguro(primero(item, 'link')) ??
      enlaceSeguro(item.match(/<link[^>]*\shref=["']([^"']+)["']/i)?.[1]) ??
      enlaceSeguro(primero(item, 'guid'));
    if (!titulo || !enlace) continue;

    const crudaFecha = primero(item, 'pubDate') ?? primero(item, 'published') ?? primero(item, 'updated');
    const ms = crudaFecha ? Date.parse(crudaFecha) : NaN;

    resultado.push({ titulo, enlace, fuente, fecha: Number.isFinite(ms) ? ms : null });
    if (resultado.length >= limite) break;
  }

  return resultado;
}

// Intercala las fuentes (una de cada una por vuelta) para que un solo portal
// no ocupe todo el bloque; dentro de cada fuente respeta el orden del feed.
export function mezclarTitulares(porFuente: Titular[][], limite: number): Titular[] {
  const vistos = new Set<string>();
  const salida: Titular[] = [];

  for (let i = 0; salida.length < limite; i++) {
    let hubo = false;
    for (const lista of porFuente) {
      const t = lista[i];
      if (!t) continue;
      hubo = true;
      const clave = t.titulo.toLowerCase();
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push(t);
      if (salida.length >= limite) break;
    }
    if (!hubo) break;
  }

  return salida;
}
