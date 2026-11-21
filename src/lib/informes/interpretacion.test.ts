import { describe, expect, it } from 'vitest';
import { armarInterpretacion, relatoComoTexto, type DatosInterpretacion } from './interpretacion';

const base: DatosInterpretacion = {
  pt: false,
  esFamiliar: false,
  periodo: 'noviembre de 2026',
  dinero: (n) => `R$ ${Math.round(n)}`,
  hayMovimientos: true,
  resultado: { ingresos: 1000, costos: 400, gastos: 800, resultado: -200, anterior: { ingresos: 800, costos: 300, gastos: 600, resultado: -100 }, topIngresos: [{ nombre: 'Ventas', valor: 1000 }], topSalidas: [{ nombre: 'Alquiler', valor: 600 }, { nombre: 'Insumos', valor: 400 }] },
  flujo: { saldoInicial: 500, entradas: 1000, salidas: 1300, saldoFinal: 200, topEntradas: [{ nombre: 'Ventas', valor: 1000 }], topSalidas: [{ nombre: 'Alquiler', valor: 600 }], ahorro: null, tasaAhorro: null },
  balance: { activo: 5000, pasivo: 4000, patrimonio: 1000, resultado: -200, anterior: { activo: 4800, pasivo: 3500, patrimonio: 1300 } },
  cuentasMovidas: [{ nombre: 'Caja', variacion: -300, saldoFinal: 200 }],
  gruposVariacion: [{ nombre: 'Pasivo', variacion: 500 }, { nombre: 'Activo', variacion: 200 }],
  sumas: { cuadra: true, totalDebe: 9000, totalHaber: 9000 },
};

describe('armarInterpretacion', () => {
  it('sin movimientos solo avisa, sin inventar', () => {
    const s = armarInterpretacion({ ...base, hayMovimientos: false });
    expect(s).toHaveLength(1);
    expect(s[0].lineas[0]).toContain('Todavía no hay movimientos');
  });

  it('arma las siete secciones con cifras reales', () => {
    const s = armarInterpretacion(base);
    expect(s.map((x) => x.clave)).toEqual(['panorama', 'resultado', 'flujo', 'balance', 'cuentas', 'sumas', 'cierre']);
    expect(s[0].lineas[0]).toContain('negativo, de R$ 200');
    expect(s[1].lineas[0]).toContain('+25,0%');
    expect(s[1].lineas.join(' ')).toContain('Alquiler');
    expect(s[2].lineas[0]).toContain('cerraste con R$ 200');
  });

  it('un mes malo aconseja revisar salidas y cuidar liquidez y deuda', () => {
    const cierre = armarInterpretacion(base).find((x) => x.clave === 'cierre')!;
    const texto = cierre.lineas.join(' ');
    expect(cierre.tono).toBe('atencion');
    expect(texto).toContain('Alquiler y Insumos');
    expect(texto).toContain('liquidez');
    expect(texto).toContain('bajar deudas');
  });

  it('un mes bueno lo dice', () => {
    const s = armarInterpretacion({
      ...base,
      resultado: { ...base.resultado, resultado: 500, ingresos: 2000, costos: 500, gastos: 1000, anterior: { ingresos: 1900, costos: 500, gastos: 1000, resultado: 400 } },
      flujo: { ...base.flujo, saldoInicial: 500, saldoFinal: 1500, salidas: 800 },
      balance: { ...base.balance, pasivo: 500, patrimonio: 4500, resultado: 500, anterior: null },
    });
    expect(s[0].tono).toBe('bien');
    expect(s.find((x) => x.clave === 'cierre')!.lineas[0]).toContain('buen mes');
  });

  it('si no cuadra el Debe y el Haber lo marca', () => {
    const s = armarInterpretacion({ ...base, sumas: { cuadra: false, totalDebe: 100, totalHaber: 90 } });
    expect(s.find((x) => x.clave === 'sumas')!.tono).toBe('atencion');
    expect(s.find((x) => x.clave === 'cierre')!.lineas.join(' ')).toContain('no cuadran');
  });

  it('Familia habla de su familia y de ahorro; en portugués sale en portugués', () => {
    const s = armarInterpretacion({ ...base, esFamiliar: true, pt: true, flujo: { ...base.flujo, ahorro: 200, tasaAhorro: 5 } });
    expect(s[0].lineas[0]).toContain('sua família');
    expect(s.find((x) => x.clave === 'flujo')!.lineas.join(' ')).toContain('Você poupou');
    expect(s.find((x) => x.clave === 'cierre')!.lineas.join(' ')).toContain('poupar pelo menos 10%');
  });

  it('el texto plano trae todos los títulos', () => {
    const t = relatoComoTexto('Relato', armarInterpretacion(base));
    expect(t).toContain('PANORAMA DEL MES');
    expect(t).toContain('SUMAS Y SALDOS');
  });
});
