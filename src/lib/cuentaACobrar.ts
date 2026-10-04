// lib/cuentaACobrar.ts
//
// Con qué cuenta se cobran los ingresos ya devengados. La primera versión
// del devengo de ingresos usaba la cuenta a cobrar general de la empresa
// ("Cuentas a cobrar", "Costão a cobrar"; guardada en
// empresas.forma_pago_a_cobrar); ahora cada plantilla tiene la suya (ver
// cuentasCompromiso.ts) y esa general solo queda como respaldo para los
// devengos que se hicieron con ella. La general NO se renombra ni se
// desactiva nunca: es la cuenta a cobrar del plan, la que usa Contabilidad
// para las ventas a crédito.

import { supabase } from './supabase';
import { resolverCuentaCompromiso } from './cuentasCompromiso';

export type ConfigACobrar = {
  // Id de la forma de pago (cuenta propia del compromiso); vacío en la cuenta
  // general de la primera versión.
  formaPagoId?: string;
  // Forma de pago con la que se devenga (debita la cuenta a cobrar).
  formaPago: string;
  // Categoría de un COBRO que la salda (acredita la cuenta a cobrar).
  categoriaLiquidacion: string;
};

export async function obtenerConfigACobrar(empresaId: string): Promise<ConfigACobrar | null> {
  const { data, error } = await supabase
    .from('empresas')
    .select('forma_pago_a_cobrar')
    .eq('id', empresaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const nombre = data?.forma_pago_a_cobrar as string | null | undefined;

  return nombre ? { formaPago: nombre, categoriaLiquidacion: nombre } : null;
}

// Con qué cuenta se cobra un ingreso ya devengado: la que se anotó en ese mes
// (por id, así un renombrado no importa) o, para los devengos de la primera
// versión, la cuenta general de la empresa.
export async function configParaCobrar(
  empresaId: string,
  cuentaDevengoFormaPagoId: string | null | undefined
): Promise<ConfigACobrar | null> {
  if (cuentaDevengoFormaPagoId) {
    const cuenta = await resolverCuentaCompromiso(cuentaDevengoFormaPagoId, 'COBRAR');
    return { formaPagoId: cuenta.formaPagoId, formaPago: cuenta.formaPago, categoriaLiquidacion: cuenta.categoriaLiquidacion };
  }

  return obtenerConfigACobrar(empresaId);
}
