// lib/tutorialSimulacion.ts
//
// Datos de ejemplo para que el Desarrollador pruebe el onboarding (wizard +
// tutorial guiado) sin tocar la base: el Mini-Juego, en modo simulación, lee
// de acá en vez de consultar categorías/medios/contactos y no registra nada.

import type { CategoriaJuego, ProductoJuego } from './miniJuego';

export type PerfilSimulado = 'SERVICIOS' | 'COMERCIAL' | 'MIXTO' | 'FAMILIAR';

export const PERFILES_SIMULADOS: Array<{ id: PerfilSimulado; nombre: string }> = [
  { id: 'SERVICIOS', nombre: 'Servicios' },
  { id: 'COMERCIAL', nombre: 'Comercial' },
  { id: 'MIXTO', nombre: 'Mixto (con mercadería)' },
  { id: 'FAMILIAR', nombre: 'Familia' },
];

export type DatosSimulados = {
  categorias: Record<string, CategoriaJuego[]>;
  formasPago: Record<string, string[]>;
  productos: ProductoJuego[];
  contactos: { clientes: string[]; proveedores: string[] };
};

export function esPerfilSimulado(valor: string | null | undefined): valor is PerfilSimulado {
  return PERFILES_SIMULADOS.some((p) => p.id === valor);
}

export function configuracionPerfil(perfil: PerfilSimulado): { esFamiliar: boolean; manejaMercaderia: boolean } {
  return { esFamiliar: perfil === 'FAMILIAR', manejaMercaderia: perfil === 'COMERCIAL' || perfil === 'MIXTO' };
}

export function datosSimulados(perfil: PerfilSimulado, idioma: string): DatosSimulados {
  const pt = idioma === 'PT';
  const { manejaMercaderia } = configuracionPerfil(perfil);
  const mercaderia = pt ? 'Mercadoria' : 'Mercadería';

  return {
    categorias: {
      INVERSION: [{ nombre: pt ? 'Aporte de capital' : 'Aporte de capital', stock: null }],
      COBRO: [
        { nombre: pt ? 'Salário' : 'Sueldo', stock: null },
        { nombre: pt ? 'Honorários' : 'Honorarios', stock: null },
      ],
      VENTA: [{ nombre: manejaMercaderia ? mercaderia : pt ? 'Serviços' : 'Servicios', stock: manejaMercaderia ? 'SI' : null }],
      COMPRA: [{ nombre: mercaderia, stock: 'SI' }],
      PAGO: [
        { nombre: pt ? 'Aluguel' : 'Alquiler', stock: null },
        { nombre: pt ? 'Alimentação' : 'Alimentación', stock: null },
        { nombre: pt ? 'Serviços' : 'Servicios', stock: null },
      ],
      TRANSFERENCIA: [
        { nombre: pt ? 'Poupança' : 'Ahorro', stock: null },
        { nombre: pt ? 'Meta' : 'Objetivo', stock: null },
      ],
    },
    formasPago: {
      default: [pt ? 'Dinheiro' : 'Efectivo', 'Banco'],
    },
    productos: [{ id: 'sim-1', nombre: pt ? 'Produto de exemplo' : 'Producto de ejemplo', categoria: mercaderia, unidad_medida: 'un' }],
    contactos: {
      clientes: pt ? ['Cliente de exemplo A', 'Cliente de exemplo B'] : ['Cliente de ejemplo A', 'Cliente de ejemplo B'],
      proveedores: pt ? ['Fornecedor de exemplo A', 'Fornecedor de exemplo B'] : ['Proveedor de ejemplo A', 'Proveedor de ejemplo B'],
    },
  };
}
