import { describe, expect, it } from 'vitest';
import { analisisSabio, composicionSalidas, topCuentas, variacionPct } from './dre';

describe('variacionPct', () => {
  it('calcula contra el mes anterior', () => {
    expect(variacionPct(120, 100)).toBeCloseTo(20);
    expect(variacionPct(80, 100)).toBeCloseTo(-20);
  });
  it('sin base de comparación no inventa un porcentaje', () => {
    expect(variacionPct(50, 0)).toBeNull();
  });
});

describe('composicionSalidas', () => {
  it('agrupa lo que sobra en Otros y suma 100%', () => {
    const t = composicionSalidas([{ nombre: 'A', valor: 50 }, { nombre: 'B', valor: 30 }, { nombre: 'C', valor: 10 }, { nombre: 'D', valor: 10 }], 2, 'Otros');
    expect(t.map((x) => x.nombre)).toEqual(['A', 'B', 'Otros']);
    expect(t[2].valor).toBe(20);
    expect(t.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100);
  });
  it('ignora saldos cero o negativos y devuelve vacío sin salidas', () => {
    expect(composicionSalidas([{ nombre: 'A', valor: 0 }], 3, 'Otros')).toEqual([]);
  });
});

describe('topCuentas', () => {
  it('ordena, calcula % del total y avisa si hay más', () => {
    const r = topCuentas([{ nombre: 'A', valor: 10 }, { nombre: 'B', valor: 30 }, { nombre: 'C', valor: 60 }], 2);
    expect(r.filas.map((f) => f.nombre)).toEqual(['C', 'B']);
    expect(r.filas[0].pct).toBeCloseTo(60);
    expect(r.hayMas).toBe(true);
    expect(r.total).toBe(100);
  });
});

describe('analisisSabio', () => {
  const base = { pt: false, esFamiliar: false, ingresos: 1000, salidas: 1200, resultado: -200, ingresosAnterior: 800, mayoresSalidas: ['Madera', 'Ropa', 'Otra'], dinero: (n: number) => `R$ ${n}` };
  it('resultado negativo con ingresos creciendo', () => {
    const t = analisisSabio(base);
    expect(t[0]).toContain('negativo en R$ 200');
    expect(t[0]).toContain('+25,0%');
    expect(t[1]).toContain('Madera y Ropa');
  });
  it('avisa si los ingresos cayeron', () => {
    expect(analisisSabio({ ...base, ingresosAnterior: 2000 })[0]).toContain('cayeron 50,0%');
  });
  it('sin movimientos no inventa nada', () => {
    expect(analisisSabio({ ...base, ingresos: 0, salidas: 0, resultado: 0 })).toEqual(['Todavía no hay movimientos en este período.']);
  });
  it('en portugués y para Familia habla de saldo', () => {
    const t = analisisSabio({ ...base, pt: true, esFamiliar: true, resultado: 300, salidas: 700 });
    expect(t[0]).toContain('saldo do período ficou positivo');
  });
});
