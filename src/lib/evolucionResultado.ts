// lib/evolucionResultado.ts
//
// Cálculo de las series del gráfico de evolución del Panel. El resultado
// del mes es Ingresos − Costos − Gastos (los Costos son el CMV y demás
// cuentas tipo COSTO); en Familia no hay costos y queda Ingresos − Gastos.

export type PuntoEvolucion = {
  mes: string;
  clave: string;
  ingresos: number;
  gastos: number;
  costos?: number;
  // Financieros e impuestos, ya incluidos en gastos.
  gastosNoOperativos?: number;
};

export type PuntoEvolucionCalculado = Required<PuntoEvolucion> & {
  resultado: number;
  margenBruto: number;
};

const aCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

export function calcularEvolucion(datos: PuntoEvolucion[]): PuntoEvolucionCalculado[] {
  return datos.map((dato) => {
    const costos = dato.costos ?? 0;
    const gastosNoOperativos = dato.gastosNoOperativos ?? 0;

    return {
      ...dato,
      costos,
      gastosNoOperativos,
      resultado: aCentavos(dato.ingresos - costos - dato.gastos),
      margenBruto: aCentavos(dato.ingresos - costos),
    };
  });
}

export function tieneCostos(datos: PuntoEvolucion[]): boolean {
  return datos.some((dato) => (dato.costos ?? 0) !== 0);
}
