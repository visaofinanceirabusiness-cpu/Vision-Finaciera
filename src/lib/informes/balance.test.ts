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

import { totalesBalance } from './balance';
import { compacto, escalaBonita, recortarRango } from './escala';

describe('totalesBalance', () => {
  const hojas = [
    { nombre: 'Caja', naturaleza: 'DEUDORA', tipo_saldo: 'ACTIVO' },
    { nombre: 'Deuda', naturaleza: 'ACREEDORA', tipo_saldo: 'PASIVO' },
    { nombre: 'Capital', naturaleza: 'ACREEDORA', tipo_saldo: 'PATRIMONIO' },
    { nombre: 'Retiro', naturaleza: 'DEUDORA', tipo_saldo: 'PATRIMONIO' },
    { nombre: 'Ventas', naturaleza: 'ACREEDORA', tipo_saldo: 'INGRESO' },
    { nombre: 'Alquiler', naturaleza: 'DEUDORA', tipo_saldo: 'GASTO' },
  ];
  const asientos = [
    { debito: 'Caja', credito: 'Capital', importe: 1000 },
    { debito: 'Caja', credito: 'Ventas', importe: 500 },
    { debito: 'Alquiler', credito: 'Caja', importe: 200 },
    { debito: 'Caja', credito: 'Deuda', importe: 300 },
    { debito: 'Retiro', credito: 'Caja', importe: 100 },
  ];
  it('la ecuación patrimonial cierra y el resultado se suma al patrimonio', () => {
    const t = totalesBalance(hojas, asientos);
    expect(t.activo).toBe(1500);
    expect(t.pasivo).toBe(300);
    expect(t.resultado).toBe(300);
    expect(t.patrimonio).toBe(1000 - 100 + 300);
    expect(t.activo).toBe(t.pasivo + t.patrimonio);
  });
});

describe('escala de los gráficos', () => {
  it('compacta importes', () => {
    expect(compacto(1500, 'R$')).toBe('R$ 1.5k');
    expect(compacto(-25000, '')).toBe('−25k');
  });
  it('la escala incluye el rango pedido', () => {
    const e = escalaBonita(-300, 1200);
    expect(e.min).toBeLessThanOrEqual(-300);
    expect(e.max).toBeGreaterThanOrEqual(1200);
  });
  it('recorta a los últimos meses', () => {
    expect(recortarRango([1, 2, 3, 4, 5], '3M')).toEqual([3, 4, 5]);
    expect(recortarRango([1, 2], '12M')).toEqual([1, 2]);
    expect(recortarRango([1, 2, 3], 'TODO')).toEqual([1, 2, 3]);
  });
});
