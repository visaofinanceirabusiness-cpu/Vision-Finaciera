import { describe, it, expect } from 'vitest';
import {
  analizarContrapartes,
  normalizarNombre,
  operacionBase,
  mesesHacia,
  fichaDeContraparte,
  grafiasPorRevisar,
  operacionesSinContraparte,
  sugerenciaDeHistorico,
  type OperacionTercero,
} from './analisisContrapartes';

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

describe('fichaDeContraparte', () => {
  const ops = [
    op('2026-10-02', 100, 'Ana'),
    op('2026-08-10', 300, 'ana '),
    op('2026-10-05', 40, 'Ana', 'COBRO'),
    op('2026-10-06', 9, 'Beto'),
  ];
  const ficha = fichaDeContraparte({ operaciones: ops, tipo: 'clientes', esFamiliar: false, clave: 'ana', periodo: '2026-10', hoy: HOY });

  it('totales históricos y del período solo con ventas', () => {
    expect(ficha.totalHistorico).toBe(400);
    expect(ficha.totalPeriodo).toBe(100);
    expect(ficha.operaciones).toBe(2);
    expect(ficha.ticketPromedio).toBe(200);
    expect(ficha.primera).toBe('2026-08-10');
    expect(ficha.ultima).toBe('2026-10-02');
    expect(ficha.diasDesdeUltima).toBe(15);
  });

  it('lista ventas y cobros de la persona, más nuevos primero', () => {
    expect(ficha.movimientos.map((m) => m.operacion)).toEqual(['COBRO', 'VENTA', 'VENTA']);
    expect(ficha.movimientos[0].esBase).toBe(false);
  });

  it('evolución de 12 meses', () => {
    expect(ficha.evolucion).toHaveLength(12);
    expect(ficha.evolucion[11].valor).toBe(100);
    expect(ficha.evolucion[9].valor).toBe(300);
  });
});

describe('grafiasPorRevisar', () => {
  const ops = [
    op('2026-10-02', 100, 'ana '),
    op('2026-10-03', 100, 'Ana'),
    op('2026-10-04', 50, 'Beto Limma'),
    op('2026-10-05', 70, 'Carla'),
    op('2026-10-06', 5, 'Zeca', 'COMPRA'),
  ];
  const r = grafiasPorRevisar({ operaciones: ops, tipo: 'clientes', esFamiliar: false, altas: ['Ana', 'Beto Lima'] });

  it('ignora lo que coincide exacto con un alta y lo de otro tipo', () => {
    expect(r.map((x) => x.grafia).sort()).toEqual(['Beto Limma', 'Carla', 'ana ']);
  });

  it('misma persona escrita distinto', () => {
    expect(r.find((x) => x.grafia === 'ana ')).toMatchObject({ sugerencia: 'Ana', confianza: 'MISMA', operaciones: 1 });
  });

  it('nombre parecido', () => {
    expect(r.find((x) => x.grafia === 'Beto Limma')).toMatchObject({ sugerencia: 'Beto Lima', confianza: 'PARECIDA' });
  });

  it('sin parecido: falta darlo de alta', () => {
    expect(r.find((x) => x.grafia === 'Carla')).toMatchObject({ sugerencia: null, confianza: null, primeraFecha: '2026-10-05' });
  });
});

describe('sugerenciaDeHistorico', () => {
  it('saca el nombre de un devengo recurrente', () => {
    expect(sugerenciaDeHistorico('Casita 💚 — devengado 2026-10')).toBe('Casita 💚');
    expect(sugerenciaDeHistorico('Alquiler Santihno — devengado 2026-10')).toBe('Alquiler Santihno');
  });

  it('no inventa nombres de otros históricos', () => {
    expect(sugerenciaDeHistorico('Pago deuda')).toBeNull();
    expect(sugerenciaDeHistorico('')).toBeNull();
    expect(sugerenciaDeHistorico(null)).toBeNull();
  });
});

describe('operacionesSinContraparte', () => {
  const con = (id: string, fecha: string, operacion: string, tercero: string | null, historico: string): OperacionTercero => ({
    id,
    fecha,
    operacion,
    total: 10,
    cliente_proveedor: tercero,
    estado: 'VALIDADO',
    categoria: 'Cat',
    historico,
  });
  const ops = [
    con('1', '2026-10-01', 'COBRO', null, 'Uber — devengado 2026-10'),
    con('2', '2026-10-05', 'COBRO', '  ', 'Pago deuda'),
    con('3', '2026-10-06', 'COBRO', 'Ana', 'x'),
    con('4', '2026-10-07', 'PAGO', null, 'Netflix — devengado 2026-10'),
    { ...con('5', '2026-10-08', 'COBRO', null, 'y'), estado: 'PENDIENTE' },
    { ...con('6', '2026-10-09', 'COBRO', null, 'z'), id: undefined },
  ];

  it('solo las del tipo, validadas, con id y sin nombre; más nuevas primero', () => {
    const r = operacionesSinContraparte({ operaciones: ops, tipo: 'clientes', esFamiliar: true });
    expect(r.map((x) => x.id)).toEqual(['2', '1']);
    expect(r[1].sugerencia).toBe('Uber');
    expect(r[0].sugerencia).toBeNull();
  });

  it('para proveedores en empresas incluye compra y pago', () => {
    const r = operacionesSinContraparte({ operaciones: ops, tipo: 'proveedores', esFamiliar: false });
    expect(r.map((x) => x.id)).toEqual(['4']);
  });
});
