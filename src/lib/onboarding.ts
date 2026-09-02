// lib/onboarding.ts
//
// ONBOARDING GUIADO DE EMPRESAS NUEVAS
// =====================================================
//
// Toda empresa que se da de alta desde /crear-cuenta y se aprueba en
// panel-maestro queda con empresas.onboarding_completado = false —
// tiene su Plano de Contas (inicializarEmpresaDesdePerfil), pero
// todavía no tiene categorías, contactos ni matriz de operaciones
// propias: no es operativa. Las empresas que ya existían antes de
// este campo quedaron en true por el default de la migración, así
// que nunca ven este flujo.
//
// El flujo completo (wizard de datos en /bienvenida + 3 operaciones
// guiadas con Sabio en la Central de Lançamentos) todavía se está
// construyendo por fases. Esta función es la única fuente de verdad
// sobre si una empresa ya lo completó — la usa cada pantalla
// protegida para decidir si redirige a /bienvenida en vez de dejar
// pasar, y la marca en true cuando el usuario termina.

import { supabase } from './supabase';

export async function empresaTieneOnboardingCompleto(empresaId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('empresas')
    .select('onboarding_completado')
    .eq('id', empresaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  // Si por lo que sea no hay fila o el campo vino null, no se traba
  // al usuario — mismo criterio que el default de la migración.
  return data?.onboarding_completado ?? true;
}

export async function marcarOnboardingCompleto(empresaId: string): Promise<void> {
  const { error } = await supabase
    .from('empresas')
    .update({ onboarding_completado: true })
    .eq('id', empresaId);

  if (error) {
    throw error;
  }
}
