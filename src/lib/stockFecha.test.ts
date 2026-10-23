import { describe, expect, it } from 'vitest';
import { cambioDejaStockNegativo, primerDiaSinStock, stockUtilizableAFecha } from './stockFecha';

const e = (fecha: string, cantidad: number) => ({ tipo: 'ENTRADA', cantidad, fecha });
const s = (fecha: string, cantidad: number) => ({ tipo: 'SALIDA', cantidad, fecha });

describe('stockUtilizableAFecha', () => {
  it('antes de la primera compra no hay stock, aunque hoy sí haya', () => {
    expect(stockUtilizableAFecha([e('2026-10-10', 50)], '2026-10-01')).toBe(0);
    expect(stockUtilizableAFecha([e('2026-10-10', 50)], '2026-10-10')).toBe(50);
  });

  it('descuenta lo que ya salió hasta esa fecha', () => {
    expect(stockUtilizableAFecha([e('2026-10-01', 50), s('2026-10-05', 20)], '2026-10-06')).toBe(30);
  });

  it('no deja negativo el saldo de una fecha posterior (una salida ya cargada necesita ese stock)', () => {
    expect(stockUtilizableAFecha([e('2026-10-01', 50), s('2026-10-10', 40)], '2026-10-05')).toBe(10);
  });

  it('una entrada posterior no ayuda a producir antes', () => {
    expect(stockUtilizableAFecha([e('2026-10-01', 10), e('2026-10-20', 100)], '2026-10-05')).toBe(10);
  });

  it('suma los movimientos del mismo día antes de mirar el saldo', () => {
    expect(stockUtilizableAFecha([e('2026-10-01', 10), s('2026-10-08', 10), e('2026-10-08', 10)], '2026-10-05')).toBe(10);
  });
});

describe('primerDiaSinStock y cambioDejaStockNegativo', () => {
  const base = [e('2026-06-12', 1), s('2026-09-17', 1)];

  it('vender 1 el 18/06 con una compra el 12/06 y una venta el 17/09 deja sin stock al 17/09', () => {
    expect(stockUtilizableAFecha(base, '2026-06-18')).toBe(0);
    expect(primerDiaSinStock(base, '2026-06-18', 1)).toBe('2026-09-17');
  });

  it('si alcanza para todo, no hay día conflictivo', () => {
    expect(primerDiaSinStock([e('2026-06-12', 2), s('2026-09-17', 1)], '2026-06-18', 1)).toBeNull();
  });

  it('borrar la compra que abastece una salida posterior deja stock negativo', () => {
    const despues = [s('2026-09-17', 1)];
    expect(cambioDejaStockNegativo(base, despues, '2026-06-12')).toBe('2026-09-17');
  });

  it('no bloquea por un negativo que ya existía', () => {
    const viejo = [s('2026-09-17', 1)];
    expect(cambioDejaStockNegativo(viejo, viejo, '2026-06-12')).toBeNull();
  });
});
