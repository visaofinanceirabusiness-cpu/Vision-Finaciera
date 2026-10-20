import { describe, expect, it } from 'vitest';
import { armarFlujo, crearClasificador, diferenciaConSaldoDeseado, movimientosDeCaja, promedioSalidasMensuales, saldoAlCierreDePeriodo, saldoInicialDePeriodo, type AsientoFlujo, type CuentaFlujo } from './flujoCaja';

const cuentas: CuentaFlujo[] = [
  { nombre: 'Caja', codigo: '1.1.1.0.1' },
  { nombre: 'Banco', codigo: '1.1.1.0.2' },
  { nombre: 'Clientes', codigo: '1.1.2.0.1' },
  { nombre: 'Mercaderías', codigo: '1.1.3.0.1' },
  { nombre: 'Plazo Fijo', codigo: '1.3.1.0.1' },
  { nombre: 'Vehículos', codigo: '1.2.1.0.1' },
  { nombre: 'Proveedores', codigo: '2.1.1.0.1' },
  { nombre: 'Préstamo Bancario', codigo: '2.1.1.0.3' },
  { nombre: 'Alquiler a pagar', codigo: '2.1.2.0.9' },
  { nombre: 'Capital', codigo: '3.1.0.0.1' },
  { nombre: 'Ventas', codigo: '4.1.0.0.1' },
  { nombre: 'Alquiler', codigo: '6.3.1.0.1' },
  { nombre: 'Intereses', codigo: '6.4.1.0.1' },
];

const cajas = new Set(['Caja', 'Banco']);
const a = (fecha: string, debito: string, credito: string, importe: number): AsientoFlujo => ({ fecha, debito, credito, importe });

const asientos = [
  a('2026-09-10', 'Caja', 'Capital', 1000),
  a('2026-10-01', 'Caja', 'Ventas', 500),
  a('2026-10-02', 'Caja', 'Clientes', 200),
  a('2026-10-03', 'Proveedores', 'Caja', 150),
  a('2026-10-04', 'Alquiler', 'Caja', 100),
  a('2026-10-05', 'Alquiler', 'Alquiler a pagar', 80),
  a('2026-10-06', 'Alquiler a pagar', 'Caja', 80),
  a('2026-10-07', 'Plazo Fijo', 'Banco', 300),
  a('2026-10-08', 'Banco', 'Caja', 50),
  a('2026-10-09', 'Caja', 'Préstamo Bancario', 400),
  a('2026-10-10', 'Intereses', 'Caja', 20),
];

describe('flujo de caja por actividades', () => {
  const clasificar = crearClasificador(cuentas, asientos, cajas);
  const flujo = armarFlujo(movimientosDeCaja(asientos.filter((x) => x.fecha >= '2026-10'), cajas), clasificar);

  it('separa comercial, operativo, inversión y financiero', () => {
    expect(flujo.bloques.COMERCIAL.neto).toBe(500 + 200 - 150);
    expect(flujo.bloques.OPERATIVO.neto).toBe(-100 - 80);
    expect(flujo.bloques.INVERSION.neto).toBe(-300);
    expect(flujo.bloques.FINANCIERO.neto).toBe(400 - 20);
    expect(flujo.bloques.OTROS.neto).toBe(0);
  });

  it('un pasivo propio se clasifica por su origen (gasto → operativo)', () => {
    expect(clasificar('Alquiler a pagar')).toBe('OPERATIVO');
  });

  it('la transferencia entre cajas propias no cuenta', () => {
    expect(movimientosDeCaja([a('2026-10-08', 'Banco', 'Caja', 50)], cajas)).toEqual([]);
  });

  it('saldo inicial + flujo neto = saldo real de caja', () => {
    const inicial = saldoInicialDePeriodo([{ nombre: 'Caja', saldo_inicial: 100 }, { nombre: 'Banco', saldo_inicial: 0 }], asientos, '2026-10');
    expect(inicial).toBe(1100);
    const real = 100 + asientos.reduce((s, x) => s + (cajas.has(x.debito ?? '') ? x.importe : 0) - (cajas.has(x.credito ?? '') ? x.importe : 0), 0);
    expect(inicial + flujo.neto).toBe(real);
  });

  it('con todos los períodos el inicial es el saldo de arranque', () => {
    expect(saldoInicialDePeriodo([{ nombre: 'Caja', saldo_inicial: 100 }], asientos, 'TODOS')).toBe(100);
  });

  it('sin movimientos todos los bloques quedan en cero', () => {
    const vacio = armarFlujo([], clasificar);
    expect(vacio.neto).toBe(0);
    expect(vacio.bloques.COMERCIAL.entradas).toEqual([]);
  });
});

describe('saldo deseado', () => {
  it('informa lo que sobra o lo que falta', () => {
    expect(diferenciaConSaldoDeseado(1000, 400)).toEqual({ tipo: 'SOBRA', monto: 600 });
    expect(diferenciaConSaldoDeseado(300, 400)).toEqual({ tipo: 'FALTA', monto: 100 });
    expect(diferenciaConSaldoDeseado(400, 400)).toEqual({ tipo: 'EXACTO', monto: 0 });
  });
});

describe('Familia', () => {
  const plan: CuentaFlujo[] = [
    { nombre: 'Efectivo', codigo: '1.1.1.0.1' },
    { nombre: 'Plazo Fijo', codigo: '1.2.1.0.1' },
    { nombre: 'Vehículos', codigo: '1.3.1.0.1' },
    { nombre: 'Sueldo', codigo: '4.1.0.0.1' },
    { nombre: 'Supermercado', codigo: '6.1.1.0.1' },
  ];
  const caja = new Set(['Efectivo']);
  const movs = [
    a('2026-08-01', 'Efectivo', 'Sueldo', 1000),
    a('2026-08-05', 'Supermercado', 'Efectivo', 300),
    a('2026-08-06', 'Plazo Fijo', 'Efectivo', 200),
    a('2026-09-01', 'Efectivo', 'Sueldo', 1000),
    a('2026-09-05', 'Supermercado', 'Efectivo', 500),
    a('2026-09-10', 'Vehículos', 'Efectivo', 400),
    a('2026-10-01', 'Supermercado', 'Efectivo', 999),
  ];

  it('separa ahorro (1.2) de bienes (1.3)', () => {
    const clasificar = crearClasificador(plan, movs, caja, true);
    expect(clasificar('Plazo Fijo')).toBe('INVERSION');
    expect(clasificar('Vehículos')).toBe('BIENES');
    expect(crearClasificador(plan, movs, caja, false)('Vehículos')).toBe('INVERSION');
  });

  it('el colchón sugerido es el promedio de salidas sin ahorro ni bienes', () => {
    const clasificar = crearClasificador(plan, movs, caja, true);
    expect(promedioSalidasMensuales(movimientosDeCaja(movs, caja), clasificar, '2026-10')).toBe((300 + 500) / 2);
  });

  it('el saldo de ahorros al cierre suma lo aportado', () => {
    expect(saldoAlCierreDePeriodo([{ nombre: 'Plazo Fijo', saldo_inicial: 50 }], movs, '2026-08')).toBe(250);
    expect(saldoAlCierreDePeriodo([{ nombre: 'Plazo Fijo', saldo_inicial: 50 }], movs, 'TODOS')).toBe(250);
  });
});
