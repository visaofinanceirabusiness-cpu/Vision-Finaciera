import { describe, expect, it } from 'vitest';
import { agruparProductos, MAX_LINEAS_JUEGO, puedeAgregarLinea, reemplazarLinea, sumarLinea, totalLineas, type LineaJuego } from './lineasProducto';

const p = (id: string, nombre: string, tipo: string | null = 'TERMINADO') => ({ id, nombre, unidad_medida: 'un', tipo_producto: tipo });
const l = (productoId: string, cantidad: number, monto: number): LineaJuego => ({ productoId, nombre: productoId, unidad: 'un', cantidad, monto });

describe('agruparProductos', () => {
  const productos = [p('a', 'Alfa'), p('b', 'Beta'), p('c', 'Cola', 'INSUMO'), p('d', 'Dulce', 'INSUMO')];
  const saldos = { a: 5, b: 0, c: 3 };

  it('en venta separa con saldo / sin saldo y deja los insumos plegados', () => {
    const [terminados, insumos] = agruparProductos(productos, saldos, { operacion: 'VENTA' });
    expect(terminados.conSaldo.map((x) => x.id)).toEqual(['a']);
    expect(terminados.sinSaldo.map((x) => x.id)).toEqual(['b']);
    expect(insumos.conSaldo.map((x) => x.id)).toEqual(['c']);
    expect(insumos.sinSaldo.map((x) => x.id)).toEqual(['d']);
    expect(terminados.abiertoPorDefecto).toBe(true);
    expect(insumos.abiertoPorDefecto).toBe(false);
  });

  it('en compra todo queda visible', () => {
    const [terminados, insumos] = agruparProductos(productos, saldos, { operacion: 'COMPRA' });
    expect(terminados.conSaldo).toHaveLength(2);
    expect(terminados.sinSaldo).toHaveLength(0);
    expect(insumos.abiertoPorDefecto).toBe(true);
  });

  it('sin terminados, los insumos se muestran abiertos', () => {
    const [insumos] = agruparProductos([p('c', 'Cola', 'INSUMO')], {}, { operacion: 'VENTA' });
    expect(insumos.clave).toBe('INSUMOS');
    expect(insumos.abiertoPorDefecto).toBe(true);
  });
});

describe('líneas del juego', () => {
  it('suma un producto repetido', () => {
    expect(sumarLinea([l('a', 1, 10)], l('a', 2, 30))).toEqual([l('a', 3, 40)]);
  });

  it('reemplaza una línea y fusiona si queda repetida', () => {
    expect(reemplazarLinea([l('a', 1, 10), l('b', 1, 5)], 0, l('a', 4, 40))).toEqual([l('a', 4, 40), l('b', 1, 5)]);
    expect(reemplazarLinea([l('a', 1, 10), l('b', 1, 5)], 1, l('a', 2, 20))).toEqual([l('a', 3, 30)]);
  });

  it('totaliza y respeta el máximo', () => {
    expect(totalLineas([l('a', 1, 10.1), l('b', 1, 5.2)])).toBe(15.3);
    expect(puedeAgregarLinea(Array.from({ length: MAX_LINEAS_JUEGO }, (_, i) => l(String(i), 1, 1)))).toBe(false);
  });
});
