import { describe, expect, it } from 'vitest';
import { X_CENTRO, X_COCHERA, X_DER, X_IZQ } from '@/components/visao3d/familia/layout';
import { CAPACIDAD_CUARTO, MAX_COLUMNAS_ACTIVO, MAX_COLUMNAS_DERECHA, planificarCasa } from './visao3dCasaPlano';

const plano = (a: number, p: number, n: number) => planificarCasa({ ACTIVO: a, PASIVO: p, PATRIMONIO: n });
const solapan = (a: { x0: number; x1: number; y0: number }, b: { x0: number; x1: number; y0: number }) => a.y0 === b.y0 && a.x0 < b.x1 - 1e-6 && b.x0 < a.x1 - 1e-6;

describe('planificarCasa', () => {
  it('con pocas cuentas es la casa base de 5 cuartos, con las medidas de la casa dibujada', () => {
    const p = plano(0, 0, 0);
    expect(p.cuartos.map((c) => c.id).sort()).toEqual(['comedor', 'dormitorio', 'garage', 'living', 'oficina']);
    const ZONAS = {
      garage: { x0: X_IZQ, x1: X_COCHERA, y0: 0, grupo: 'ACTIVO' },
      living: { x0: X_COCHERA, x1: X_CENTRO, y0: 0, grupo: 'ACTIVO' },
      dormitorio: { x0: X_COCHERA, x1: X_CENTRO, y0: 3.75, grupo: 'ACTIVO' },
      oficina: { x0: X_CENTRO, x1: X_DER, y0: 3.75, grupo: 'PASIVO' },
      comedor: { x0: X_CENTRO, x1: X_DER, y0: 0, grupo: 'PATRIMONIO' },
    };
    for (const [id, z] of Object.entries(ZONAS)) {
      const c = p.cuartos.find((x) => x.id === id)!;
      expect(c.grupo).toBe(z.grupo);
      expect([c.x0, c.x1, c.y0].map((v) => +v.toFixed(2))).toEqual([z.x0, z.x1, z.y0].map((v) => +v.toFixed(2)));
    }
    expect(p.pisos).toBe(2);
  });

  it('la base alcanza hasta 15 objetos de Activo y 5 de Pasivo / Patrimonio', () => {
    expect(plano(3 * CAPACIDAD_CUARTO, 5, 5).cuartos).toHaveLength(5);
  });

  it('el Activo suma cuartos al lado (a la izquierda) y luego sube de piso', () => {
    const p = plano(16, 1, 1);
    const activo = p.cuartosDe('ACTIVO');
    expect(activo).toHaveLength(4);
    expect(activo[3]).toMatchObject({ col: 0, piso: 1 });
    const grande = plano(80, 1, 1).cuartosDe('ACTIVO');
    expect(grande.length).toBe(16);
    expect(Math.max(...grande.map((c) => c.piso))).toBeGreaterThanOrEqual(2);
    expect(Math.min(...grande.map((c) => c.col))).toBeGreaterThanOrEqual(-(MAX_COLUMNAS_ACTIVO - 2));
  });

  it('el Pasivo crece a la derecha y el Patrimonio queda debajo con el mismo ancho', () => {
    const p = plano(0, 8, 1);
    const pasivo = p.cuartosDe('PASIVO');
    const patrimonio = p.cuartosDe('PATRIMONIO');
    expect(pasivo).toHaveLength(2);
    expect(patrimonio).toHaveLength(2);
    expect(patrimonio.map((c) => c.piso)).toEqual([0, 0]);
    expect(pasivo.map((c) => c.piso)).toEqual([1, 1]);
    pasivo.forEach((c, i) => expect([c.x0, c.x1]).toEqual([patrimonio[i].x0, patrimonio[i].x1]));
  });

  it('pasado el ancho máximo del lado derecho se sube de piso, con el Patrimonio siempre debajo', () => {
    const p = plano(0, 5 * (MAX_COLUMNAS_DERECHA + 1), 1);
    const pasivo = p.cuartosDe('PASIVO');
    expect(Math.max(...pasivo.map((c) => c.piso))).toBe(2);
    expect(Math.max(...p.cuartosDe('PATRIMONIO').map((c) => c.piso))).toBe(0);
  });

  it('ningún cuarto se pisa con otro, en ningún tamaño', () => {
    for (const [a, pa, n] of [[0, 0, 0], [16, 6, 6], [40, 12, 3], [80, 30, 30], [200, 100, 100]] as const) {
      const cuartos = plano(a, pa, n).cuartos;
      cuartos.forEach((c, i) => cuartos.slice(i + 1).forEach((d) => expect(solapan(c, d)).toBe(false)));
    }
  });

  it('cada grupo tiene capacidad para todos sus objetos', () => {
    const p = plano(47, 23, 9);
    expect(p.cuartosDe('ACTIVO').length * CAPACIDAD_CUARTO).toBeGreaterThanOrEqual(47);
    expect(p.cuartosDe('PASIVO').length * CAPACIDAD_CUARTO).toBeGreaterThanOrEqual(23);
    expect(p.cuartosDe('PATRIMONIO').length * CAPACIDAD_CUARTO).toBeGreaterThanOrEqual(9);
  });
});
