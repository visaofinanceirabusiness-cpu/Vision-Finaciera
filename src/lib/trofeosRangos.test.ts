import { describe, expect, it } from 'vitest';
import {
  FAMILIAS_TROFEO,
  TIPOS_TROFEO,
  ORDEN_TIER,
  claveMedalla,
  descripcionMedalla,
  medallasAlcanzadas,
  medallasPendientes,
  progresoDeFamilia,
} from './trofeosRangos';

describe('catálogo', () => {
  it('cada tipo tiene el título original y 5 títulos nuevos', () => {
    for (const tipo of TIPOS_TROFEO) {
      expect(FAMILIAS_TROFEO[tipo].rangos).toHaveLength(6);
    }
  });

  it('los umbrales siempre suben: dentro de un título y de un título al siguiente', () => {
    for (const tipo of TIPOS_TROFEO) {
      const todos = FAMILIAS_TROFEO[tipo].rangos.flatMap((r) => ORDEN_TIER.map((t) => r.umbrales[t]));
      for (let i = 1; i < todos.length; i++) {
        expect(todos[i]).toBeGreaterThan(todos[i - 1]);
      }
    }
  });

  it('conserva los umbrales originales del título 0', () => {
    expect(FAMILIAS_TROFEO.PAGO.rangos[0].umbrales).toEqual({ BRONCE: 25, PLATA: 50, ORO: 85 });
    expect(FAMILIAS_TROFEO.COBRO.rangos[0].umbrales).toEqual({ BRONCE: 15, PLATA: 35, ORO: 60 });
    expect(FAMILIAS_TROFEO.TRANSFERENCIA.rangos[0].umbrales).toEqual({ BRONCE: 10, PLATA: 25, ORO: 45 });
  });

  it('cada título tiene un nombre distinto', () => {
    for (const tipo of TIPOS_TROFEO) {
      const nombres = FAMILIAS_TROFEO[tipo].rangos.map((r) => r.nombre);
      expect(new Set(nombres).size).toBe(nombres.length);
    }
  });
});

describe('progresoDeFamilia', () => {
  const pago = FAMILIAS_TROFEO.PAGO;

  it('con 167 pagos ya se completaron el título original y el primero; el 2º está en curso', () => {
    const p = progresoDeFamilia(167, pago);
    expect(p.titulosCompletos).toEqual([0, 1]);
    expect(p.rango.nombre).toBe('Pagador Ejemplar');
    expect(p.medallas).toBe(0);
    expect(p.siguiente).toEqual({ tier: 'BRONCE', umbral: 240, faltan: 73 });
  });

  it('el avance se mide desde la medalla anterior', () => {
    // entre 160 (último del título 1) y 240 (primer Bronce del título 2)
    expect(progresoDeFamilia(200, pago).porcentaje).toBe(50);
  });

  it('al empezar no hay medallas y el avance parte de cero', () => {
    const p = progresoDeFamilia(0, pago);
    expect(p.rango.indice).toBe(0);
    expect(p.medallas).toBe(0);
    expect(p.porcentaje).toBe(0);
  });

  it('con todo completo queda el último título, marcado como completo', () => {
    const p = progresoDeFamilia(99999, pago);
    expect(p.completo).toBe(true);
    expect(p.rango.nombre).toBe('Pagador Legendario');
    expect(p.siguiente).toBeNull();
  });
});

describe('medallas', () => {
  it('cuenta cuántas de las 3 medallas de un título se alcanzaron', () => {
    const r = FAMILIAS_TROFEO.COBRO.rangos[1]; // 65 / 80 / 120
    expect(medallasAlcanzadas(64, r)).toBe(0);
    expect(medallasAlcanzadas(80, r)).toBe(2);
    expect(medallasAlcanzadas(500, r)).toBe(3);
  });

  it('devuelve las medallas alcanzadas que todavía no están guardadas', () => {
    const ganadas = new Set([claveMedalla('COBRO', 0, 'BRONCE'), claveMedalla('COBRO', 0, 'PLATA')]);
    const pendientes = medallasPendientes({ PAGO: 0, COBRO: 72, TRANSFERENCIA: 0 }, ganadas);
    expect(pendientes).toEqual([
      { tipo: 'COBRO', rango: 0, tier: 'ORO' },
      { tipo: 'COBRO', rango: 1, tier: 'BRONCE' },
    ]);
  });

  it('describe la medalla en los dos idiomas', () => {
    expect(descripcionMedalla('PAGO', 2, 'ORO', false)).toBe('Pagador Ejemplar — medalla Oro');
    expect(descripcionMedalla('PAGO', 2, 'ORO', true)).toBe('Pagador Exemplar — medalha Ouro');
  });
});
