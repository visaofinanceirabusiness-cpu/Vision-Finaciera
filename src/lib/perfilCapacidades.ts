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
