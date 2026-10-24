import { describe, expect, it } from 'vitest';
import { colorDeSaldo, COLOR_NEGATIVO, COLOR_SIN_SALDO, tipoObjeto } from './visao3dObjetos';

describe('tipoObjeto', () => {
  it('reconoce cuentas típicas en español y portugués', () => {
    expect(tipoObjeto('Vehículos')).toBe('auto');
    expect(tipoObjeto('Veículos')).toBe('auto');
    expect(tipoObjeto('Inmuebles')).toBe('casa');
    expect(tipoObjeto('Muebles y Útiles')).toBe('mesa');
    expect(tipoObjeto('Electrodomésticos')).toBe('equipo');
    expect(tipoObjeto('Mercadería')).toBe('mercaderia');
    expect(tipoObjeto('Banco Santander')).toBe('banco');
    expect(tipoObjeto('Efectivo')).toBe('billetes');
    expect(tipoObjeto('Caixa')).toBe('billetes');
    expect(tipoObjeto('Caxinha Viaje')).toBe('ahorro');
    expect(tipoObjeto('Capital')).toBe('capital');
  });

  it('las cuentas de stock son mercadería (salvo vehículos, que siguen siendo un auto)', () => {
    expect(tipoObjeto('Estoque Eletrônicos')).toBe('mercaderia');
    expect(tipoObjeto('Estoque Calçados')).toBe('mercaderia');
    expect(tipoObjeto('Stock Ropa')).toBe('mercaderia');
    expect(tipoObjeto('Estoque Veículos')).toBe('auto');
    expect(tipoObjeto('Equipamentos de Informática')).toBe('equipo');
  });

  it('lo que se debe o se cobra es un documento aunque nombre otra cosa', () => {
    expect(tipoObjeto('Alquiler Arg. Casita a cobrar')).toBe('documento');
    expect(tipoObjeto('Préstamos Santander')).toBe('documento');
    expect(tipoObjeto('T. de Crédito a Pagar Nu')).toBe('documento');
  });

  it('línea calculada y desconocidas', () => {
    expect(tipoObjeto('Lo que sea', true)).toBe('resultado');
    expect(tipoObjeto('Cosa rara')).toBe('caja');
  });
});

describe('colorDeSaldo', () => {
  it('gris en cero, rojo en negativo, color del grupo si hay saldo', () => {
    expect(colorDeSaldo(0, '#2f7df6')).toBe(COLOR_SIN_SALDO);
    expect(colorDeSaldo(0.3, '#2f7df6')).toBe(COLOR_SIN_SALDO);
    expect(colorDeSaldo(-50, '#2f7df6')).toBe(COLOR_NEGATIVO);
    expect(colorDeSaldo(500, '#2f7df6')).toBe('#2f7df6');
  });
});
