// lib/saldoCuenta.ts
//
// Saldo en vivo de la cuenta detrás de una forma de pago, a una
// fecha — mismo cálculo exacto que ya usa registrarOperacion
// (motor.ts) para bloquear una operación que dejaría la cuenta en
// negativo, expuesto acá para mostrarlo en pantalla mientras se
// completa el formulario (igual que el stock disponible de un
// producto).

import { supabase } from './supabase';
import { obtenerSaldoCuenta } from './motor';

// Solo tiene sentido mostrar un "saldo" para una cuenta de Activo
// (Caja, Banco, Cuenta a Cobrar...) o Pasivo (Tarjeta, Préstamo...) —
// son las únicas que acumulan un stock de plata/deuda de un momento a
// otro. Ingreso/Gasto/Costo/Patrimonio son cuentas de flujo (lo que
// entró/salió en el período), no de saldo puntual, así que no
// corresponde mostrarles nada acá.
function esActivoOPasivo(tipoSaldo: string | null | undefined): boolean {
  return tipoSaldo === 'ACTIVO' || tipoSaldo === 'PASIVO';
}

export async function saldoDeFormaDePago(
  empresaId: string,
  nombreFormaPago: string,
  fecha: string
): Promise<{ cuenta: string; saldo: number } | null> {
  if (!nombreFormaPago || !fecha) return null;

  const { data: formaPago } = await supabase
    .from('formas_pago')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('nombre', nombreFormaPago)
    .maybeSingle();

  if (!formaPago) return null;

  const { data: link } = await supabase
    .from('forma_pago_cuentas')
    .select('cuenta_id')
    .eq('forma_pago_id', formaPago.id)
    .maybeSingle();

  if (!link) return null;

  const { data: cuenta } = await supabase
    .from('plan_cuentas')
    .select('nombre')
    .eq('id', link.cuenta_id)
    .maybeSingle();

  if (!cuenta) return null;

  const resultado = await obtenerSaldoCuenta(empresaId, cuenta.nombre, fecha);

  if (!resultado || !esActivoOPasivo(resultado.tipoSaldo)) return null;

  return { cuenta: cuenta.nombre, saldo: resultado.saldo };
}

// En una Transferencia, tanto "Hacia" como "Desde" pueden resolver a
// una forma de pago real (medio a medio) o a una cuenta de Ahorro/
// Inversión (Plazo Fijo, Caxinhas...), que vive en
// categorias_operacion en vez de formas_pago — se prueba primero como
// forma de pago y, si no existe, como categoría de Transferencia.
export async function saldoEnTransferencia(
  empresaId: string,
  nombre: string,
  fecha: string
): Promise<{ cuenta: string; saldo: number } | null> {
  const porFormaPago = await saldoDeFormaDePago(empresaId, nombre, fecha);
  if (porFormaPago) return porFormaPago;

  return saldoDeCategoria(empresaId, nombre, 'TRANSFERENCIA', fecha);
}

// Mismo cálculo que arriba, pero para la cuenta detrás de una
// CATEGORÍA (ej. "Préstamos Santander" o "T. de Crédito a Pagar Nu"
// cuando se paga la deuda en sí, no un gasto financiado con ella) —
// esas viven en categorias_operacion/categorias_operacion_cuentas,
// una tabla totalmente aparte de formas_pago/forma_pago_cuentas.
export async function saldoDeCategoria(
  empresaId: string,
  nombreCategoria: string,
  operacion: string,
  fecha: string
): Promise<{ cuenta: string; saldo: number } | null> {
  if (!nombreCategoria || !fecha) return null;

  const { data: categoria } = await supabase
    .from('categorias_operacion')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion)
    .eq('nombre', nombreCategoria)
    .maybeSingle();

  if (!categoria) return null;

  const { data: link } = await supabase
    .from('categorias_operacion_cuentas')
    .select('cuenta_id')
    .eq('categoria_operacion_id', categoria.id)
    .eq('activo', true)
    .maybeSingle();

  if (!link) return null;

  const { data: cuenta } = await supabase
    .from('plan_cuentas')
    .select('nombre')
    .eq('id', link.cuenta_id)
    .maybeSingle();

  if (!cuenta) return null;

  const resultado = await obtenerSaldoCuenta(empresaId, cuenta.nombre, fecha);

  if (!resultado || !esActivoOPasivo(resultado.tipoSaldo)) return null;

  return { cuenta: cuenta.nombre, saldo: resultado.saldo };
}
