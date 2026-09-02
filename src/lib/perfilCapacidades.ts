// lib/perfilCapacidades.ts
//
// Si una empresa maneja mercadería (productos con stock) depende de
// su perfil — y, en el caso de Mixto, de qué componentes tildó el
// admin en Datos da Empresa. Esto es lo mismo que ya decide si se
// puede crear una "Categoría de Producto" en CONFIGURAÇÕES, o si se
// le arman los objetivos de Mercadería — así que se centraliza acá
// para no repetir el mismo cálculo en cada lugar.

import { supabase } from './supabase';

export async function empresaManejaMercaderia(empresaId: string): Promise<boolean> {
  const { data: empresa } = await supabase
    .from('empresas')
    .select('perfil_empresa_id, perfiles_empresa(codigo)')
    .eq('id', empresaId)
    .maybeSingle();

  const perfilCodigo = (empresa as unknown as { perfiles_empresa?: { codigo: string } | null } | null)
    ?.perfiles_empresa?.codigo;

  if (perfilCodigo === 'SERVICIOS' || perfilCodigo === 'FAMILIAR') {
    return false;
  }

  if (perfilCodigo === 'MIXTO') {
    const { data: componentes } = await supabase
      .from('empresa_mixto_componentes')
      .select('componente')
      .eq('empresa_id', empresaId);

    return (componentes ?? []).some(
      (c) => c.componente === 'COMERCIAL' || c.componente === 'PRODUCCION'
    );
  }

  // COMERCIAL, PRODUCCION, o una empresa "vieja" sin perfil asignado
  // (se asume que sí maneja mercadería, como venía siendo hasta ahora).
  return true;
}

// Si una empresa tiene habilitado un módulo opcional (hoy solo
// PRODUCCION, pero sirve para cualquiera que se agregue a
// perfil_modulos). Centraliza la MISMA regla en un solo lugar para que
// el lobby, los accesos rápidos entre herramientas, o cualquier otra
// pantalla que necesite esta pregunta no puedan divergir entre sí —
// ver el bug de Equilibra (Mixto con Producción tildada, pero la
// herramienta no aparecía porque cada pantalla hacía su propia
// consulta y ninguna miraba empresa_mixto_componentes).
//
// El perfil MIXTO no tiene fila propia en perfil_modulos — no hay un
// módulo fijo, depende de qué componentes tildó la empresa al darse
// de alta — así que para Mixto la respuesta sale de
// empresa_mixto_componentes en vez de perfil_modulos.
export async function empresaTieneModulo(empresaId: string, modulo: string): Promise<boolean> {
  const { data: empresa } = await supabase
    .from('empresas')
    .select('perfil_empresa_id, perfiles_empresa(codigo)')
    .eq('id', empresaId)
    .maybeSingle();

  const perfilEmpresaId = empresa?.perfil_empresa_id ?? null;
  const perfilCodigo = (empresa as unknown as { perfiles_empresa?: { codigo: string } | null } | null)
    ?.perfiles_empresa?.codigo;

  if (perfilCodigo === 'MIXTO') {
    const { data: componentes } = await supabase
      .from('empresa_mixto_componentes')
      .select('componente')
      .eq('empresa_id', empresaId);

    return (componentes ?? []).some((c) => c.componente === modulo);
  }

  if (!perfilEmpresaId) {
    return false;
  }

  const { data: modulosData } = await supabase
    .from('perfil_modulos')
    .select('modulo')
    .eq('perfil_empresa_id', perfilEmpresaId)
    .eq('activo', true);

  return (modulosData ?? []).some((fila) => fila.modulo === modulo);
}
