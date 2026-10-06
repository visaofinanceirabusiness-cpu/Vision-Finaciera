// lib/noticiasEmpresas.ts
//
// Empresas con "Noticias del día" — hoy solo Buenaventura (piloto). Sin
// imports, igual que planAccionEmpresas.ts.
export const EMPRESAS_CON_NOTICIAS = ['8512b8b0-1985-4731-981b-955f1d62a898']; // Buenaventura

export function empresaTieneNoticias(empresaId: string | null | undefined): boolean {
  return Boolean(empresaId) && EMPRESAS_CON_NOTICIAS.includes(empresaId as string);
}
