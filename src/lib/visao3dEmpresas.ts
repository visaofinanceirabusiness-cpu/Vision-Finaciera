// lib/visao3dEmpresas.ts
//
// Empresas con Visão 3D ("La empresa por dentro"): por ahora solo Buenaventura (piloto). Sin imports,
// igual que planAccionEmpresas.ts. Para abrirlo a más empresas basta con agregar su id acá.
export const EMPRESAS_CON_VISAO_3D = ['8512b8b0-1985-4731-981b-955f1d62a898']; // Buenaventura

export function empresaTieneVisao3D(empresaId: string | null | undefined): boolean {
  return Boolean(empresaId) && EMPRESAS_CON_VISAO_3D.includes(empresaId as string);
}
