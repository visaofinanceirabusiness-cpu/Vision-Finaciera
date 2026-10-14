import { describe, it, expect } from 'vitest';
import { agruparPatrimonio, grupoDeCuentaPatrimonio } from './gruposPatrimonio';

describe('grupoDeCuentaPatrimonio', () => {
  it('reconoce aportes, resultados y lo familiar', () => {
    expect(grupoDeCuentaPatrimonio({ nombre: 'Aportes y Ayudas Recibidas', codigo: null })).toBe('APORTES');
    expect(grupoDeCuentaPatrimonio({ nombre: 'Capital Social', codigo: null })).toBe('APORTES');
    expect(grupoDeCuentaPatrimonio({ nombre: 'Resultados Acumulados', codigo: null })).toBe('RESULTADOS');
    expect(grupoDeCuentaPatrimonio({ nombre: 'Retiro Personal / Préstamos Otorgados', codigo: null })).toBe('FAMILIAR');
  });
});

describe('agruparPatrimonio', () => {
  it('suma por grupo, ordena y descarta lo que no tiene saldo', () => {
    const r = agruparPatrimonio([
      { nombre: 'Aportes y Ayudas Recibidas', codigo: null, valor: 500 },
      { nombre: 'Resultados Acumulados', codigo: null, valor: 900 },
      { nombre: 'Retiro Personal / Préstamos Otorgados', codigo: null, valor: 0 },
    ]);
    expect(r.map((g) => [g.id, g.total])).toEqual([['RESULTADOS', 900], ['APORTES', 500]]);
  });
});
