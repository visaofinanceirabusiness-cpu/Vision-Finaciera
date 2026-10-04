import { describe, it, expect } from 'vitest';
import {
  mapaNaturaleza,
  resultadoPorNaturaleza,
  resumenNaturaleza,
  type AsientoResultado,
  type CuentaResultado,
} from './naturalezaResultado';

const cuentas: CuentaResultado[] = [
  { id: 'i1', nombre: 'Alquiler Argentina', tipo_saldo: 'INGRESO', naturaleza: 'ACREEDORA', saldo_inicial: 0 },
  { id: 'i2', nombre: 'Uber', tipo_saldo: 'INGRESO', naturaleza: 'ACREEDORA', saldo_inicial: 0 },
  { id: 'g1', nombre: 'Vivienda', tipo_saldo: 'GASTO', naturaleza: 'DEUDORA', saldo_inicial: 0 },
  { id: 'g2', nombre: 'Servicios', tipo_saldo: 'GASTO', naturaleza: 'DEUDORA', saldo_inicial: 0 },
  { id: 'g3', nombre: 'Transporte', tipo_saldo: 'GASTO', naturaleza: 'DEUDORA', saldo_inicial: 0 },
  { id: 'a1', nombre: 'Banco Nu', tipo_saldo: 'ACTIVO', naturaleza: 'DEUDORA', saldo_inicial: 500 },
];

const asientos: AsientoResultado[] = [
  { id_operacion: 'OP-1', debito: 'Cuentas a cobrar', credito: 'Alquiler Argentina', importe: 1900 }, // ingreso fijo
  { id_operacion: 'OP-2', debito: 'Banco Nu', credito: 'Uber', importe: 438 }, // ingreso del mes
  { id_operacion: 'OP-3', debito: 'Vivienda', credito: 'Cuentas a Pagar', importe: 1800 }, // gasto fijo
  { id_operacion: 'OP-4', debito: 'Servicios', credito: 'Banco Nu', importe: 170 }, // recurrente variable
  { id_operacion: 'OP-5', debito: 'Transporte', credito: 'Banco Nu', importe: 120 }, // del mes
  { id_operacion: null, debito: 'Transporte', credito: 'Banco Nu', importe: 30 }, // sin id: del mes
];

const mapa = mapaNaturaleza([
  { idOperacion: 'OP-1', montoFijo: true },
  { idOperacion: 'OP-3', montoFijo: true },
  { idOperacion: 'OP-4', montoFijo: false },
]);

describe('naturalezaResultado', () => {
  it('reparte ingresos y gastos en fijos, recurrentes variables y del mes', () => {
    const r = resultadoPorNaturaleza(cuentas, asientos, mapa, false);

    expect(r.INGRESO.FIJO.total).toBe(1900);
    expect(r.INGRESO.DEL_MES.total).toBe(438);
    expect(r.GASTO.FIJO.total).toBe(1800);
    expect(r.GASTO.RECURRENTE_VARIABLE.total).toBe(170);
    expect(r.GASTO.DEL_MES.total).toBe(150);
    expect(r.GASTO.DEL_MES.filas[0].nombre).toBe('Transporte');
  });

  it('no incluye cuentas que no son de resultado', () => {
    const r = resultadoPorNaturaleza(cuentas, asientos, mapa, false);
    const nombres = Object.values(r.GASTO).flatMap((g) => g.filas.map((f) => f.nombre));
    expect(nombres).not.toContain('Banco Nu');
  });

  it('el total de los tres grupos coincide con el resultado sin partir', () => {
    const r = resultadoPorNaturaleza(cuentas, asientos, mapa, false);
    const resumen = resumenNaturaleza(r);
    // ingresos 2338 − gastos 2120 (sin partir)
    expect(resumen.resultadoTotal).toBe(2338 - 1800 - 170 - 150);
    expect(resumen.neto.FIJO).toBe(1900 - 1800);
    expect(resumen.neto.RECURRENTE_VARIABLE).toBe(-170);
    expect(resumen.neto.DEL_MES).toBe(438 - 150);
  });

  it('el saldo inicial (arrastre histórico) va a "del mes"', () => {
    const conInicial = cuentas.map((c) => (c.id === 'g3' ? { ...c, saldo_inicial: 1000 } : c));
    const r = resultadoPorNaturaleza(conInicial, asientos, mapa, true);
    expect(r.GASTO.DEL_MES.total).toBe(1150);
    expect(resultadoPorNaturaleza(conInicial, asientos, mapa, false).GASTO.DEL_MES.total).toBe(150);
  });

  it('cobertura y peso de lo recurrente', () => {
    const resumen = resumenNaturaleza(resultadoPorNaturaleza(cuentas, asientos, mapa, false));
    expect(resumen.cobertura).toBeCloseTo(1900 / 1970, 5);
    expect(resumen.pesoRecurrente).toBeCloseTo(1970 / 2120, 5);
  });

  it('sin gastos recurrentes no hay cobertura', () => {
    const resumen = resumenNaturaleza(resultadoPorNaturaleza(cuentas, asientos, new Map(), false));
    expect(resumen.cobertura).toBeNull();
    expect(resumen.pesoRecurrente).toBe(0);
  });

  it('si un asiento está vinculado como fijo y como variable, gana fijo', () => {
    const m = mapaNaturaleza([
      { idOperacion: 'OP-9', montoFijo: false },
      { idOperacion: 'OP-9', montoFijo: true },
    ]);
    expect(m.get('OP-9')).toBe('FIJO');
  });
});
