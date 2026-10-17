// lib/noticiasEmpresas.ts
//
// "Noticias del día" está disponible para todas las empresas (nació como piloto
// de Buenaventura). Las fuentes son genéricas (mundo, Brasil, Argentina) y el
// servidor las cachea 30 minutos, así que no depende de la empresa. Se
// mantiene la función para no tocar a quien ya la usa y poder volver a
// restringir si hiciera falta. Sin imports.
export function empresaTieneNoticias(empresaId: string | null | undefined): boolean {
  return Boolean(empresaId);
}
