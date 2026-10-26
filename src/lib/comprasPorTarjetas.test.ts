import { describe, expect, it } from 'vitest';
import { categoriasDeTarjeta, empresaUsaTarjetasDeCompra, grupoDeCategoria } from './comprasPorTarjetas';

const categorias = ['Automóveis', 'Calçados', 'Veículos da Empresa', 'Móveis e Utensílios'];
const stockPorCategoria = { Automóveis: 'SI', Calçados: 'SI', 'Veículos da Empresa': 'NO', 'Móveis e Utensílios': 'NO' };
const productos = [
  { categoria: 'Automóveis', tipo_producto: 'TERMINADO' },
  { categoria: 'Automóveis', tipo_producto: 'INSUMO' },
  { categoria: 'Calçados', tipo_producto: 'TERMINADO' },
];
const base = { categorias, stockPorCategoria, productos, categoriaActual: '' };

describe('compras por tarjetas', () => {
  it('solo la empresa demo lo usa', () => {
    expect(empresaUsaTarjetasDeCompra('c887a052-cbab-47f2-8ec7-a2102af43295')).toBe(true);
    expect(empresaUsaTarjetasDeCompra('otra')).toBe(false);
    expect(empresaUsaTarjetasDeCompra(null)).toBe(false);
  });
  it('bienes de uso: las categorías sin stock', () => {
    expect(categoriasDeTarjeta({ ...base, grupo: 'BIENES', tipo: '' })).toEqual(['Veículos da Empresa', 'Móveis e Utensílios']);
  });
  it('mercadería: solo tras elegir terminados o insumos, y solo categorías que tienen de ese tipo', () => {
    expect(categoriasDeTarjeta({ ...base, grupo: 'MERCADERIA', tipo: '' })).toEqual([]);
    expect(categoriasDeTarjeta({ ...base, grupo: 'MERCADERIA', tipo: 'TERMINADO' })).toEqual(['Automóveis', 'Calçados']);
    expect(categoriasDeTarjeta({ ...base, grupo: 'MERCADERIA', tipo: 'INSUMO' })).toEqual(['Automóveis']);
  });
  it('sin tarjeta elegida no se ofrece nada, salvo al editar una operación con categoría', () => {
    expect(categoriasDeTarjeta({ ...base, grupo: '', tipo: '' })).toEqual([]);
    expect(categoriasDeTarjeta({ ...base, grupo: '', tipo: '', categoriaActual: 'Calçados' })).toEqual(categorias);
  });
  it('deduce la tarjeta de una categoría', () => {
    expect(grupoDeCategoria('SI')).toBe('MERCADERIA');
    expect(grupoDeCategoria('NO')).toBe('BIENES');
  });
});
