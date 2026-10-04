// lib/saludCaja.ts
//
// SALUD DE CAJA — compara lo que vas a tener (saldo de las cuentas de
// dinero que el cliente elige mostrar + ingresos pendientes del
// período) contra lo que vas a necesitar pagar (pasivos y gastos
// recurrentes pendientes del mismo período). Vive entre Mis Ingresos
// y Mis Vencimientos en Panel de Controle.
//
// "Cuenta de dinero" = una Forma de Pago que resuelve a una cuenta del
// plan de cuentas de tipo ACTIVO (Caja, Banco...) — se excluyen las
// que resuelven a PASIVO (Tarjeta de Crédito) porque esas ya se
// cuentan del lado de los pasivos, no del disponible.
//
// Qué cuentas se muestran queda guardado en
// formas_pago.incluir_en_salud_caja — una preferencia de la empresa
// (no de cada usuario), fija hasta que alguien la cambia a mano desde
// este mismo panel.

import { supabase } from './supabase';
import { obtenerSaldoCuenta } from './motor';
import { idsCuentasPorCobrar } from './cuentasPorCobrar';

export type CuentaDeDinero = {
  formaPagoId: string;
  nombre: string;
  cuentaNombre: string;
  incluida: boolean;
  saldo: number;
};

export async function listarCuentasDeDinero(empresaId: string, fecha: string): Promise<CuentaDeDinero[]> {
  const { data: formasPago, error } = await supabase
    .from('formas_pago')
    .select('id, nombre, incluir_en_salud_caja, forma_pago_cuentas!inner(cuenta_id, activo)')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .eq('forma_pago_cuentas.activo', true);

  if (error) {
    throw error;
  }

  const cuentaIds = Array.from(
    new Set(
      (formasPago ?? []).flatMap((fp) =>
        (fp.forma_pago_cuentas as unknown as { cuenta_id: string }[]).map((v) => v.cuenta_id)
      )
    )
  );

  if (cuentaIds.length === 0) {
    return [];
  }

  const { data: cuentas, error: errorCuentas } = await supabase
    .from('plan_cuentas')
    .select('id, nombre, tipo_saldo')
    .in('id', cuentaIds)
    .eq('tipo_saldo', 'ACTIVO');

  if (errorCuentas) {
    throw errorCuentas;
  }

  // Una cuenta a cobrar no es plata disponible: ya entra como "a cobrar" del período.
  const idsPorCobrar = await idsCuentasPorCobrar(empresaId);
  const cuentaPorId = new Map((cuentas ?? []).filter((c) => !idsPorCobrar.has(c.id)).map((c) => [c.id, c.nombre]));

  const candidatas = (formasPago ?? [])
    .map((fp) => {
      const vinculo = (fp.forma_pago_cuentas as unknown as { cuenta_id: string }[])[0];
      const cuentaNombre = vinculo ? cuentaPorId.get(vinculo.cuenta_id) : undefined;
      return cuentaNombre ? { formaPagoId: fp.id as string, nombre: fp.nombre as string, cuentaNombre, incluida: Boolean(fp.incluir_en_salud_caja) } : null;
    })
    .filter((c): c is { formaPagoId: string; nombre: string; cuentaNombre: string; incluida: boolean } => c !== null);

  const saldos = await Promise.all(candidatas.map((c) => obtenerSaldoCuenta(empresaId, c.cuentaNombre, fecha)));

  return candidatas
    .map((c, i) => ({ ...c, saldo: saldos[i]?.saldo ?? 0 }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function cambiarCuentaEnSaludCaja(formaPagoId: string, incluida: boolean) {
  const { error } = await supabase.from('formas_pago').update({ incluir_en_salud_caja: incluida }).eq('id', formaPagoId);
  if (error) {
    throw error;
  }
}
