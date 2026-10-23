import { describe, expect, it } from 'vitest';
import { cambioDejaSaldoNegativo, primerDiaSinSaldo, saldoAFecha, saldoUtilizableAFecha } from './saldoFecha';

const m = (fecha: string, delta: number) => ({ fecha, delta });

describe('saldoFecha', () => {
  const caja = [m('2026-06-01', 1000), m('2026-09-10', -900)];

  it('el saldo a una fecha ignora lo posterior', () => {
    expect(saldoAFecha(0, caja, '2026-06-15')).toBe(1000);
    expect(saldoAFecha(0, caja, '2026-09-10')).toBe(100);
  });

  it('un pago atrasado no puede dejar sin fondos a un pago posterior', () => {
    expect(saldoUtilizableAFecha(0, caja, '2026-06-15')).toBe(100);
    expect(primerDiaSinSaldo(0, caja, '2026-06-15', 200)).toBe('2026-09-10');
    expect(primerDiaSinSaldo(0, caja, '2026-06-15', 100)).toBeNull();
  });

  it('suma el saldo inicial y los movimientos del mismo día juntos', () => {
    expect(saldoUtilizableAFecha(50, [m('2026-06-01', -50), m('2026-06-01', 30)], '2026-05-01')).toBe(30);
  });

  it('redondea a centavos (0,1 + 0,2)', () => {
    expect(saldoAFecha(0, [m('2026-01-01', 0.1), m('2026-01-02', 0.2)], '2026-01-05')).toBe(0.3);
    expect(primerDiaSinSaldo(0, [m('2026-01-01', 0.1), m('2026-01-02', 0.2)], '2026-01-05', 0.3)).toBeNull();
  });

  it('borrar un ingreso que financia un pago posterior deja la cuenta en negativo; un negativo viejo no bloquea', () => {
    const despues = [m('2026-09-10', -900)];
    expect(cambioDejaSaldoNegativo(0, caja, despues, '2026-06-01')).toBe('2026-09-10');
    expect(cambioDejaSaldoNegativo(0, despues, despues, '2026-06-01')).toBeNull();
  });
});
