import { describe, expect, it } from 'vitest';
import { pesoDelMovimiento, serieFlujo, variacionCaja } from './flujo';

describe('serieFlujo', () => {
  it('agrupa por mes, ordena y toma el saldo real de cada cierre', () => {
    const s = serieFlujo(
      [
        { fecha: '2026-02-10', entrada: false, importe: 40 },
        { fecha: '2026-01-05', entrada: true, importe: 100 },
        { fecha: '2026-01-20', entrada: false, importe: 30 },
        { fecha: '2026-02-11', entrada: true, importe: 10 },
      ],
      (clave) => (clave === '2026-01' ? 70 : 40)
    );
    expect(s.map((p) => p.clave)).toEqual(['2026-01', '2026-02']);
    expect(s[0]).toEqual({ clave: '2026-01', entradas: 100, salidas: 30, saldo: 70 });
    expect(s[1]).toEqual({ clave: '2026-02', entradas: 10, salidas: 40, saldo: 40 });
  });
  it('sin movimientos no hay serie', () => {
    expect(serieFlujo([], () => 0)).toEqual([]);
  });
});

describe('variacionCaja', () => {
  it('sube y baja respecto del inicio', () => {
    expect(variacionCaja(100, 150)).toBeCloseTo(50);
    expect(variacionCaja(200, 100)).toBeCloseTo(-50);
  });
  it('sin saldo inicial no inventa porcentaje', () => {
    expect(variacionCaja(0, 500)).toBeNull();
  });
});

describe('pesoDelMovimiento', () => {
  it('reparte el movimiento y no divide por cero', () => {
    expect(pesoDelMovimiento(30, 70)).toBe(30);
    expect(pesoDelMovimiento(0, 0)).toBe(0);
  });
});
