// lib/cuentaAPagar.ts
//
// Con qué cuenta se saldan los gastos ya devengados. La primera versión
// del devengo usaba UNA cuenta general "Cuentas a Pagar" por empresa
// (guardada en empresas.forma_pago_a_pagar); ahora cada plantilla tiene
// la suya (ver cuentasCompromiso.ts) y esa general solo queda como
// respaldo para los devengos que se hicieron con ella.

import { supabase } from './supabase';
import { resolverCuentaCompromiso } from './cuentasCompromiso';

export type ConfigAPagar = {
  // Id de la forma de pago (cuenta específica por compromiso); vacío en la
  // cuenta general "Cuentas a Pagar" de la primera versión.
  formaPagoId?: string;
  // Forma de pago con la que se devenga (acredita la cuenta a pagar).
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

// Con qué cuenta se salda un gasto ya devengado: la que se anotó en ese mes
// (por id, así un renombrado no importa) o, para los devengos de la primera
// versión, la cuenta general de la empresa.
export async function configParaSaldar(
  empresaId: string,
  cuentaDevengoFormaPagoId: string | null | undefined
): Promise<ConfigAPagar | null> {
  if (cuentaDevengoFormaPagoId) {
    const cuenta = await resolverCuentaCompromiso(cuentaDevengoFormaPagoId, 'PAGAR');
    return { formaPagoId: cuenta.formaPagoId, formaPago: cuenta.formaPago, categoriaLiquidacion: cuenta.categoriaLiquidacion };
  }

  return obtenerConfigAPagar(empresaId);
}
