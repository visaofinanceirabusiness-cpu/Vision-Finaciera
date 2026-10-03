// Tests de construirAnalisisMensual — función pura, sin Supabase.

import { describe, expect, it } from 'vitest';
import { construirAnalisisMensual, type OperacionDelMes } from './analisisMensual';

const opciones = { idioma: 'ES', moneda: 'BRL', mesNombre: 'septiembre' };

function operacion(operacion: string, categoria: string, total: number, fecha: string): OperacionDelMes {
  return { operacion, categoria, total, fecha };
}

describe('construirAnalisisMensual', () => {
  it('arma un análisis completo cuando hay actividad suficiente', () => {
    const operaciones: OperacionDelMes[] = [
      operacion('COBRO', 'Alquiler', 1000, '2026-09-01'),
      operacion('COBRO', 'Uber', 500, '2026-09-02'),
      operacion('PAGO', 'Alimentación', 300, '2026-09-03'),
      operacion('PAGO', 'Transporte', 200, '2026-09-04'),
      operacion('PAGO', 'Educación', 100, '2026-09-05'),
      operacion('COBRO', 'Alquiler', 1000, '2026-09-06'),
      operacion('PAGO', 'Salud', 50, '2026-09-07'),
      operacion('COBRO', 'Uber', 300, '2026-09-08'),
      operacion('PAGO', 'Ocio', 80, '2026-09-09'),
      operacion('PAGO', 'Servicios', 120, '2026-09-10'),
      operacion('PAGO', 'Alimentación', 90, '2026-09-10'),
    ];

    const resultado = construirAnalisisMensual(operaciones, opciones);

    expect(resultado.modo).toBe('completo');
    expect(resultado.titulo).toContain('septiembre');
    expect(resultado.texto).toContain('RESUMEN DEL MES');
    expect(resultado.texto).toContain('DE DÓNDE VINO LA PLATA');
    expect(resultado.texto).toContain('EN QUÉ SE FUE');
    // Ingresos: 1000+500+1000+300 = 2800. Egresos: 300+200+100+50+80+120+90 = 940.
    expect(resultado.texto).toContain('2.800');
    expect(resultado.texto).toContain('940');
  });

  it('pasa a modo motivacional con pocas operaciones', () => {
    const operaciones: OperacionDelMes[] = [
      operacion('COBRO', 'Particular', 100, '2026-09-01'),
      operacion('PAGO', 'Alimentación', 50, '2026-09-02'),
    ];

    const resultado = construirAnalisisMensual(operaciones, opciones);

    expect(resultado.modo).toBe('motivacional');
    expect(resultado.texto).toContain('pocos movimientos');
    expect(resultado.texto).not.toContain('RESUMEN DEL MES');
  });

  it('pasa a modo motivacional sin ninguna operación', () => {
    const resultado = construirAnalisisMensual([], opciones);
    expect(resultado.modo).toBe('motivacional');
  });

  it('pasa a modo motivacional con muchas operaciones concentradas en pocos días', () => {
    // 12 operaciones pero solo 3 días distintos -> igual motivacional,
    // porque el umbral de días también tiene que cumplirse.
    const operaciones: OperacionDelMes[] = Array.from({ length: 12 }, (_, i) =>
      operacion('COBRO', 'Particular', 10, `2026-09-0${(i % 3) + 1}`)
    );

    const resultado = construirAnalisisMensual(operaciones, opciones);
    expect(resultado.modo).toBe('motivacional');
  });

  it('distingue resultado operativo de resultado final cuando hay aportes', () => {
    const operaciones: OperacionDelMes[] = [
      operacion('COBRO', 'Alquiler', 400, '2026-09-01'),
      operacion('PAGO', 'Vivienda', 800, '2026-09-02'),
      operacion('PAGO', 'Alimentación', 300, '2026-09-03'),
      operacion('PAGO', 'Transporte', 200, '2026-09-04'),
      operacion('PAGO', 'Salud', 100, '2026-09-05'),
      operacion('INVERSION', 'Aportes y Ayudas Recibidas', 2000, '2026-09-06'),
      operacion('COBRO', 'Uber', 300, '2026-09-07'),
      operacion('PAGO', 'Ocio', 50, '2026-09-08'),
      operacion('PAGO', 'Servicios', 80, '2026-09-09'),
      operacion('COBRO', 'Otro', 100, '2026-09-10'),
    ];

    const resultado = construirAnalisisMensual(operaciones, opciones);

    expect(resultado.modo).toBe('completo');
    // Ingresos 800, egresos 1530 -> operativo -730 (rojo)
    expect(resultado.texto).toContain('Aportes recibidos');
    expect(resultado.texto).toContain('Resultado final del mes');
    expect(resultado.texto).toContain('Sin los aportes recibidos');
  });
});
