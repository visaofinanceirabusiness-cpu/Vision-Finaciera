import { describe, expect, it } from 'vitest';
import { calcularEvolucion, tieneCostos } from './evolucionResultado';

describe('calcularEvolucion', () => {
  it('resta costos y gastos de los ingresos', () => {
    const [p] = calcularEvolucion([{ mes: 'Oct', clave: '2026-10', ingresos: 1000, costos: 400, gastos: 250 }]);
    expect(p.resultado).toBe(350);
    expect(p.margenBruto).toBe(600);
  });

  it('sin costos (Familia) el resultado es ingresos − gastos', () => {
    const datos = [{ mes: 'Oct', clave: '2026-10', ingresos: 500, gastos: 700 }];
    expect(calcularEvolucion(datos)[0].resultado).toBe(-200);
    expect(tieneCostos(datos)).toBe(false);
  });

  it('detecta costos en cualquier mes', () => {
    expect(
      tieneCostos([
        { mes: 'Sep', clave: '2026-09', ingresos: 1, gastos: 0, costos: 0 },
        { mes: 'Oct', clave: '2026-10', ingresos: 1, gastos: 0, costos: 5 },
      ])
    ).toBe(true);
  });

  it('redondea a centavos', () => {
    const [p] = calcularEvolucion([{ mes: 'Oct', clave: '2026-10', ingresos: 0.3, costos: 0.1, gastos: 0.1 }]);
    expect(p.resultado).toBe(0.1);
  });
});
