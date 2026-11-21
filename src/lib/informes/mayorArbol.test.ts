import { describe, expect, it } from 'vitest';
import { arbolMayor, profundidadMaxima, rutaHastaCuenta, sinCeros, type CuentaArbol } from './mayorArbol';

const c = (id: string, codigo: string, nombre: string, padre: string | null, naturaleza: string, tipo: string, saldo = 0): CuentaArbol => ({ id, codigo, nombre, cuenta_padre_id: padre, naturaleza, tipo_saldo: tipo, saldo_inicial: saldo });
const cuentas = [
  c('1', '1.0', 'Activo', null, 'DEUDORA', 'ACTIVO'),
  c('11', '1.1', 'Caja', '1', 'DEUDORA', 'ACTIVO', 1000),
  c('12', '1.2', 'Banco', '1', 'DEUDORA', 'ACTIVO'),
  c('3', '3.0', 'Patrimonio', null, 'ACREEDORA', 'PATRIMONIO'),
  c('31', '3.1', 'Capital', '3', 'ACREEDORA', 'PATRIMONIO', 1000),
  c('32', '3.2', 'Retiro', '3', 'DEUDORA', 'PATRIMONIO'),
  c('9', '9.0', 'Vacía', null, 'DEUDORA', 'ACTIVO'),
];
const asientos = [
  { fecha: '2026-09-10', debito: 'Banco', credito: 'Caja', importe: 300 },
  { fecha: '2026-10-05', debito: 'Retiro', credito: 'Banco', importe: 50 },
  { fecha: '2026-10-20', debito: 'Caja', credito: 'Capital', importe: 200 },
];

describe('arbolMayor', () => {
  it('todo el histórico: saldos y totales de las cuentas título', () => {
    const { raices, totalDebe, totalHaber } = arbolMayor(cuentas, asientos, 'TODOS');
    const activo = raices.find((r) => r.cuenta.nombre === 'Activo')!;
    expect(activo.debe).toBe(500);
    expect(activo.haber).toBe(350);
    expect(activo.saldoInicial).toBe(1000);
    expect(activo.saldoFinal).toBe(1150);
    expect(totalDebe).toBe(totalHaber);
  });
  it('un mes: el saldo inicial arrastra lo anterior', () => {
    const { raices } = arbolMayor(cuentas, asientos, '2026-10');
    const caja = raices[0].hijos.find((h) => h.cuenta.nombre === 'Caja')!;
    expect(caja.saldoInicial).toBe(700);
    expect(caja.debe).toBe(200);
    expect(caja.saldoFinal).toBe(900);
  });
  it('una cuenta contra resta del patrimonio', () => {
    const { raices } = arbolMayor(cuentas, asientos, 'TODOS');
    const pat = raices.find((r) => r.cuenta.nombre === 'Patrimonio')!;
    expect(pat.saldoFinal).toBe(1200 - 50);
  });
});

describe('utilidades del árbol', () => {
  it('sinCeros saca lo que nunca tuvo saldo', () => {
    const { raices } = arbolMayor(cuentas, asientos, 'TODOS');
    expect(sinCeros(raices).map((r) => r.cuenta.nombre)).not.toContain('Vacía');
  });
  it('profundidad y ruta', () => {
    const { raices } = arbolMayor(cuentas, asientos, 'TODOS');
    expect(profundidadMaxima(raices)).toBe(2);
    expect(rutaHastaCuenta(cuentas, 'Caja')).toEqual(['11', '1']);
  });
});
