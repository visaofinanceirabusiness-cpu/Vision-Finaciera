import { describe, expect, it } from 'vitest';
import { coincideBusqueda, coincideGrupoTipo, estiloDeOperacion, normalizarTexto, restarDias, textoBuscable, ultimosTresDias, type FilaBuscable } from './libroDiario';

const fila = (extra: Partial<FilaBuscable> = {}): FilaBuscable => ({
  id_operacion: 'OP-0042',
  fecha: '2026-11-05',
  operacion: 'VENTA',
  historico: 'Venta de remeras',
  cuenta_debito: 'Caja',
  cuenta_credito: 'Ingresos por Ventas',
  importe: 1234.5,
  estado: 'VALIDADO',
  tipo_registro: 'OPERACION',
  categoria: 'Ropa',
  forma_pago: 'Efectivo',
  cliente_proveedor: 'María Pérez',
  ...extra,
});

describe('buscador global', () => {
  it('encuentra por cada campo, incluidos los que la tabla no muestra', () => {
    const f = fila();
    for (const q of ['OP-0042', '2026-11-05', '05/11/2026', 'venta', 'remeras', 'caja', 'ingresos por ventas', '1234', '1234,5', 'ropa', 'efectivo', 'maria perez', 'validado']) expect(coincideBusqueda(f, q, 'ES', false), q).toBe(true);
  });
  it('ignora tildes y mayúsculas y pide todas las palabras', () => {
    expect(coincideBusqueda(fila(), 'MARÍA remeras', 'ES', false)).toBe(true);
    expect(coincideBusqueda(fila(), 'maria zapatos', 'ES', false)).toBe(false);
  });
  it('los asientos automáticos se encuentran por «automático» y una consulta vacía deja todo', () => {
    expect(coincideBusqueda(fila({ tipo_registro: 'AUTOMATICO', operacion: 'CMV' }), 'automatico', 'ES', false)).toBe(true);
    expect(coincideBusqueda(fila(), '   ', 'ES', false)).toBe(true);
  });
  it('normaliza y arma el texto sin campos vacíos', () => {
    expect(normalizarTexto('Acción')).toBe('accion');
    expect(textoBuscable(fila({ historico: null, categoria: null }), 'ES', false)).not.toContain('null');
  });
});

describe('tipos y estilos', () => {
  it('agrupa las operaciones como el resto de los indicadores', () => {
    expect(coincideGrupoTipo('VENTA', 'INGRESOS')).toBe(true);
    expect(coincideGrupoTipo('PAGO', 'EGRESOS')).toBe(true);
    expect(coincideGrupoTipo('TRANSFERENCIA', 'TRANSFERENCIAS')).toBe(true);
    expect(coincideGrupoTipo('VENTA', 'EGRESOS')).toBe(false);
    expect(coincideGrupoTipo('INVERSION', 'TODOS')).toBe(true);
    expect(estiloDeOperacion('COMPRA').flecha).toBe('↓');
    expect(estiloDeOperacion('LO_QUE_SEA').flecha).toBe('•');
  });
});

describe('últimos 3 días', () => {
  it('arma hoy, ayer y hace 2 días con hasta tres movimientos de operaciones manuales', () => {
    const filas = [
      fila({ id_operacion: 'OP-1', fecha: '2026-11-05', importe: 10 }),
      fila({ id_operacion: 'OP-2', fecha: '2026-11-05', importe: 20 }),
      fila({ id_operacion: 'OP-3', fecha: '2026-11-05', importe: 30 }),
      fila({ id_operacion: 'OP-4', fecha: '2026-11-05', importe: 40 }),
      fila({ id_operacion: 'OP-5', fecha: '2026-11-05', tipo_registro: 'AUTOMATICO', operacion: 'CMV' }),
      fila({ id_operacion: 'OP-6', fecha: '2026-11-04' }),
      fila({ id_operacion: 'OP-7', fecha: '2026-11-01' }),
    ];
    const [hoy, ayer, hace2] = ultimosTresDias(filas, '2026-11-05');
    expect(hoy).toMatchObject({ etiqueta: 'HOY', fecha: '2026-11-05', operaciones: 4, restantes: 1 });
    expect(hoy.movimientos.map((m) => m.id_operacion)).toEqual(['OP-4', 'OP-3', 'OP-2']);
    expect(ayer).toMatchObject({ etiqueta: 'AYER', fecha: '2026-11-04', operaciones: 1, restantes: 0 });
    expect(hace2).toMatchObject({ etiqueta: 'HACE_2', fecha: '2026-11-03', operaciones: 0, movimientos: [] });
  });
  it('resta días cruzando el mes', () => {
    expect(restarDias('2026-03-01', 1)).toBe('2026-02-28');
  });
});
