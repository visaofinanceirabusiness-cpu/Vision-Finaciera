// lib/cuentaACobrar.ts
//
// La cuenta de Activo "a cobrar" con la que se devengan los ingresos
// recurrentes (Compromisos Fase 2D) — espejo de cuentaAPagar.ts. A
// diferencia del Pasivo, casi todas las empresas YA tienen una (se llama
// distinto en cada una: "Cuentas a cobrar", "Costão a cobrar"...), así
// que primero se la busca; solo si no hay ninguna se crea. El nombre
// queda en empresas.forma_pago_a_cobrar porque no se puede adivinar por
// nombre en cada empresa.

import { supabase } from './supabase';
import { crearCuentaParaMedioPago, crearFormaPago, habilitarLiquidacionCuentaCobrar } from './categorias';
import { generarMatrizOperaciones } from './motor';

export const NOMBRE_CUENTA_A_COBRAR = 'Cuentas a Cobrar';

export type ConfigACobrar = {
  // Forma de pago con la que se devenga (debita la cuenta a cobrar).
  formaPago: string;
  // Categoría de un COBRO que la salda (acredita la cuenta a cobrar):
  // habilitarLiquidacionCuentaCobrar le pone el mismo nombre que a la cuenta.
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

// Busca una forma de pago ya existente que sea una cuenta a cobrar:
// vinculada a una cuenta de ACTIVO, que se pueda usar en un COBRO y cuyo
// nombre diga "cobrar".
async function buscarCuentaACobrarExistente(empresaId: string): Promise<{ nombre: string; cuentaId: string } | null> {
  const { data, error } = await supabase
    .from('formas_pago')
    .select('id, nombre, forma_pago_cuentas(cuenta_id, activo, plan_cuentas(tipo_saldo))')
    .eq('empresa_id', empresaId)
    .eq('activo', true);

  if (error) {
    throw error;
  }

  const candidatas = (data ?? []).filter((forma) => /cobrar/i.test(forma.nombre));

  for (const forma of candidatas) {
    const vinculos = (forma.forma_pago_cuentas ?? []) as unknown as {
      cuenta_id: string;
      activo: boolean;
      plan_cuentas: { tipo_saldo: string } | { tipo_saldo: string }[] | null;
    }[];

    const vinculo = vinculos.find((v) => {
      const plan = Array.isArray(v.plan_cuentas) ? v.plan_cuentas[0] : v.plan_cuentas;
      return v.activo && plan?.tipo_saldo === 'ACTIVO';
    });

    if (!vinculo) continue;

    const { data: usos, error: errorUsos } = await supabase
      .from('formas_pago_operacion')
      .select('operaciones!inner(nombre)')
      .eq('empresa_id', empresaId)
      .eq('forma_pago_id', forma.id)
      .eq('activo', true);

    if (errorUsos) {
      throw errorUsos;
    }

    const sirveParaCobro = (usos ?? []).some((u) => {
      const operacion = u.operaciones as unknown as { nombre: string } | { nombre: string }[];
      return (Array.isArray(operacion) ? operacion[0]?.nombre : operacion?.nombre) === 'COBRO';
    });

    if (sirveParaCobro) {
      return { nombre: forma.nombre, cuentaId: vinculo.cuenta_id };
    }
  }

  return null;
}

export async function asegurarCuentaACobrar(empresaId: string): Promise<ConfigACobrar> {
  const existente = await obtenerConfigACobrar(empresaId);

  if (existente) {
    return existente;
  }

  let cuenta = await buscarCuentaACobrarExistente(empresaId);
  // Solo si se crea algo hay que regenerar la matriz de operaciones.
  let seCreoAlgo = false;

  if (!cuenta) {
    seCreoAlgo = true;
    const cuentaId = await crearCuentaParaMedioPago(empresaId, NOMBRE_CUENTA_A_COBRAR, 'ACTIVO');
    await crearFormaPago(empresaId, NOMBRE_CUENTA_A_COBRAR, cuentaId, ['VENTA', 'COBRO']);
    cuenta = { nombre: NOMBRE_CUENTA_A_COBRAR, cuentaId };
  }

  // La categoría con la que se SALDA (Cobro: Banco / Cuenta a cobrar):
  // si la cuenta ya existía, normalmente ya está; solo se crea si falta.
  const { data: categoriaLiquidacion, error: errorCategoria } = await supabase
    .from('categorias_operacion')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('operacion', 'COBRO')
    .eq('nombre', cuenta.nombre)
    .maybeSingle();

  if (errorCategoria) {
    throw errorCategoria;
  }

  if (!categoriaLiquidacion) {
    seCreoAlgo = true;
    await habilitarLiquidacionCuentaCobrar(empresaId, cuenta.cuentaId, cuenta.nombre);
  }

  if (seCreoAlgo) {
    await generarMatrizOperaciones(empresaId);
  }

  const { error: errorGuardar } = await supabase
    .from('empresas')
    .update({ forma_pago_a_cobrar: cuenta.nombre })
    .eq('id', empresaId);

  if (errorGuardar) {
    throw errorGuardar;
  }

  return { formaPago: cuenta.nombre, categoriaLiquidacion: cuenta.nombre };
}
