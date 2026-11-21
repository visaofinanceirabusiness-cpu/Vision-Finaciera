import { describe, expect, it } from 'vitest';
import { reunirDatos } from './interpretacionDatos';
import { armarInterpretacion } from './interpretacion';
import type { CuentaArbol } from './mayorArbol';

const c = (id: string, codigo: string, nombre: string, padre: string | null, naturaleza: string, tipo: string, saldo = 0): CuentaArbol => ({ id, codigo, nombre, cuenta_padre_id: padre, naturaleza, tipo_saldo: tipo, saldo_inicial: saldo });
const cuentas = [
  c('1', '1.0.0.0.0', 'Activo', null, 'DEUDORA', 'ACTIVO'),
  c('11', '1.1.1.0.1', 'Caja', '1', 'DEUDORA', 'ACTIVO', 100),
  c('3', '3.0.0.0.0', 'Patrimonio', null, 'ACREEDORA', 'PATRIMONIO'),
  c('31', '3.1.1.0.1', 'Capital', '3', 'ACREEDORA', 'PATRIMONIO', 100),
  c('4', '4.0.0.0.0', 'Ingresos', null, 'ACREEDORA', 'INGRESO'),
  c('41', '4.1.0.0.1', 'Ventas', '4', 'ACREEDORA', 'INGRESO'),
  c('6', '6.0.0.0.0', 'Gastos', null, 'DEUDORA', 'GASTO'),
  c('61', '6.1.1.0.1', 'Alquiler', '6', 'DEUDORA', 'GASTO'),
];
const hojas = cuentas.filter((x) => !cuentas.some((y) => y.cuenta_padre_id === x.id));
const asientos = [
  { fecha: '2026-09-10', debito: 'Caja', credito: 'Ventas', importe: 300 },
  { fecha: '2026-10-05', debito: 'Caja', credito: 'Ventas', importe: 500 },
  { fecha: '2026-10-20', debito: 'Alquiler', credito: 'Caja', importe: 200 },
];

describe('reunirDatos', () => {
  const datos = reunirDatos({ pt: false, esFamiliar: false, periodo: '2026-10', etiquetaPeriodo: 'octubre de 2026', dinero: (n) => `R$ ${Math.round(n)}`, cuentas, hojas, asientos, nombresMedioFinanciero: new Set(['Caja']), nombresPorCobrar: new Set() });

  it('el resultado es el del mes y se compara con el anterior', () => {
    expect(datos.resultado.ingresos).toBe(500);
    expect(datos.resultado.gastos).toBe(200);
    expect(datos.resultado.resultado).toBe(300);
    expect(datos.resultado.anterior?.ingresos).toBe(300);
    expect(datos.resultado.topSalidas[0]).toEqual({ nombre: 'Alquiler', valor: 200 });
  });

  it('el flujo parte del saldo real de caja y cierra con el neto del mes', () => {
    expect(datos.flujo.saldoInicial).toBe(400);
    expect(datos.flujo.entradas).toBe(500);
    expect(datos.flujo.salidas).toBe(200);
    expect(datos.flujo.saldoFinal).toBe(700);
  });

  it('el balance es a fin de mes y la ecuación cierra', () => {
    expect(datos.balance.activo).toBe(700);
    expect(datos.balance.activo).toBe(datos.balance.pasivo + datos.balance.patrimonio);
    expect(datos.sumas.cuadra).toBe(true);
  });

  it('alimenta al relato sin romperse', () => {
    const s = armarInterpretacion(datos);
    expect(s[0].lineas[0]).toContain('positivo, de R$ 300');
    expect(s.find((x) => x.clave === 'cuentas')!.lineas[0]).toContain('Ventas');
  });

  it('un mes sin movimientos lo marca', () => {
    const vacio = reunirDatos({ pt: false, esFamiliar: false, periodo: '2026-12', etiquetaPeriodo: 'diciembre de 2026', dinero: (n) => String(n), cuentas, hojas, asientos, nombresMedioFinanciero: new Set(['Caja']), nombresPorCobrar: new Set() });
    expect(vacio.hayMovimientos).toBe(false);
  });
});
