import { describe, expect, it } from 'vitest';
import { tipoCuotasPara } from './cuotasOperacion';

describe('tipoCuotasPara', () => {
  it('Compra/Pago contra un Pasivo → PASIVO', () => {
    expect(tipoCuotasPara('PAGO', '2', false)).toBe('PASIVO');
    expect(tipoCuotasPara('COMPRA', '2', false)).toBe('PASIVO');
  });
  it('Venta/Cobro contra cuenta por cobrar → COBRO', () => {
    expect(tipoCuotasPara('VENTA', '1', false)).toBe('COBRO');
    expect(tipoCuotasPara('COBRO', '1', false)).toBe('COBRO');
  });
  it('Caja/Banco (usables para gasto) y otras operaciones → null', () => {
    expect(tipoCuotasPara('VENTA', '1', true)).toBeNull();
    expect(tipoCuotasPara('TRANSFERENCIA', '2', false)).toBeNull();
    expect(tipoCuotasPara('PAGO', '1', false)).toBeNull();
  });
});
