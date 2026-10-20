// lib/flujoCajaMeta.ts
//
// Saldo deseado de caja por mes (Informes → Flujo de Caja). Es un dato manual e
// informativo: no genera asientos ni toca el motor.

import { supabase } from './supabase';

export async function obtenerSaldoDeseado(empresaId: string, periodo: string): Promise<number> {
  const { data, error } = await supabase
    .from('flujo_caja_metas')
    .select('saldo_deseado')
    .eq('empresa_id', empresaId)
    .eq('periodo', periodo)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.saldo_deseado ?? 0);
}

export async function guardarSaldoDeseado(empresaId: string, periodo: string, valor: number): Promise<void> {
  const { error } = await supabase
    .from('flujo_caja_metas')
    .upsert(
      { empresa_id: empresaId, periodo, saldo_deseado: valor, actualizado_en: new Date().toISOString() },
      { onConflict: 'empresa_id,periodo' }
    );

  if (error) throw error;
}

export function periodoAnterior(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const fecha = new Date(anio, mes - 2, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}
