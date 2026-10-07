import { describe, it, expect } from 'vitest';
import { repartirMovimientos, type FilaDevengada, type MovimientoLibro } from './conciliacionCompromisos';

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
