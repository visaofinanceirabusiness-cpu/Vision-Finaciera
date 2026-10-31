import { describe, expect, it } from 'vitest';
import { estadoDeServicio, lineasDeVenta, perfilVendeServicios, precioServicioValido } from './miLocalServicios';
import { herramientaDisponible, type ContextoMenu } from './herramientasMenu';

const base: ContextoMenu = { empresaId: 'x', perfilCodigo: null, tipoUsuario: 'ADMIN', manejaMercaderia: false, tieneProduccion: false, aperturaVisao3D: null };

describe('Mi Local para Servicios', () => {
  it('qué perfiles venden servicios', () => {
    expect(perfilVendeServicios('SERVICIOS')).toBe(true);
    expect(perfilVendeServicios('MIXTO', ['COMERCIAL', 'SERVICIOS'])).toBe(true);
    expect(perfilVendeServicios('MIXTO', ['COMERCIAL'])).toBe(false);
    expect(perfilVendeServicios('COMERCIAL')).toBe(false);
    expect(perfilVendeServicios('FAMILIAR')).toBe(false);
    expect(perfilVendeServicios(null)).toBe(false);
  });

  it('Mi Local aparece en el menú de quien vende servicios aunque no maneje mercadería; el asistente no lo ve', () => {
    expect(herramientaDisponible('/mi-local', { ...base, manejaMercaderia: false })).toBe(false);
    expect(herramientaDisponible('/mi-local', { ...base, vendeServicios: true })).toBe(true);
    expect(herramientaDisponible('/mi-local', { ...base, manejaMercaderia: true })).toBe(true);
    expect(herramientaDisponible('/mi-local', { ...base, vendeServicios: true, tipoUsuario: 'ASISTENTE' })).toBe(false);
  });

  it('un servicio solo se publica con precio mayor que cero', () => {
    expect(precioServicioValido(350)).toBe(true);
    expect(precioServicioValido(0)).toBe(false);
    expect(precioServicioValido(-1)).toBe(false);
    expect(precioServicioValido(Number.NaN)).toBe(false);
    expect(estadoDeServicio(null)).toBe('SIN_PRECIO');
    expect(estadoDeServicio({ precio: 0, publicado: false })).toBe('SIN_PRECIO');
    expect(estadoDeServicio({ precio: 120, publicado: false })).toBe('BORRADOR');
    expect(estadoDeServicio({ precio: 120, publicado: true })).toBe('PUBLICADO');
  });

  it('líneas de venta: el servicio va sin producto; el producto lleva su id', () => {
    const servicio = [{ producto_id: null, categoria: 'Clases', cantidad: 2, precio_unitario: 350, nombre: 'Clase' }];
    expect(lineasDeVenta(servicio, true)).toEqual([{ producto: '', cantidad: 2, monto: 350 }]);

    const producto = [{ producto_id: 'p1', categoria: 'Ropa', cantidad: 1, precio_unitario: 99.9, nombre: 'Remera' }];
    expect(lineasDeVenta(producto, false)).toEqual([{ producto: 'p1', cantidad: 1, monto: 99.9 }]);
  });

  it('seguridad: no se mezclan productos en una categoría de servicio, y un producto borrado sigue frenando la venta', () => {
    expect(() => lineasDeVenta(producto1(), true)).toThrow('ML_CATEGORIA_MEZCLADA');
    expect(() => lineasDeVenta([{ producto_id: null, categoria: 'Ropa', cantidad: 1, precio_unitario: 10, nombre: 'X' }], false)).toThrow('ya no existe en Mercadería');
  });
});

function producto1() {
  return [{ producto_id: 'p1', categoria: 'Clases', cantidad: 1, precio_unitario: 10, nombre: 'X' }];
}
