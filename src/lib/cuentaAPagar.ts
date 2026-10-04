// lib/cuentaAPagar.ts
//
// La cuenta de Pasivo "Cuentas a Pagar" con la que se devengan los
// gastos recurrentes (Compromisos Fase 2). Se crea sola, una vez por
// empresa, al activar el primer devengo — con el mismo crearPasivo que
// usa Contabilidad para cualquier deuda nueva: cuenta bajo Pasivo
// Corriente + forma de pago (para devengar: Gasto / Cuentas a Pagar) +
// categoría de liquidación (para saldar: Cuentas a Pagar / Banco). El
// nombre se guarda en empresas.forma_pago_a_pagar, porque cada empresa
// puede llamar distinto a sus cuentas y no se busca por nombre.

import { supabase } from './supabase';
import { crearPasivo } from './categorias';
import { generarMatrizOperaciones } from './motor';

export const NOMBRE_CUENTA_A_PAGAR = 'Cuentas a Pagar';

export type ConfigAPagar = {
  // Forma de pago con la que se devenga (acredita Cuentas a Pagar).
  formaPago: string;
  // Categoría de un PAGO que la salda (debita Cuentas a Pagar). crearPasivo
  // le pone el mismo nombre que a la forma de pago.
  categoriaLiquidacion: string;
};

export async function obtenerConfigAPagar(empresaId: string): Promise<ConfigAPagar | null> {
  const { data, error } = await supabase
    .from('empresas')
    .select('forma_pago_a_pagar')
    .eq('id', empresaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const nombre = data?.forma_pago_a_pagar as string | null | undefined;

  return nombre ? { formaPago: nombre, categoriaLiquidacion: nombre } : null;
}

export async function asegurarCuentaAPagar(empresaId: string): Promise<ConfigAPagar> {
  const existente = await obtenerConfigAPagar(empresaId);

  if (existente) {
    return existente;
  }

  const { data: yaCreada, error: errorBusqueda } = await supabase
    .from('formas_pago')
    .select('nombre')
    .eq('empresa_id', empresaId)
    .eq('nombre', NOMBRE_CUENTA_A_PAGAR)
    .maybeSingle();

  if (errorBusqueda) {
    throw errorBusqueda;
  }

  if (!yaCreada) {
    await crearPasivo(empresaId, NOMBRE_CUENTA_A_PAGAR);
    await generarMatrizOperaciones(empresaId);
  }

  const { error: errorGuardar } = await supabase
    .from('empresas')
    .update({ forma_pago_a_pagar: NOMBRE_CUENTA_A_PAGAR })
    .eq('id', empresaId);

  if (errorGuardar) {
    throw errorGuardar;
  }

  return { formaPago: NOMBRE_CUENTA_A_PAGAR, categoriaLiquidacion: NOMBRE_CUENTA_A_PAGAR };
}
