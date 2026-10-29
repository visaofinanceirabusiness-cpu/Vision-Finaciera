// lib/shell.ts
//
// NUEVO DISEÑO (cascarón): barra superior + menú lateral fijo + zona central, para TODAS las empresas y perfiles (Fase 3; antes
// piloto solo de Buenaventura). Todas las herramientas del menú se muestran dentro del cascarón; las pantallas públicas, el Panel
// Maestro y el alta quedan fuera. Qué herramientas ve cada perfil lo decide lib/herramientasMenu.ts.

// Rutas que ya se muestran dentro del cascarón.
export const RUTAS_EN_SHELL = [
  '/',
  '/panel-de-control',
  '/contabilidad',
  '/libro-diario',
  '/diario',
  '/registros',
  '/lanzamiento-rapido',
  '/finanzas',
  '/mercaderia',
  '/stock',
  '/movimientos-stock',
  '/mi-local',
  '/informes',
  '/visao-3d',
  '/produccion',
  '/recursos-humanos',
  '/plan-accion',
  '/nuestro-sueno',
  '/mensajes',
  '/configuracoes',
  '/sabio-bot',
];

export function empresaUsaShell(empresaId: string | null | undefined): boolean {
  return Boolean(empresaId);
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
