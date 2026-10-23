// lib/visao3dEmpresas.ts
//
// Quién ve Visão 3D ("La empresa por dentro"). Sin imports, igual que planAccionEmpresas.ts.
// La apertura es progresiva: por perfil de empresa (PERFILES_ABIERTOS) o, para el piloto, por empresa puntual.
export const EMPRESAS_CON_VISAO_3D = ['8512b8b0-1985-4731-981b-955f1d62a898']; // Buenaventura

// Perfiles abiertos a todas sus empresas (apertura progresiva): por ahora solo Familia.
// Estas dos listas son el RESPALDO: la apertura real vive en la tabla `visao3d_apertura` (Panel Maestro → Apertura de Visão 3D)
// y se usa mientras se pueda leer; si la lectura falla, valen estas.
export const PERFILES_ABIERTOS: string[] = ['FAMILIAR'];

export type FilaApertura = { tipo: string; clave: string; abierto: boolean };

// `reglas` = filas de `visao3d_apertura`; null/undefined = no se pudieron leer (se usa el respaldo del código).
// Orden: apagado general > excepción de la empresa > regla de su perfil > cerrado (sin fila).
export function empresaTieneVisao3D(empresaId: string | null | undefined, perfilCodigo?: string | null, reglas?: FilaApertura[] | null): boolean {
  if (!reglas) {
    if (perfilCodigo && PERFILES_ABIERTOS.includes(perfilCodigo)) return true;
    return Boolean(empresaId) && EMPRESAS_CON_VISAO_3D.includes(empresaId as string);
  }

  const fila = (tipo: string, clave: string) => reglas.find((r) => r.tipo === tipo && r.clave === clave);

  if (fila('GLOBAL', 'todos')?.abierto === false) return false;

  const deEmpresa = empresaId ? fila('EMPRESA', empresaId) : undefined;
  if (deEmpresa) return deEmpresa.abierto;

  const dePerfil = perfilCodigo ? fila('PERFIL', perfilCodigo) : undefined;
  return dePerfil?.abierto === true;
}

// Todos los perfiles usan la misma casa (plano de cuartos y objetos por cuenta); lo que cambia es el tema: fachada, techo,
// pintura, mobiliario y exterior (ver components/visao3d/casa/temas.ts). El edificio queda como vista alternativa.
export type TipoEscena = 'casa' | 'edificio';

const PERFILES_CON_CASA = ['FAMILIAR', 'COMERCIAL', 'SERVICIOS', 'MIXTO', 'PRODUCCION'];

export function escenaDePerfil(perfilCodigo: string | null | undefined): TipoEscena {
  return perfilCodigo && PERFILES_CON_CASA.includes(perfilCodigo) ? 'casa' : 'edificio';
}
