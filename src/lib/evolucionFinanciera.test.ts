import { describe, expect, it } from 'vitest';
import { agrupar, etiquetaPeriodo, filtrarRango, rangoAnterior, rangoDePreset, rellenarMeses, totalesDe, variacion } from './evolucionFinanciera';

const mes = (clave: string, ingresos: number, costos = 0, gastos = 0) => ({ mes: '', clave, ingresos, costos, gastos });

describe('rellenarMeses', () => {
  it('completa en cero los meses sin movimientos', () => {
    const r = rellenarMeses([mes('2026-01', 100), mes('2026-04', 40)]);
    expect(r.map((d) => d.clave)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(r[1].ingresos).toBe(0);
  });

  it('calcula resultado y margen bruto', () => {
    const [p] = rellenarMeses([mes('2026-01', 1000, 400, 250)]);
    expect(p.resultado).toBe(350);
    expect(p.margenBruto).toBe(600);
  });
});

describe('agrupar', () => {
  const datos = rellenarMeses([mes('2025-11', 10), mes('2025-12', 20), mes('2026-01', 30, 5, 5), mes('2026-07', 70)]);

  it('por trimestre y semestre', () => {
    expect(agrupar(datos, 'TRIMESTRE').map((g) => [g.clave, g.ingresos])).toEqual([
      ['2025-T4', 30],
      ['2026-T1', 30],
      ['2026-T2', 0],
      ['2026-T3', 70],
    ]);
    expect(agrupar(datos, 'SEMESTRE').map((g) => g.clave)).toEqual(['2025-S2', '2026-S1', '2026-S2']);
  });

  it('por año suma el resultado', () => {
    const anual = agrupar(datos, 'ANIO');
    expect(anual.map((g) => g.clave)).toEqual(['2025', '2026']);
    expect(anual[1].resultado).toBe(20 + 70 + 0);
  });
});

describe('rangos y variaciones', () => {
  it('rango anterior de igual largo', () => {
    expect(rangoAnterior({ desde: '2026-04', hasta: '2026-06' })).toEqual({ desde: '2026-01', hasta: '2026-03' });
    expect(rangoAnterior({ desde: '2026-01', hasta: '2026-03' })).toEqual({ desde: '2025-10', hasta: '2025-12' });
  });

  it('variación null sin base', () => {
    expect(variacion(10, 0)).toBeNull();
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(-50, -100)).toBe(50);
  });

  it('filtra y totaliza', () => {
    const datos = rellenarMeses([mes('2026-01', 10), mes('2026-02', 20), mes('2026-03', 30)]);
    const t = totalesDe(filtrarRango(datos, { desde: '2026-02', hasta: '2026-03' }));
    expect(t.ingresos).toBe(50);
  });

  it('presets', () => {
    const claves = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02'];
    expect(rangoDePreset('TODO', claves)).toEqual({ desde: '2025-10', hasta: '2026-02' });
    expect(rangoDePreset('ULT6', claves)).toEqual({ desde: '2025-10', hasta: '2026-02' });
    expect(rangoDePreset('ANIO_ACTUAL', claves, new Date(2026, 5, 1))).toEqual({ desde: '2026-01', hasta: '2026-02' });
    // sin datos del año en curso → último año con datos
    expect(rangoDePreset('ANIO_ACTUAL', claves, new Date(2027, 0, 1))).toEqual({ desde: '2026-01', hasta: '2026-02' });
    expect(rangoDePreset('ANIO_2030', claves)).toBeNull();
    expect(rangoDePreset('TODO', [])).toBeNull();
  });
});

describe('etiquetaPeriodo', () => {
  it('meses en español y portugués', () => {
    expect(etiquetaPeriodo('2026-09', 'ES')).toBe('Sep');
    expect(etiquetaPeriodo('2026-09', 'PT')).toBe('Set');
    expect(etiquetaPeriodo('2026-09', 'PT', { larga: true })).toBe('Setembro 2026');
    expect(etiquetaPeriodo('2026-09', 'ES', { conAnio: true })).toBe('Sep 26');
  });

  it('trimestre, semestre y año', () => {
    expect(etiquetaPeriodo('2026-T2', 'ES')).toBe('T2');
    expect(etiquetaPeriodo('2026-T2', 'ES', { conAnio: true })).toBe('T2 2026');
    expect(etiquetaPeriodo('2026-S1', 'ES', { larga: true })).toBe('1º semestre 2026');
    expect(etiquetaPeriodo('2026', 'ES')).toBe('2026');
  });
});
