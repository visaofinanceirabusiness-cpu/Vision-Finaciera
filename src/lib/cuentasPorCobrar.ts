// lib/cuentasPorCobrar.ts
//
// Qué cuentas de Activo son cuentas POR COBRAR y no plata disponible.
//
// Una cuenta a cobrar se crea como forma de pago (para poder vender o
// devengar un ingreso "a cobrar"), igual que un banco — por eso no se
// distingue mirando forma_pago_cuentas. Lo que sí la distingue: tiene una
// categoría de COBRO de rol ACTIVO (con la que se la cobra contra caja:
// Banco / Cuenta a cobrar), algo que un banco no tiene. Esa es la señal
// que usa el Panel para no sumarlas a "caja disponible" ni ofrecerlas como
// "cuenta de dinero" en Salud de Caja (ya se cuentan como "a cobrar").

import { supabase } from './supabase';

export async function idsCuentasPorCobrar(empresaId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('categorias_operacion_cuentas')
    .select('cuenta_id, categorias_operacion(operacion, activo)')
    .eq('empresa_id', empresaId)
    .eq('rol', 'ACTIVO')
    .eq('activo', true);

  if (error) {
    throw error;
  }

  const ids = new Set<string>();

  for (const fila of data ?? []) {
    const categoria = fila.categorias_operacion as unknown as
      | { operacion: string; activo: boolean }
      | { operacion: string; activo: boolean }[]
      | null;
    const lista = Array.isArray(categoria) ? categoria : categoria ? [categoria] : [];

    if (lista.some((c) => c.operacion === 'COBRO' && c.activo)) {
      ids.add(fila.cuenta_id as string);
    }
  }

  return ids;
}
