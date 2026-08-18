// src/lib/produccion.ts
//
// PRODUCCIÓN — lógica central del módulo de Producción.
//
// Responsabilidades actuales:
// 1. Buscar la receta activa de un producto terminado.
// 2. Calcular los insumos necesarios según la cantidad a producir.
// 3. Validar si existe stock suficiente de cada insumo.
//
// Todavía NO registra producción ni modifica stock.
// Esa parte se agregará después de validar este bloque.
//

import { supabase } from './supabase';

export type ProductoProduccion = {
  id: string;
  nombre: string;
  unidad_medida: string | null;
  tipo_producto: string | null;
};

export type Receta = {
  id: string;
  empresa_id: string;
  producto_terminado_id: string;
  nombre: string;
  rendimiento: number;
  unidad_rendimiento: string;
  activo: boolean;
};

export type RecetaDetalle = {
  id: string;
  receta_id: string;
  insumo_id: string;
  cantidad: number;
  unidad_medida: string;
};

export type InsumoRecetaCalculado = {
  insumoId: string;
  nombre: string;
  unidadMedida: string;
  cantidadReceta: number;
  cantidadNecesaria: number;
  stockDisponible: number;
  stockSuficiente: boolean;
};

export type CalculoProduccion = {
  receta: Receta;
  producto: ProductoProduccion;
  cantidadProducir: number;
  multiplicador: number;
  insumos: InsumoRecetaCalculado[];
  stockSuficiente: boolean;
};

// ============================================================
// OBTENER RECETA ACTIVA
// ============================================================
//
// Busca la receta activa correspondiente al producto terminado.
//
// Por ahora tomamos la primera receta activa encontrada.
// Más adelante podemos formalizar una única receta activa
// por producto mediante una restricción en la base.
//

export async function obtenerRecetaActiva(
  empresaId: string,
  productoId: string
): Promise<{
  receta: Receta;
  detalles: RecetaDetalle[];
  producto: ProductoProduccion;
} | null> {
  if (!empresaId) {
    throw new Error('Falta la empresa. No se puede buscar la receta.');
  }

  if (!productoId) {
    throw new Error('Falta el producto terminado.');
  }

  // ----------------------------------------------------------
  // 1. Producto
  // ----------------------------------------------------------

  const { data: producto, error: errorProducto } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida, tipo_producto')
    .eq('id', productoId)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (errorProducto) {
    throw errorProducto;
  }

  if (!producto) {
    return null;
  }

  if (producto.tipo_producto !== 'TERMINADO') {
    throw new Error(
      `El producto "${producto.nombre}" no es un producto terminado.`
    );
  }

  // ----------------------------------------------------------
  // 2. Receta activa
  // ----------------------------------------------------------

  const { data: receta, error: errorReceta } = await supabase
    .from('recetas')
    .select(
      'id, empresa_id, producto_terminado_id, nombre, rendimiento, unidad_rendimiento, activo'
    )
    .eq('empresa_id', empresaId)
    .eq('producto_terminado_id', productoId)
    .eq('activo', true)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errorReceta) {
    throw errorReceta;
  }

  if (!receta) {
    return null;
  }

  // ----------------------------------------------------------
  // 3. Detalle de receta
  // ----------------------------------------------------------

  const { data: detalles, error: errorDetalles } = await supabase
    .from('receta_detalle')
    .select(
      'id, receta_id, insumo_id, cantidad, unidad_medida'
    )
    .eq('receta_id', receta.id)
    .order('creado_en', { ascending: true });

  if (errorDetalles) {
    throw errorDetalles;
  }

  return {
    receta: receta as Receta,
    detalles: (detalles ?? []) as RecetaDetalle[],
    producto: producto as ProductoProduccion,
  };
}

// ============================================================
// CALCULAR CONSUMO
// ============================================================
//
// Toma una receta y calcula cuánto de cada insumo se necesita
// para producir una cantidad determinada.
//
// Ejemplo:
//
// Receta:
// rendimiento = 16 alfajores
//
// Producción:
// cantidadProducir = 40
//
// Multiplicador:
// 40 / 16 = 2,5
//
// Cada ingrediente se multiplica por 2,5.
//

export async function calcularConsumo(
  empresaId: string,
  productoId: string,
  cantidadProducir: number
): Promise<CalculoProduccion> {
  if (!cantidadProducir || cantidadProducir <= 0) {
    throw new Error('La cantidad a producir debe ser mayor que cero.');
  }

  const datos = await obtenerRecetaActiva(empresaId, productoId);

  if (!datos) {
    throw new Error(
      'No existe una receta activa para el producto seleccionado.'
    );
  }

  const {
    receta,
    detalles,
    producto,
  } = datos;

  if (!receta.rendimiento || receta.rendimiento <= 0) {
    throw new Error(
      `La receta "${receta.nombre}" tiene un rendimiento inválido.`
    );
  }

  if (detalles.length === 0) {
    throw new Error(
      `La receta "${receta.nombre}" no tiene insumos definidos.`
    );
  }

  const multiplicador = cantidadProducir / Number(receta.rendimiento);

  // ----------------------------------------------------------
  // Buscar todos los productos usados como insumos.
  // ----------------------------------------------------------

  const insumoIds = Array.from(
    new Set(detalles.map((detalle) => detalle.insumo_id))
  );

  const { data: insumos, error: errorInsumos } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida, tipo_producto')
    .eq('empresa_id', empresaId)
    .in('id', insumoIds);

  if (errorInsumos) {
    throw errorInsumos;
  }

  const insumoPorId = new Map(
    (insumos ?? []).map((insumo) => [insumo.id, insumo])
  );

  // ----------------------------------------------------------
  // Buscar stock actual de los insumos.
  // ----------------------------------------------------------

  const { data: saldos, error: errorSaldos } = await supabase
    .from('saldo_stock')
    .select('producto_id, saldo')
    .eq('empresa_id', empresaId)
    .in('producto_id', insumoIds);

  if (errorSaldos) {
    throw errorSaldos;
  }

  const saldoPorProducto = new Map(
    (saldos ?? []).map((saldo) => [
      saldo.producto_id,
      Number(saldo.saldo ?? 0),
    ])
  );

  // ----------------------------------------------------------
  // Calcular consumo por insumo.
  // ----------------------------------------------------------

  const calculados: InsumoRecetaCalculado[] = detalles.map((detalle) => {
    const insumo = insumoPorId.get(detalle.insumo_id);

    if (!insumo) {
      throw new Error(
        `No se encontró el insumo con ID ${detalle.insumo_id}.`
      );
    }

    if (insumo.tipo_producto !== 'INSUMO') {
      throw new Error(
        `"${insumo.nombre}" está utilizado en una receta pero no está clasificado como INSUMO.`
      );
    }

    const cantidadReceta = Number(detalle.cantidad);
    const cantidadNecesaria = cantidadReceta * multiplicador;
    const stockDisponible = saldoPorProducto.get(insumo.id) ?? 0;

    return {
      insumoId: insumo.id,
      nombre: insumo.nombre,
      unidadMedida: detalle.unidad_medida,
      cantidadReceta,
      cantidadNecesaria,
      stockDisponible,
      stockSuficiente: stockDisponible >= cantidadNecesaria,
    };
  });

  const stockSuficiente = calculados.every(
    (insumo) => insumo.stockSuficiente
  );

  return {
    receta,
    producto,
    cantidadProducir,
    multiplicador,
    insumos: calculados,
    stockSuficiente,
  };
}

// ============================================================
// VALIDAR STOCK DE INSUMOS
// ============================================================
//
// Esta función es un atajo para saber si una producción
// puede realizarse con el stock disponible.
//
// Devuelve además los faltantes para que la interfaz pueda
// informar exactamente qué insumos faltan.
//

export async function validarStockInsumos(
  empresaId: string,
  productoId: string,
  cantidadProducir: number
): Promise<{
  suficiente: boolean;
  faltantes: Array<{
    insumoId: string;
    nombre: string;
    unidadMedida: string;
    necesario: number;
    disponible: number;
    faltante: number;
  }>;
}> {
  const calculo = await calcularConsumo(
    empresaId,
    productoId,
    cantidadProducir
  );

  const faltantes = calculo.insumos
    .filter((insumo) => !insumo.stockSuficiente)
    .map((insumo) => ({
      insumoId: insumo.insumoId,
      nombre: insumo.nombre,
      unidadMedida: insumo.unidadMedida,
      necesario: insumo.cantidadNecesaria,
      disponible: insumo.stockDisponible,
      faltante: insumo.cantidadNecesaria - insumo.stockDisponible,
    }));

  return {
    suficiente: calculo.stockSuficiente,
    faltantes,
  };
}
