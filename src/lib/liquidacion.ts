// lib/liquidacion.ts
//
// Regla pura: qué medio puede SALDAR una deuda o COBRAR algo pendiente.
//
// Un PAGO que liquida una cuenta de Pasivo ("Préstamos Santander": Debe
// Pasivo / Haber Medio) o un COBRO que liquida una cuenta a cobrar (Debe Medio
// / Haber Activo a cobrar) tiene que mover plata de verdad: caja, banco o
// billetera. Con otro pasivo (el mismo préstamo, una tarjeta) o con otra
// cuenta a cobrar como "medio", el asiento solo traslada una deuda o un
// crédito de un lado a otro y deja los saldos sin sentido. La matriz de
// operaciones combina cada categoría con todos los medios habilitados, así que
// esta regla se aplica al registrar (ver validarMedioDeLiquidacion en motor.ts).

export type ReglaDeLiquidacion = {
  operacion: string;
  motor: string | null | undefined;
  cuenta_debito: string | null | undefined;
  cuenta_credito: string | null | undefined;
};

// Cuál de las dos cuentas del asiento es el "medio" cuando la regla es una
// liquidación; null si no lo es (gasto, ingreso, venta a crédito, etc.).
export function cuentaMedioDeLiquidacion(regla: ReglaDeLiquidacion): string | null {
  if (regla.operacion === 'PAGO' && regla.motor === 'PASIVOS') return regla.cuenta_credito ?? null;
  if (regla.operacion === 'COBRO' && regla.motor === 'ACTIVO') return regla.cuenta_debito ?? null;
  return null;
}

// true si ese medio NO sirve para liquidar. Un tipo desconocido (la cuenta no
// se encontró) no se bloquea: eso lo reportan los otros chequeos del motor.
export function medioNoValidoParaLiquidar(tipoSaldoMedio: string | null | undefined, esCuentaPorCobrar: boolean): boolean {
  if (!tipoSaldoMedio) return false;
  return tipoSaldoMedio !== 'ACTIVO' || esCuentaPorCobrar;
}
