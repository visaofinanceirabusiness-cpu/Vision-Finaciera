// lib/presupuesto.ts
//
// PRESUPUESTO DEL MES — un tope por categoría de gasto frente a lo gastado
// en el mes. Es solo una vista: lo gastado sale de los asientos ya
// registrados (mismo criterio que "Gastos por categoría" del Panel) y no se
// crea ningún asiento.

export type EstadoPresupuesto = 'OK' | 'ALERTA' | 'EXCEDIDO' | 'SIN_PRESUPUESTO' | 'VACIA';

export type TopeCategoria = { categoria: string; monto: number };
export type GastoCategoria = { categoria: string; monto: number };
export type GastoMensual = { periodo: string; categoria: string; monto: number };

export type FilaPresupuesto = {
  categoria: string;
  presupuesto: number | null;
  gastado: number;
  // Lo que queda del tope (negativo si se pasó); null si no hay tope.
  restante: number | null;
  // Porcentaje del tope ya gastado; null si no hay tope.
  porcentaje: number | null;
  estado: EstadoPresupuesto;
};

export type ResumenPresupuesto = {
  filas: FilaPresupuesto[];
  totalPresupuestado: number;
  // Gastado en las categorías que tienen tope.
  gastadoConTope: number;
  gastadoSinTope: number;
  restante: number;
};

export const UMBRAL_ALERTA = 80;
export const MESES_PROMEDIO = 3;

const redondear = (valor: number) => Math.round(valor * 100) / 100;

export function estadoDe(presupuesto: number | null, gastado: number): EstadoPresupuesto {
  if (presupuesto === null || presupuesto <= 0) {
    return gastado > 0 ? 'SIN_PRESUPUESTO' : 'VACIA';
  }

  const porcentaje = (gastado / presupuesto) * 100;
  if (porcentaje > 100) return 'EXCEDIDO';
  if (porcentaje >= UMBRAL_ALERTA) return 'ALERTA';
  return 'OK';
}

const ORDEN_ESTADO: Record<EstadoPresupuesto, number> = { EXCEDIDO: 0, ALERTA: 1, OK: 2, SIN_PRESUPUESTO: 3, VACIA: 4 };

// `categoriasGasto` son todas las que se pueden presupuestar; también entran
// las que tuvieron gasto o tope aunque no estén en esa lista.
export function armarPresupuesto(
  topes: TopeCategoria[],
  gastos: GastoCategoria[],
  categoriasGasto: string[]
): ResumenPresupuesto {
  const topePorCategoria = new Map(topes.map((t) => [t.categoria, t.monto]));
  const gastoPorCategoria = new Map<string, number>();
  for (const g of gastos) gastoPorCategoria.set(g.categoria, (gastoPorCategoria.get(g.categoria) ?? 0) + g.monto);

  const categorias = new Set([...categoriasGasto, ...topePorCategoria.keys(), ...gastoPorCategoria.keys()]);

  const filas: FilaPresupuesto[] = Array.from(categorias).map((categoria) => {
    const tope = topePorCategoria.get(categoria);
    const presupuesto = tope !== undefined && tope > 0 ? tope : null;
    const gastado = redondear(gastoPorCategoria.get(categoria) ?? 0);

    return {
      categoria,
      presupuesto,
      gastado,
      restante: presupuesto === null ? null : redondear(presupuesto - gastado),
      porcentaje: presupuesto === null ? null : Math.round((gastado / presupuesto) * 100),
      estado: estadoDe(presupuesto, gastado),
    };
  });

  filas.sort(
    (a, b) =>
      ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
      (b.porcentaje ?? 0) - (a.porcentaje ?? 0) ||
      b.gastado - a.gastado ||
      a.categoria.localeCompare(b.categoria)
  );

  const conTope = filas.filter((f) => f.presupuesto !== null);
  const totalPresupuestado = redondear(conTope.reduce((suma, f) => suma + (f.presupuesto ?? 0), 0));
  const gastadoConTope = redondear(conTope.reduce((suma, f) => suma + f.gastado, 0));
  const gastadoSinTope = redondear(filas.filter((f) => f.presupuesto === null).reduce((suma, f) => suma + f.gastado, 0));

  return { filas, totalPresupuestado, gastadoConTope, gastadoSinTope, restante: redondear(totalPresupuestado - gastadoConTope) };
}

export function mesAnterior(periodo: string, meses: number = 1): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 - meses, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
}

// Promedio mensual por categoría de los N meses anteriores a `periodo`. Se
// divide por N aunque algún mes no tenga gasto: un mes sin gasto también es
// un dato, y así no se sobrestima el tope.
export function promedioPorCategoria(gastosMensuales: GastoMensual[], periodo: string, meses: number = MESES_PROMEDIO): Map<string, number> {
  const ventana = new Set(Array.from({ length: meses }, (_, i) => mesAnterior(periodo, i + 1)));
  const sumas = new Map<string, number>();

  for (const g of gastosMensuales) {
    if (!ventana.has(g.periodo)) continue;
    sumas.set(g.categoria, (sumas.get(g.categoria) ?? 0) + g.monto);
  }

  return new Map(Array.from(sumas.entries()).map(([categoria, suma]) => [categoria, redondear(suma / meses)]));
}
