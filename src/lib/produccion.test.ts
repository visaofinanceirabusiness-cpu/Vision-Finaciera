import { describe, expect, it } from 'vitest';
import { stockUtilizableAFecha } from './produccion';

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
