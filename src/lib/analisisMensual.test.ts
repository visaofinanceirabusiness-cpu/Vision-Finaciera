// Tests de construirAnalisisMensual — función pura, sin Supabase.

import { describe, expect, it } from 'vitest';
import { construirAnalisisMensual, type OperacionDelMes } from './analisisMensual';

const opciones = { idioma: 'ES', moneda: 'BRL', mesNombre: 'septiembre' };

// Por defecto infiere el tipo del nombre de la operación (como en
// casi todos los tests, donde no importa) — el test del bug de
// Activo/Pasivo pasa su propio `tipo` explícito para el caso que sí
// importa.
function operacion(operacion: string, categoria: string, total: number, fecha: string, tipo?: string): OperacionDelMes {
  const tipoPorDefecto = operacion === 'COBRO' || operacion === 'VENTA' ? 'INGRESO' : operacion === 'PAGO' || operacion === 'COMPRA' ? 'GASTO' : '';
  return { operacion, categoria, total, fecha, tipo: tipo ?? tipoPorDefecto };
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

  it('no cuenta como resultado un COBRO/PAGO que liquida una Cuenta a Cobrar/Pagar o compra un bien (bug real de Buenaventura, ver memory.md)', () => {
    const operaciones: OperacionDelMes[] = [
      operacion('COBRO', 'Alquiler', 2430, '2026-09-01'),
      operacion('COBRO', 'Uber', 1127.18, '2026-09-02'),
      operacion('COBRO', 'Brenda', 365, '2026-09-03'),
      operacion('COBRO', 'Intereses Bancarios', 154, '2026-09-04'),
      operacion('COBRO', 'Honorarios', 100, '2026-09-05'),
      // Esta liquida una Cuenta a Cobrar ya facturada — tipo ACTIVO,
      // no es ingreso nuevo del mes.
      operacion('COBRO', 'Cuentas a cobrar', 110, '2026-09-06', 'ACTIVO'),
      operacion('PAGO', 'Vivienda', 1800, '2026-09-07'),
      operacion('PAGO', 'Alimentación', 1060.06, '2026-09-08'),
      operacion('PAGO', 'Educación', 806, '2026-09-09'),
      operacion('PAGO', 'Transporte', 790, '2026-09-10'),
      operacion('PAGO', 'Ocio', 345.5, '2026-09-11'),
      operacion('PAGO', 'Salud', 40, '2026-09-12'),
      operacion('PAGO', 'Servicios', 30, '2026-09-13'),
      operacion('PAGO', 'Consumos', 52, '2026-09-14'),
      // Estas pagan deuda (Pasivo) o compran un bien (Activo) — no son
      // gasto del mes aunque la operación sea PAGO/COMPRA.
      operacion('PAGO', 'Préstamos Santander', 359, '2026-09-15', 'PASIVO'),
      operacion('PAGO', 'T. de Crédito a Pagar Nu', 300, '2026-09-16', 'PASIVO'),
      operacion('COMPRA', 'Muebles y Útiles', 587, '2026-09-17', 'ACTIVO'),
      operacion('INVERSION', 'Aportes y Ayudas Recibidas', 7000, '2026-09-18'),
    ];

    const resultado = construirAnalisisMensual(operaciones, opciones);

    // Ingresos reales: 2430+1127.18+365+154+100 = 4176.18 (sin los 110 de la Cuenta a Cobrar).
    // Egresos reales: 1800+1060.06+806+790+345.5+40+30+52 = 4923.56 (sin los 359+300 de deuda ni los 587 del mueble).
    // Operativo: 4176.18 - 4923.56 = -747.38 (no los -1883.38 que daría contando todo por nombre de operación).
    expect(resultado.texto).toContain('4.176');
    expect(resultado.texto).toContain('4.924');
    expect(resultado.texto).not.toContain('1.883');
    expect(resultado.texto).not.toContain('6.170');
  });
});
