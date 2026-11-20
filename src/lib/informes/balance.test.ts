import { describe, expect, it } from 'vitest';
import { analisisBalance, porcentaje } from './balance';

const base = { pt: false, activo: 51698, pasivo: 172, patrimonio: 51526, resultado: 1731, dinero: (n: number) => `R$ ${n}` };

describe('analisisBalance', () => {
  it('estructura sólida con poca deuda', () => {
    const t = analisisBalance(base);
    expect(t[0]).toContain('R$ 51526');
    expect(t[0]).toContain('99,7%');
    expect(t[1]).toContain('muy sólida');
  });
  it('deuda media y alta cambian el consejo', () => {
    expect(analisisBalance({ ...base, pasivo: 20000, patrimonio: 31698 })[1]).toContain('vigilar');
    expect(analisisBalance({ ...base, pasivo: 40000, patrimonio: 11698 })[1]).toContain('reducir las deudas');
  });
  it('patrimonio negativo se dice sin rodeos', () => {
    expect(analisisBalance({ ...base, patrimonio: -500, pasivo: 52198 })[0]).toContain('negativo');
  });
  it('resultado negativo suma un aviso y en portugués sale en portugués', () => {
    const t = analisisBalance({ ...base, pt: true, resultado: -10 });
    expect(t[t.length - 1]).toContain('resultado do exercício está negativo');
  });
  it('sin saldos no inventa nada', () => {
    expect(analisisBalance({ ...base, activo: 0, pasivo: 0, patrimonio: 0 })).toEqual(['Todavía no hay saldos en este período.']);
  });
});

describe('porcentaje', () => {
  it('no divide por cero', () => {
    expect(porcentaje(5, 0)).toBe(0);
    expect(porcentaje(25, 100)).toBe(25);
  });
});
