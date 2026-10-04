import { describe, it, expect } from 'vitest';
import { proyectarCompromisos, totalesProgramados } from './compromisosProgramados';

describe('proyectarCompromisos', () => {
  const ingresos = [
    { monto_habitual: 1900, activo: true },
    { monto_habitual: 500, activo: false },
  ];
  const gastos = [
    { monto_habitual: '1800', activo: true },
    { monto_habitual: 45, activo: true },
  ];

  it('proyecta 12 meses, empezando por el mes siguiente al actual', () => {
    const meses = proyectarCompromisos(ingresos, gastos, '2026-10-04');
    expect(meses).toHaveLength(12);
    expect(meses[0].periodo).toBe('2026-11-01');
    expect(meses[1].periodo).toBe('2026-12-01');
    expect(meses[2].periodo).toBe('2027-01-01');
    expect(meses[11].periodo).toBe('2027-10-01');
  });

  it('ignora plantillas inactivas y suma montos que llegan como texto', () => {
    const [mes] = proyectarCompromisos(ingresos, gastos, '2026-10-04');
    expect(mes.porCobrar).toBe(1900);
    expect(mes.porPagar).toBe(1845);
    expect(mes.neto).toBe(55);
  });

  it('no proyecta las plantillas que ya devengan mes a mes (tienen filas reales)', () => {
    const [mes] = proyectarCompromisos(ingresos, [...gastos, { monto_habitual: 1800, activo: true, devengar: true }], '2026-10-04');
    expect(mes.porPagar).toBe(1845);
  });

  it('suma los totales de todo el horizonte', () => {
    const totales = totalesProgramados(proyectarCompromisos(ingresos, gastos, '2026-10-04'));
    expect(totales).toEqual({ porCobrar: 22800, porPagar: 22140, neto: 660 });
  });
});
