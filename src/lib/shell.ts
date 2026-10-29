// lib/shell.ts
//
// NUEVO DISEÑO (cascarón): barra superior + menú lateral fijo + zona central. Fase 1: piloto solo para Buenaventura y solo
// en Inicio y Contabilidad; las demás herramientas se abren con el diseño anterior hasta que se migren (fase 2).

export const EMPRESAS_CON_SHELL = new Set<string>(['8512b8b0-1985-4731-981b-955f1d62a898']); // Buenaventura

// Rutas que ya se muestran dentro del cascarón.
export const RUTAS_EN_SHELL = ['/', '/contabilidad'];

export function empresaUsaShell(empresaId: string | null | undefined): boolean {
  return Boolean(empresaId) && EMPRESAS_CON_SHELL.has(empresaId as string);
}

export function rutaEnShell(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return RUTAS_EN_SHELL.some((r) => (r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(`${r}/`)));
}

// Resaltado del menú: "/" solo coincide con el inicio; las demás, con su ruta y sus pantallas hijas.
export function rutaActiva(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Pantallas que cuelgan de una herramienta y deben resaltarla en el menú.
const HIJAS: Record<string, string[]> = { '/contabilidad': ['/libro-diario', '/diario', '/registros', '/lanzamiento-rapido'], '/mercaderia': ['/stock', '/movimientos-stock'] };

export function herramientaDeRuta(pathname: string | null | undefined, hrefs: string[]): string | null {
  if (!pathname) return null;
  for (const h of hrefs) {
    if (rutaActiva(pathname, h)) return h;
    if ((HIJAS[h] ?? []).some((hija) => rutaActiva(pathname, hija))) return h;
  }
  return null;
}
