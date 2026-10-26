import { describe, expect, it } from 'vitest';
import {
  agregarAlCarrito,
  agruparCatalogo,
  agruparItemsPorCategoria,
  cambiarCantidad,
  enlaceBannerValido,
  formatearReales,
  generarSlug,
  precioConMargen,
  puedeRegistrarVenta,
  puedeTransicionar,
  quitarDelCarrito,
  totalCarrito,
  urlWhatsapp,
  validarPedido,
  validarSlug,
  whatsappValido,
} from './miLocal';

describe('slug', () => {
  it('normaliza acentos y símbolos', () => {
    expect(generarSlug('  Encanto Doces & Café!  ')).toBe('encanto-doces-cafe');
  });
  it('valida formato y reservados', () => {
    expect(validarSlug('encanto')).toBeNull();
    expect(validarSlug('ab')).toBe('min3');
    expect(validarSlug('Encanto')).toBe('formato');
    expect(validarSlug('a--b')).toBe('formato');
    expect(validarSlug('admin')).toBe('reservado');
  });
});

describe('formato R$', () => {
  it('usa coma decimal', () => {
    expect(formatearReales(49.9).replace(/\s/g, ' ')).toBe('R$ 49,90');
    expect(formatearReales(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
  });
});

describe('carrito', () => {
  const a = { id: 'a', titulo: 'Torta', precio: 49.9 };
  it('suma cantidades del mismo producto y calcula el total sin error de coma flotante', () => {
    let c = agregarAlCarrito([], a, 2);
    c = agregarAlCarrito(c, a, 1);
    expect(c).toHaveLength(1);
    expect(c[0].cantidad).toBe(3);
    expect(totalCarrito(c)).toBe(149.7);
    expect(totalCarrito(agregarAlCarrito([], { id: 'b', titulo: 'x', precio: 0.1 }, 3))).toBe(0.3);
  });
  it('cambiar a 0 quita; tope por ítem', () => {
    const c = agregarAlCarrito([], a, 1);
    expect(cambiarCantidad(c, 'a', 0)).toEqual([]);
    expect(cambiarCantidad(c, 'a', 500)[0].cantidad).toBe(99);
    expect(quitarDelCarrito(c, 'a')).toEqual([]);
  });
  it('valida el pedido', () => {
    const c = agregarAlCarrito([], a, 1);
    expect(validarPedido('Ana', '(11) 91234-5678', [])).toBe('carrito_vacio');
    expect(validarPedido('A', '11912345678', c)).toBe('nombre');
    expect(validarPedido('Ana', '123', c)).toBe('whatsapp');
    expect(validarPedido('Ana', '11912345678', c)).toBeNull();
  });
});

describe('whatsapp', () => {
  it('valida y arma el link', () => {
    expect(whatsappValido('(11) 91234-5678')).toBe(true);
    expect(whatsappValido('12345')).toBe(false);
    expect(urlWhatsapp('(11) 91234-5678')).toBe('https://wa.me/5511912345678');
    expect(urlWhatsapp('5511912345678', 'Olá')).toBe('https://wa.me/5511912345678?text=Ol%C3%A1');
  });
});

describe('estados del pedido', () => {
  it('solo transiciones válidas', () => {
    expect(puedeTransicionar('pending', 'confirmed')).toBe(true);
    expect(puedeTransicionar('pending', 'delivered')).toBe(false);
    expect(puedeTransicionar('confirmed', 'ready')).toBe(true);
    expect(puedeTransicionar('delivered', 'cancelled')).toBe(false);
    expect(puedeTransicionar('cancelled', 'confirmed')).toBe(false);
  });
  it('un pedido pendiente o cancelado nunca se contabiliza como venta', () => {
    expect(puedeRegistrarVenta('pending', 'NO')).toBe(false);
    expect(puedeRegistrarVenta('cancelled', 'NO')).toBe(false);
    expect(puedeRegistrarVenta('confirmed', 'NO')).toBe(true);
    expect(puedeRegistrarVenta('delivered', 'REGISTRADA')).toBe(false);
  });
});

describe('venta por categoría', () => {
  it('agrupa y ordena de forma determinista', () => {
    const g = agruparItemsPorCategoria([
      { producto_id: '1', categoria: 'Tortas', cantidad: 1, precio_unitario: 10, nombre: 'a' },
      { producto_id: '2', categoria: 'Bebidas', cantidad: 1, precio_unitario: 5, nombre: 'b' },
      { producto_id: '3', categoria: 'Tortas', cantidad: 2, precio_unitario: 8, nombre: 'c' },
    ]);
    expect(g.map((x) => x.categoria)).toEqual(['Bebidas', 'Tortas']);
    expect(g[1].items).toHaveLength(2);
  });
});

describe('precio con margen', () => {
  it('aplica el margen y redondea a centavos', () => {
    expect(precioConMargen(10, 100)).toBe(20);
    expect(precioConMargen(12.34, 100)).toBe(24.68);
    expect(precioConMargen(3.333, 50)).toBe(5);
    expect(precioConMargen(10, 0)).toBe(10);
  });
  it('sin costo o con margen inválido no sugiere', () => {
    expect(precioConMargen(0, 100)).toBeNull();
    expect(precioConMargen(10, -5)).toBeNull();
    expect(precioConMargen(10, NaN)).toBeNull();
  });
});

describe('catálogo por categoría', () => {
  it('ordena categorías y, dentro, con saldo (mayor a menor) y luego sin saldo', () => {
    const prods = [
      { id: '1', nombre: 'B', categoria: 'Perfumes' },
      { id: '2', nombre: 'A', categoria: 'Perfumes' },
      { id: '3', nombre: 'C', categoria: 'Perfumes' },
      { id: '4', nombre: 'D', categoria: 'Perfumes' },
      { id: '5', nombre: 'Z', categoria: null },
      { id: '6', nombre: 'Y', categoria: 'Labiales' },
    ];
    const g = agruparCatalogo(prods, new Map([['1', 5], ['3', 20], ['4', 0]]));
    expect(g.map((x) => x.categoria)).toEqual(['Labiales', 'Perfumes', '']);
    expect(g[1].lista.map((p) => p.id)).toEqual(['3', '1', '2', '4']);
  });
});

describe('enlace de banner', () => {
  it('solo acepta http/https', () => {
    expect(enlaceBannerValido('https://wa.me/5511912345678')).toBe(true);
    expect(enlaceBannerValido('javascript:alert(1)')).toBe(false);
    expect(enlaceBannerValido('data:text/html,x')).toBe(false);
    expect(enlaceBannerValido('https://a b')).toBe(false);
  });
});
