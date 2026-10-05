import { describe, expect, it } from 'vitest';
import { armarPresupuesto, estadoDe, mesAnterior, promedioPorCategoria } from './presupuesto';

describe('estadoDe', () => {
  it('OK hasta el 80 %, alerta del 80 al 100 % y excedido después', () => {
    expect(estadoDe(100, 79)).toBe('OK');
    expect(estadoDe(100, 80)).toBe('ALERTA');
    expect(estadoDe(100, 100)).toBe('ALERTA');
    expect(estadoDe(100, 101)).toBe('EXCEDIDO');
  });

  it('sin tope: marca el gasto sin presupuesto o la fila vacía', () => {
    expect(estadoDe(null, 50)).toBe('SIN_PRESUPUESTO');
    expect(estadoDe(null, 0)).toBe('VACIA');
    expect(estadoDe(0, 10)).toBe('SIN_PRESUPUESTO');
  });
});

describe('armarPresupuesto', () => {
  const topes = [
    { categoria: 'Alimentación', monto: 1000 },
    { categoria: 'Ocio', monto: 200 },
  ];
  const gastos = [
    { categoria: 'Alimentación', monto: 400 },
    { categoria: 'Alimentación', monto: 450 },
    { categoria: 'Ocio', monto: 250 },
    { categoria: 'Transporte', monto: 90 },
  ];

  it('calcula restante y porcentaje, y suma lo gastado dentro y fuera de los topes', () => {
    const r = armarPresupuesto(topes, gastos, ['Alimentación', 'Ocio', 'Transporte', 'Salud']);
    const alimentacion = r.filas.find((f) => f.categoria === 'Alimentación');
    expect(alimentacion).toMatchObject({ presupuesto: 1000, gastado: 850, restante: 150, porcentaje: 85, estado: 'ALERTA' });
    expect(r.totalPresupuestado).toBe(1200);
    expect(r.gastadoConTope).toBe(1100);
    expect(r.gastadoSinTope).toBe(90);
    expect(r.restante).toBe(100);
  });

  it('ordena primero lo excedido, después lo que está cerca, y deja al final lo vacío', () => {
    const r = armarPresupuesto(topes, gastos, ['Alimentación', 'Ocio', 'Transporte', 'Salud']);
    expect(r.filas.map((f) => f.categoria)).toEqual(['Ocio', 'Alimentación', 'Transporte', 'Salud']);
    expect(r.filas[0].estado).toBe('EXCEDIDO');
    expect(r.filas[3].estado).toBe('VACIA');
  });

  it('incluye categorías con gasto aunque no estén en la lista', () => {
    const r = armarPresupuesto([], [{ categoria: 'Rara', monto: 5 }], []);
    expect(r.filas).toEqual([expect.objectContaining({ categoria: 'Rara', estado: 'SIN_PRESUPUESTO', presupuesto: null })]);
  });
});

describe('promedioPorCategoria', () => {
  it('promedia los 3 meses anteriores dividiendo siempre por 3', () => {
    const gastos = [
      { periodo: '2026-09-01', categoria: 'Luz', monto: 90 },
      { periodo: '2026-08-01', categoria: 'Luz', monto: 60 },
      { periodo: '2026-10-01', categoria: 'Luz', monto: 999 },
      { periodo: '2026-05-01', categoria: 'Luz', monto: 999 },
    ];
    expect(promedioPorCategoria(gastos, '2026-10-01').get('Luz')).toBe(50);
  });

  it('mesAnterior cruza el cambio de año', () => {
    expect(mesAnterior('2026-01-01')).toBe('2025-12-01');
    expect(mesAnterior('2026-02-01', 3)).toBe('2025-11-01');
  });
});
