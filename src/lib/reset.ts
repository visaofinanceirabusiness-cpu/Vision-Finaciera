// lib/reset.ts
//
// Resetea una empresa a estado "operativo pero vacío": borra todo el
// dato transaccional (operaciones, movimientos de stock, producción,
// productos, proveedores, clientes) pero deja intacta la
// configuración (plan de cuentas, categorías, formas de pago, reglas
// contables, matriz de operaciones, socios, objetivos, datos de la
// empresa) para que el sistema siga andando de inmediato.
//
// No hace falta recalcular ningún saldo: plan_cuentas.saldo_inicial
// es el único valor que se guarda — el saldo "actual" de cada cuenta
// siempre se recalcula en el momento sumando registro_operaciones y
// registros_automaticos (ver obtenerSaldoCuenta en motor.ts), así que
// al vaciar esas tablas todas las cuentas vuelven solas a su saldo
// inicial. La matriz de operaciones tampoco se toca: es config
// derivada (se arma desde categorías/formas de pago/reglas), no dato
// transaccional.
//
// Orden de borrado obligado por las foreign keys reales entre tablas:
// movimientos_stock y producción dependen de productos, así que hay
// que vaciarlos antes de poder borrar productos.

import { supabase } from './supabase';
import { empresaTieneModulo } from './perfilCapacidades';

export type ResultadoReset = {
  tablasLimpias: string[];
  errores: string[];
};

async function borrarPorEmpresa(tabla: string, empresaId: string): Promise<string | null> {
  const { error } = await supabase.from(tabla).delete().eq('empresa_id', empresaId);

  if (error) {
    console.error(`Error borrando ${tabla}:`, error);
    return `${tabla} (${error.message})`;
  }

  return null;
}

// produccion_detalle y receta_detalle no tienen empresa_id propio —
// cuelgan de producciones/recetas por produccion_id/receta_id — así
// que primero hay que traer los ids de la empresa y recién ahí borrar
// por esa lista.
async function borrarDetallePorPadre(
  tablaDetalle: string,
  columnaFk: string,
  tablaPadre: string,
  empresaId: string
): Promise<string | null> {
  const { data: padres, error: errorPadres } = await supabase
    .from(tablaPadre)
    .select('id')
    .eq('empresa_id', empresaId);

  if (errorPadres) {
    console.error(`Error buscando ${tablaPadre} para borrar ${tablaDetalle}:`, errorPadres);
    return `${tablaDetalle} (${errorPadres.message})`;
  }

  const ids = (padres ?? []).map((fila) => fila.id);

  if (ids.length === 0) {
    return null;
  }

  const { error: errorDetalle } = await supabase.from(tablaDetalle).delete().in(columnaFk, ids);

  if (errorDetalle) {
    console.error(`Error borrando ${tablaDetalle}:`, errorDetalle);
    return `${tablaDetalle} (${errorDetalle.message})`;
  }

  return null;
}

export async function resetearSistema(empresaId: string): Promise<ResultadoReset> {
  const tablasLimpias: string[] = [];
  const errores: string[] = [];

  async function borrar(tabla: string) {
    const err = await borrarPorEmpresa(tabla, empresaId);
    if (err) {
      errores.push(err);
    } else {
      tablasLimpias.push(tabla);
    }
  }

  async function borrarDetalle(tablaDetalle: string, columnaFk: string, tablaPadre: string) {
    const err = await borrarDetallePorPadre(tablaDetalle, columnaFk, tablaPadre, empresaId);
    if (err) {
      errores.push(err);
    } else {
      tablasLimpias.push(tablaDetalle);
    }
  }

  // 1. Movimientos y registros que cuelgan de las operaciones.
  await borrar('movimientos_stock');
  await borrar('registros_automaticos');
  await borrar('registro_operaciones');

  // 2. Producción, solo si la empresa tiene ese módulo habilitado —
  // produccion_detalle y receta_detalle dependen de producciones y
  // recetas, así que van primero.
  if (await empresaTieneModulo(empresaId, 'PRODUCCION')) {
    await borrarDetalle('produccion_detalle', 'produccion_id', 'producciones');
    await borrar('producciones');
    await borrarDetalle('receta_detalle', 'receta_id', 'recetas');
    await borrar('recetas');
  }

  // 3. Productos — recién ahora, con movimientos_stock y producción
  // ya vacíos, no quedan filas que lo referencien.
  await borrar('productos');

  // 4. Proveedores y clientes.
  await borrar('proveedores');
  await borrar('clientes');

  return { tablasLimpias, errores };
}
