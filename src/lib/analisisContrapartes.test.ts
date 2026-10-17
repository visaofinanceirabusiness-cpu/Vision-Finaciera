import { describe, it, expect } from 'vitest';
import { analizarContrapartes, normalizarNombre, operacionBase, mesesHacia, type OperacionTercero } from './analisisContrapartes';

const op = (fecha: string, total: number, tercero: string | null, operacion = 'VENTA', estado = 'VALIDADO'): OperacionTercero => ({
  fecha,
  operacion,
  total,
  cliente_proveedor: tercero,
  estado,
});

const HOY = '2026-10-17';

describe('operacionBase', () => {
  it('empresas usan venta/compra y Familia cobro/pago', () => {
    expect(operacionBase('clientes', false)).toBe('VENTA');
    expect(operacionBase('proveedores', false)).toBe('COMPRA');
    expect(operacionBase('clientes', true)).toBe('COBRO');
    expect(operacionBase('proveedores', true)).toBe('PAGO');
  });
});

describe('normalizarNombre', () => {
  it('ignora mayúsculas, tildes y espacios repetidos', () => {
    expect(normalizarNombre('  José   PÉREZ ')).toBe('jose perez');
  });
});

describe('mesesHacia', () => {
  it('cruza el año', () => {
    expect(mesesHacia('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('analizarContrapartes', () => {
  const ops = [
    op('2026-10-02', 100, 'Ana'),
    op('2026-10-10', 300, 'ana '),
    op('2026-10-12', 50, 'Beto'),
    op('2026-10-14', 25, null),
    op('2026-09-05', 200, 'Beto'),
    op('2026-10-15', 999, 'Ana', 'COBRO'),
    op('2026-10-16', 70, null, 'COBRO'),
    op('2026-10-16', 500, 'Ana', 'VENTA', 'PENDIENTE'),
  ];

  const resultado = analizarContrapartes({ operaciones: ops, tipo: 'clientes', esFamiliar: false, periodo: '2026-10', hoy: HOY, fechasAlta: new Map([['beto', '2026-10-01']]) });

  it('agrupa por nombre normalizado y suma solo el período', () => {
    expect(resultado.ranking.map((r) => [r.nombre, r.valor])).toEqual([['Ana', 400], ['Beto', 50]]);
    expect(resultado.activos).toBe(2);
  });

  it('total incluye lo que no tiene contraparte, y ticket promedio', () => {
    expect(resultado.total).toBe(475);
    expect(resultado.operaciones).toBe(4);
    expect(resultado.ticketPromedio).toBeCloseTo(118.75, 2);
    expect(resultado.sinContraparte).toEqual({ operaciones: 1, importe: 25 });
  });

  it('ignora operaciones no validadas y de otro tipo', () => {
    expect(resultado.total).not.toBeGreaterThan(475);
  });

  it('marca cobros sin contraparte como falta asignar', () => {
    expect(resultado.liquidacionesSinAsignar).toEqual({ operaciones: 1, importe: 70 });
  });

  it('cuenta nuevos por fecha de alta dentro del período', () => {
    expect(resultado.nuevos).toBe(1);
  });

  it('concentración top 3 sobre el total', () => {
    expect(resultado.concentracionTop3).toBeCloseTo((450 / 475) * 100, 1);
  });

  it('evolución de 12 meses terminando en el período', () => {
    expect(resultado.evolucion).toHaveLength(12);
    expect(resultado.evolucion[11]).toEqual({ clave: '2026-10', valor: 475, operaciones: 4 });
    expect(resultado.evolucion[10].valor).toBe(200);
  });

  it('frecuencia usa todo el historial y detecta dormidos', () => {
    const dormidos = analizarContrapartes({
      operaciones: [op('2026-01-01', 10, 'Zoe'), op('2026-01-20', 10, 'Zoe'), op('2026-10-10', 10, 'Ana')],
      tipo: 'clientes',
      esFamiliar: false,
      periodo: 'TODOS',
      hoy: HOY,
      fechasAlta: new Map(),
    });
    const zoe = dormidos.frecuencia.find((f) => f.nombre === 'Zoe')!;
    expect(zoe.etiqueta).toBe('DORMIDO');
    expect(zoe.intervaloPromedioDias).toBe(19);
    expect(dormidos.frecuencia.find((f) => f.nombre === 'Ana')!.etiqueta).toBe('OCASIONAL');
  });

  it('Familia usa cobros para fuentes de ingreso', () => {
    const familia = analizarContrapartes({
      operaciones: [op('2026-10-05', 1000, 'Empresa X', 'COBRO'), op('2026-10-06', 80, 'Super', 'PAGO')],
      tipo: 'clientes',
      esFamiliar: true,
      periodo: '2026-10',
      hoy: HOY,
      fechasAlta: new Map(),
    });
    expect(familia.total).toBe(1000);
    expect(familia.liquidacionesSinAsignar.operaciones).toBe(0);
  });
});
