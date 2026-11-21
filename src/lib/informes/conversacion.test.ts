import { describe, expect, it } from 'vitest';
import { armarConversacion, conversacionComoTexto, direccionDeSerie, huellaDeDatos, sinMarcas } from './conversacion';
import type { DatosInterpretacion } from './interpretacion';

const base: DatosInterpretacion = {
  pt: false,
  esFamiliar: false,
  periodo: 'noviembre de 2026',
  dinero: (n) => `R$ ${Math.round(n)}`,
  hayMovimientos: true,
  resultado: { ingresos: 5000, costos: 1000, gastos: 1000, resultado: 3000, anterior: { ingresos: 4000, costos: 900, gastos: 900, resultado: 2200 }, topIngresos: [{ nombre: 'Masajes', valor: 3000 }, { nombre: 'Paquetes', valor: 2000 }], topSalidas: [{ nombre: 'Insumos', valor: 1200 }, { nombre: 'Alquiler', valor: 800 }] },
  flujo: { saldoInicial: 1000, entradas: 5000, salidas: 2000, saldoFinal: 4000, topEntradas: [], topSalidas: [], ahorro: null, tasaAhorro: null },
  balance: { activo: 9000, pasivo: 1000, patrimonio: 8000, resultado: 3000, anterior: { activo: 7000, pasivo: 1000, patrimonio: 6000 } },
  cuentasMovidas: [{ nombre: 'Caja', variacion: 3000, saldoFinal: 4000 }],
  gruposVariacion: null,
  sumas: { cuadra: true, totalDebe: 100, totalHaber: 100 },
  tendencia: [{ etiqueta: 'sep', resultado: 1500, ingresos: 3500 }, { etiqueta: 'oct', resultado: 2200, ingresos: 4000 }, { etiqueta: 'nov', resultado: 3000, ingresos: 5000 }],
  mesAnterior: 'octubre de 2026',
};
const quien = { nombre: 'Jorge', empresa: 'Equilibra' };

describe('armarConversacion', () => {
  it('saluda por el nombre y cuenta el mes con cifras reales', () => {
    const c = armarConversacion(base, quien);
    expect(c.saludo.titulo).toContain('Jorge');
    expect(c.saludo.texto).toContain('Equilibra');
    expect(sinMarcas(c.bloques[0].parrafos[0])).toContain('positivo de R$ 3000');
    expect(sinMarcas(c.bloques[0].parrafos[0])).toContain('un crecimiento de 36,4% frente a octubre de 2026');
  });

  it('un mes bueno con tendencia que sube cierra con tono positivo', () => {
    const c = armarConversacion(base, quien);
    expect(sinMarcas(c.bloques[2].parrafos[0])).toContain('viene mejorando');
    expect(c.tono).toBe('bien');
    expect(c.resumen).toContain('buen paso');
    expect(c.bloques.map((b) => b.clave)).toEqual(['inicio', 'como', 'tendencia', 'recomiendo']);
  });

  it('no inventa tendencias con pocos meses', () => {
    const c = armarConversacion({ ...base, tendencia: [{ etiqueta: 'nov', resultado: 3000, ingresos: 5000 }] }, quien);
    expect(c.bloques[2].parrafos[0]).toContain('Todavía no tengo suficientes meses');
  });

  it('un mes difícil es honesto y recomienda revisar las salidas', () => {
    const c = armarConversacion({ ...base, resultado: { ...base.resultado, resultado: -500, ingresos: 1500 }, flujo: { ...base.flujo, saldoFinal: 500 } }, quien);
    expect(sinMarcas(c.bloques[0].parrafos[0])).toContain('negativo de R$ 500');
    expect(c.bloques[3].parrafos[0]).toContain('Insumos y Alquiler');
    expect(c.tono).toBe('atencion');
  });

  it('sin movimientos solo avisa', () => {
    const c = armarConversacion({ ...base, hayMovimientos: false }, quien);
    expect(c.bloques).toHaveLength(1);
    expect(c.bloques[0].parrafos[0]).toContain('Todavía no hay movimientos');
  });

  it('en portugués habla con «você» y el texto plano no trae marcas', () => {
    const c = armarConversacion({ ...base, pt: true }, quien);
    expect(c.saludo.titulo).toContain('Olá');
    expect(conversacionComoTexto('Interpretação', c)).not.toContain('**');
    expect(c.resumen).toContain('Em resumo');
  });
});

describe('direccionDeSerie y huella', () => {
  it('detecta subida, bajada e irregularidad', () => {
    expect(direccionDeSerie([1, 2, 3])).toBe('sube');
    expect(direccionDeSerie([3, 2, 1])).toBe('baja');
    expect(direccionDeSerie([1, 3, 2])).toBe('irregular');
    expect(direccionDeSerie([1, 2])).toBe('irregular');
  });
  it('la huella cambia cuando cambian los números', () => {
    const a = huellaDeDatos(base);
    expect(huellaDeDatos(base)).toBe(a);
    expect(huellaDeDatos({ ...base, flujo: { ...base.flujo, saldoFinal: 4001 } })).not.toBe(a);
  });
});
