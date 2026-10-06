import { describe, it, expect } from 'vitest';
import { armarTop, combinarConFavoritas, claveTarjeta, mediana, montoSospechoso, parsearMonto, validarMonto, type OperacionReciente } from './lanzamientoRapido';

function fila(p: Partial<OperacionReciente>): OperacionReciente {
  return {
    id_operacion: 'OP-1',
    fecha: '2026-10-01',
    operacion: 'PAGO',
    categoria: 'Combustible',
    forma_pago: 'Banco',
    total: 10,
    historico: 'Nafta',
    cliente_proveedor: 'Posto',
    ...p,
  };
}

describe('armarTop', () => {
  it('agrupa por operación+categoría+medio y toma el último valor', () => {
    const top = armarTop([
      fila({ id_operacion: 'OP-1', fecha: '2026-09-01', total: 10 }),
      fila({ id_operacion: 'OP-2', fecha: '2026-10-01', total: 15 }),
      fila({ id_operacion: 'OP-3', forma_pago: 'Efectivo', total: 5 }),
    ]);
    expect(top).toHaveLength(2);
    expect(top[0].usos).toBe(2);
    expect(top[0].ultimoValor).toBe(15);
    expect(top[0].ultimoProveedor).toBe('Posto');
  });

  it('excluye compras/ventas y asientos de devengo', () => {
    const top = armarTop([
      fila({ operacion: 'COMPRA' }),
      fila({ operacion: 'VENTA' }),
      fila({ historico: '— devengado octubre' }),
    ]);
    expect(top).toHaveLength(0);
  });

  it('respeta el límite', () => {
    const filas = Array.from({ length: 15 }, (_, i) => fila({ id_operacion: `OP-${i}`, categoria: `C${i}` }));
    expect(armarTop(filas, 10)).toHaveLength(10);
  });
});

describe('seguridad del monto', () => {
  it('mediana', () => {
    expect(mediana([1, 3, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });
  it('rechaza vacío, cero y negativos', () => {
    expect(validarMonto(parsearMonto(''))).not.toBeNull();
    expect(validarMonto(0)).not.toBeNull();
    expect(validarMonto(-5)).not.toBeNull();
    expect(validarMonto(12.5)).toBeNull();
  });
  it('parsea formato local', () => {
    expect(parsearMonto('1.234,50')).toBe(1234.5);
    expect(parsearMonto('15')).toBe(15);
  });
  it('alerta solo con 3+ usos y más de 10× la mediana', () => {
    expect(montoSospechoso(200, { usos: 5, mediana: 15 })).toBe(true);
    expect(montoSospechoso(100, { usos: 5, mediana: 15 })).toBe(false);
    expect(montoSospechoso(2000, { usos: 2, mediana: 15 })).toBe(false);
  });
});

describe('combinarConFavoritas', () => {
  const historial = new Map(armarTop([fila({ total: 20 }), fila({ id_operacion: 'OP-2', categoria: 'Otra', total: 5 })]).map((t) => [t.clave, t]));
  const top = [...historial.values()];

  it('pone las favoritas primero y no repite', () => {
    const r = combinarConFavoritas(top, historial, [
      { operacion: 'PAGO', categoria: 'Otra', forma_pago: 'Banco', historico: '', cliente_proveedor: '', valor_sugerido: 0 },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].categoria).toBe('Otra');
    expect(r[0].favorita).toBe(true);
    expect(r[1].favorita).toBeUndefined();
  });

  it('una favorita sin historial usa el valor sugerido', () => {
    const r = combinarConFavoritas([], new Map(), [
      { operacion: 'COBRO', categoria: 'X', forma_pago: 'Efectivo', historico: 'h', cliente_proveedor: 'p', valor_sugerido: '50' },
    ]);
    expect(r[0]).toMatchObject({ usos: 0, ultimoValor: 50, ultimoHistorico: 'h', clave: claveTarjeta('COBRO', 'X', 'Efectivo') });
  });
});
