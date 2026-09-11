// src/lib/produccion.ts
//
// PRODUCCIÓN — lógica central del módulo de Producción.
//
// Responsabilidades:
// 1. CRUD de recetas (una por producto terminado, como máximo).
// 2. Calcular los insumos necesarios según la cantidad a producir,
//    convirtiendo unidades cuando la receta y el stock del insumo no
//    coinciden (ej. receta en gramos, insumo cargado en kilos).
// 3. Validar si existe stock suficiente de cada insumo.
// 4. Confirmar una producción: consume insumos, genera el producto
//    terminado en stock con su costo calculado, y deja el asiento
//    contable de transferencia de inventario (sin tocar el
//    resultado — el costo de venta se reconoce recién al vender,
//    con el motor de CMV que ya existe en motor.ts).

import { supabase } from './supabase';
import { generarIdOperacion } from './motor';

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
  unidadMedida: string; // unidad tal como está escrita en la receta
  unidadStock: string; // unidad en la que se lleva el stock de ese insumo
  cantidadReceta: number; // cantidad de la receta (unidad de receta), sin multiplicar
  cantidadNecesaria: number; // ya convertida a unidadStock y multiplicada
  stockDisponible: number; // en unidadStock
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
// CONVERSIÓN DE UNIDADES
// ============================================================
//
// Las únicas 5 unidades que existen hoy en Mercadería/Producción
// (ver opcionesUnidad en mercaderia/page.tsx y el CHECK de
// produccion_detalle.unidad_medida). Se agrupan en 3 familias: no
// tiene sentido convertir litros a kilos, por ejemplo.

export const UNIDADES_PRODUCCION = ['UNIDAD', 'KG', 'G', 'L', 'ML'] as const;

const FAMILIA_UNIDAD: Record<string, string> = {
  UNIDAD: 'CONTEO',
  KG: 'MASA',
  G: 'MASA',
  L: 'VOLUMEN',
  ML: 'VOLUMEN',
};

// Factor para llevar la cantidad a la unidad base de su familia
// (gramos para masa, mililitros para volumen, unidades para conteo).
const A_UNIDAD_BASE: Record<string, number> = {
  UNIDAD: 1,
  KG: 1000,
  G: 1,
  L: 1000,
  ML: 1,
};

export function convertirCantidad(
  cantidad: number,
  deUnidad: string,
  aUnidad: string
): number {
  if (deUnidad === aUnidad) return cantidad;

  const familiaDe = FAMILIA_UNIDAD[deUnidad];
  const familiaA = FAMILIA_UNIDAD[aUnidad];

  if (!familiaDe || !familiaA) {
    throw new Error(`Unidad de medida desconocida: "${deUnidad}" o "${aUnidad}".`);
  }

  if (familiaDe !== familiaA) {
    throw new Error(
      `No se puede convertir "${deUnidad}" a "${aUnidad}" — son unidades de distinto tipo (peso, volumen o cantidad).`
    );
  }

  const enBase = cantidad * A_UNIDAD_BASE[deUnidad];
  return enBase / A_UNIDAD_BASE[aUnidad];
}

// ============================================================
// LISTADOS PARA LOS FORMULARIOS
// ============================================================

export async function listarProductosTerminados(empresaId: string) {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida')
    .eq('empresa_id', empresaId)
    .eq('tipo_producto', 'TERMINADO')
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listarInsumosDisponibles(empresaId: string) {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida')
    .eq('empresa_id', empresaId)
    .eq('tipo_producto', 'INSUMO')
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export type RecetaConProducto = Receta & { nombreProducto: string };

export async function listarRecetas(empresaId: string): Promise<RecetaConProducto[]> {
  const { data, error } = await supabase
    .from('recetas')
    .select(
      'id, empresa_id, producto_terminado_id, nombre, rendimiento, unidad_rendimiento, activo, productos!recetas_producto_terminado_id_fkey(nombre)'
    )
    .eq('empresa_id', empresaId)
    .order('creado_en', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((fila) => {
    const { productos, ...receta } = fila as unknown as Receta & {
      productos: { nombre: string } | null;
    };
    return { ...receta, nombreProducto: productos?.nombre ?? '—' };
  });
}

// ============================================================
// CRUD DE RECETAS
// ============================================================
//
// "Cada producto con 1 receta": hay como máximo una fila en
// `recetas` por producto_terminado_id (restricción UNIQUE en la
// base). Crear = insertar si no existe; editar = actualizar esa
// fila y reemplazar su receta_detalle; eliminar = desactivarla
// (activo=false) — no se borra físicamente porque `producciones`
// la referencia con FK para mantener el historial.

export async function obtenerRecetaPorProducto(
  empresaId: string,
  productoId: string
): Promise<{ receta: Receta; detalles: RecetaDetalle[] } | null> {
  const { data: receta, error: errorReceta } = await supabase
    .from('recetas')
    .select('id, empresa_id, producto_terminado_id, nombre, rendimiento, unidad_rendimiento, activo')
    .eq('empresa_id', empresaId)
    .eq('producto_terminado_id', productoId)
    .maybeSingle();

  if (errorReceta) throw errorReceta;
  if (!receta) return null;

  const { data: detalles, error: errorDetalles } = await supabase
    .from('receta_detalle')
    .select('id, receta_id, insumo_id, cantidad, unidad_medida')
    .eq('receta_id', receta.id)
    .order('creado_en', { ascending: true });

  if (errorDetalles) throw errorDetalles;

  return { receta: receta as Receta, detalles: (detalles ?? []) as RecetaDetalle[] };
}

export type RecetaDetalleInput = { insumo_id: string; cantidad: number; unidad_medida: string };

export async function guardarReceta(
  empresaId: string,
  productoTerminadoId: string,
  datos: { nombre: string; rendimiento: number; detalle: RecetaDetalleInput[] }
): Promise<Receta> {
  const nombre = datos.nombre.trim();

  if (!nombre) {
    throw new Error('Ponele un nombre a la receta.');
  }

  if (!datos.rendimiento || datos.rendimiento <= 0) {
    throw new Error('El rendimiento tiene que ser mayor a cero.');
  }

  if (datos.detalle.length === 0) {
    throw new Error('Agregá al menos un insumo a la receta.');
  }

  const existente = await obtenerRecetaPorProducto(empresaId, productoTerminadoId);
  let recetaId: string;

  if (existente) {
    const { error } = await supabase
      .from('recetas')
      .update({ nombre, rendimiento: datos.rendimiento, activo: true })
      .eq('id', existente.receta.id);

    if (error) throw error;
    recetaId = existente.receta.id;

    const { error: errorBorrar } = await supabase
      .from('receta_detalle')
      .delete()
      .eq('receta_id', recetaId);

    if (errorBorrar) throw errorBorrar;
  } else {
    const { data: nueva, error } = await supabase
      .from('recetas')
      .insert({
        empresa_id: empresaId,
        producto_terminado_id: productoTerminadoId,
        nombre,
        rendimiento: datos.rendimiento,
        unidad_rendimiento: 'UNIDAD',
        activo: true,
      })
      .select('id')
      .single();

    if (error) throw error;
    recetaId = nueva.id;
  }

  const { error: errorDetalle } = await supabase.from('receta_detalle').insert(
    datos.detalle.map((d) => ({
      receta_id: recetaId,
      insumo_id: d.insumo_id,
      cantidad: d.cantidad,
      unidad_medida: d.unidad_medida,
    }))
  );

  if (errorDetalle) throw errorDetalle;

  const resultado = await obtenerRecetaPorProducto(empresaId, productoTerminadoId);
  if (!resultado) throw new Error('No se pudo recuperar la receta recién guardada.');
  return resultado.receta;
}

export async function eliminarReceta(recetaId: string) {
  const { error } = await supabase.from('recetas').update({ activo: false }).eq('id', recetaId);
  if (error) throw error;
}

export async function reactivarReceta(recetaId: string) {
  const { error } = await supabase.from('recetas').update({ activo: true }).eq('id', recetaId);
  if (error) throw error;
}

// ============================================================
// OBTENER RECETA ACTIVA (para calcular consumo / producir)
// ============================================================

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

  const { data: producto, error: errorProducto } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida, tipo_producto')
    .eq('id', productoId)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (errorProducto) throw errorProducto;
  if (!producto) return null;

  if (producto.tipo_producto !== 'TERMINADO') {
    throw new Error(`El producto "${producto.nombre}" no es un producto terminado.`);
  }

  const { data: receta, error: errorReceta } = await supabase
    .from('recetas')
    .select('id, empresa_id, producto_terminado_id, nombre, rendimiento, unidad_rendimiento, activo')
    .eq('empresa_id', empresaId)
    .eq('producto_terminado_id', productoId)
    .eq('activo', true)
    .maybeSingle();

  if (errorReceta) throw errorReceta;
  if (!receta) return null;

  const { data: detalles, error: errorDetalles } = await supabase
    .from('receta_detalle')
    .select('id, receta_id, insumo_id, cantidad, unidad_medida')
    .eq('receta_id', receta.id)
    .order('creado_en', { ascending: true });

  if (errorDetalles) throw errorDetalles;

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
// Toma una receta y calcula cuánto de cada insumo se necesita para
// producir una cantidad determinada, convirtiendo la cantidad de la
// receta a la unidad en la que se lleva el stock de ese insumo (ej.
// receta pide 250 G de harina, el insumo "Harina" se compra y se
// stockea en KG → se convierte antes de comparar contra el stock).

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
    throw new Error('No existe una receta activa para el producto seleccionado.');
  }

  const { receta, detalles, producto } = datos;

  if (!receta.rendimiento || receta.rendimiento <= 0) {
    throw new Error(`La receta "${receta.nombre}" tiene un rendimiento inválido.`);
  }

  if (detalles.length === 0) {
    throw new Error(`La receta "${receta.nombre}" no tiene insumos definidos.`);
  }

  const multiplicador = cantidadProducir / Number(receta.rendimiento);

  const insumoIds = Array.from(new Set(detalles.map((detalle) => detalle.insumo_id)));

  const { data: insumos, error: errorInsumos } = await supabase
    .from('productos')
    .select('id, nombre, unidad_medida, tipo_producto')
    .eq('empresa_id', empresaId)
    .in('id', insumoIds);

  if (errorInsumos) throw errorInsumos;

  const insumoPorId = new Map((insumos ?? []).map((insumo) => [insumo.id, insumo]));

  const { data: saldos, error: errorSaldos } = await supabase
    .from('saldo_stock')
    .select('producto_id, saldo')
    .eq('empresa_id', empresaId)
    .in('producto_id', insumoIds);

  if (errorSaldos) throw errorSaldos;

  const saldoPorProducto = new Map(
    (saldos ?? []).map((saldo) => [saldo.producto_id, Number(saldo.saldo ?? 0)])
  );

  const calculados: InsumoRecetaCalculado[] = detalles.map((detalle) => {
    const insumo = insumoPorId.get(detalle.insumo_id);

    if (!insumo) {
      throw new Error(`No se encontró el insumo con ID ${detalle.insumo_id}.`);
    }

    if (insumo.tipo_producto !== 'INSUMO') {
      throw new Error(
        `"${insumo.nombre}" está utilizado en una receta pero no está clasificado como INSUMO.`
      );
    }

    if (!insumo.unidad_medida) {
      throw new Error(
        `El insumo "${insumo.nombre}" no tiene una unidad de medida definida en Mercadería — asignale una antes de producir.`
      );
    }

    const cantidadReceta = Number(detalle.cantidad);
    const cantidadEnUnidadStock = convertirCantidad(cantidadReceta, detalle.unidad_medida, insumo.unidad_medida);
    const cantidadNecesaria = cantidadEnUnidadStock * multiplicador;
    const stockDisponible = saldoPorProducto.get(insumo.id) ?? 0;

    return {
      insumoId: insumo.id,
      nombre: insumo.nombre,
      unidadMedida: detalle.unidad_medida,
      unidadStock: insumo.unidad_medida,
      cantidadReceta,
      cantidadNecesaria,
      stockDisponible,
      stockSuficiente: stockDisponible >= cantidadNecesaria,
    };
  });

  const stockSuficiente = calculados.every((insumo) => insumo.stockSuficiente);

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

export type FaltanteInsumo = {
  insumoId: string;
  nombre: string;
  unidadMedida: string;
  necesario: number;
  disponible: number;
  faltante: number;
};

export async function validarStockInsumos(
  empresaId: string,
  productoId: string,
  cantidadProducir: number
): Promise<{ suficiente: boolean; faltantes: FaltanteInsumo[] }> {
  const calculo = await calcularConsumo(empresaId, productoId, cantidadProducir);

  const faltantes = calculo.insumos
    .filter((insumo) => !insumo.stockSuficiente)
    .map((insumo) => ({
      insumoId: insumo.insumoId,
      nombre: insumo.nombre,
      unidadMedida: insumo.unidadStock,
      necesario: insumo.cantidadNecesaria,
      disponible: insumo.stockDisponible,
      faltante: insumo.cantidadNecesaria - insumo.stockDisponible,
    }));

  return { suficiente: calculo.stockSuficiente, faltantes };
}

// ============================================================
// CONFIRMAR PRODUCCIÓN
// ============================================================
//
// Producción = transformación de inventario, no una venta ni un
// gasto: el stock de insumos baja, el stock de producto terminado
// sube, mismo valor total — sin tocar el Estado de Resultado. El
// costo de venta (CMV) se reconoce recién cuando el producto
// terminado se vende, con el motor que ya existe en motor.ts (que
// ya sabe calcular costo promedio ponderado a partir de las
// "entradas" de stock — acá se genera exactamente ese tipo de
// entrada, con el costo real calculado de los insumos consumidos).

async function costoPromedioActual(
  empresaId: string,
  productoId: string,
  fecha: string
): Promise<{ costoMedio: number; cantidadDisponible: number }> {
  const { data: movimientos, error } = await supabase
    .from('movimientos_stock')
    .select('tipo, cantidad, costo_unitario')
    .eq('empresa_id', empresaId)
    .eq('producto_id', productoId)
    .in('tipo', ['ENTRADA', 'SALIDA'])
    .lte('fecha', fecha);

  if (error) throw error;

  let cantidadDisponible = 0;
  let valorDisponible = 0;

  for (const movimiento of movimientos ?? []) {
    const cantidad = Number(movimiento.cantidad ?? 0);
    const costo = Number(movimiento.costo_unitario ?? 0);

    if (movimiento.tipo === 'ENTRADA') {
      cantidadDisponible += cantidad;
      valorDisponible += cantidad * costo;
    } else {
      cantidadDisponible -= cantidad;
      valorDisponible -= cantidad * costo;
    }
  }

  const costoMedio = cantidadDisponible > 0 ? valorDisponible / cantidadDisponible : 0;
  return { costoMedio, cantidadDisponible };
}

async function resolverCuentaStock(empresaId: string, categoriaProductoId: string): Promise<string> {
  const { data: cuentasCategoria, error } = await supabase
    .from('categorias_productos_cuentas')
    .select('cuenta_stock_id')
    .eq('empresa_id', empresaId)
    .eq('categoria_producto_id', categoriaProductoId)
    .eq('activo', true)
    .maybeSingle();

  if (error) throw error;

  if (!cuentasCategoria) {
    throw new Error('No existe configuración de cuenta de Stock para una de las categorías de producto involucradas.');
  }

  const { data: cuenta, error: errorPlan } = await supabase
    .from('plan_cuentas')
    .select('nombre')
    .eq('id', cuentasCategoria.cuenta_stock_id)
    .maybeSingle();

  if (errorPlan) throw errorPlan;
  if (!cuenta) throw new Error('No se pudo resolver la cuenta de Stock configurada.');

  return cuenta.nombre;
}

export type ResultadoProduccion =
  | { ok: true; idOperacion: string; costoTotal: number; costoUnitario: number }
  | { ok: false; faltantes: FaltanteInsumo[] };

export async function confirmarProduccion(
  empresaId: string,
  productoTerminadoId: string,
  cantidadProducir: number,
  fecha: string
): Promise<ResultadoProduccion> {
  const calculo = await calcularConsumo(empresaId, productoTerminadoId, cantidadProducir);

  if (!calculo.stockSuficiente) {
    return {
      ok: false,
      faltantes: calculo.insumos
        .filter((insumo) => !insumo.stockSuficiente)
        .map((insumo) => ({
          insumoId: insumo.insumoId,
          nombre: insumo.nombre,
          unidadMedida: insumo.unidadStock,
          necesario: insumo.cantidadNecesaria,
          disponible: insumo.stockDisponible,
          faltante: insumo.cantidadNecesaria - insumo.stockDisponible,
        })),
    };
  }

  const { data: empresaConfig } = await supabase
    .from('empresas')
    .select('validacion_automatica')
    .eq('id', empresaId)
    .maybeSingle();

  const estadoInicial = empresaConfig?.validacion_automatica ? 'VALIDADO' : 'PENDIENTE';

  const { data: insumosInfo, error: errorInsumosInfo } = await supabase
    .from('productos')
    .select('id, categoria_producto_id, categoria')
    .eq('empresa_id', empresaId)
    .in('id', calculo.insumos.map((insumo) => insumo.insumoId));

  if (errorInsumosInfo) throw errorInsumosInfo;

  const infoPorInsumo = new Map((insumosInfo ?? []).map((p) => [p.id, p]));

  // ---- Costo real de cada insumo a la fecha elegida. Se valida TODO
  // ---- antes de escribir nada, igual que el resto del motor.
  const costosInsumo: {
    insumoId: string;
    nombre: string;
    categoriaProductoId: string | null;
    cantidad: number;
    costoUnitario: number;
  }[] = [];

  for (const insumo of calculo.insumos) {
    const { costoMedio, cantidadDisponible } = await costoPromedioActual(
      empresaId,
      insumo.insumoId,
      fecha
    );

    // Puede pasar si el saldo_stock (usado en calcularConsumo, que no
    // filtra por fecha) está desactualizado respecto al histórico
    // filtrado por fecha -- mismo caso límite que ya contempla
    // motor.ts para una venta con fecha atrasada.
    if (cantidadDisponible < insumo.cantidadNecesaria) {
      return {
        ok: false,
        faltantes: [
          {
            insumoId: insumo.insumoId,
            nombre: insumo.nombre,
            unidadMedida: insumo.unidadStock,
            necesario: insumo.cantidadNecesaria,
            disponible: cantidadDisponible,
            faltante: insumo.cantidadNecesaria - cantidadDisponible,
          },
        ],
      };
    }

    costosInsumo.push({
      insumoId: insumo.insumoId,
      nombre: insumo.nombre,
      categoriaProductoId: infoPorInsumo.get(insumo.insumoId)?.categoria_producto_id ?? null,
      cantidad: insumo.cantidadNecesaria,
      costoUnitario: costoMedio,
    });
  }

  const costoTotal = costosInsumo.reduce((suma, c) => suma + c.cantidad * c.costoUnitario, 0);

  if (costoTotal <= 0) {
    throw new Error(
      'El costo de los insumos consumidos da $0 — revisá que tengan compras cargadas con costo antes de producir.'
    );
  }

  const costoUnitarioProducido = costoTotal / cantidadProducir;

  const { data: productoTerminadoInfo, error: errorProdInfo } = await supabase
    .from('productos')
    .select('categoria_producto_id, categoria')
    .eq('id', productoTerminadoId)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (errorProdInfo) throw errorProdInfo;

  if (!productoTerminadoInfo?.categoria_producto_id) {
    throw new Error(
      `El producto "${calculo.producto.nombre}" no tiene una categoría de producto asignada — asignale una en Mercadería antes de producir.`
    );
  }

  const cuentaStockTerminado = await resolverCuentaStock(
    empresaId,
    productoTerminadoInfo.categoria_producto_id
  );

  const cuentaPorCategoriaInsumo = new Map<string, string>();

  for (const c of costosInsumo) {
    if (!c.categoriaProductoId) {
      throw new Error(
        `El insumo "${c.nombre}" no tiene una categoría de producto asignada — asignale una en Mercadería antes de producir.`
      );
    }

    if (!cuentaPorCategoriaInsumo.has(c.categoriaProductoId)) {
      cuentaPorCategoriaInsumo.set(
        c.categoriaProductoId,
        await resolverCuentaStock(empresaId, c.categoriaProductoId)
      );
    }
  }

  // ------------------- A partir de acá sí se graba todo. -------------------

  const idOperacion = await generarIdOperacion(empresaId);

  const { error: errorMovInsumos } = await supabase.from('movimientos_stock').insert(
    costosInsumo.map((c) => ({
      empresa_id: empresaId,
      id_operacion: idOperacion,
      fecha,
      tipo: 'SALIDA',
      categoria: infoPorInsumo.get(c.insumoId)?.categoria ?? null,
      producto_id: c.insumoId,
      cantidad: c.cantidad,
      costo_unitario: c.costoUnitario,
      historico: `Consumo por producción ${idOperacion} — ${calculo.producto.nombre}`,
      estado: estadoInicial,
    }))
  );

  if (errorMovInsumos) throw errorMovInsumos;

  const { error: errorMovTerminado } = await supabase.from('movimientos_stock').insert({
    empresa_id: empresaId,
    id_operacion: idOperacion,
    fecha,
    tipo: 'ENTRADA',
    categoria: productoTerminadoInfo.categoria ?? null,
    producto_id: productoTerminadoId,
    cantidad: cantidadProducir,
    costo_unitario: costoUnitarioProducido,
    historico: `Producción ${idOperacion} — ${calculo.receta.nombre}`,
    estado: estadoInicial,
  });

  if (errorMovTerminado) throw errorMovTerminado;

  const { data: produccionRow, error: errorProduccion } = await supabase
    .from('producciones')
    .insert({
      empresa_id: empresaId,
      receta_id: calculo.receta.id,
      producto_terminado_id: productoTerminadoId,
      fecha,
      cantidad_producida: cantidadProducir,
      costo_total: costoTotal,
      costo_unitario: costoUnitarioProducido,
      estado: estadoInicial === 'VALIDADO' ? 'PROCESADA' : 'PENDIENTE',
      id_operacion: idOperacion,
    })
    .select('id')
    .single();

  if (errorProduccion) throw errorProduccion;

  const { error: errorDetalle } = await supabase.from('produccion_detalle').insert(
    costosInsumo.map((c) => ({
      produccion_id: produccionRow.id,
      insumo_id: c.insumoId,
      cantidad_teorica: c.cantidad,
      cantidad_consumida: c.cantidad,
      unidad_medida: calculo.insumos.find((i) => i.insumoId === c.insumoId)?.unidadStock ?? 'UNIDAD',
      costo_unitario: c.costoUnitario,
      costo_total: c.cantidad * c.costoUnitario,
    }))
  );

  if (errorDetalle) throw errorDetalle;

  const asientos: Record<string, unknown>[] = [];

  for (const [categoriaId, cuentaInsumo] of cuentaPorCategoriaInsumo.entries()) {
    const importe = costosInsumo
      .filter((c) => c.categoriaProductoId === categoriaId)
      .reduce((suma, c) => suma + c.cantidad * c.costoUnitario, 0);

    if (importe > 0) {
      asientos.push({
        empresa_id: empresaId,
        id_operacion: idOperacion,
        tipo_registro: 'PRODUCCION',
        fecha,
        cuenta_debito: cuentaStockTerminado,
        cuenta_credito: cuentaInsumo,
        importe,
        historico: `Producción automática — ${idOperacion}`,
        estado: estadoInicial,
      });
    }
  }

  const { error: errorAsientos } = await supabase.from('registros_automaticos').insert(asientos);
  if (errorAsientos) throw errorAsientos;

  return { ok: true, idOperacion, costoTotal, costoUnitario: costoUnitarioProducido };
}
