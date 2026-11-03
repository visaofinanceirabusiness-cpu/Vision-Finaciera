import { describe, expect, it } from 'vitest';
import { cuentasMasUsadas, etiquetaRuta, formatearDuracion, operacionesPorMes, resumirActividad, usoPorHerramienta, type FilaActividad } from './actividad';

const fila = (fecha: string, ruta: string, segundos: number, extra: Partial<FilaActividad> = {}): FilaActividad => ({ usuario_id: 'u', fecha, ruta, segundos, visitas: 0, sesiones: 0, estimado: false, ...extra });

describe('resumirActividad', () => {
  it('separa lo medido de lo estimado y dice desde cuándo se mide', () => {
    const r = resumirActividad([fila('2026-10-01', 'estimado:operaciones', 600, { estimado: true }), fila('2026-11-03', '/', 120, { sesiones: 1 })], '2026-11-03');
    expect(r.totalSegundos).toBe(720);
    expect(r.medidoSegundos).toBe(120);
    expect(r.estimadoSegundos).toBe(600);
    expect(r.medidoDesde).toBe('2026-11-03');
    expect(r.sesiones).toBe(1);
  });
  it('la racha sigue viva si el último día fue ayer y se corta si pasó más', () => {
    const base = [fila('2026-11-01', '/', 1), fila('2026-11-02', '/', 1)];
    expect(resumirActividad(base, '2026-11-03').rachaActual).toBe(2);
    expect(resumirActividad(base, '2026-11-05').rachaActual).toBe(0);
  });
  it('calcula la mejor racha histórica', () => {
    const f = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-11'].map((d) => fila(d, '/', 1));
    expect(resumirActividad(f, '2026-11-03').mejorRacha).toBe(3);
  });
  it('sin datos no rompe', () => {
    const r = resumirActividad([], '2026-11-03');
    expect(r.totalSegundos).toBe(0);
    expect(r.primeraFecha).toBeNull();
  });
});

describe('usoPorHerramienta', () => {
  it('suma por ruta y ordena de mayor a menor', () => {
    const r = usoPorHerramienta([fila('2026-11-01', '/a', 10), fila('2026-11-02', '/b', 50), fila('2026-11-03', '/a', 60)]);
    expect(r.map((x) => x.ruta)).toEqual(['/a', '/b']);
    expect(r[0].segundos).toBe(70);
  });
});

describe('textos', () => {
  it('etiqueta rutas conocidas, subrutas y desconocidas', () => {
    expect(etiquetaRuta('/mi-local', 'ES').texto).toBe('Mi Local');
    expect(etiquetaRuta('/mi-local/algo', 'PT').texto).toBe('Meu Local');
    expect(etiquetaRuta('/rara', 'ES').texto).toBe('/rara');
  });
  it('formatea duraciones', () => {
    expect(formatearDuracion(20, 'ES')).toBe('< 1 min');
    expect(formatearDuracion(45 * 60, 'ES')).toBe('45 min');
    expect(formatearDuracion(3 * 3600, 'ES')).toBe('3 h');
    expect(formatearDuracion(3600 + 24 * 60, 'ES')).toBe('1 h 24 min');
  });
});

describe('operacionesPorMes', () => {
  it('devuelve siempre los últimos meses, cruzando el año', () => {
    const r = operacionesPorMes(['2026-01-05', '2026-01-05', '2026-01-09', '2025-12-30', '2025-10-01'], '2026-01-20', 3);
    expect(r.map((m) => m.mes)).toEqual(['2025-11', '2025-12', '2026-01']);
    expect(r[2]).toMatchObject({ operaciones: 3, diasConOperaciones: 2 });
    expect(r[0].operaciones).toBe(0);
  });
});

describe('cuentasMasUsadas', () => {
  it('cuenta débito y crédito y ordena', () => {
    const r = cuentasMasUsadas([
      { cuenta_debito: 'Caja', cuenta_credito: 'Ventas' },
      { cuenta_debito: 'Caja', cuenta_credito: null },
      { cuenta_debito: ' ', cuenta_credito: 'Ventas' },
    ]);
    expect(r).toEqual([{ cuenta: 'Caja', movimientos: 2 }, { cuenta: 'Ventas', movimientos: 2 }]);
  });
});
