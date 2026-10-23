// lib/visao3dEmpresas.ts
//
// Quién ve Visão 3D ("La empresa por dentro"). Sin imports, igual que planAccionEmpresas.ts.
// La apertura es progresiva: por perfil de empresa (PERFILES_ABIERTOS) o, para el piloto, por empresa puntual.
export const EMPRESAS_CON_VISAO_3D = ['8512b8b0-1985-4731-981b-955f1d62a898']; // Buenaventura

// Perfiles abiertos a todas sus empresas. Vacío hasta decidir el lanzamiento; el primero será 'FAMILIAR'.
export const PERFILES_ABIERTOS: string[] = [];

export function empresaTieneVisao3D(empresaId: string | null | undefined, perfilCodigo?: string | null): boolean {
  if (perfilCodigo && PERFILES_ABIERTOS.includes(perfilCodigo)) return true;
  return Boolean(empresaId) && EMPRESAS_CON_VISAO_3D.includes(empresaId as string);
}

// Familia comparte la casa (lo que cambia por perfil son las cuentas); el resto usa el edificio hasta tener su propia escena.
export type TipoEscena = 'casa' | 'edificio';

export function escenaDePerfil(perfilCodigo: string | null | undefined): TipoEscena {
  return perfilCodigo === 'FAMILIAR' ? 'casa' : 'edificio';
}
