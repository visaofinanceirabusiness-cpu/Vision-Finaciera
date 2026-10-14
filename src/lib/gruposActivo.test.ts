import { describe, it, expect } from 'vitest';
import { agruparActivo, grupoDeCuentaActivo, type CuentaDeActivo } from './gruposActivo';

const c = (p: Partial<CuentaDeActivo>): CuentaDeActivo => ({
  nombre: 'X',
  codigo: null,
  esMedio: false,
  esPorCobrar: false,
  ancestros: ['ACTIVO', 'ACTIVO CORRIENTE'],
  valor: 100,
  ...p,
});

describe('grupoDeCuentaActivo', () => {
  it('lo por cobrar va aparte, aunque cuelgue de un grupo de alquileres', () => {
    expect(grupoDeCuentaActivo(c({ esPorCobrar: true, ancestros: ['ACTIVO', 'ACTIVO CORRIENTE', 'Alquileres Argentina a cobrar'] }))).toBe('POR_COBRAR');
  });
  it('un medio de pago bajo Activo corriente es dinero disponible', () => {
    expect(grupoDeCuentaActivo(c({ esMedio: true }))).toBe('DINERO');
  });
  it('el grupo del plan manda sobre el medio de pago', () => {
    expect(grupoDeCuentaActivo(c({ esMedio: true, ancestros: ['ACTIVO', 'AHORROS E INVERSIONES'] }))).toBe('AHORROS');
  });
  it('bienes, no corriente e inventario', () => {
    expect(grupoDeCuentaActivo(c({ ancestros: ['ACTIVO', 'BIENES Y PROPIEDADES'] }))).toBe('BIENES');
    expect(grupoDeCuentaActivo(c({ ancestros: ['ACTIVO', 'ACTIVO NO CORRIENTE'] }))).toBe('NO_CORRIENTE');
    expect(grupoDeCuentaActivo(c({ ancestros: ['ACTIVO', 'ACTIVO CORRIENTE', 'Mercaderías'] }))).toBe('INVENTARIO');
    expect(grupoDeCuentaActivo(c({ codigo: '1.1.3.0.1' }))).toBe('INVENTARIO');
  });
  it('lo que no encaja queda en otros', () => {
    expect(grupoDeCuentaActivo(c({}))).toBe('OTROS');
  });
});

describe('agruparActivo', () => {
  it('suma, ordena por total y descarta lo que no tiene saldo', () => {
    const r = agruparActivo([
      c({ nombre: 'Banco A', esMedio: true, valor: 50 }),
      c({ nombre: 'Banco B', esMedio: true, valor: 150 }),
      c({ nombre: 'Casa', ancestros: ['ACTIVO', 'BIENES Y PROPIEDADES'], valor: 1000 }),
      c({ nombre: 'Vacía', esMedio: true, valor: 0 }),
    ]);
    expect(r.map((g) => [g.id, g.total])).toEqual([['BIENES', 1000], ['DINERO', 200]]);
    expect(r[1].cuentas.map((x) => x.nombre)).toEqual(['Banco B', 'Banco A']);
  });
});
