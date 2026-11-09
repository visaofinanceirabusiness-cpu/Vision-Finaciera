import { describe, expect, it } from 'vitest';
import { MAX_PARTES, chequearSaldos, cuentasInvolucradas, importesPorCuenta, totalDePartes, validarPartes, validarPartidaDoble, type HistorialSaldo, type ParteOperacion } from './pagoDividido';

const parte = (formaPago: string, monto: number, extra: Partial<ParteOperacion> = {}): ParteOperacion => ({ categoria: 'Alimentación', formaPago, monto, ...extra });

describe('validarPartes', () => {
  it('acepta un gasto de 300 pagado 100 con banco y 200 con efectivo', () => {
    expect(validarPartes([parte('Banco XX', 100), parte('Efectivo', 200)], 300, { tieneStock: false })).toBeNull();
  });
  it('rechaza menos de 2 partes, más del máximo y montos en cero', () => {
    expect(validarPartes([parte('Banco', 300)], 300, { tieneStock: false })).toContain('al menos dos');
    const muchas = Array.from({ length: MAX_PARTES + 1 }, (_, i) => parte(`Medio ${i}`, 10));
    expect(validarPartes(muchas, 10 * (MAX_PARTES + 1), { tieneStock: false })).toContain('hasta');
    expect(validarPartes([parte('Banco', 0), parte('Efectivo', 300)], 300, { tieneStock: false })).toContain('mayor que cero');
  });
  it('exige que las partes sumen el total e informa cuánto falta o sobra', () => {
    expect(validarPartes([parte('Banco', 100), parte('Efectivo', 150)], 300, { tieneStock: false })).toContain('faltan 50.00');
    expect(validarPartes([parte('Banco', 100), parte('Efectivo', 250)], 300, { tieneStock: false })).toContain('se pasan 50.00');
  });
  it('no se pierde por centavos de punto flotante', () => {
    expect(validarPartes([parte('Banco', 0.1), parte('Efectivo', 0.2)], 0.3, { tieneStock: false })).toBeNull();
  });
  it('no repite la misma categoría con la misma forma de pago', () => {
    expect(validarPartes([parte('Banco', 100), parte('Banco', 200)], 300, { tieneStock: false })).toContain('No repitas');
  });
  it('con productos solo se divide entre formas de pago; sin productos también entre categorías', () => {
    const entreCategorias = [parte('Banco', 100), { ...parte('Banco', 200), categoria: 'Transporte' }];
    expect(validarPartes(entreCategorias, 300, { tieneStock: true })).toContain('misma categoría');
    expect(validarPartes(entreCategorias, 300, { tieneStock: false })).toBeNull();
  });
  it('solo una parte puede ir en cuotas', () => {
    expect(validarPartes([parte('Tarjeta A', 100, { enCuotas: true }), parte('Tarjeta B', 200, { enCuotas: true })], 300, { tieneStock: false })).toContain('Solo una');
    expect(validarPartes([parte('Tarjeta A', 100, { enCuotas: true }), parte('Efectivo', 200)], 300, { tieneStock: false })).toBeNull();
  });
  it('suma los montos', () => {
    expect(totalDePartes([parte('a', 100.1), parte('b', 199.9)])).toBe(300);
  });
});

describe('importes por cuenta', () => {
  const asientos = [
    { cuenta_debito: 'Gastos', cuenta_credito: 'Banco', importe: 100 },
    { cuenta_debito: 'Gastos', cuenta_credito: 'Efectivo', importe: 200 },
  ];
  it('suma por cuenta y lado', () => {
    const r = importesPorCuenta(asientos);
    expect(r.find((x) => x.cuenta === 'Gastos' && x.lado === 'DEBITO')?.importe).toBe(300);
    expect(r.find((x) => x.cuenta === 'Banco')?.importe).toBe(100);
    expect(cuentasInvolucradas(asientos).sort()).toEqual(['Banco', 'Efectivo', 'Gastos']);
  });
  it('dos partes en la misma cuenta se validan juntas', () => {
    const r = importesPorCuenta([{ cuenta_debito: 'Gastos', cuenta_credito: 'Banco', importe: 60 }, { cuenta_debito: 'Gastos', cuenta_credito: 'Banco', importe: 60 }]);
    expect(r.find((x) => x.cuenta === 'Banco')?.importe).toBe(120);
  });
});

describe('chequearSaldos', () => {
  const historiales = (banco: number, efectivo: number): Map<string, HistorialSaldo | null> =>
    new Map<string, HistorialSaldo | null>([
      ['Banco', { naturaleza: 'DEUDORA', saldoInicial: banco, movimientos: [] }],
      ['Efectivo', { naturaleza: 'DEUDORA', saldoInicial: efectivo, movimientos: [] }],
      ['Gastos', { naturaleza: 'DEUDORA', saldoInicial: 0, movimientos: [] }],
    ]);
  const asientos = [
    { cuenta_debito: 'Gastos', cuenta_credito: 'Banco', importe: 100 },
    { cuenta_debito: 'Gastos', cuenta_credito: 'Efectivo', importe: 200 },
  ];
  it('deja pasar cuando cada cuenta alcanza para su parte', () => {
    expect(chequearSaldos(asientos, historiales(100, 200), '2026-11-09')).toBeNull();
    expect(chequearSaldos(asientos, historiales(500, 500), '2026-11-09')).toBeNull();
  });
  it('rechaza si UNA cuenta no alcanza, y dice cuál', () => {
    const e = chequearSaldos(asientos, historiales(99.99, 200), '2026-11-09');
    expect(e).toContain('"Banco"');
    expect(e).toContain('No hay saldo suficiente');
    expect(chequearSaldos(asientos, historiales(100, 150), '2026-11-09')).toContain('"Efectivo"');
  });
  it('dos partes sobre la misma cuenta cuentan juntas', () => {
    const dos = [{ cuenta_debito: 'Gastos', cuenta_credito: 'Banco', importe: 60 }, { cuenta_debito: 'Gastos', cuenta_credito: 'Banco', importe: 60 }];
    expect(chequearSaldos(dos, historiales(100, 0), '2026-11-09')).toContain('"Banco"');
    expect(chequearSaldos(dos, historiales(120, 0), '2026-11-09')).toBeNull();
  });
  it('una cuenta acreedora no puede quedar con saldo a favor', () => {
    const h = new Map<string, HistorialSaldo | null>([['Proveedores', { naturaleza: 'ACREEDORA', saldoInicial: 50, movimientos: [] }]]);
    expect(chequearSaldos([{ cuenta_debito: 'Proveedores', cuenta_credito: 'Banco', importe: 80 }], h, '2026-11-09')).toContain('saldo a favor');
  });
  it('una cuenta que no existe en el plan se ignora, como siempre', () => {
    expect(chequearSaldos(asientos, new Map(), '2026-11-09')).toBeNull();
  });
  it('no deja sin fondos a un movimiento ya cargado con fecha posterior', () => {
    const h = new Map<string, HistorialSaldo | null>([
      ['Banco', { naturaleza: 'DEUDORA', saldoInicial: 0, movimientos: [{ fecha: '2026-11-01', delta: 300 }, { fecha: '2026-11-20', delta: -250 }] }],
    ]);
    expect(chequearSaldos([{ cuenta_debito: 'Gastos', cuenta_credito: 'Banco', importe: 100 }], h, '2026-11-10')).toContain('más adelante');
  });
});

import { autocompletarUltima, faltante, numeroDeMonto, partesDeForm, partesIniciales, resumenDePartes } from './pagoDividido';

describe('formulario de pago dividido', () => {
  it('lee montos con coma o punto y devuelve 0 si no son un número', () => {
    expect(numeroDeMonto('100,5')).toBe(100.5);
    expect(numeroDeMonto('100.5')).toBe(100.5);
    expect(numeroDeMonto('')).toBe(0);
    expect(numeroDeMonto('abc')).toBe(0);
  });
  it('arranca con dos partes: la primera con todo el monto y la segunda en blanco', () => {
    const p = partesIniciales('Alimentación', 'Banco XX', 300);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ formaPago: 'Banco XX', monto: '300' });
    expect(p[1]).toMatchObject({ formaPago: '', monto: '', auto: true });
  });
  it('la última parte se completa sola con lo que falta, hasta que la escriba la persona', () => {
    let p = partesIniciales('A', 'Banco', 300);
    p = [{ ...p[0], monto: '100' }, p[1]];
    p = autocompletarUltima(p, 300);
    expect(p[1].monto).toBe('200');
    expect(faltante(p, 300)).toBe(0);
    const escrita = [p[0], { ...p[1], monto: '150', auto: false }];
    expect(autocompletarUltima(escrita, 300)).toEqual(escrita);
  });
  it('si ya se pasó, la última queda en blanco', () => {
    const p = autocompletarUltima([{ categoria: 'A', formaPago: 'Banco', monto: '400' }, { categoria: 'A', formaPago: '', monto: '', auto: true }], 300);
    expect(p[1].monto).toBe('');
    expect(faltante(p, 300)).toBe(-100);
  });
  it('convierte a las partes del motor y arma el texto del resumen', () => {
    const partes = partesDeForm([{ categoria: 'A', formaPago: 'Banco XX', monto: '100' }, { categoria: 'A', formaPago: 'Efectivo', monto: '200,5', enCuotas: true }]);
    expect(partes[1]).toMatchObject({ monto: 200.5, enCuotas: true });
    expect(resumenDePartes(partes, 'R$', false)).toContain('Banco XX R$ 100');
    expect(resumenDePartes(partes, 'R$', true)).toContain('A · Efectivo');
  });
});

describe('validarPartidaDoble', () => {
  it('acepta asientos con Debe y Haber', () => {
    expect(validarPartidaDoble([{ cuenta_debito: 'Gasto', cuenta_credito: 'Banco', importe: 100 }, { cuenta_debito: 'Gasto', cuenta_credito: 'Caja', importe: 200 }])).toBeNull();
  });
  it('rechaza un asiento sin Haber', () => {
    expect(validarPartidaDoble([{ cuenta_debito: 'Gasto', cuenta_credito: null, importe: 100 }])).toContain('Partida doble');
  });
  it('rechaza importes inválidos', () => {
    expect(validarPartidaDoble([{ cuenta_debito: 'A', cuenta_credito: 'B', importe: 0 }])).toContain('Partida doble');
    expect(validarPartidaDoble([{ cuenta_debito: 'A', cuenta_credito: 'B', importe: Number.NaN }])).toContain('Partida doble');
  });
});
