// lib/informes/flujo.ts — series y porcentajes de la vista visual del Flujo de Caja. Puro: recibe lo que ya calculó el informe.

export type MovimientoMes = { fecha: string; entrada: boolean; importe: number };
export type PuntoFlujo = { clave: string; entradas: number; salidas: number; saldo: number };

// Entradas y salidas de cada mes con movimiento. `saldoAlCierre(clave)` da el saldo real de caja al cierre de ese mes
// (el mismo cálculo del informe), así la línea del gráfico coincide con el saldo final de cada período.
export function serieFlujo(movimientos: MovimientoMes[], saldoAlCierre: (clave: string) => number): PuntoFlujo[] {
  const por = new Map<string, { entradas: number; salidas: number }>();
  for (const m of movimientos) {
    const clave = m.fecha.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(clave)) continue;
    const a = por.get(clave) ?? { entradas: 0, salidas: 0 };
    if (m.entrada) a.entradas += m.importe;
    else a.salidas += m.importe;
    por.set(clave, a);
  }
  return [...por.keys()]
    .sort()
    .map((clave) => ({ clave, entradas: Math.round(por.get(clave)!.entradas * 100) / 100, salidas: Math.round(por.get(clave)!.salidas * 100) / 100, saldo: saldoAlCierre(clave) }));
}

// Cuánto subió o bajó la caja entre el inicio y el cierre. Sin base (inicio en cero) no se inventa un porcentaje.
export function variacionCaja(inicial: number, final: number): number | null {
  if (Math.abs(inicial) < 0.005) return null;
  return ((final - inicial) / Math.abs(inicial)) * 100;
}

// Qué parte del movimiento total (entradas + salidas) es de un lado.
export function pesoDelMovimiento(lado: number, otroLado: number): number {
  const total = lado + otroLado;
  return total > 0 ? (lado / total) * 100 : 0;
}
