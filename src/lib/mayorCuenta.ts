// lib/mayorCuenta.ts
//
// Libro Mayor de una cuenta (Informes → Mayor): movimientos con saldo corrido, filtro por mes
// e indicadores. Solo lectura sobre los asientos ya cargados; no toca el motor.

export type AsientoMayor = {
  id_operacion: string | null;
  fecha: string;
  descripcion: string;
  debito: string | null;
  credito: string | null;
  importe: number;
  operacion: string | null;
};

export type CuentaMayor = { nombre: string; naturaleza?: string | null; saldo_inicial?: number | string | null };

export type FilaMayor = AsientoMayor & { esDebe: boolean; contrapartida: string; saldo: number };

export type MayorDelMes = {
  // Meses 'YYYY-MM' en que la cuenta tuvo movimientos, del más reciente al más viejo.
  meses: string[];
  // Saldo con el que arranca el período elegido (el saldo inicial de la cuenta si es "Todos").
  saldoAnterior: number;
  filas: FilaMayor[];
  saldoFinal: number;
  indicadores: {
    variacionSaldo: number;
    debe: number;
    haber: number;
    neto: number;
    movimientos: number;
    // Volumen (debe + haber) del mes previo; null con "Todos" o si ese mes no tuvo movimiento.
    volumenMesAnterior: number | null;
    variacionVolumen: number | null;
    contrapartidas: { cuenta: string; importe: number; porcentaje: number }[];
  };
};

const redondear = (n: number) => Math.round(n * 100) / 100;

export function mesAnteriorDe(mes: string): string {
  const [anio, m] = mes.split('-').map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, '0')}`;
}

// `mes` = 'YYYY-MM' o 'TODOS'.
export function armarMayor(cuenta: CuentaMayor, asientos: AsientoMayor[], mes: string): MayorDelMes {
  const esAcreedora = cuenta.naturaleza === 'ACREEDORA';
  const inicial = Number(cuenta.saldo_inicial ?? 0);

  const movimientos = asientos
    .filter((a) => a.debito === cuenta.nombre || a.credito === cuenta.nombre)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.id_operacion ?? '').localeCompare(b.id_operacion ?? ''));

  // El saldo corrido siempre arranca del saldo inicial de la cuenta, así un mes puntual
  // muestra el saldo real (no uno recalculado desde cero).
  let saldo = inicial;
  let saldoAnterior = inicial;
  const todas: FilaMayor[] = movimientos.map((m) => {
    const esDebe = m.debito === cuenta.nombre;
    const monto = esDebe ? m.importe : -m.importe;
    const mesFila = m.fecha.slice(0, 7);

    if (mes !== 'TODOS' && mesFila < mes) saldoAnterior = redondear(saldoAnterior + (esAcreedora ? -monto : monto));
    saldo += esAcreedora ? -monto : monto;

    return { ...m, esDebe, contrapartida: (esDebe ? m.credito : m.debito) ?? '—', saldo };
  });

  const filas = mes === 'TODOS' ? todas : todas.filter((f) => f.fecha.slice(0, 7) === mes);
  const debe = redondear(filas.filter((f) => f.esDebe).reduce((s, f) => s + f.importe, 0));
  const haber = redondear(filas.filter((f) => !f.esDebe).reduce((s, f) => s + f.importe, 0));
  const saldoFinal = filas.length ? filas[filas.length - 1].saldo : saldoAnterior;

  let volumenMesAnterior: number | null = null;
  if (mes !== 'TODOS') {
    const previo = todas.filter((f) => f.fecha.slice(0, 7) === mesAnteriorDe(mes));
    if (previo.length) volumenMesAnterior = redondear(previo.reduce((s, f) => s + f.importe, 0));
  }
  const volumen = redondear(debe + haber);

  const porContrapartida = new Map<string, number>();
  for (const f of filas) porContrapartida.set(f.contrapartida, (porContrapartida.get(f.contrapartida) ?? 0) + f.importe);

  return {
    meses: Array.from(new Set(todas.map((f) => f.fecha.slice(0, 7)))).sort((a, b) => b.localeCompare(a)),
    saldoAnterior: redondear(saldoAnterior),
    filas,
    saldoFinal: redondear(saldoFinal),
    indicadores: {
      variacionSaldo: redondear(saldoFinal - saldoAnterior),
      debe,
      haber,
      neto: redondear(debe - haber),
      movimientos: filas.length,
      volumenMesAnterior,
      variacionVolumen: volumenMesAnterior ? redondear(((volumen - volumenMesAnterior) / volumenMesAnterior) * 100) : null,
      contrapartidas: Array.from(porContrapartida.entries())
        .map(([cuentaContra, importe]) => ({
          cuenta: cuentaContra,
          importe: redondear(importe),
          porcentaje: volumen > 0 ? redondear((importe / volumen) * 100) : 0,
        }))
        .sort((a, b) => b.importe - a.importe || a.cuenta.localeCompare(b.cuenta))
        .slice(0, 3),
    },
  };
}
