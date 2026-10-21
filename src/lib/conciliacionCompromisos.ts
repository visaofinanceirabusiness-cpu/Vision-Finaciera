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

// ---------------------------------------------------------------------------
// Cuotas de pasivos / cuentas a cobrar
// ---------------------------------------------------------------------------
// Un pago (cobro) contra la cuenta del pasivo cargado "libre" —sin el botón Pagar de la
// cuota— baja la deuda en el libro pero dejaba la cuota entera. Se reparte entre las cuotas
// abiertas de esa cuenta, de la que vence primero a la última.
//
// Solo cuentan los movimientos cargados DESPUÉS de que existiera la cuota (lo anterior —pagos de
// deudas sin cuotas, cuotas saldadas a mano— no se toca) y solo cuotas que vencen hasta el fin del
// mes del pago: un pago de este mes no adelanta las cuotas de meses futuros.

export type CuotaAbiertaConciliable = {
  id: string;
  // Cuenta contable del pasivo (o del activo a cobrar), tomada de la operación que originó la cuota.
  cuenta: string;
  vencimiento: string;
  creadaEn: string;
  saldo: number;
};

export type MovimientoLibreCuota = {
  idOperacion: string;
  cuenta: string;
  fecha: string;
  creadoEn: string;
  monto: number;
};

export function repartirMovimientosEnCuotas(cuotas: CuotaAbiertaConciliable[], movimientos: MovimientoLibreCuota[]): Asignacion[] {
  const saldos = new Map(cuotas.map((c) => [c.id, c.saldo]));
  const asignaciones: Asignacion[] = [];
  const ordenados = [...movimientos].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.idOperacion.localeCompare(b.idOperacion));

  for (const mov of ordenados) {
    let restante = mov.monto;

    const candidatas = cuotas
      .filter((c) => c.cuenta === mov.cuenta && c.creadaEn <= mov.creadoEn && c.vencimiento <= `${mov.fecha.slice(0, 7)}-31`)
      .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.creadaEn.localeCompare(b.creadaEn));

    for (const cuota of candidatas) {
      if (restante <= TOLERANCIA) break;
      const saldo = saldos.get(cuota.id) ?? 0;
      if (saldo <= TOLERANCIA) continue;

      const monto = Math.min(saldo, restante);
      asignaciones.push({ recordatorioId: cuota.id, idOperacion: mov.idOperacion, monto, fecha: mov.fecha });
      saldos.set(cuota.id, saldo - monto);
      restante -= monto;
    }
  }

  return asignaciones;
}
