// Presentación de los grupos de cuentas (nombre, imagen y colores). Las
// imágenes viven en public/grupos/; si una falta, se muestra el emoji.

export type PresentacionGrupo = {
  es: string;
  pt: string;
  imagen: string | null;
  emoji: string;
  acento: string;
  fondo: string;
  borde: string;
};

export const GRUPOS_ACTIVO: Record<string, PresentacionGrupo> = {
  DINERO: { es: 'Dinero disponible', pt: 'Dinheiro disponível', imagen: '/grupos/activo-dinero.webp', emoji: '🏦', acento: '#15803d', fondo: '#f0fdf4', borde: '#bbf7d0' },
  POR_COBRAR: { es: 'Por cobrar', pt: 'A receber', imagen: '/grupos/activo-por-cobrar.webp', emoji: '🧾', acento: '#be185d', fondo: '#fdf2f8', borde: '#fbcfe8' },
  INVENTARIO: { es: 'Mercaderías e inventario', pt: 'Mercadorias e estoque', imagen: '/grupos/activo-mercaderias.webp', emoji: '📦', acento: '#c2410c', fondo: '#fff7ed', borde: '#fed7aa' },
  AHORROS: { es: 'Ahorros e inversiones', pt: 'Poupança e investimentos', imagen: '/grupos/activo-ahorros.webp', emoji: '🐷', acento: '#6d28d9', fondo: '#f5f3ff', borde: '#ddd6fe' },
  BIENES: { es: 'Bienes y propiedades', pt: 'Bens e propriedades', imagen: '/grupos/activo-bienes.webp', emoji: '🏠', acento: '#1d4ed8', fondo: '#eff6ff', borde: '#bfdbfe' },
  NO_CORRIENTE: { es: 'Equipos e instalaciones', pt: 'Equipamentos e instalações', imagen: '/grupos/activo-no-corriente.webp', emoji: '🛠️', acento: '#0f766e', fondo: '#f0fdfa', borde: '#99f6e4' },
  OTROS: { es: 'Otros activos', pt: 'Outros ativos', imagen: '/grupos/activo-otros.webp', emoji: '💰', acento: '#475569', fondo: '#f8fafc', borde: '#e2e8f0' },
};
