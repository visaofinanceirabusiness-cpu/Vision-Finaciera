import { describe, expect, it } from 'vitest';
import { diasParaElCierre, enPeriodoDeAviso, estadoPeriodo, limiteReapertura, marcaDelDia, resumirCierres } from './cierres';

const cfg = { activo: true, desde: '2026-11-01' };

describe('estadoPeriodo', () => {
  it('sin cierre activo todo está abierto', () => {
    expect(estadoPeriodo({ activo: false, desde: null }, '2020-01-10', '2026-12-01')).toBe('ABIERTO');
  });
  it('meses anteriores a «desde» quedan abiertos (histórico)', () => {
    expect(estadoPeriodo(cfg, '2026-10-20', '2026-12-01')).toBe('ABIERTO');
  });
  it('el mes en curso y los futuros están abiertos', () => {
    expect(estadoPeriodo(cfg, '2026-11-30', '2026-11-30')).toBe('ABIERTO');
    expect(estadoPeriodo(cfg, '2027-01-05', '2026-11-30')).toBe('ABIERTO');
  });
  it('el día 1 el mes anterior ya está cerrado', () => {
    expect(estadoPeriodo(cfg, '2026-11-15', '2026-12-01')).toBe('CERRADO');
  });
  it('el cliente puede reabrir hasta el día 5 inclusive', () => {
    expect(estadoPeriodo(cfg, '2026-11-15', '2026-12-05')).toBe('CERRADO');
    expect(estadoPeriodo(cfg, '2026-11-15', '2026-12-06')).toBe('BLOQUEADO');
  });
  it('un habilitado vigente abre, uno vencido no', () => {
    const ahora = new Date('2026-12-02T12:00:00Z');
    expect(estadoPeriodo(cfg, '2026-11-15', '2026-12-02', new Date('2026-12-02T12:03:00Z'), ahora)).toBe('HABILITADO');
    expect(estadoPeriodo(cfg, '2026-11-15', '2026-12-02', new Date('2026-12-02T11:59:00Z'), ahora)).toBe('CERRADO');
  });
  it('cruza el año', () => {
    expect(limiteReapertura('2026-12-10')).toBe('2027-01-05');
    expect(estadoPeriodo({ activo: true, desde: null }, '2026-12-31', '2027-01-04')).toBe('CERRADO');
  });
});

describe('aviso previo', () => {
  it('cuenta los días hasta fin de mes', () => {
    expect(diasParaElCierre('2026-11-30')).toBe(0);
    expect(diasParaElCierre('2026-11-26')).toBe(4);
    expect(diasParaElCierre('2026-02-10')).toBe(18);
  });
  it('avisa durante los últimos 5 días (incluido el último)', () => {
    expect(enPeriodoDeAviso('2026-11-25')).toBe(false);
    expect(enPeriodoDeAviso('2026-11-26')).toBe(true);
    expect(enPeriodoDeAviso('2026-11-30')).toBe(true);
  });
});

describe('marcaDelDia', () => {
  const c = { activo: true, desde: '2026-11-01' };
  it('marca los últimos 5 días, el último con otro color, y el 1 y el 5', () => {
    expect(marcaDelDia(c, '2026-11-20', '2026-11-20', false)).toBeNull();
    expect(marcaDelDia(c, '2026-11-26', '2026-11-26', false)?.color).toBe('#d97706');
    expect(marcaDelDia(c, '2026-11-30', '2026-11-30', false)?.color).toBe('#dc2626');
    expect(marcaDelDia(c, '2026-12-01', '2026-12-01', false)?.color).toBe('#2563eb');
    expect(marcaDelDia(c, '2026-12-05', '2026-12-05', false)?.color).toBe('#7c3aed');
  });
  it('sin cierre activo no marca nada', () => {
    expect(marcaDelDia({ activo: false, desde: null }, '2026-11-30', '2026-11-30', false)).toBeNull();
  });
});

describe('resumirCierres', () => {
  const tipos = new Map([['Ventas', 'INGRESO'], ['CMV', 'COSTO'], ['Alquiler', 'GASTO'], ['Resultados Acumulados', 'PATRIMONIO']]);
  it('separa ingresos, costos y gastos y arma el resultado', () => {
    const r = resumirCierres(
      [
        { ejercicio: 2026, cuenta_debito: 'Ventas', cuenta_credito: 'Resultados Acumulados', importe: 1000 },
        { ejercicio: 2026, cuenta_debito: 'Resultados Acumulados', cuenta_credito: 'CMV', importe: 400 },
        { ejercicio: 2026, cuenta_debito: 'Resultados Acumulados', cuenta_credito: 'Alquiler', importe: 700, es_prueba: true },
      ],
      tipos
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ ingresos: 1000, costos: 400, gastos: 700, resultado: -100, lineas: 3, esPrueba: true });
  });
  it('un ingreso con saldo deudor resta', () => {
    const r = resumirCierres([{ ejercicio: 2026, cuenta_debito: 'Resultados Acumulados', cuenta_credito: 'Ventas', importe: 50 }], tipos);
    expect(r[0].ingresos).toBe(-50);
  });
});
