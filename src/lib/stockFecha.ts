// lib/stockFecha.ts
//
// Stock de un producto según la fecha de los movimientos. Lógica pura (sin Supabase), compartida por el motor contable
// (ventas, pérdidas, ediciones y bajas) y por Producción. Una operación con fecha atrasada no puede mirar solo el stock
// de ESA fecha: lo que consume tiene que seguir alcanzando para las salidas ya cargadas en fechas posteriores.

export type MovimientoSimple = { tipo: string; cantidad: number | string | null; fecha: string };

const delta = (m: MovimientoSimple) => (m.tipo === 'ENTRADA' ? 1 : -1) * Number(m.cantidad ?? 0);
const ordenar = (movimientos: MovimientoSimple[]) => [...movimientos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

// Saldo al cierre de cada día con movimientos, de `fecha` en adelante, más el saldo a `fecha` misma (antes de lo posterior).
function saldosDesde(movimientos: MovimientoSimple[], fecha: string): Array<{ fecha: string; saldo: number }> {
  const ordenados = ordenar(movimientos);
  let saldo = 0;
  let i = 0;

  while (i < ordenados.length && String(ordenados[i].fecha) <= fecha) {
    saldo += delta(ordenados[i]);
    i += 1;
  }

  const dias = [{ fecha, saldo }];

  while (i < ordenados.length) {
    saldo += delta(ordenados[i]);
    // Los movimientos de un mismo día se suman antes de mirar el saldo de ese día.
    if (i + 1 >= ordenados.length || ordenados[i + 1].fecha !== ordenados[i].fecha) dias.push({ fecha: String(ordenados[i].fecha), saldo });
    i += 1;
  }

  return dias;
}

// Cuánto se puede consumir en `fecha`: el stock a esa fecha, y sin dejar en negativo ningún día posterior (mínimo del saldo corrido).
export function stockUtilizableAFecha(movimientos: MovimientoSimple[], fecha: string): number {
  return Math.min(...saldosDesde(movimientos, fecha).map((d) => d.saldo));
}

// Primer día (desde `fecha`) en que consumir `cantidad` dejaría el stock en negativo; null si alcanza siempre.
export function primerDiaSinStock(movimientos: MovimientoSimple[], fecha: string, cantidad: number): string | null {
  return saldosDesde(movimientos, fecha).find((d) => d.saldo < cantidad)?.fecha ?? null;
}

// Un cambio (borrar, editar) "empeora" el stock si deja un día en negativo que antes no lo estaba (o más negativo).
// Así no se bloquea por saldos viejos que ya venían mal, solo por lo que el cambio causaría.
export function cambioDejaStockNegativo(antes: MovimientoSimple[], despues: MovimientoSimple[], desdeFecha: string): string | null {
  const minimoDespues = stockUtilizableAFecha(despues, desdeFecha);
  if (minimoDespues >= 0 || minimoDespues >= stockUtilizableAFecha(antes, desdeFecha)) return null;
  return primerDiaSinStock(despues, desdeFecha, 0);
}
