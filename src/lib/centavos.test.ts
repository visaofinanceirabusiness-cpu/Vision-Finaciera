import { describe, it, expect } from 'vitest';
import { aCentavos } from './centavos';

describe('aCentavos', () => {
  it('una suma que da 19,99999… queda en 20', () => {
    const importes = [0.1, 0.2, 0.7, 19, 0.1, 0.2, 0.7];
    const haber = importes.reduce((s, x) => s + x, 0);
    const debe = 0.1 + 0.2 + 0.7;
    expect(aCentavos(haber - debe - 20)).toBe(0);
  });

  it('el pago que deja la cuenta en cero no es negativo', () => {
    const saldo = aCentavos(17169.49 - 17149.49);
    expect(aCentavos(saldo - 20) < 0).toBe(false);
  });

  it('un faltante real de un centavo sigue siendo negativo', () => {
    expect(aCentavos(19.99 - 20)).toBe(-0.01);
    expect(aCentavos(19.99 - 20) < 0).toBe(true);
  });
});
