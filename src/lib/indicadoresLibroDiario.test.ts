import { describe, expect, it } from 'vitest';
import { aplicarFiltroIndicador, calcularIndicadores, filtrarPorRango, rangoAnterior, rangoDelPeriodo, type FilaLibro } from './indicadoresLibroDiario';

const f = (p: Partial<FilaLibro>): FilaLibro => ({
  id_operacion: 'OP-1',
  fecha: '2026-10-05',
  operacion: 'VENTA',
  cuenta_debito: 'Caja',
  cuenta_credito: 'Ventas',
  importe: 100,
  estado: 'VALIDADO',
  tipo_registro: 'OPERACION',
  cliente_proveedor: 'Ana',
  ...p,
});

describe('períodos', () => {
  it('arma el mes actual, el anterior y el previo al rango', () => {
    expect(rangoDelPeriodo('MES', '2026-10-21')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoDelPeriodo('MES_ANTERIOR', '2026-01-10')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
    expect(rangoAnterior({ desde: '2026-03-01', hasta: '2026-03-31' })).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoDelPeriodo('TODO', '2026-10-21')).toBeNull();
  });

  it('filtra por rango inclusive', () => {
    const rango = { desde: '2026-10-01', hasta: '2026-10-31' };
    expect(filtrarPorRango([f({ fecha: '2026-09-30' }), f({ fecha: '2026-10-31' }), f({ fecha: '2026-11-01' })], rango)).toHaveLength(1);
  });
});

describe('indicadores', () => {
  const rango = { desde: '2026-10-01', hasta: '2026-10-31' };
  const filas = [
    f({ id_operacion: 'OP-1', fecha: '2026-10-05', importe: 100 }),
    f({ id_operacion: 'OP-2', fecha: '2026-10-05', operacion: 'COMPRA', cuenta_debito: 'Mercadería', cuenta_credito: 'Caja', importe: 40, cliente_proveedor: 'Prov', estado: 'PENDIENTE' }),
    f({ id_operacion: 'OP-3', fecha: '2026-10-12', importe: 60, cliente_proveedor: 'Ana' }),
    f({ id_operacion: 'OP-3', fecha: '2026-10-12', operacion: 'CMV', cuenta_debito: 'CMV', cuenta_credito: 'Mercadería', importe: 20, tipo_registro: 'AUTOMATICO', cliente_proveedor: null }),
  ];
  const r = calcularIndicadores(filas, [f({ importe: 100, fecha: '2026-09-02' })], rango, '2026-10-20');

  it('movimiento y variación', () => {
    expect(r.movimiento).toMatchObject({ asientos: 4, operaciones: 3, volumen: 220, variacionVolumen: 120, incompletos: 0 });
  });

  it('ritmo de actividad hasta hoy', () => {
    expect(r.ritmo).toMatchObject({ diasConMovimiento: 2, diasDelPeriodo: 20, promedioOperacionesPorDiaActivo: 1.5, ultimoRegistro: '2026-10-12' });
    expect(r.ritmo.diaMasActivo).toEqual({ fecha: '2026-10-05', operaciones: 2 });
  });

  it('mix, cuentas y contrapartes', () => {
    expect(r.mix[0]).toMatchObject({ clave: 'VENTA', cantidad: 2, importe: 160 });
    expect(r.cuentas[0]).toMatchObject({ cuenta: 'Caja' });
    expect(r.contrapartes.clientes).toEqual([{ nombre: 'Ana', importe: 160 }]);
    expect(r.contrapartes.proveedores).toEqual([{ nombre: 'Prov', importe: 40 }]);
  });

  it('calidad del registro', () => {
    expect(r.calidad).toEqual({ validados: 3, pendientes: 1, porcentajeValidado: 75, manuales: 3, automaticos: 1 });
  });

  it('sin período anterior no hay variación y detecta asientos incompletos', () => {
    const solo = calcularIndicadores([f({ cuenta_credito: null })], null, null, '2026-10-20');
    expect(solo.movimiento.variacionVolumen).toBeNull();
    expect(solo.movimiento.incompletos).toBe(1);
  });
});

describe('filtros de indicadores', () => {
  const filas = [f({}), f({ id_operacion: 'OP-2', operacion: 'COMPRA', estado: 'PENDIENTE', cliente_proveedor: 'Prov' })];
  it('filtra por operación, estado y contraparte', () => {
    expect(aplicarFiltroIndicador(filas, { tipo: 'operacion', valor: 'COMPRA' })).toHaveLength(1);
    expect(aplicarFiltroIndicador(filas, { tipo: 'estado', valor: 'PENDIENTE' })).toHaveLength(1);
    expect(aplicarFiltroIndicador(filas, { tipo: 'contraparte', valor: 'Ana' })).toHaveLength(1);
    expect(aplicarFiltroIndicador(filas, null)).toHaveLength(2);
  });
});
