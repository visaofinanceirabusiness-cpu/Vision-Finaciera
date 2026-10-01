// Contextos, tipos y helpers compartidos entre las 4 pestañas de
// Contabilidad (Central de Lançamentos, Registro de Operaciones,
// Libro Diario, Editar Registros) — movidos de contabilidad/page.tsx
// (Fase 2 de mantenimiento), sin cambiar comportamiento.

import { createContext } from 'react';
import { supabase } from '@/lib/supabase';
import type { LineaOperacion } from '@/lib/motor';

// Igual que en Informes: contexto para no tener que pasar el símbolo
// de moneda como prop por cada pestaña y sub-componente.
export const SimboloContext = createContext('R$');

// Si la empresa es de perfil Familiar, "Cliente"/"Proveedor" no es
// vocabulario natural (nadie dice "mi proveedor" por el supermercado)
// — se usan las mismas etiquetas amigables que en Recursos Humanos.
export const EsFamiliarContext = createContext(false);

export const IdiomaContext = createContext<string | null>(null);

// Colores personalizables por empresa (CONFIGURAÇÕES → Apariencia):
// var(--x, <default>) resuelve a la variable si TemaGlobal la seteó,
// y si no, usa el mismo valor de siempre — ver lib/apariencia.ts.
export const COLORES = {
  azul: 'var(--color-primario, #1f3a5f)',
  verde: 'var(--color-secundario, #2e8b57)',
  gris: 'var(--color-acento, #6e7781)',
  blanco: '#ffffff',
};

// Venta y Pérdida no guardan el precio/monto original por línea
// (solo el costo promedio, para el CMV) — reconstruirlo al editar
// sería adivinar. Para esas dos es más seguro eliminar y cargar de
// nuevo a mano que "editar" con un valor estimado. Comparten esta
// lista Registro de Operaciones (admin) y Editar Registros (cliente).
export const OPERACIONES_EDITABLES = ['COMPRA', 'PAGO', 'INVERSION', 'EXTRACCION', 'TRANSFERENCIA'];

// Unidad en la que el operador está tipeando la cantidad de una línea
// — puede ser la unidad general del producto (Mercadería) o su
// alternativa de compra (Kilogramo en vez de Gramo, Mililitro en vez
// de Litro, Centímetro en vez de Metro). Solo aplica a compras de
// Insumos; se convierte a la unidad general antes de registrar la
// operación (ver handleRegistrar), nunca se guarda en la base.
export type LineaFormulario = LineaOperacion & { unidadCarga: string };

export type ValoresIniciales = {
  fecha: string;
  operacion: string;
  categoria: string;
  formaPago: string;
  historico: string;
  clienteProveedor: string;
  socio?: string;
  lineas: LineaFormulario[];
};

export type Registro = {
  id: string;
  id_operacion: string;
  fecha: string;
  operacion: string;
  categoria: string;
  forma_pago: string;
  total: number;
  historico: string | null;
  cliente_proveedor: string | null;
  estado: string | null;
};

// Reconstruye los ValoresIniciales de un registro ya cargado para
// poder reabrirlo en modo edición — usado tanto por Registro de
// Operaciones (admin) como por Editar Registros (cliente). Para
// Compra, el monto original por línea se recupera de
// movimientos_stock (ver comentario en OPERACIONES_EDITABLES); para
// el resto se usa el total de la operación en una sola línea.
export async function construirValoresEdicion(empresaId: string, fila: Registro): Promise<ValoresIniciales> {
  const { data: movimientos, error: errorMovimientos } = await supabase
    .from('movimientos_stock')
    .select('producto_id, cantidad, costo_unitario')
    .eq('empresa_id', empresaId)
    .eq('id_operacion', fila.id_operacion);

  if (errorMovimientos) {
    throw errorMovimientos;
  }

  const lineas: LineaFormulario[] =
    movimientos && movimientos.length > 0
      ? movimientos.map((m) => ({
          producto: m.producto_id,
          cantidad: Number(m.cantidad),
          monto: Number(m.costo_unitario),
          unidadCarga: '',
        }))
      : [{ producto: '', cantidad: 1, monto: Number(fila.total), unidadCarga: '' }];

  return {
    fecha: fila.fecha,
    operacion: fila.operacion,
    categoria: fila.categoria,
    formaPago: fila.forma_pago,
    historico: fila.historico ?? '',
    clienteProveedor: fila.cliente_proveedor ?? '',
    lineas,
  };
}
