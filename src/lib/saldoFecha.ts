// lib/saldoFecha.ts
//
// Saldo de una cuenta del plan según la fecha de sus movimientos. Lógica pura (sin Supabase), la misma idea que stockFecha.ts:
// una operación con fecha atrasada no puede mirar solo el saldo de ESA fecha, porque lo que mueve se resta también de todos los
// días posteriores (un pago ya cargado más adelante podría quedar sin fondos). Los movimientos van con su signo ya aplicado según
// la naturaleza de la cuenta (positivo = aumenta el saldo de la cuenta, negativo = lo reduce).

import { aCentavos } from './centavos';

export type MovimientoCuenta = { fecha: string; delta: number };

// Saldo al cierre de `fecha` y de cada día posterior con movimientos.
function saldosDesde(saldoInicial: number, movimientos: MovimientoCuenta[], fecha: string): Array<{ fecha: string; saldo: number }> {
  const ordenados = [...movimientos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  let saldo = saldoInicial;
  let i = 0;

  while (i < ordenados.length && String(ordenados[i].fecha) <= fecha) {
    saldo += ordenados[i].delta;
    i += 1;
  }

  const dias = [{ fecha, saldo: aCentavos(saldo) }];

  while (i < ordenados.length) {
    saldo += ordenados[i].delta;
    if (i + 1 >= ordenados.length || ordenados[i + 1].fecha !== ordenados[i].fecha) dias.push({ fecha: String(ordenados[i].fecha), saldo: aCentavos(saldo) });
    i += 1;
  }

  return dias;
}

export function saldoAFecha(saldoInicial: number, movimientos: MovimientoCuenta[], fecha: string): number {
  return saldosDesde(saldoInicial, movimientos, fecha)[0].saldo;
}

// Lo que se puede restar a la cuenta en `fecha` sin dejarla en negativo ese día ni ningún día posterior.
export function saldoUtilizableAFecha(saldoInicial: number, movimientos: MovimientoCuenta[], fecha: string): number {
  return Math.min(...saldosDesde(saldoInicial, movimientos, fecha).map((d) => d.saldo));
}

// Primer día (desde `fecha`) en que restar `monto` dejaría la cuenta en negativo; null si alcanza siempre.
export function primerDiaSinSaldo(saldoInicial: number, movimientos: MovimientoCuenta[], fecha: string, monto: number): string | null {
  return saldosDesde(saldoInicial, movimientos, fecha).find((d) => aCentavos(d.saldo - monto) < 0)?.fecha ?? null;
}

// Un cambio (borrar o editar una operación) "empeora" la cuenta si deja un día en negativo que antes no lo estaba (o más negativo):
// no se bloquea por saldos que ya venían mal, solo por lo que el cambio causaría.
export function cambioDejaSaldoNegativo(saldoInicial: number, antes: MovimientoCuenta[], despues: MovimientoCuenta[], desdeFecha: string): string | null {
  const minimoDespues = saldoUtilizableAFecha(saldoInicial, despues, desdeFecha);
  if (minimoDespues >= 0 || minimoDespues >= saldoUtilizableAFecha(saldoInicial, antes, desdeFecha)) return null;
  return primerDiaSinSaldo(saldoInicial, despues, desdeFecha, 0);
}
