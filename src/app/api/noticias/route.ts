import { NextResponse } from 'next/server';
import { FUENTES_NOTICIAS, mezclarTitulares, parsearFeed, type Bloque, type Titular } from '@/lib/noticias';

// Titulares de feeds RSS públicos, sin guardar nada y sin IA (costo cero). Se
// cachea en el edge para no pedirle los feeds a los portales en cada visita.
export const revalidate = 1800;

const TIMEOUT_MS = 6000;
const POR_BLOQUE = 8;

async function leerFuente(f: (typeof FUENTES_NOTICIAS)[number]): Promise<Titular[]> {
  const respuesta = await fetch(f.url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; VisaoFinanceira/1.0)', accept: 'application/rss+xml, application/xml, text/xml, */*' },
    next: { revalidate },
  });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return parsearFeed(await respuesta.text(), f.nombre, 6);
}

export async function GET() {
  const resultados = await Promise.allSettled(FUENTES_NOTICIAS.map(leerFuente));
  const fallidas: string[] = [];
  const porBloque: Record<Bloque, Titular[][]> = { mundo: [], brasil: [], argentina: [] };

  resultados.forEach((r, i) => {
    const f = FUENTES_NOTICIAS[i];
    if (r.status === 'fulfilled' && r.value.length > 0) porBloque[f.bloque].push(r.value);
    else fallidas.push(f.nombre);
  });

  return NextResponse.json({
    mundo: mezclarTitulares(porBloque.mundo, POR_BLOQUE),
    brasil: mezclarTitulares(porBloque.brasil, POR_BLOQUE),
    argentina: mezclarTitulares(porBloque.argentina, POR_BLOQUE),
    fuentesFallidas: fallidas,
  });
}
