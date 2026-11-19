// lib/sabioSoporte/plan.ts — PLAN DE CRECIMIENTO (puro). De la configuración sale la meta de ventas de cada mes y, de ahí, el presupuesto de cada día.

import type { ConfigSabio } from './config';

export function mesesEntre(desde: string, hasta: string): number {
  const [a1, m1] = desde.split('-').map(Number);
  const [a2, m2] = hasta.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

// Meta de ventas del mes (YYYY-MM) según la curva elegida y la estacionalidad.
export function metaVentasMes(c: ConfigSabio, mes: string): number {
  const n = Math.max(0, mesesEntre(c.inicio.slice(0, 7), mes));
  const g = c.plan.crecimientoMensualPct / 100;
  let factor: number;
  switch (c.plan.curva) {
    case 'LINEAL':
      factor = 1 + g * n;
      break;
    case 'ESCALONADA':
      // Sube de a trimestre: tres meses iguales y salto.
      factor = Math.pow(1 + g, Math.floor(n / 3) * 3);
      break;
    case 'S': {
      // Crecimiento lento al principio, rápido en el medio y que se aplana: 12 meses de recorrido.
      const t = Math.min(1, n / 12);
      const sigmoide = 1 / (1 + Math.exp(-10 * (t - 0.5)));
      factor = 1 + (Math.pow(1 + g, 12) - 1) * sigmoide;
      break;
    }
    default:
      factor = Math.pow(1 + g, n);
  }
  const estacional = c.plan.estacionalidad[Number(mes.slice(5, 7)) - 1] ?? 1;
  return Math.round(c.plan.ventasBaseMensual * factor * estacional * 100) / 100;
}

export function diasDelMes(mes: string): string[] {
  const [a, m] = mes.split('-').map(Number);
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
}

// Último día real del mes (28, 29, 30 o 31): `${mes}-31` no existe en febrero, abril, junio, septiembre ni noviembre y la base rechaza esa fecha.
export function ultimoDiaDelMes(mes: string): string {
  const dias = diasDelMes(mes);
  return dias[dias.length - 1];
}

export function diaDeSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

export function pesoDelDia(c: ConfigSabio, fecha: string): number {
  return c.ritmo.pesoDiaSemana[diaDeSemana(fecha)] ?? 0;
}

// Presupuesto de ventas del día: lo que falta para la meta del mes (meta − ventas reales hasta ayer) repartido entre los días que quedan,
// según el peso de cada día. Si un mes va atrasado, los días siguientes venden más; si va adelantado, menos (nunca menos de 0).
export function presupuestoVentasDia(c: ConfigSabio, fecha: string, ventasRealesHastaAyer: number): number {
  const mes = fecha.slice(0, 7);
  const restantes = diasDelMes(mes).filter((d) => d >= fecha);
  const pesoRestante = restantes.reduce((s, d) => s + pesoDelDia(c, d), 0);
  const peso = pesoDelDia(c, fecha);
  if (pesoRestante <= 0 || peso <= 0) return 0;
  const falta = Math.max(0, metaVentasMes(c, mes) - ventasRealesHastaAyer);
  return Math.round(((falta * peso) / pesoRestante) * 100) / 100;
}

// Costo acumulado por inflación desde el mes de inicio.
export function factorInflacion(c: ConfigSabio, fecha: string): number {
  const n = Math.max(0, mesesEntre(c.inicio.slice(0, 7), fecha.slice(0, 7)));
  return Math.pow(1 + c.compras.inflacionCostosMensualPct / 100, n);
}
