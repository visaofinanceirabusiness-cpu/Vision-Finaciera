import { describe, it, expect } from 'vitest';
import { repartirMovimientos, repartirMovimientosEnCuotas, type FilaDevengada, type MovimientoLibro } from './conciliacionCompromisos';

const fila = (p: Partial<FilaDevengada>): FilaDevengada => ({ id: 'r1', cuenta: 'Casita a cobrar', periodo: '2026-10-01', devengado: 1100, movido: 1000, ...p });
const mov = (p: Partial<MovimientoLibro>): MovimientoLibro => ({ idOperacion: 'OP-5', cuenta: 'Casita a cobrar', fecha: '2026-10-07', monto: 100, ...p });

describe('repartirMovimientos', () => {
  it('asocia un cobro suelto al mes devengado con saldo', () => {
    const r = repartirMovimientos([fila({})], [mov({})], new Map([['Casita a cobrar', 1000]]), new Map([['Casita a cobrar', 1100]]));
    expect(r).toEqual([{ recordatorioId: 'r1', idOperacion: 'OP-5', monto: 100, fecha: '2026-10-07' }]);
  });

  it('no hace nada si el libro ya coincide con lo imputado (evita duplicar)', () => {
    const r = repartirMovimientos([fila({})], [mov({})], new Map([['Casita a cobrar', 1100]]), new Map([['Casita a cobrar', 1100]]));
    expect(r).toEqual([]);
  });

  it('reparte del mes más viejo al más nuevo y parte un cobro grande', () => {
    const filas = [
      fila({ id: 'nov', periodo: '2026-11-01', devengado: 500, movido: 0 }),
      fila({ id: 'oct', periodo: '2026-10-01', devengado: 300, movido: 0 }),
    ];
    const r = repartirMovimientos(filas, [mov({ monto: 600, fecha: '2026-11-05' })], new Map(), new Map([['Casita a cobrar', 600]]));
    expect(r.map((a) => [a.recordatorioId, a.monto])).toEqual([['oct', 300], ['nov', 300]]);
  });

  it('un cobro no cubre un mes que todavía no estaba devengado a su fecha', () => {
    const filas = [fila({ id: 'nov', periodo: '2026-11-01', devengado: 500, movido: 0 })];
    expect(repartirMovimientos(filas, [mov({ fecha: '2026-10-07' })], new Map(), new Map([['Casita a cobrar', 100]]))).toEqual([]);
  });

  it('no cruza cuentas distintas', () => {
    const r = repartirMovimientos([fila({})], [mov({ cuenta: 'Otra a cobrar' })], new Map(), new Map([['Otra a cobrar', 100]]));
    expect(r).toEqual([]);
  });

  it('no asigna más que la diferencia del libro', () => {
    const r = repartirMovimientos([fila({ movido: 0 })], [mov({ monto: 500 })], new Map(), new Map([['Casita a cobrar', 200]]));
    expect(r[0].monto).toBe(200);
  });
});

describe('repartirMovimientosEnCuotas', () => {
  const cuota = (id: string, vencimiento: string, saldo: number, creadaEn = '2026-10-19T16:43:00Z') => ({ id, cuenta: 'Préstamos', vencimiento, creadaEn, saldo });
  const pago = (idOperacion: string, monto: number, creadoEn = '2026-10-19T16:46:00Z') => ({ idOperacion, cuenta: 'Préstamos', fecha: '2026-10-19', creadoEn, monto });

  it('aplica el pago a la cuota que vence primero y deja saldo', () => {
    expect(repartirMovimientosEnCuotas([cuota('b', '2026-10-19', 50), cuota('a', '2026-10-19', 30, '2026-10-19T16:40:00Z')], [pago('OP-1', 28)])).toEqual([
      { recordatorioId: 'a', idOperacion: 'OP-1', monto: 28, fecha: '2026-10-19' },
    ]);
  });

  it('lo que sobra pasa a la siguiente cuota y no se pasa del saldo total', () => {
    const r = repartirMovimientosEnCuotas([cuota('a', '2026-10-01', 30), cuota('b', '2026-10-25', 50)], [pago('OP-1', 40), pago('OP-2', 100)]);
    expect(r.map((x) => [x.recordatorioId, x.monto])).toEqual([['a', 30], ['b', 10], ['b', 40]]);
  });

  it('no adelanta cuotas de meses futuros', () => {
    expect(repartirMovimientosEnCuotas([cuota('a', '2026-11-09', 171)], [pago('OP-1', 1300)])).toEqual([]);
    expect(repartirMovimientosEnCuotas([cuota('a', '2026-10-31', 171)], [pago('OP-1', 1300)])).toHaveLength(1);
  });

  it('ignora pagos anteriores a la cuota o de otra cuenta', () => {
    expect(repartirMovimientosEnCuotas([cuota('a', '2026-10-19', 30)], [pago('OP-0', 10, '2026-10-19T10:00:00Z')])).toEqual([]);
    expect(repartirMovimientosEnCuotas([cuota('a', '2026-10-19', 30)], [{ ...pago('OP-3', 10), cuenta: 'Otra' }])).toEqual([]);
  });
});
