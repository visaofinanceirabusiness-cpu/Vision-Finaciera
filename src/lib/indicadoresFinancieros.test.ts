import { describe, expect, it } from 'vitest';
import { calcularIndicadores, cambioContraAnterior, lucroDe, serieDeIndicador, type FotoMes } from './indicadoresFinancieros';

const foto = (clave: string, extra: Partial<FotoMes> = {}): FotoMes => ({
  clave,
  activoCorriente: 1500,
  mercaderias: 500,
  activoTotal: 2500,
  pasivoCorriente: 600,
  pasivoTotal: 800,
  patrimonioNeto: 1700,
  ingresos: 1000,
  costos: 400,
  gastosOperativos: 200,
  gastosNoOperativos: 50,
  ...extra,
});

describe('calcularIndicadores', () => {
  const r = calcularIndicadores(foto('2026-10'), null);

  it('liquidez', () => {
    expect(r.liquidezCorriente).toBe(2.5);
    expect(r.liquidezSeca).toBe(1.67);
    expect(r.liquidezGeneral).toBe(1.88);
  });

  it('márgenes sobre ingresos', () => {
    expect(r.margenBruto).toBe(60);
    expect(r.margenOperacional).toBe(40);
    expect(r.margenLiquido).toBe(35);
    expect(lucroDe(foto('2026-10'))).toBe(350);
  });

  it('rentabilidades y estructura', () => {
    expect(r.rentabilidadActivo).toBe(14);
    expect(r.rentabilidadPN).toBe(20.6);
    expect(r.participacionTerceros).toBe(47.1);
    expect(r.endeudamiento).toBe(32);
  });

  it('anualizar multiplica por 12 solo las rentabilidades', () => {
    const a = calcularIndicadores(foto('2026-10'), null, { anualizar: true });
    expect(a.rentabilidadActivo).toBe(168);
    expect(a.margenLiquido).toBe(35);
  });

  it('sin base devuelve null en vez de números engañosos', () => {
    const sinNada = calcularIndicadores(foto('2026-10', { pasivoCorriente: 0, pasivoTotal: 0, ingresos: 0, patrimonioNeto: -50 }), null);
    expect(sinNada.liquidezCorriente).toBeNull();
    expect(sinNada.liquidezGeneral).toBeNull();
    expect(sinNada.margenBruto).toBeNull();
    expect(sinNada.rentabilidadPN).toBeNull();
    expect(sinNada.participacionTerceros).toBeNull();
    expect(sinNada.crecimientoIngresos).toBeNull();
  });
});

describe('crecimiento', () => {
  it('mes contra mes', () => {
    const r = calcularIndicadores(foto('2026-10', { ingresos: 1200 }), foto('2026-09', { ingresos: 1000 }));
    expect(r.crecimientoIngresos).toBe(20);
  });

  it('del lucro con base negativa: perder menos es crecer', () => {
    const anterior = foto('2026-09', { ingresos: 100, costos: 100, gastosOperativos: 100, gastosNoOperativos: 0 }); // −100
    const actual = foto('2026-10', { ingresos: 100, costos: 100, gastosOperativos: 50, gastosNoOperativos: 0 }); // −50
    expect(calcularIndicadores(actual, anterior).crecimientoLucro).toBe(50);
  });

  it('null si el mes anterior fue cero', () => {
    const anterior = foto('2026-09', { ingresos: 0, costos: 0, gastosOperativos: 0, gastosNoOperativos: 0 });
    expect(calcularIndicadores(foto('2026-10'), anterior).crecimientoLucro).toBeNull();
  });
});

describe('serieDeIndicador y cambioContraAnterior', () => {
  const fotos = [foto('2026-08', { ingresos: 800 }), foto('2026-09', { ingresos: 1000 }), foto('2026-10', { ingresos: 1100 })];

  it('serie hasta el mes elegido', () => {
    const s = serieDeIndicador(fotos, 'crecimientoIngresos', { hastaClave: '2026-09' });
    expect(s.map((p) => p.clave)).toEqual(['2026-08', '2026-09']);
    expect(s[0].valor).toBeNull();
    expect(s[1].valor).toBe(25);
  });

  it('últimos N meses', () => {
    expect(serieDeIndicador(fotos, 'margenBruto', { ultimos: 2 }).map((p) => p.clave)).toEqual(['2026-09', '2026-10']);
  });

  it('el pulgar depende de si subir es bueno', () => {
    expect(cambioContraAnterior('liquidezCorriente', 2, 1.5)).toEqual({ delta: 0.5, favorable: true });
    expect(cambioContraAnterior('endeudamiento', 40, 35)).toEqual({ delta: 5, favorable: false });
    expect(cambioContraAnterior('endeudamiento', 30, 35)).toEqual({ delta: -5, favorable: true });
    expect(cambioContraAnterior('margenBruto', 50, 50)).toEqual({ delta: 0, favorable: null });
    expect(cambioContraAnterior('margenBruto', null, 50)).toBeNull();
  });
});
