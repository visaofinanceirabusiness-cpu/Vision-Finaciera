// lib/informes/dre.ts — cálculos puros de la vista visual del Estado de Resultado (tarjetas, torta, top de cuentas, análisis de Sabio).
// Todo sale de los números que ya calcula el informe: acá no se consulta nada.

export type FilaCuenta = { nombre: string; valor: number };

export function variacionPct(actual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || Math.abs(anterior) < 0.005) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

export type TrozoTorta = { nombre: string; valor: number; pct: number; esOtros: boolean };

// Las `max` cuentas más grandes y el resto agrupado en «Otros».
export function composicionSalidas(filas: FilaCuenta[], max: number, nombreOtros: string): TrozoTorta[] {
  const positivas = filas.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = positivas.reduce((s, f) => s + f.valor, 0);
  if (total <= 0) return [];
  const principales = positivas.slice(0, max);
  const resto = positivas.slice(max).reduce((s, f) => s + f.valor, 0);
  const trozos: TrozoTorta[] = principales.map((f) => ({ nombre: f.nombre, valor: f.valor, pct: (f.valor / total) * 100, esOtros: false }));
  if (resto > 0) trozos.push({ nombre: nombreOtros, valor: resto, pct: (resto / total) * 100, esOtros: true });
  return trozos;
}

export type FilaTop = FilaCuenta & { pct: number };

export function topCuentas(filas: FilaCuenta[], n: number, ordenar = true): { filas: FilaTop[]; total: number; hayMas: boolean } {
  const positivas = filas.filter((f) => f.valor > 0);
  if (ordenar) positivas.sort((a, b) => b.valor - a.valor);
  const total = positivas.reduce((s, f) => s + f.valor, 0);
  return {
    filas: positivas.slice(0, n).map((f) => ({ ...f, pct: total > 0 ? (f.valor / total) * 100 : 0 })),
    total,
    hayMas: positivas.length > n,
  };
}

export type DatosAnalisis = {
  pt: boolean;
  esFamiliar: boolean;
  ingresos: number;
  salidas: number; // costos + gastos
  resultado: number;
  ingresosAnterior: number | null;
  mayoresSalidas: string[]; // nombres, de mayor a menor
  dinero: (n: number) => string;
};

// Texto de Sabio por reglas: nunca inventa un dato que no esté en el informe.
export function analisisSabio(d: DatosAnalisis): string[] {
  const { pt } = d;
  if (d.ingresos === 0 && d.salidas === 0) return [pt ? 'Ainda não há movimentos neste período.' : 'Todavía no hay movimientos en este período.'];

  const rent = d.ingresos !== 0 ? (d.resultado / d.ingresos) * 100 : 0;
  const rentTxt = `${rent.toFixed(1).replace('.', pt ? ',' : ',')}%`;
  const sustantivo = d.esFamiliar ? (pt ? 'saldo do período' : 'saldo del período') : pt ? 'resultado líquido' : 'resultado neto';
  const parrafos: string[] = [];

  const primera =
    d.resultado < 0
      ? pt ? `Seu ${sustantivo} ficou negativo em ${d.dinero(Math.abs(d.resultado))} (${rentTxt}).` : `Tu ${sustantivo} quedó negativo en ${d.dinero(Math.abs(d.resultado))} (${rentTxt}).`
      : pt ? `Seu ${sustantivo} ficou positivo em ${d.dinero(d.resultado)} (${rentTxt}).` : `Tu ${sustantivo} quedó positivo en ${d.dinero(d.resultado)} (${rentTxt}).`;

  const v = d.ingresosAnterior === null ? null : variacionPct(d.ingresos, d.ingresosAnterior);
  let segunda = '';
  if (v !== null && v >= 5) segunda = pt ? ` A boa notícia é o crescimento das receitas (+${v.toFixed(1).replace('.', ',')}%).` : ` La buena noticia es el crecimiento de los ingresos (+${v.toFixed(1).replace('.', ',')}%).`;
  if (v !== null && v <= -5) segunda = pt ? ` Atenção: as receitas caíram ${Math.abs(v).toFixed(1).replace('.', ',')}% em relação ao mês anterior.` : ` Atención: los ingresos cayeron ${Math.abs(v).toFixed(1).replace('.', ',')}% respecto del mes anterior.`;
  parrafos.push(primera + segunda);

  const top = d.mayoresSalidas.slice(0, 2);
  if (top.length > 0) {
    const nombres = top.join(pt ? ' e ' : ' y ');
    if (d.resultado < 0 || rent < 10) {
      parrafos.push(pt ? `Para melhorar o resultado, revise as saídas de maior impacto (${nombres}).` : `Para mejorar el resultado, revisá las salidas de mayor impacto (${nombres}).`);
    } else {
      parrafos.push(pt ? `Continue assim! O maior peso das saídas está em ${nombres}: vale mantê-lo sob controle.` : `¡Seguí así! El mayor peso de las salidas está en ${nombres}: conviene mantenerlo bajo control.`);
    }
  }
  return parrafos;
}

// ---- Vista «por naturaleza» (fijos / recurrentes variables / del mes) ----
export type NaturalezaClave = 'FIJO' | 'RECURRENTE_VARIABLE' | 'DEL_MES';
export const ORDEN_NAT: NaturalezaClave[] = ['FIJO', 'RECURRENTE_VARIABLE', 'DEL_MES'];

export function etiquetasNaturaleza(pt: boolean): Record<NaturalezaClave, string> {
  return {
    FIJO: pt ? 'Fixos' : 'Fijos',
    RECURRENTE_VARIABLE: pt ? 'Recorrentes variáveis' : 'Recurrentes variables',
    DEL_MES: pt ? 'Do mês' : 'Del mes',
  };
}

// Un total por naturaleza, sumando los tipos pedidos (p. ej. costos + gastos para «salidas»).
export function filasPorNaturaleza(totales: Record<NaturalezaClave, number>[], pt: boolean): FilaCuenta[] {
  const etiquetas = etiquetasNaturaleza(pt);
  return ORDEN_NAT.map((n) => ({ nombre: etiquetas[n], valor: totales.reduce((s, t) => s + (t[n] ?? 0), 0) }));
}

export type ResumenNat = { neto: Record<NaturalezaClave, number>; cobertura: number | null; pesoRecurrente: number | null };

export function analisisNaturaleza(d: { pt: boolean; resumen: ResumenNat; resultado: number; dinero: (n: number) => string }): string[] {
  const { pt, resumen } = d;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const parrafos: string[] = [];
  if (resumen.pesoRecurrente !== null) {
    parrafos.push(pt ? `${pct(resumen.pesoRecurrente)} das suas despesas já estão comprometidas por recorrentes.` : `El ${pct(resumen.pesoRecurrente)} de tus gastos ya está comprometido por recurrentes.`);
  }
  if (resumen.cobertura !== null) {
    parrafos.push(
      resumen.cobertura >= 1
        ? pt ? `Suas receitas recorrentes cobrem ${pct(resumen.cobertura)} dos gastos recorrentes: a base está coberta.` : `Tus ingresos recurrentes cubren el ${pct(resumen.cobertura)} de los gastos recurrentes: la base está cubierta.`
        : pt ? `Suas receitas recorrentes cobrem só ${pct(resumen.cobertura)} dos gastos recorrentes: o resto depende do mês.` : `Tus ingresos recurrentes cubren solo el ${pct(resumen.cobertura)} de los gastos recurrentes: el resto depende del mes.`
    );
  }
  if (parrafos.length === 0) parrafos.push(pt ? 'Ainda não há recorrentes neste período: tudo é do mês.' : 'Todavía no hay recurrentes en este período: todo es del mes.');
  return parrafos;
}
