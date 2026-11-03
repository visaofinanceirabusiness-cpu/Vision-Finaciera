import { describe, expect, it } from 'vitest';
import { consolidar, generarCodigoFamilia, participaciones, tendenciaDelResultado, unirCategorias, unirEvolucion, type PersonaFamilia, type PuntoEvolucion } from './familiaUnida';

const persona = (n: string, extra: Partial<PersonaFamilia> = {}): PersonaFamilia => ({ empresaId: n, nombre: n, esYo: false, ingresos: 0, egresos: 0, resultado: 0, activos: 0, pasivos: 0, evolucion: [], gastosCategorias: [], ingresosCategorias: [], ...extra });
const pt = (clave: string, ingresos: number, egresos: number): PuntoEvolucion => ({ clave, mes: clave, ingresos, egresos, resultado: ingresos - egresos });

describe('consolidar', () => {
  it('suma personas sin tocar los datos originales y el resultado cierra', () => {
    const a = persona('A', { ingresos: 1000, egresos: 400, resultado: 600, activos: 5000, pasivos: 1000 });
    const b = persona('B', { ingresos: 500, egresos: 700, resultado: -200, activos: 2000, pasivos: 500 });
    const copia = JSON.stringify([a, b]);
    const t = consolidar([a, b]);
    expect(t).toMatchObject({ ingresos: 1500, egresos: 1100, resultado: 400, activos: 7000, pasivos: 1500, patrimonioLiquido: 5500 });
    expect(t.ingresos - t.egresos).toBe(t.resultado);
    expect(JSON.stringify([a, b])).toBe(copia);
  });
  it('una sola persona o ninguna también funciona', () => {
    expect(consolidar([]).resultado).toBe(0);
    expect(consolidar([persona('A', { ingresos: 10, egresos: 4, resultado: 6 })]).resultado).toBe(6);
  });
});

describe('unir categorías y evolución', () => {
  it('agrupa por nombre, ordena y descarta lo que no suma', () => {
    const r = unirCategorias([[{ nombre: 'Moradia', valor: 100 }, { nombre: 'Lazer', valor: 20 }], [{ nombre: 'Moradia', valor: 50 }, { nombre: 'Cero', valor: 0 }]]);
    expect(r).toEqual([{ nombre: 'Moradia', valor: 150 }, { nombre: 'Lazer', valor: 20 }]);
  });
  it('suma por mes aunque una persona no tenga ese mes', () => {
    const r = unirEvolucion([[pt('2026-09', 100, 40), pt('2026-10', 100, 60)], [pt('2026-10', 50, 80)]]);
    expect(r.map((p) => [p.clave, p.resultado])).toEqual([['2026-09', 60], ['2026-10', 10]]);
  });
});

describe('tendenciaDelResultado', () => {
  it('detecta cuántos meses seguidos sube', () => {
    const t = tendenciaDelResultado([pt('2026-08', 10, 9), pt('2026-09', 10, 8), pt('2026-10', 10, 5)]);
    expect(t).toMatchObject({ direccion: 'sube', mesesSeguidos: 2, actual: 5, anterior: 2, variacionPct: 150 });
  });
  it('detecta bajas y evita porcentajes engañosos con base negativa', () => {
    expect(tendenciaDelResultado([pt('2026-09', 10, 5), pt('2026-10', 10, 8)]).direccion).toBe('baja');
    expect(tendenciaDelResultado([pt('2026-09', 5, 10), pt('2026-10', 10, 8)]).variacionPct).toBeNull();
  });
  it('ignora meses vacíos y sin datos suficientes no opina', () => {
    expect(tendenciaDelResultado([pt('2026-09', 0, 0), pt('2026-10', 10, 5)]).direccion).toBe('sin-datos');
    expect(tendenciaDelResultado([]).direccion).toBe('sin-datos');
  });
});

describe('participaciones y código', () => {
  it('calcula el porcentaje de cada categoría', () => {
    expect(participaciones([{ nombre: 'A', valor: 75 }, { nombre: 'B', valor: 25 }]).map((c) => c.porcentaje)).toEqual([75, 25]);
    expect(participaciones([])).toEqual([]);
  });
  it('el código tiene 8 caracteres sin ambiguos', () => {
    const c = generarCodigoFamilia(() => 0.5);
    expect(c).toHaveLength(8);
    expect(generarCodigoFamilia()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});
