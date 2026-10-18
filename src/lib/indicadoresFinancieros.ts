// lib/indicadoresFinancieros.ts
//
// Indicadores financieros del Panel (tarjeta de Situación actual, empresas).
// Todo sale de una "foto" por mes que arma contabilidad.ts: el balance al
// CIERRE de ese mes (acumulado, con saldo inicial) y el resultado de ESE mes
// (solo sus movimientos). Esta capa es pura: recibe fotos y devuelve números.

export type FotoMes = {
  clave: string; // "YYYY-MM"
  // Balance al cierre del mes
  activoCorriente: number; // 1.1 (disponible, por cobrar, mercaderías) + 1.3 (ahorros e inversiones)
  mercaderias: number; // 1.1.3
  activoTotal: number;
  pasivoCorriente: number; // 2.1
  pasivoTotal: number; // 2.1 + 2.2 (el plan hoy no tiene no corriente)
  patrimonioNeto: number; // aportes − retiros + resultados acumulados
  // Resultado del mes
  ingresos: number;
  costos: number; // todas las cuentas tipo COSTO (costo de ventas / servicio)
  gastosOperativos: number; // gastos menos los financieros e impuestos
  gastosNoOperativos: number; // 6.4 financieros + 6.5 impuestos
};

export type IndicadorId =
  | 'liquidezCorriente'
  | 'liquidezSeca'
  | 'liquidezGeneral'
  | 'margenBruto'
  | 'margenOperacional'
  | 'margenLiquido'
  | 'rentabilidadActivo'
  | 'rentabilidadPN'
  | 'participacionTerceros'
  | 'endeudamiento'
  | 'crecimientoIngresos'
  | 'crecimientoLucro';

export type Unidad = 'veces' | 'porcentaje';

export const INDICADORES: { id: IndicadorId; unidad: Unidad; subirEsBueno: boolean }[] = [
  { id: 'liquidezCorriente', unidad: 'veces', subirEsBueno: true },
  { id: 'liquidezSeca', unidad: 'veces', subirEsBueno: true },
  { id: 'liquidezGeneral', unidad: 'veces', subirEsBueno: true },
  { id: 'margenBruto', unidad: 'porcentaje', subirEsBueno: true },
  { id: 'margenOperacional', unidad: 'porcentaje', subirEsBueno: true },
  { id: 'margenLiquido', unidad: 'porcentaje', subirEsBueno: true },
  { id: 'rentabilidadActivo', unidad: 'porcentaje', subirEsBueno: true },
  { id: 'rentabilidadPN', unidad: 'porcentaje', subirEsBueno: true },
  { id: 'participacionTerceros', unidad: 'porcentaje', subirEsBueno: false },
  { id: 'endeudamiento', unidad: 'porcentaje', subirEsBueno: false },
  { id: 'crecimientoIngresos', unidad: 'porcentaje', subirEsBueno: true },
  { id: 'crecimientoLucro', unidad: 'porcentaje', subirEsBueno: true },
];

export type ResultadoIndicadores = Record<IndicadorId, number | null>;

const redondear = (valor: number, decimales = 2) => {
  const f = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * f) / f;
};

// null cuando el divisor no permite un número con sentido (cero, o negativo
// donde un ratio con patrimonio negativo engañaría).
function razon(numerador: number, divisor: number, { exigirPositivo = false } = {}): number | null {
  if (divisor === 0 || (exigirPositivo && divisor < 0)) return null;
  return numerador / divisor;
}

export function lucroDe(foto: FotoMes): number {
  return redondear(foto.ingresos - foto.costos - foto.gastosOperativos - foto.gastosNoOperativos);
}

// Variación sobre la base en valor absoluto: pasar de −100 a −50 es una mejora.
function crecimiento(actual: number, anterior: number | null): number | null {
  if (anterior === null || anterior === 0) return null;
  return redondear(((actual - anterior) / Math.abs(anterior)) * 100);
}

export function calcularIndicadores(
  actual: FotoMes,
  anterior: FotoMes | null,
  opciones: { anualizar?: boolean } = {}
): ResultadoIndicadores {
  const lucro = lucroDe(actual);
  const factor = opciones.anualizar ? 12 : 1;
  const pct = (valor: number | null) => (valor === null ? null : redondear(valor * 100, 1));
  const veces = (valor: number | null) => (valor === null ? null : redondear(valor, 2));

  return {
    liquidezCorriente: veces(razon(actual.activoCorriente, actual.pasivoCorriente, { exigirPositivo: true })),
    liquidezSeca: veces(razon(actual.activoCorriente - actual.mercaderias, actual.pasivoCorriente, { exigirPositivo: true })),
    // El plan no tiene realizable a largo plazo: (AC + RLP) / (PC + PNC) = AC / pasivo total.
    liquidezGeneral: veces(razon(actual.activoCorriente, actual.pasivoTotal, { exigirPositivo: true })),
    margenBruto: pct(razon(actual.ingresos - actual.costos, actual.ingresos, { exigirPositivo: true })),
    margenOperacional: pct(razon(actual.ingresos - actual.costos - actual.gastosOperativos, actual.ingresos, { exigirPositivo: true })),
    margenLiquido: pct(razon(lucro, actual.ingresos, { exigirPositivo: true })),
    rentabilidadActivo: pct(razon(lucro * factor, actual.activoTotal, { exigirPositivo: true })),
    rentabilidadPN: pct(razon(lucro * factor, actual.patrimonioNeto, { exigirPositivo: true })),
    participacionTerceros: pct(razon(actual.pasivoTotal, actual.patrimonioNeto, { exigirPositivo: true })),
    endeudamiento: pct(razon(actual.pasivoTotal, actual.activoTotal, { exigirPositivo: true })),
    crecimientoIngresos: anterior ? crecimiento(actual.ingresos, anterior.ingresos) : null,
    crecimientoLucro: anterior ? crecimiento(lucro, lucroDe(anterior)) : null,
  };
}

// Serie de un indicador hasta (e incluyendo) el mes elegido, para la mini-línea
// y el gráfico de tendencia.
export function serieDeIndicador(
  fotos: FotoMes[],
  id: IndicadorId,
  opciones: { anualizar?: boolean; hastaClave?: string; ultimos?: number } = {}
): { clave: string; valor: number | null }[] {
  const hasta = opciones.hastaClave ? fotos.findIndex((f) => f.clave === opciones.hastaClave) : fotos.length - 1;
  if (hasta < 0) return [];

  const inicio = opciones.ultimos ? Math.max(0, hasta - opciones.ultimos + 1) : 0;
  const salida: { clave: string; valor: number | null }[] = [];

  for (let i = inicio; i <= hasta; i++) {
    salida.push({ clave: fotos[i].clave, valor: calcularIndicadores(fotos[i], i > 0 ? fotos[i - 1] : null, opciones)[id] });
  }

  return salida;
}

// Cambio de un mes al anterior, en la unidad del indicador (puntos porcentuales
// o veces), y si ese cambio es favorable. null si falta alguno de los dos.
export function cambioContraAnterior(
  id: IndicadorId,
  actual: number | null,
  anterior: number | null
): { delta: number; favorable: boolean | null } | null {
  if (actual === null || anterior === null) return null;

  const delta = redondear(actual - anterior, id.startsWith('liquidez') ? 2 : 1);
  if (delta === 0) return { delta, favorable: null };

  const subirEsBueno = INDICADORES.find((i) => i.id === id)?.subirEsBueno ?? true;
  return { delta, favorable: delta > 0 === subirEsBueno };
}
