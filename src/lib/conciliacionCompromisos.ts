// lib/conciliacionCompromisos.ts
//
// Lógica pura para "conciliar" los meses devengados con el Libro Diario: un
// cobro (o pago) contra la cuenta "X a cobrar" ("X a pagar") puede haberse
// cargado por cualquier camino (Mini-Juego, Sabio Bot, Lanzamiento rápido...)
// y no por el botón Cobrar/Pagar del compromiso, así que el mes seguía
// "pendiente". El Libro Diario es la fuente de verdad: lo que ya entró por ahí
// y no está asociado a ningún mes se reparte acá, del mes más viejo al más nuevo.

export type FilaDevengada = {
  id: string;
  cuenta: string;
  // 'YYYY-MM-01'
  periodo: string;
  devengado: number;
  // Lo ya cobrado/pagado según el recordatorio.
  movido: number;
};

export type MovimientoLibro = {
  idOperacion: string;
  cuenta: string;
  fecha: string;
  monto: number;
};

export type Asignacion = { recordatorioId: string; idOperacion: string; monto: number; fecha: string };

const TOLERANCIA = 0.01;

// `filas` = meses DEVENGADA con saldo (los candidatos); `movidoPorCuenta` = lo
// que los recordatorios (todos, incluidos los saldados) ya tienen imputado a
// esa cuenta; `movimientos` = lo que el Libro Diario movió contra la cuenta y
// todavía no está asociado a ningún mes.
//
// Solo se reparte la DIFERENCIA entre el libro y lo ya imputado (si un dato
// viejo quedó imputado sin dejar su asociación, no se cuenta dos veces), y un
// movimiento solo cubre meses ya devengados a su fecha (periodo <= fecha).
export function repartirMovimientos(
  filas: FilaDevengada[],
  movimientos: MovimientoLibro[],
  movidoPorCuenta: Map<string, number>,
  totalLibroPorCuenta: Map<string, number>
): Asignacion[] {
  const saldos = new Map(filas.map((f) => [f.id, f.devengado - f.movido]));
  const faltaAsociar = new Map<string, number>();

  for (const [cuenta, total] of totalLibroPorCuenta) {
    faltaAsociar.set(cuenta, total - (movidoPorCuenta.get(cuenta) ?? 0));
  }

  const asignaciones: Asignacion[] = [];
  const ordenados = [...movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.idOperacion.localeCompare(b.idOperacion));

  for (const mov of ordenados) {
    let restante = Math.min(mov.monto, faltaAsociar.get(mov.cuenta) ?? 0);

    const candidatas = filas
      .filter((f) => f.cuenta === mov.cuenta && f.periodo <= mov.fecha)
      .sort((a, b) => a.periodo.localeCompare(b.periodo));

    for (const fila of candidatas) {
      if (restante <= TOLERANCIA) break;
      const saldo = saldos.get(fila.id) ?? 0;
      if (saldo <= TOLERANCIA) continue;

      const monto = Math.min(saldo, restante);
      asignaciones.push({ recordatorioId: fila.id, idOperacion: mov.idOperacion, monto, fecha: mov.fecha });
      saldos.set(fila.id, saldo - monto);
      restante -= monto;
      faltaAsociar.set(mov.cuenta, (faltaAsociar.get(mov.cuenta) ?? 0) - monto);
    }
  }

  return asignaciones;
}
