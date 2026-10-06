import { describe, expect, it } from 'vitest';
import { cuentaMedioDeLiquidacion, medioNoValidoParaLiquidar } from './liquidacion';

describe('cuentaMedioDeLiquidacion', () => {
  it('un PAGO que salda un pasivo tiene el medio del lado del Haber', () => {
    expect(cuentaMedioDeLiquidacion({ operacion: 'PAGO', motor: 'PASIVOS', cuenta_debito: 'Préstamos Santander', cuenta_credito: 'Banco Nu' })).toBe('Banco Nu');
  });

  it('un COBRO que salda una cuenta a cobrar tiene el medio del lado del Debe', () => {
    expect(cuentaMedioDeLiquidacion({ operacion: 'COBRO', motor: 'ACTIVO', cuenta_debito: 'Banco Nu', cuenta_credito: 'Clientes a Cobrar' })).toBe('Banco Nu');
  });

  it('un gasto, un ingreso o una venta a crédito no son liquidaciones', () => {
    expect(cuentaMedioDeLiquidacion({ operacion: 'PAGO', motor: 'GASTOS', cuenta_debito: 'Alimentación', cuenta_credito: 'T. de Crédito' })).toBeNull();
    expect(cuentaMedioDeLiquidacion({ operacion: 'COBRO', motor: 'INGRESOS', cuenta_debito: 'Banco', cuenta_credito: 'Salario' })).toBeNull();
    expect(cuentaMedioDeLiquidacion({ operacion: 'VENTA', motor: 'ACTIVO', cuenta_debito: 'Clientes a Cobrar', cuenta_credito: 'Ventas' })).toBeNull();
  });
});

describe('medioNoValidoParaLiquidar', () => {
  it('solo sirve una cuenta de Activo que no sea por cobrar', () => {
    expect(medioNoValidoParaLiquidar('ACTIVO', false)).toBe(false);
    expect(medioNoValidoParaLiquidar('PASIVO', false)).toBe(true);
    expect(medioNoValidoParaLiquidar('ACTIVO', true)).toBe(true);
  });

  it('una cuenta que no se encontró no se bloquea acá', () => {
    expect(medioNoValidoParaLiquidar(null, false)).toBe(false);
    expect(medioNoValidoParaLiquidar(undefined, false)).toBe(false);
  });
});
