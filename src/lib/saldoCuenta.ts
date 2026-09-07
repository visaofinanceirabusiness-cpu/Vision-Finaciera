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

  if (!resultado) return null;

  return { cuenta: cuenta.nombre, saldo: resultado.saldo };
}
