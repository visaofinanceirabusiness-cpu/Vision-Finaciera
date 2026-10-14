import { describe, it, expect } from 'vitest';
import { agruparPasivo, grupoDeCuentaPasivo, type CuentaDePasivo } from './gruposPasivo';

const c = (p: Partial<CuentaDePasivo>): CuentaDePasivo => ({ nombre: 'X', codigo: null, ancestros: ['PASIVO', 'PASIVO CORRIENTE'], valor: 100, ...p });

describe('grupoDeCuentaPasivo', () => {
  it('reconoce tarjetas, préstamos, cuentas a pagar y largo plazo', () => {
    expect(grupoDeCuentaPasivo(c({ nombre: 'T. de Crédito a Pagar Nu' }))).toBe('TARJETAS');
    expect(grupoDeCuentaPasivo(c({ nombre: 'Préstamos Santander' }))).toBe('DEUDAS');
    expect(grupoDeCuentaPasivo(c({ nombre: 'Netflix a pagar', ancestros: ['PASIVO', 'PASIVO CORRIENTE', 'Suscripciones a pagar'] }))).toBe('CUENTAS_PAGAR');
    expect(grupoDeCuentaPasivo(c({ nombre: 'Combustible Uber a pagar' }))).toBe('CUENTAS_PAGAR');
    expect(grupoDeCuentaPasivo(c({ nombre: 'Hipoteca banco', ancestros: ['PASIVO', 'PASIVO NO CORRIENTE'] }))).toBe('LARGO_PLAZO');
  });
  it('lo que no encaja queda en otros', () => {
    expect(grupoDeCuentaPasivo(c({ nombre: 'Varios' }))).toBe('OTROS');
  });
});

describe('agruparPasivo', () => {
  it('suma, ordena y descarta lo que no tiene saldo', () => {
    const r = agruparPasivo([
      c({ nombre: 'Netflix a pagar', valor: 45 }),
      c({ nombre: 'Claude a pagar', valor: 120 }),
      c({ nombre: 'Préstamos Santander', valor: 1000 }),
      c({ nombre: 'Facultad a pagar', valor: 0 }),
    ]);
    expect(r.map((g) => [g.id, g.total])).toEqual([['DEUDAS', 1000], ['CUENTAS_PAGAR', 165]]);
  });
});
