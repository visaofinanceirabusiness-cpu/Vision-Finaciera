import { describe, expect, it } from 'vitest';
import { agruparVentas, enlaceChat } from './whatsappVentas';

const fila = (id: string, extra: Record<string, unknown> = {}) => ({ id_operacion: id, fecha: '2026-11-10', operacion: 'VENTA', cliente_proveedor: 'Ana', historico: 'Remera', forma_pago: 'Caja', total: 100, parte: 1, ...extra });

describe('agruparVentas', () => {
  it('une las partes de un pago dividido en una sola venta', () => {
    const r = agruparVentas([fila('OP-2', { forma_pago: 'Banco', total: 60, parte: 2 }), fila('OP-2', { total: 40 })], new Map([['Ana', '+54 9 11 5555-5555']]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ total: 100, formaPago: 'Caja + Banco', telefono: '+54 9 11 5555-5555' });
  });
  it('ordena de la más nueva a la más vieja y deja sin teléfono al cliente que no lo tiene', () => {
    const r = agruparVentas([fila('OP-1'), fila('OP-3', { fecha: '2026-11-11', cliente_proveedor: 'Beto' })], new Map());
    expect(r.map((v) => v.idOperacion)).toEqual(['OP-3', 'OP-1']);
    expect(r[0].telefono).toBeNull();
  });
});

describe('enlaceChat', () => {
  it('deja solo dígitos', () => expect(enlaceChat('+54 9 11 2233-4455')).toBe('https://wa.me/5491122334455'));
});

describe('mensaje de la venta', () => {
  it('lista cantidad, producto, precio por unidad, precio de la línea, forma de pago y total', async () => {
    const { mensajeDeVenta } = await import('./whatsappVentas');
    const [v] = agruparVentas([fila('OP-9', { lineas_detalle: [{ p: 'x1', c: 3, u: 25 }, { p: 'Envío', c: 1, u: 10 }], forma_pago: 'Banco', total: 85 })], new Map(), new Map([['x1', 'Remera']]));
    const m = mensajeDeVenta(v, 'Mi Tienda', 'ES', '$');
    expect(m).toContain('• 3 × Remera — $ 25.00 c/u = $ 75.00');
    expect(m).toContain('• 1 × Envío — $ 10.00 c/u = $ 10.00');
    expect(m).toContain('Forma de pago: Banco');
    expect(m).toContain('Total: $ 85.00');
  });
});
