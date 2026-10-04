// lib/naturalezaResultado.ts
//
// ESTADO DE RESULTADO "POR NATURALEZA" — reglas puras (sin Supabase).
//
// Parte cada ingreso/gasto en tres grupos según de dónde viene:
//   FIJO                 vino de un gasto/ingreso recurrente de monto fijo
//                        (alquiler, Netflix, un sueldo)
//   RECURRENTE_VARIABLE  vino de un recurrente de monto variable (luz, agua)
//   DEL_MES              todo lo demás: lo eventual, lo que no está planificado
//
// Es solo una vista: no cambia ningún asiento ni el resultado total — la suma
// de los tres grupos da siempre el mismo total que el estado de resultado
// "por cuenta". Cuál asiento es de cuál grupo lo dice el vínculo con las
// plantillas recurrentes (el devengo del mes y los pagos/cobros vinculados);
// lo que nunca se vinculó a una plantilla queda en DEL_MES.

export type Naturaleza = 'FIJO' | 'RECURRENTE_VARIABLE' | 'DEL_MES';

export const ORDEN_NATURALEZA: Naturaleza[] = ['FIJO', 'RECURRENTE_VARIABLE', 'DEL_MES'];

export type VinculoRecurrente = { idOperacion: string; montoFijo: boolean };

// Si un mismo asiento aparece en más de un vínculo (ej. el devengo y un pago
// vinculado), FIJO gana: es el grupo más "comprometido".
export function mapaNaturaleza(vinculos: VinculoRecurrente[]): Map<string, Naturaleza> {
  const mapa = new Map<string, Naturaleza>();

  for (const vinculo of vinculos) {
    if (!vinculo.idOperacion) continue;

    const nueva: Naturaleza = vinculo.montoFijo ? 'FIJO' : 'RECURRENTE_VARIABLE';
    const actual = mapa.get(vinculo.idOperacion);

    if (!actual || nueva === 'FIJO') {
      mapa.set(vinculo.idOperacion, nueva);
    }
  }

  return mapa;
}

export type CuentaResultado = {
  id: string;
  nombre: string;
  tipo_saldo: string | null;
  naturaleza: string | null;
  saldo_inicial: number | string | null;
};

export type AsientoResultado = {
  id_operacion: string | null;
  debito: string | null;
  credito: string | null;
  importe: number;
};

export type TipoResultado = 'INGRESO' | 'COSTO' | 'GASTO';

export type FilaNaturaleza = { cuentaId: string; nombre: string; valor: number };

export type GrupoNaturaleza = { filas: FilaNaturaleza[]; total: number };

export type ResultadoPorNaturaleza = Record<TipoResultado, Record<Naturaleza, GrupoNaturaleza>>;

function grupoVacio(): GrupoNaturaleza {
  return { filas: [], total: 0 };
}

// Mismo cálculo que el estado de resultado por cuenta (calcularMovimiento en
// Informes), repartido por naturaleza del asiento. El saldo inicial (arrastre
// histórico, solo con "Todos los períodos") va a DEL_MES: no viene de ninguna
// plantilla.
export function resultadoPorNaturaleza(
  cuentas: CuentaResultado[],
  asientos: AsientoResultado[],
  mapa: Map<string, Naturaleza>,
  incluirSaldoInicial: boolean
): ResultadoPorNaturaleza {
  const resultado: ResultadoPorNaturaleza = {
    INGRESO: { FIJO: grupoVacio(), RECURRENTE_VARIABLE: grupoVacio(), DEL_MES: grupoVacio() },
    COSTO: { FIJO: grupoVacio(), RECURRENTE_VARIABLE: grupoVacio(), DEL_MES: grupoVacio() },
    GASTO: { FIJO: grupoVacio(), RECURRENTE_VARIABLE: grupoVacio(), DEL_MES: grupoVacio() },
  };

  const tiposDeResultado: TipoResultado[] = ['INGRESO', 'COSTO', 'GASTO'];
  const cuentasDeResultado = cuentas.filter((c) => tiposDeResultado.includes(c.tipo_saldo as TipoResultado));
  const porNombre = new Map(cuentasDeResultado.map((c) => [c.nombre, c]));

  // debe/haber por cuenta y naturaleza, en una sola pasada por los asientos.
  const movimientos = new Map<string, Record<Naturaleza, { debe: number; haber: number }>>();

  const movimientoDe = (nombre: string) => {
    let actual = movimientos.get(nombre);
    if (!actual) {
      actual = {
        FIJO: { debe: 0, haber: 0 },
        RECURRENTE_VARIABLE: { debe: 0, haber: 0 },
        DEL_MES: { debe: 0, haber: 0 },
      };
      movimientos.set(nombre, actual);
    }
    return actual;
  };

  for (const asiento of asientos) {
    const naturaleza: Naturaleza = (asiento.id_operacion ? mapa.get(asiento.id_operacion) : undefined) ?? 'DEL_MES';

    if (asiento.debito && porNombre.has(asiento.debito)) {
      movimientoDe(asiento.debito)[naturaleza].debe += asiento.importe;
    }

    if (asiento.credito && porNombre.has(asiento.credito)) {
      movimientoDe(asiento.credito)[naturaleza].haber += asiento.importe;
    }
  }

  for (const cuenta of cuentasDeResultado) {
    const tipo = cuenta.tipo_saldo as TipoResultado;
    const mov = movimientos.get(cuenta.nombre);

    for (const naturaleza of ORDEN_NATURALEZA) {
      const debe = mov?.[naturaleza].debe ?? 0;
      const haber = mov?.[naturaleza].haber ?? 0;
      const inicial = naturaleza === 'DEL_MES' && incluirSaldoInicial ? Number(cuenta.saldo_inicial ?? 0) : 0;
      const valor = cuenta.naturaleza === 'ACREEDORA' ? inicial + haber - debe : inicial + debe - haber;

      if (Math.round(valor) !== 0) {
        resultado[tipo][naturaleza].filas.push({ cuentaId: cuenta.id, nombre: cuenta.nombre, valor });
      }
    }
  }

  for (const tipo of tiposDeResultado) {
    for (const naturaleza of ORDEN_NATURALEZA) {
      const grupo = resultado[tipo][naturaleza];
      grupo.filas.sort((a, b) => b.valor - a.valor);
      grupo.total = grupo.filas.reduce((suma, fila) => suma + fila.valor, 0);
    }
  }

  return resultado;
}

export type ResumenNaturaleza = {
  // Ingresos − costos − gastos de cada grupo.
  neto: Record<Naturaleza, number>;
  resultadoTotal: number;
  // Cuánto de los gastos recurrentes cubren los ingresos recurrentes (null si no hay gastos recurrentes).
  cobertura: number | null;
  // Qué parte de los gastos ya estaba comprometida por recurrentes (null si no hay gastos).
  pesoRecurrente: number | null;
};

export function resumenNaturaleza(resultado: ResultadoPorNaturaleza): ResumenNaturaleza {
  const neto = {} as Record<Naturaleza, number>;

  for (const naturaleza of ORDEN_NATURALEZA) {
    neto[naturaleza] =
      resultado.INGRESO[naturaleza].total - resultado.COSTO[naturaleza].total - resultado.GASTO[naturaleza].total;
  }

  const ingresosRecurrentes = resultado.INGRESO.FIJO.total + resultado.INGRESO.RECURRENTE_VARIABLE.total;
  const gastosRecurrentes = resultado.GASTO.FIJO.total + resultado.GASTO.RECURRENTE_VARIABLE.total;
  const gastosTotales = gastosRecurrentes + resultado.GASTO.DEL_MES.total;

  return {
    neto,
    resultadoTotal: neto.FIJO + neto.RECURRENTE_VARIABLE + neto.DEL_MES,
    cobertura: gastosRecurrentes > 0 ? ingresosRecurrentes / gastosRecurrentes : null,
    pesoRecurrente: gastosTotales > 0 ? gastosRecurrentes / gastosTotales : null,
  };
}
