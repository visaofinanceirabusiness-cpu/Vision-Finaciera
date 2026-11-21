import { describe, expect, it } from 'vitest';
import { aCsv, variacion } from './sumas';

describe('variacion', () => {
  it('monto y porcentaje contra el período de comparación', () => {
    expect(variacion(150, 100)).toEqual({ monto: 50, pct: 50 });
    expect(variacion(80, 100).pct).toBeCloseTo(-20);
  });
  it('sin base no inventa porcentaje', () => {
    expect(variacion(500, 0)).toEqual({ monto: 500, pct: null });
  });
});

describe('aCsv', () => {
  it('separa con punto y coma, usa coma decimal y escapa comillas', () => {
    const csv = aCsv([['Cuenta', 'Saldo'], ['Caja "chica"', 1234.5], ['A;B', 0]]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Caja ""chica""'.replace(/^/, '"').replace(/$/, '"') + ';1234,5');
    expect(csv).toContain('"A;B";0');
  });
});
