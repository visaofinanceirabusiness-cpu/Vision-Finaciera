import { describe, expect, it } from 'vitest';
import { construirEdificio, type CuentaPlan } from './visao3d';
import { construirNodosCasa, slotDeCuenta } from './visao3dCasa';

const c = (id: string, codigo: string, nombre: string, tipo: string, nat: string, padre: string | null = null, ini = 0): CuentaPlan => ({ id, codigo, nombre, cuenta_padre_id: padre, tipo_saldo: tipo, naturaleza: nat, saldo_inicial: ini });
const plan: CuentaPlan[] = [
  c('a', '1', 'ACTIVO', 'ACTIVO', 'DEUDORA'), c('ab', '1.1', 'BIENES', 'ACTIVO', 'DEUDORA', 'a'),
  c('veh', '1.1.1', 'Vehículos', 'ACTIVO', 'DEUDORA', 'ab', 20000), c('inm', '1.1.2', 'Inmuebles', 'ACTIVO', 'DEUDORA', 'ab', 0),
  c('bn', '1.1.3', 'Banco Nu', 'ACTIVO', 'DEUDORA', 'ab', 500), c('bs', '1.1.4', 'Banco Santander', 'ACTIVO', 'DEUDORA', 'ab', 300), c('cx', '1.1.5', 'Caxinha Viaje', 'ACTIVO', 'DEUDORA', 'ab', 100), c('x', '1.1.6', 'Cosa rara', 'ACTIVO', 'DEUDORA', 'ab', 50),
  c('p', '2', 'PASIVO', 'PASIVO', 'ACREEDORA'), c('tj', '2.1', 'T. de Crédito a Pagar Nu', 'PASIVO', 'ACREEDORA', 'p', 400), c('pr', '2.2', 'Préstamos Santander', 'PASIVO', 'ACREEDORA', 'p', 200), c('ag', '2.3', 'Netflix a pagar', 'PASIVO', 'ACREEDORA', 'p', 20),
  c('pn', '3', 'PATRIMONIO', 'PATRIMONIO', 'ACREEDORA'), c('cap', '3.1', 'Aportes y Ayudas Recibidas', 'PATRIMONIO', 'ACREEDORA', 'pn', 20000),
];
const e = construirEdificio(plan, [], null, { empresa: 'E', ACTIVO: 'Ativo', PASIVO: 'Passivo', PATRIMONIO: 'PL', resultado: 'Resultado' });
const nodos = construirNodosCasa(e.raiz, false);

describe('construirNodosCasa', () => {
  it('suma las cuentas de cada amenidad (varios bancos = una amenidad)', () => {
    expect(nodos.auto.saldo).toBe(20000);
    expect(nodos.banco.saldo).toBe(800);
    expect(nodos.banco.hijos.map((h) => h.id).sort()).toEqual(['bn', 'bs']);
    expect(nodos.ahorro.saldo).toBe(100);
    expect(nodos.otros.saldo).toBe(50);
  });

  it('amenidades sin cuentas quedan en cero (la casa las tiene, sin pintar)', () => {
    expect(nodos.muebles.saldo).toBe(0);
    expect(nodos.electro.hijos).toEqual([]);
    expect(nodos.inmueble.saldo).toBe(0);
  });

  it('pasivo y patrimonio', () => {
    expect(nodos.tarjeta.saldo).toBe(400);
    expect(nodos.prestamo.saldo).toBe(200);
    expect(nodos.apagar.saldo).toBe(20);
    expect(nodos.capital.saldo).toBe(20000);
    expect(nodos.resultado.sintetico).toBe(true);
  });

  it('los totales de las amenidades cierran con los de cada grupo (sin duplicar)', () => {
    const suma = (grupo: string) => Object.values(nodos).filter((n) => n.grupo === grupo).reduce((s, n) => s + n.saldo, 0);
    expect(suma('ACTIVO')).toBe(e.raiz.hijos[0].saldo);
    expect(suma('PASIVO')).toBe(e.raiz.hijos[1].saldo);
    expect(suma('PATRIMONIO')).toBe(e.raiz.hijos[2].saldo);
  });

  it('encuentra la amenidad de una cuenta', () => {
    expect(slotDeCuenta(nodos, 'bs')).toBe('banco');
    expect(slotDeCuenta(nodos, 'nada')).toBeNull();
  });
});
