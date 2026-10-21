import { describe, expect, it } from 'vitest';
import { armarMayor, mesAnteriorDe, type AsientoMayor } from './mayorCuenta';

const a = (id: string, fecha: string, debito: string, credito: string, importe: number): AsientoMayor => ({ id_operacion: id, fecha, descripcion: '', debito, credito, importe, operacion: null });

const caja = { nombre: 'Caja', naturaleza: 'DEUDORA', saldo_inicial: 100 };
const asientos = [
  a('OP-1', '2026-09-10', 'Caja', 'Ventas', 200),
  a('OP-2', '2026-09-20', 'Proveedores', 'Caja', 50),
  a('OP-3', '2026-10-05', 'Caja', 'Ventas', 300),
  a('OP-4', '2026-10-06', 'Caja', 'Cobros', 100),
  a('OP-5', '2026-10-07', 'Alquiler', 'Caja', 150),
  a('OP-6', '2026-10-08', 'Otra', 'Ventas', 999),
];

describe('armarMayor', () => {
  it('Todos: saldo corrido desde el inicial y meses disponibles', () => {
    const m = armarMayor(caja, asientos, 'TODOS');
    expect(m.meses).toEqual(['2026-10', '2026-09']);
    expect(m.saldoAnterior).toBe(100);
    expect(m.saldoFinal).toBe(500);
    expect(m.filas).toHaveLength(5);
    expect(m.indicadores.volumenMesAnterior).toBeNull();
  });

  it('un mes: saldo anterior acumulado, indicadores y variación contra el mes previo', () => {
    const m = armarMayor(caja, asientos, '2026-10');
    expect(m.saldoAnterior).toBe(250);
    expect(m.saldoFinal).toBe(500);
    expect(m.indicadores).toMatchObject({ variacionSaldo: 250, debe: 400, haber: 150, neto: 250, movimientos: 3, volumenMesAnterior: 250, variacionVolumen: 120 });
    expect(m.indicadores.contrapartidas[0]).toEqual({ cuenta: 'Ventas', importe: 300, porcentaje: 54.55 });
  });

  it('cuenta acreedora y mes sin movimientos', () => {
    const ventas = { nombre: 'Ventas', naturaleza: 'ACREEDORA', saldo_inicial: 0 };
    expect(armarMayor(ventas, asientos, '2026-09').saldoFinal).toBe(200);
    const vacio = armarMayor(caja, asientos, '2026-11');
    expect(vacio.filas).toEqual([]);
    expect(vacio.saldoAnterior).toBe(500);
    expect(vacio.saldoFinal).toBe(500);
  });

  it('mes anterior', () => {
    expect(mesAnteriorDe('2026-01')).toBe('2025-12');
    expect(mesAnteriorDe('2026-10')).toBe('2026-09');
  });
});
