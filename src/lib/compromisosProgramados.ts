// lib/compromisosProgramados.ts
//
// COMPROMISOS PROGRAMADOS — proyección de los próximos 12 meses de lo
// que las plantillas de Ingresos y Gastos Recurrentes van a generar.
// Es solo una VISTA (no crea asientos ni filas): sirve para ver cuánto
// hay por cobrar y por pagar a futuro sin que figure en el balance,
// porque cada mes se reconoce recién en su período (devengado mes a
// mes). El mes en curso no entra: ya tiene sus vencimientos reales.

export const MESES_HORIZONTE = 12;

export type PlantillaProgramada = {
  monto_habitual: number | string;
  activo: boolean;
  // Las que devengan mes a mes ya tienen sus 12 meses como filas reales
  // (ver lib/devengoGastos.ts): no se proyectan acá, se contarían doble.
  devengar?: boolean;
};

export type MesProgramado = {
  periodo: string; // 'YYYY-MM-01'
  porCobrar: number;
  porPagar: number;
  neto: number;
};

function sumarMontos(plantillas: PlantillaProgramada[]): number {
  // Number() explícito: las columnas numeric de Postgres pueden llegar como string.
  return plantillas.filter((p) => p.activo && !p.devengar).reduce((suma, p) => suma + Number(p.monto_habitual), 0);
}

export function proyectarCompromisos(
  ingresos: PlantillaProgramada[],
  gastos: PlantillaProgramada[],
  hoy: string,
  meses: number = MESES_HORIZONTE
): MesProgramado[] {
  const [anio, mes] = hoy.split('-').map(Number);
  const porCobrar = sumarMontos(ingresos);
  const porPagar = sumarMontos(gastos);

  return Array.from({ length: meses }, (_, i) => {
    const fecha = new Date(anio, mes - 1 + i + 1, 1);
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
    return { periodo, porCobrar, porPagar, neto: porCobrar - porPagar };
  });
}

export function totalesProgramados(meses: MesProgramado[]): { porCobrar: number; porPagar: number; neto: number } {
  const porCobrar = meses.reduce((suma, m) => suma + m.porCobrar, 0);
  const porPagar = meses.reduce((suma, m) => suma + m.porPagar, 0);
  return { porCobrar, porPagar, neto: porCobrar - porPagar };
}
