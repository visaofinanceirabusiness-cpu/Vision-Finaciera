import { describe, expect, it } from 'vitest';
import { construirEdificio, buscarNodo, type CuentaPlan, type NodoEdificio } from './visao3d';
import { ALTURA_EDIFICIO, alturaPorValor, disenarVolumenes, hijosVisibles } from './visao3dLayout';

const nodo = (id: string, saldo: number, extra: Partial<NodoEdificio> = {}): NodoEdificio => ({
  id, codigo: id, nombre: id, grupo: 'ACTIVO', nivel: 2, saldo, saldoAnterior: null, variacion: null, variacionPct: null, participacion: null,
  hijos: [], esHoja: true, sintetico: false, cuentasDependientes: 0, cuentaNombre: id, ...extra,
});

describe('hijosVisibles', () => {
  it('oculta los saldos en cero y los cuenta', () => {
    const padre = nodo('p', 30, { hijos: [nodo('a', 30), nodo('b', 0), nodo('c', 0.2)] });
    expect(hijosVisibles(padre, false, 'Otras')).toMatchObject({ ocultosEnCero: 2 });
    expect(hijosVisibles(padre, true, 'Otras').visibles).toHaveLength(3);
  });

  it('agrupa lo que excede el tope en un "Otras" que suma, sin perder importe', () => {
    const hijos = Array.from({ length: 30 }, (_, i) => nodo(`c${i}`, i + 1));
    const padre = nodo('p', hijos.reduce((s, h) => s + h.saldo, 0), { hijos });
    const { visibles } = hijosVisibles(padre, false, 'Otras', 10);
    expect(visibles).toHaveLength(10);
    const otras = visibles[9];
    expect(otras.id).toBe('otras:p');
    expect(otras.hijos).toHaveLength(21);
    expect(visibles.reduce((s, h) => s + h.saldo, 0)).toBe(padre.saldo);
  });
});

describe('disenarVolumenes', () => {
  const plan: CuentaPlan[] = [
    { id: 'a', codigo: '1', nombre: 'ACTIVO', cuenta_padre_id: null, tipo_saldo: 'ACTIVO', naturaleza: 'DEUDORA', saldo_inicial: 0 },
    { id: 'caja', codigo: '1.1', nombre: 'Caja', cuenta_padre_id: 'a', tipo_saldo: 'ACTIVO', naturaleza: 'DEUDORA', saldo_inicial: 300 },
    { id: 'p', codigo: '2', nombre: 'PASIVO', cuenta_padre_id: null, tipo_saldo: 'PASIVO', naturaleza: 'ACREEDORA', saldo_inicial: 0 },
    { id: 'deu', codigo: '2.1', nombre: 'Deudas', cuenta_padre_id: 'p', tipo_saldo: 'PASIVO', naturaleza: 'ACREEDORA', saldo_inicial: 100 },
    { id: 'pn', codigo: '3', nombre: 'PATRIMONIO', cuenta_padre_id: null, tipo_saldo: 'PATRIMONIO', naturaleza: 'ACREEDORA', saldo_inicial: 0 },
    { id: 'cap', codigo: '3.1', nombre: 'Capital', cuenta_padre_id: 'pn', tipo_saldo: 'PATRIMONIO', naturaleza: 'ACREEDORA', saldo_inicial: 200 },
  ];
  const e = construirEdificio(plan, [], null, { empresa: 'E', ACTIVO: 'Ativo', PASIVO: 'Passivo', PATRIMONIO: 'PL', resultado: 'Res' });

  it('empresa: Activo a la izquierda; Pasivo sobre Patrimonio, con alturas de la ecuación', () => {
    const { volumenes } = disenarVolumenes(e.raiz, false, 'Otras');
    const [activo, patrimonio, pasivo] = volumenes;
    expect(activo.alto).toBe(ALTURA_EDIFICIO);
    expect(activo.x).toBeLessThan(0);
    // A escala: 100/300 y 200/300 del Activo (que mide 6).
    expect(pasivo.alto).toBeCloseTo(2, 5);
    expect(patrimonio.alto).toBeCloseTo(4, 5);
    expect(pasivo.y).toBeCloseTo(patrimonio.alto, 5);
    expect(patrimonio.alto).toBeGreaterThan(pasivo.alto);
  });

  it('un grupo: pisos apilados con altura total del edificio', () => {
    const { volumenes } = disenarVolumenes(buscarNodo(e.raiz, 'grupo:ACTIVO')!, false, 'Otras', e.raiz.saldo);
    const pisos = volumenes[0].pisos;
    expect(pisos.map((p) => p.id)).toEqual(['caja']);
    expect(pisos.reduce((s, p) => s + p.altura, 0)).toBeCloseTo(volumenes[0].alto, 5);
    expect(volumenes[0].alto).toBe(ALTURA_EDIFICIO);
  });

  it('el alto de un grupo depende de su valor (mismo criterio en todo el edificio)', () => {
    const activo = disenarVolumenes(buscarNodo(e.raiz, 'grupo:ACTIVO')!, false, 'Otras', e.raiz.saldo).volumenes[0].alto;
    const pasivo = disenarVolumenes(buscarNodo(e.raiz, 'grupo:PASIVO')!, false, 'Otras', e.raiz.saldo).volumenes[0].alto;
    expect(pasivo).toBeCloseTo(2, 5);
    expect(pasivo).toBeLessThan(activo);
  });

  it('alturaPorValor: mínimo visible, tope y espacio para los pisos', () => {
    expect(alturaPorValor(0, 1000)).toBeGreaterThan(1);
    expect(alturaPorValor(5000, 1000)).toBe(ALTURA_EDIFICIO);
    expect(alturaPorValor(-500, 1000)).toBe(3);
    expect(alturaPorValor(10, 1000, 12)).toBeGreaterThanOrEqual(12 * 0.32);
  });
});
