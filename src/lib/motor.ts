// lib/motor.ts
//
// EL MOTOR — el corazón de "Sabio".
// Lee las reglas configuradas para cada empresa.
// Genera la matriz y registra las operaciones.
// Mantiene un mismo id_operacion como hilo conductor.

import { supabase } from './supabase';
import { notificarPendienteAlAdmin } from './notificarPush';

// =====================================================
// TIPOS
// =====================================================

type ReglaContable = {
  operacion: string;
  categoria_codigo: string | null;
  categoria_nombre: string | null;
  rol_debito: string;
  rol_credito: string;
  stock: string;
  libro: string;
  cmv: string;
  motor: string;
};

export type LineaOperacion = {
  producto: string;
  cantidad: number;
  monto: number;
};

export type FormularioOperacion = {
  fecha: string;
  operacion: string;
  categoria: string;
  formaPago: string;
  historico: string;
  clienteProveedor: string;
  // Quién de la familia generó ese ingreso — separado de
  // clienteProveedor (que en un COBRO es la "Fuente de ingreso": el
  // empleador o quien pagó, no la persona de la familia). Solo se usa
  // hoy en perfil Familia, para poder armar "Distribución de ingresos
  // por socio". Opcional: si no se envía, se guarda vacío.
  socio?: string;
  lineas: LineaOperacion[];
};

// =====================================================
// GENERAR MATRIZ DE OPERACIONES
// =====================================================
//
// IMPORTANTE — LEER ANTES DE TOCAR ESTA FUNCIÓN:
//
// Los roles genéricos de reglas_contables (STOCK_CATEGORIA,
// INGRESO_CATEGORIA, GASTO_CATEGORIA, RETIRO_PERSONAL, APORTE_SOCIA,
// PERDIDA_STOCK, MEDIO_FINANCIERO) se resuelven acá contra cuentas
// reales del Plan de Contas, usando las tablas de vínculo que ya
// existen y se configuran en CONFIGURAÇÕES → Categorias e Formas de
// Pagamento:
//
//   - MEDIO_FINANCIERO              → forma_pago_cuentas
//   - STOCK_CATEGORIA / INGRESO_CATEGORIA → categorias_productos_cuentas
//   - cualquier otro rol (ej. GASTO_CATEGORIA, RETIRO_PERSONAL,
//     APORTE_SOCIA, PERDIDA_STOCK) → categorias_operacion_cuentas,
//     buscando por el "rol base" (todo antes del primer "_": GASTO,
//     RETIRO, APORTE, PERDIDA)
//
// Las formas de pago válidas para cada operación salen de
// formas_pago_operacion (no de una lista fija en el código). Si una
// operación no tiene ninguna forma de pago asociada (ej. PERDIDA,
// que es un ajuste de stock sin movimiento de dinero), se genera una
// única fila con forma_pago = "Ajustes".
//
// Si falta alguna configuración (una categoría sin cuenta asignada,
// una forma de pago sin cuenta asignada, etc.) esta función lanza un
// error explícito en vez de grabar una matriz a medias — así nunca
// queda un rol sin resolver escrito como texto literal en
// matriz_operaciones (ese fue el bug original: ver memoria
// "project-visao-matriz-roles-sin-resolver").

export async function generarMatrizOperaciones(
  empresaId: string
) {
  const [
    { data: reglas, error: errorReglas },
    { data: operaciones, error: errorOperaciones },
    { data: formasPagoOperacion, error: errorFPO },
    { data: formasPago, error: errorFormasPago },
    { data: formaPagoCuentas, error: errorFPC },
    { data: categoriasProductos, error: errorCatProd },
    { data: categoriasProductosCuentas, error: errorCatProdCuentas },
    { data: categoriasOperacion, error: errorCatOp },
    { data: categoriasOperacionCuentas, error: errorCatOpCuentas },
    { data: planCuentas, error: errorPlan },
  ] = await Promise.all([
    supabase.from('reglas_contables').select('*').eq('empresa_id', empresaId),
    supabase.from('operaciones').select('id, nombre').eq('empresa_id', empresaId),
    supabase.from('formas_pago_operacion').select('operacion_id, forma_pago_id').eq('empresa_id', empresaId).eq('activo', true),
    supabase.from('formas_pago').select('id, codigo, nombre').eq('empresa_id', empresaId),
    supabase.from('forma_pago_cuentas').select('forma_pago_id, cuenta_id').eq('empresa_id', empresaId).eq('activo', true),
    supabase.from('categorias_productos').select('id, codigo').eq('empresa_id', empresaId),
    supabase.from('categorias_productos_cuentas').select('categoria_producto_id, cuenta_stock_id, cuenta_ingreso_id').eq('empresa_id', empresaId).eq('activo', true),
    supabase.from('categorias_operacion').select('id, operacion, codigo').eq('empresa_id', empresaId),
    supabase.from('categorias_operacion_cuentas').select('categoria_operacion_id, cuenta_id, rol').eq('empresa_id', empresaId).eq('activo', true),
    supabase.from('plan_cuentas').select('id, nombre').eq('empresa_id', empresaId),
  ]);

  const primerError =
    errorReglas || errorOperaciones || errorFPO || errorFormasPago ||
    errorFPC || errorCatProd || errorCatProdCuentas || errorCatOp ||
    errorCatOpCuentas || errorPlan;

  if (primerError) {
    throw primerError;
  }

  // ---------------------------------------------------
  // MAPAS DE BÚSQUEDA
  // ---------------------------------------------------

  const nombreCuenta = new Map(
    (planCuentas ?? []).map((c) => [c.id, c.nombre])
  );

  const formaPagoPorId = new Map(
    (formasPago ?? []).map((f) => [f.id, f])
  );

  const cuentaPorFormaPago = new Map(
    (formaPagoCuentas ?? []).map((f) => [f.forma_pago_id, nombreCuenta.get(f.cuenta_id)])
  );

  const operacionIdPorNombre = new Map(
    (operaciones ?? []).map((o) => [o.nombre, o.id])
  );

  const formasPagoPorOperacionId = new Map<string, string[]>();
  for (const fila of formasPagoOperacion ?? []) {
    const lista = formasPagoPorOperacionId.get(fila.operacion_id) ?? [];
    lista.push(fila.forma_pago_id);
    formasPagoPorOperacionId.set(fila.operacion_id, lista);
  }

  const categoriaProductoPorCodigo = new Map(
    (categoriasProductos ?? []).map((c) => [c.codigo, c.id])
  );

  const cuentasProductoPorCategoriaId = new Map(
    (categoriasProductosCuentas ?? []).map((c) => [c.categoria_producto_id, c])
  );

  const categoriaOperacionPorClave = new Map(
    (categoriasOperacion ?? []).map((c) => [`${c.operacion}.${c.codigo}`, c.id])
  );

  const cuentaOperacionPorClaveYRol = new Map(
    (categoriasOperacionCuentas ?? []).map((c) => [`${c.categoria_operacion_id}.${c.rol}`, nombreCuenta.get(c.cuenta_id)])
  );

  // ---------------------------------------------------
  // RESOLVER UN ROL A UN NOMBRE DE CUENTA REAL
  // ---------------------------------------------------

  function resolverRol(
    rol: string,
    regla: ReglaContable,
    cuentaDelMedio: string | undefined
  ): string {
    if (rol === 'MEDIO_FINANCIERO') {
      if (!cuentaDelMedio) {
        throw new Error(
          `La forma de pago usada en "${regla.operacion} / ${regla.categoria_nombre}" no tiene una cuenta contable asignada. Configurala en CONFIGURAÇÕES → Categorias e Formas de Pagamento.`
        );
      }
      return cuentaDelMedio;
    }

    if (rol === 'STOCK_CATEGORIA' || rol === 'INGRESO_CATEGORIA') {
      const categoriaProductoId = categoriaProductoPorCodigo.get(regla.categoria_codigo ?? '');
      const cuentas = categoriaProductoId ? cuentasProductoPorCategoriaId.get(categoriaProductoId) : undefined;
      const cuentaId = rol === 'STOCK_CATEGORIA' ? cuentas?.cuenta_stock_id : cuentas?.cuenta_ingreso_id;
      const nombrePorProducto = cuentaId ? nombreCuenta.get(cuentaId) : undefined;

      if (nombrePorProducto) {
        return nombrePorProducto;
      }

      // No es una categoría de producto (ej. una venta de servicio, o
      // un ingreso personal en el perfil Familiar): se resuelve igual
      // que un rol "propio" de categoría de operación.
      const rolBaseAlternativo = rol === 'STOCK_CATEGORIA' ? 'STOCK' : 'INGRESO';
      const categoriaOperacionId = categoriaOperacionPorClave.get(`${regla.operacion}.${regla.categoria_codigo ?? ''}`);
      const nombrePorOperacion = categoriaOperacionId
        ? cuentaOperacionPorClaveYRol.get(`${categoriaOperacionId}.${rolBaseAlternativo}`)
        : undefined;

      if (!nombrePorOperacion) {
        throw new Error(
          `Falta asignar la cuenta de ${rol === 'STOCK_CATEGORIA' ? 'stock' : 'ingreso'} para "${regla.categoria_nombre}". Configurala en CONFIGURAÇÕES → Categorias e Formas de Pagamento.`
        );
      }

      return nombrePorOperacion;
    }

    // Roles "propios" de una categoría de operación: GASTO_CATEGORIA,
    // RETIRO_PERSONAL, APORTE_SOCIA, PERDIDA_STOCK, o cualquier rol
    // nuevo que se agregue con la misma convención "BASE_algo".
    const rolBase = rol.split('_')[0];
    const categoriaOperacionId = categoriaOperacionPorClave.get(`${regla.operacion}.${regla.categoria_codigo ?? ''}`);
    const nombre = categoriaOperacionId
      ? cuentaOperacionPorClaveYRol.get(`${categoriaOperacionId}.${rolBase}`)
      : undefined;

    if (!nombre) {
      throw new Error(
        `Falta asignar la cuenta contable para "${regla.categoria_nombre}" (rol ${rol}) en "${regla.operacion}". Configurala en CONFIGURAÇÕES → Categorias e Formas de Pagamento.`
      );
    }

    return nombre;
  }

  // ---------------------------------------------------
  // ARMAR LAS FILAS DE LA MATRIZ
  // ---------------------------------------------------

  const filas: Record<string, unknown>[] = [];

  for (const regla of (reglas as ReglaContable[]) ?? []) {
    // Las filas con categoria_codigo null son "plantillas" (quedan
    // así al aplicar un perfil, esperando a que el usuario cree una
    // categoría real desde CONFIGURAÇÕES) — no generan ninguna fila
    // de matriz por sí solas.
    if (!regla.categoria_codigo) {
      continue;
    }

    const operacionId = operacionIdPorNombre.get(regla.operacion.trim().toUpperCase());
    const formasPagoIds = operacionId ? formasPagoPorOperacionId.get(operacionId) ?? [] : [];

    const mediosValidos = formasPagoIds
      .map((id) => formaPagoPorId.get(id))
      .filter((forma): forma is { id: string; codigo: string; nombre: string } => Boolean(forma));

    // Operación sin forma de pago asociada (ej. PERDIDA): una sola
    // fila de ajuste, sin depender de ningún medio financiero.
    if (mediosValidos.length === 0) {
      const cuentaDebito = resolverRol(regla.rol_debito, regla, undefined);
      const cuentaCredito = resolverRol(regla.rol_credito, regla, undefined);

      filas.push({
        empresa_id: empresaId,
        clave: `${regla.operacion}.${regla.categoria_nombre ?? ''}.Ajustes`,
        operacion: regla.operacion,
        categoria: regla.categoria_nombre,
        forma_pago: 'Ajustes',
        cuenta_debito: cuentaDebito,
        cuenta_credito: cuentaCredito,
        stock: regla.stock,
        libro: regla.libro,
        cmv: regla.cmv,
        motor: regla.motor,
      });

      continue;
    }

    for (const medio of mediosValidos) {
      const cuentaDelMedio = cuentaPorFormaPago.get(medio.id);

      const cuentaDebito = resolverRol(regla.rol_debito, regla, cuentaDelMedio);
      const cuentaCredito = resolverRol(regla.rol_credito, regla, cuentaDelMedio);

      filas.push({
        empresa_id: empresaId,
        clave: `${regla.operacion}.${regla.categoria_nombre ?? ''}.${medio.nombre}`,
        operacion: regla.operacion,
        categoria: regla.categoria_nombre,
        forma_pago: medio.nombre,
        cuenta_debito: cuentaDebito,
        cuenta_credito: cuentaCredito,
        stock: regla.stock,
        libro: regla.libro,
        cmv: regla.cmv,
        motor: regla.motor,
      });
    }
  }

  // ---------------------------------------------------
  // GRABAR — recién acá, con todo ya resuelto sin errores
  // ---------------------------------------------------

  const { error: errorBorrar } =
    await supabase
      .from('matriz_operaciones')
      .delete()
      .eq('empresa_id', empresaId);

  if (errorBorrar) {
    throw errorBorrar;
  }

  if (filas.length > 0) {
    const { error: errorInsertar } =
      await supabase
        .from('matriz_operaciones')
        .insert(filas);

    if (errorInsertar) {
      throw errorInsertar;
    }
  }

  return {
    reglasGeneradas: filas.length,
  };
}

// =====================================================
// BUSCAR REGLA
// =====================================================

export async function buscarRegla(
  empresaId: string,
  operacion: string,
  categoria: string,
  formaPago: string
) {
  const { data, error } = await supabase
    .from('matriz_operaciones')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion)
    .eq('categoria', categoria)
    .eq('forma_pago', formaPago)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// =====================================================
// GENERAR ID DE OPERACIÓN
// =====================================================

async function generarIdOperacion(
  empresaId: string
) {
  const { data, error } = await supabase
    .from('registro_operaciones')
    .select('id_operacion')
    .eq('empresa_id', empresaId);

  if (error) {
    throw error;
  }

  const numeros = (data ?? [])
    .map((fila) =>
      parseInt(
        String(fila.id_operacion ?? '')
          .replace('OP-', ''),
        10
      )
    )
    .filter((n) => !Number.isNaN(n));

  const siguiente =
    numeros.length > 0
      ? Math.max(...numeros) + 1
      : 1;

  return `OP-${String(siguiente).padStart(5, '0')}`;
}

// =====================================================
// ELIMINAR DATOS DE UNA OPERACIÓN
// =====================================================

async function limpiarOperacion(
  empresaId: string,
  idOperacion: string
) {
  const errores: string[] = [];

  const { error: errorAutomaticos } =
    await supabase
      .from('registros_automaticos')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id_operacion', idOperacion);

  if (errorAutomaticos) {
    console.error(
      'Error limpiando registros automáticos:',
      errorAutomaticos
    );
    errores.push(`registros automáticos (${errorAutomaticos.message})`);
  }

  const { error: errorStock } =
    await supabase
      .from('movimientos_stock')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id_operacion', idOperacion);

  if (errorStock) {
    console.error(
      'Error limpiando movimientos de stock:',
      errorStock
    );
    errores.push(`movimientos de stock (${errorStock.message})`);
  }

  const { error: errorRegistro } =
    await supabase
      .from('registro_operaciones')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id_operacion', idOperacion);

  if (errorRegistro) {
    console.error(
      'Error limpiando registro de operación:',
      errorRegistro
    );
    errores.push(`registro de operación (${errorRegistro.message})`);
  }

  return errores;
}

// =====================================================
// SALDO ACTUAL DE UNA CUENTA (para no dejarla en negativo)
// =====================================================

async function obtenerSaldoCuenta(empresaId: string, nombreCuenta: string, fechaLimite: string) {
  const { data: cuenta } = await supabase
    .from('plan_cuentas')
    .select('naturaleza, tipo_saldo, saldo_inicial')
    .eq('empresa_id', empresaId)
    .eq('nombre', nombreCuenta)
    .maybeSingle();

  if (!cuenta) {
    return null;
  }

  // Importante: el saldo se calcula SOLO con los movimientos hasta
  // fechaLimite (la fecha de la operación que se está por registrar),
  // no con el total histórico. Si no se filtrara por fecha, cargar una
  // operación con fecha atrasada podría aprobarse mirando el saldo de
  // HOY (que ya incluye ingresos posteriores a esa fecha) aunque en
  // esa fecha vieja la cuenta hubiera quedado en negativo.
  const [
    { data: comoDebito },
    { data: comoCredito },
    { data: autoComoDebito },
    { data: autoComoCredito },
  ] = await Promise.all([
    supabase.from('registro_operaciones').select('total').eq('empresa_id', empresaId).eq('cuenta_debito', nombreCuenta).lte('fecha', fechaLimite),
    supabase.from('registro_operaciones').select('total').eq('empresa_id', empresaId).eq('cuenta_credito', nombreCuenta).lte('fecha', fechaLimite),
    supabase.from('registros_automaticos').select('importe').eq('empresa_id', empresaId).eq('cuenta_debito', nombreCuenta).lte('fecha', fechaLimite),
    supabase.from('registros_automaticos').select('importe').eq('empresa_id', empresaId).eq('cuenta_credito', nombreCuenta).lte('fecha', fechaLimite),
  ]);

  const sumar = (filas: { total?: unknown; importe?: unknown }[] | null, campo: 'total' | 'importe') =>
    (filas ?? []).reduce((suma, fila) => suma + Number(fila[campo] ?? 0), 0);

  const debe = sumar(comoDebito, 'total') + sumar(autoComoDebito, 'importe');
  const haber = sumar(comoCredito, 'total') + sumar(autoComoCredito, 'importe');

  const saldo =
    cuenta.naturaleza === 'ACREEDORA'
      ? Number(cuenta.saldo_inicial ?? 0) + haber - debe
      : Number(cuenta.saldo_inicial ?? 0) + debe - haber;

  return {
    saldo,
    naturaleza: cuenta.naturaleza as string,
    tipoSaldo: cuenta.tipo_saldo as string,
  };
}

// =====================================================
// REGISTRAR OPERACIÓN
// =====================================================

export async function registrarOperacion(
  empresaId: string,
  formulario: FormularioOperacion,
  idOperacionForzado?: string
) {
  const total = formulario.lineas.reduce(
    (suma, linea) =>
      suma +
      Number(linea.cantidad) *
        Number(linea.monto),
    0
  );

  if (total <= 0) {
    throw new Error(
      'El total debe ser mayor que cero.'
    );
  }

  // ---------------------------------------------------
  // 1. BUSCAR REGLA
  // ---------------------------------------------------

  const regla = await buscarRegla(
    empresaId,
    formulario.operacion.trim(),
    formulario.categoria.trim(),
    formulario.formaPago.trim()
  );

  if (!regla) {
    throw new Error(
      `No se encontró una regla contable para "${formulario.operacion}" / "${formulario.categoria}" / "${formulario.formaPago}". Revisá la Matriz de Operaciones.`
    );
  }

  // ---------------------------------------------------
  // 1.b VALIDAR QUE NINGUNA CUENTA INVOLUCRADA QUEDE EN NEGATIVO
  //
  // Regla general, para cuentas de CUALQUIER tipo_saldo (Activo,
  // Pasivo, Patrimonio, Ingreso, Gasto, Costo): el saldo se mueve
  // según la naturaleza de la cuenta, no según su tipo. Dos casos
  // simétricos:
  //   - El lado que se ACREDITA de una cuenta DEUDORA (Caja, Banco,
  //     Stock, un Gasto, un Costo) resta de su saldo — no puede
  //     quedar negativo.
  //   - El lado que se DEBITA de una cuenta ACREEDORA (Proveedor, un
  //     Ingreso, Patrimonio) resta de su saldo — tampoco puede quedar
  //     negativo: sería un saldo "a favor" que hoy no tiene una cuenta
  //     propia (sería un anticipo, que se modela con otra cuenta —
  //     pendiente de desarrollar). Hasta que eso exista, se bloquea la
  //     operación en vez de dejar la cuenta en negativo.
  //
  // Una cuenta ACREEDORA creciendo por el crédito (una deuda nueva o
  // más grande, un ingreso) es normal y no se bloquea acá, ni tampoco
  // una cuenta DEUDORA creciendo por el débito.
  // ---------------------------------------------------

  if (regla.cuenta_credito) {
    const cuentaCredito = await obtenerSaldoCuenta(empresaId, regla.cuenta_credito, formulario.fecha);

    if (cuentaCredito && cuentaCredito.naturaleza === 'DEUDORA') {
      const saldoResultante = cuentaCredito.saldo - total;

      if (saldoResultante < 0) {
        throw new Error(
          `No hay saldo suficiente en "${regla.cuenta_credito}" para esta operación en la fecha indicada. Saldo disponible al ${formulario.fecha}: R$ ${cuentaCredito.saldo.toFixed(2)}, se necesitan R$ ${total.toFixed(2)}. Registrá una Inversión (aporte) con fecha anterior o igual a esta para cubrir la diferencia.`
        );
      }
    }
  }

  if (regla.cuenta_debito) {
    const cuentaDebito = await obtenerSaldoCuenta(empresaId, regla.cuenta_debito, formulario.fecha);

    if (cuentaDebito && cuentaDebito.naturaleza === 'ACREEDORA') {
      const saldoResultante = cuentaDebito.saldo - total;

      if (saldoResultante < 0) {
        throw new Error(
          `Esta operación dejaría "${regla.cuenta_debito}" con saldo a favor (negativo) en la fecha indicada, y todavía no hay una cuenta de anticipo para eso. Saldo al ${formulario.fecha}: R$ ${cuentaDebito.saldo.toFixed(2)}, se necesitan R$ ${total.toFixed(2)}.`
        );
      }
    }
  }

  // Al editar una operación existente, se reutiliza el mismo
  // id_operacion en vez de generar uno nuevo — así el hilo conductor
  // (registro_operaciones + movimientos_stock + registros_automaticos)
  // no cambia, solo su contenido.
  const idOperacion =
    idOperacionForzado ?? (await generarIdOperacion(empresaId));

  // ===================================================
  // 2. PREPARAR MOVIMIENTOS Y CMV
  //
  // IMPORTANTE:
  // Acá todavía NO grabamos nada.
  // Primero validamos y calculamos todo.
  // ===================================================

  const movimientos: Record<string, unknown>[] =
    [];

  const costosCMV: {
    cantidad: number;
    costoMedio: number;
  }[] = [];

  if (regla.stock === 'SI') {
    const tipoMovimiento =
      formulario.operacion === 'COMPRA'
        ? 'ENTRADA'
        : 'SALIDA';

    for (const linea of formulario.lineas) {
      if (
        !linea.producto ||
        Number(linea.cantidad) <= 0
      ) {
        continue;
      }

      let costoUnitario =
        Number(linea.monto);

      // ------------------------------------------------
      // COMPRA
      // ------------------------------------------------

      if (
        formulario.operacion === 'COMPRA'
      ) {
        costoUnitario =
          Number(linea.monto);
      }

      // ------------------------------------------------
      // CUALQUIER SALIDA DE STOCK (VENTA, PERDIDA, o
      // cualquier otra operación que se agregue con
      // stock='SI' y no sea COMPRA)
      //
      // Se calcula lo que efectivamente queda disponible
      // en stock — cantidad y valor — tomando el historial
      // de movimientos (ENTRADA y SALIDA) del producto HASTA
      // LA FECHA de esta operación (no todo el histórico:
      // igual que con el saldo de las cuentas financieras,
      // si no se filtrara por fecha se podría cargar una
      // venta con fecha atrasada usando stock de una compra
      // posterior que en esa fecha vieja todavía no existía)
      // y restando lo ya consumido. El costo unitario de cada
      // SALIDA pasada ya refleja el promedio vigente en su
      // momento, así que restar su cantidad*costo_unitario es
      // equivalente a "consumir" ese valor del stock (promedio
      // ponderado perpetuo).
      //
      // Ninguna SALIDA puede pedir más cantidad de la que
      // hay disponible — así ninguna operación deja el
      // stock de un producto en negativo, sea una venta o
      // una baja por pérdida.
      // ------------------------------------------------

      if (tipoMovimiento === 'SALIDA') {
        const {
          data: movimientosProducto,
          error,
        } = await supabase
          .from('movimientos_stock')
          .select(
            'tipo, cantidad, costo_unitario'
          )
          .eq('empresa_id', empresaId)
          .eq(
            'producto_id',
            linea.producto
          )
          .in('tipo', ['ENTRADA', 'SALIDA'])
          .lte('fecha', formulario.fecha);

        if (error) {
          throw error;
        }

        let cantidadDisponible = 0;
        let valorDisponible = 0;

        for (const movimiento of movimientosProducto ?? []) {
          const cantidadMov = Number(movimiento.cantidad ?? 0);
          const costoMov = Number(movimiento.costo_unitario ?? 0);

          if (movimiento.tipo === 'ENTRADA') {
            cantidadDisponible += cantidadMov;
            valorDisponible += cantidadMov * costoMov;
          } else {
            cantidadDisponible -= cantidadMov;
            valorDisponible -= cantidadMov * costoMov;
          }
        }

        if (cantidadDisponible <= 0) {
          throw new Error(
            `No hay stock disponible para el producto seleccionado. Producto: ${linea.producto}`
          );
        }

        if (Number(linea.cantidad) > cantidadDisponible) {
          throw new Error(
            `No hay stock suficiente — quedan ${cantidadDisponible} unidades disponibles y se pidieron ${Number(linea.cantidad)}. Producto: ${linea.producto}`
          );
        }

        if (formulario.operacion === 'VENTA') {
          costoUnitario =
            valorDisponible /
            cantidadDisponible;

          costosCMV.push({
            cantidad: Number(
              linea.cantidad
            ),
            costoMedio:
              costoUnitario,
          });
        }
      }

      movimientos.push({
        empresa_id: empresaId,
        id_operacion: idOperacion,
        fecha: formulario.fecha,
        tipo: tipoMovimiento,
        categoria:
          formulario.categoria,
        producto_id:
          linea.producto,
        cantidad:
          Number(linea.cantidad),
        costo_unitario:
          costoUnitario,
        historico:
          formulario.historico,
        estado: 'PENDIENTE',
      });
    }
  }

  // ===================================================
  // 3. PREPARAR CMV COMPLETO
  //
  // TODAVÍA NO GRABAMOS NADA.
  // ===================================================

  let datosCMV:
    | {
        cuentaDebito: string;
        cuentaCredito: string;
        importe: number;
      }
    | null = null;

  if (
    formulario.operacion === 'VENTA' &&
    regla.cmv === 'SI' &&
    costosCMV.length > 0
  ) {
    // ------------------------------------------------
    // Buscar categoría de producto
    // ------------------------------------------------

    const {
      data: categoriaProducto,
      error: errorCategoria,
    } = await supabase
      .from('categorias_productos')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq(
        'nombre',
        formulario.categoria
      )
      .maybeSingle();

    if (errorCategoria) {
      throw errorCategoria;
    }

    if (!categoriaProducto) {
      throw new Error(
        `No se encontró la categoría de producto "${formulario.categoria}".`
      );
    }

    // ------------------------------------------------
    // Buscar cuentas Stock / CMV
    // ------------------------------------------------

    const {
      data: cuentasCategoria,
      error: errorCuentas,
    } = await supabase
      .from('categorias_productos_cuentas')
      .select(
        'cuenta_stock_id, cuenta_cmv_id'
      )
      .eq('empresa_id', empresaId)
      .eq(
        'categoria_producto_id',
        categoriaProducto.id
      )
      .eq('activo', true)
      .maybeSingle();

    if (errorCuentas) {
      throw errorCuentas;
    }

    if (!cuentasCategoria) {
      throw new Error(
        `No existe configuración de Stock/CMV para "${formulario.categoria}".`
      );
    }

    // ------------------------------------------------
    // Resolver cuentas del Plan de Cuentas
    // ------------------------------------------------

    const {
      data: cuentas,
      error: errorPlan,
    } = await supabase
      .from('plan_cuentas')
      .select(
        'id, codigo, nombre'
      )
      .in('id', [
        cuentasCategoria.cuenta_stock_id,
        cuentasCategoria.cuenta_cmv_id,
      ]);

    if (errorPlan) {
      throw errorPlan;
    }

    const cuentaCMV =
      cuentas?.find(
        (cuenta) =>
          cuenta.id ===
          cuentasCategoria.cuenta_cmv_id
      );

    const cuentaStock =
      cuentas?.find(
        (cuenta) =>
          cuenta.id ===
          cuentasCategoria.cuenta_stock_id
      );

    if (!cuentaCMV || !cuentaStock) {
      throw new Error(
        `No se pudieron resolver las cuentas contables de CMV/Stock para "${formulario.categoria}".`
      );
    }

    // ------------------------------------------------
    // Calcular importe CMV
    // ------------------------------------------------

    const importeCMV =
      costosCMV.reduce(
        (acumulado, linea) =>
          acumulado +
          linea.cantidad *
            linea.costoMedio,
        0
      );

    if (importeCMV <= 0) {
      throw new Error(
        'El importe calculado del CMV debe ser mayor que cero.'
      );
    }

    datosCMV = {
      cuentaDebito:
        cuentaCMV.nombre,
      cuentaCredito:
        cuentaStock.nombre,
      importe: importeCMV,
    };
  }

  // ===================================================
  // 4. GRABAR TODO
  //
  // Recién acá comenzamos a modificar la base.
  // ===================================================

  try {
    // -------------------------------------------------
    // REGISTRO DE OPERACIONES
    // -------------------------------------------------

    if (regla.libro === 'SI') {
      const { error } =
        await supabase
          .from('registro_operaciones')
          .insert({
            empresa_id: empresaId,
            id_operacion:
              idOperacion,
            fecha:
              formulario.fecha,
            operacion:
              formulario.operacion,
            categoria:
              formulario.categoria,
            forma_pago:
              formulario.formaPago,
            total,
            historico:
              formulario.historico,
            cliente_proveedor:
              formulario.clienteProveedor,
            socio:
              formulario.socio?.trim() || null,
            cuenta_debito:
              regla.cuenta_debito,
            cuenta_credito:
              regla.cuenta_credito,
            estado: 'PENDIENTE',
          });

      if (error) {
        throw error;
      }
    }

    // -------------------------------------------------
    // MOVIMIENTOS DE STOCK
    // -------------------------------------------------

    if (movimientos.length > 0) {
      const { error } =
        await supabase
          .from('movimientos_stock')
          .insert(movimientos);

      if (error) {
        throw error;
      }
    }

    // -------------------------------------------------
    // REGISTRO AUTOMÁTICO CMV
    // -------------------------------------------------

    if (datosCMV) {
      const { error } =
        await supabase
          .from('registros_automaticos')
          .insert({
            empresa_id:
              empresaId,
            id_operacion:
              idOperacion,
            tipo_registro:
              'CMV',
            fecha:
              formulario.fecha,
            cuenta_debito:
              datosCMV.cuentaDebito,
            cuenta_credito:
              datosCMV.cuentaCredito,
            importe:
              datosCMV.importe,
            historico:
              `CMV generado automáticamente - ${idOperacion}`,
            estado:
              'PENDIENTE',
          });

      if (error) {
        throw error;
      }
    }

    // =================================================
    // TODO SALIÓ CORRECTAMENTE
    // =================================================

    (async () => {
      try {
        const { data: empresaNotif } = await supabase
          .from('empresas')
          .select('nombre')
          .eq('id', empresaId)
          .maybeSingle();

        const nombreEmpresa = empresaNotif?.nombre ?? 'Un emprendedor';

        await notificarPendienteAlAdmin({
          titulo: `${nombreEmpresa} · Nueva operación pendiente`,
          cuerpo: `${formulario.operacion} · ${formulario.categoria} · Total: ${total.toFixed(2)}`,
        });
      } catch (errorNotificacion) {
        // Nunca debe romper el registro de la operación en sí — si
        // falla el aviso, solo se pierde la notificación push.
        console.warn('No se pudo notificar la operación pendiente:', errorNotificacion);
      }
    })();

    return {
      total,
      regla,
      idOperacion,
      cmv:
        datosCMV?.importe ?? 0,
    };
  } catch (error) {
    // =================================================
    // SI ALGO FALLA, REVERTIR LA OPERACIÓN
    // =================================================

    await limpiarOperacion(
      empresaId,
      idOperacion
    );

    throw error;
  }
}

// =====================================================
// ELIMINAR OPERACIÓN
// =====================================================

export async function eliminarOperacion(
  empresaId: string,
  idOperacion: string
) {
  const errores = await limpiarOperacion(
    empresaId,
    idOperacion
  );

  if (errores.length > 0) {
    throw new Error(
      `La operación ${idOperacion} se borró solo en parte — quedó pendiente: ${errores.join(', ')}. Revisalo con un administrador.`
    );
  }
}

// =====================================================
// EDITAR OPERACIÓN (admin)
//
// No existe un "UPDATE" quirúrgico posible acá: cambiar la
// categoría, la forma de pago o las cantidades puede cambiar qué
// cuentas corresponden y qué costo promedio aplica, así que la
// única forma correcta de editar es recalcular todo de cero. Se
// valida la regla ANTES de borrar nada (para no dejar el
// id_operacion vacío si los datos nuevos son inválidos), se borra
// lo viejo, y se vuelve a generar todo bajo el MISMO id_operacion
// — así el hilo conductor con Libro Diario, Registros Automáticos
// (CMV) y Movimientos de Stock no se pierde.
// =====================================================

export async function editarOperacion(
  empresaId: string,
  idOperacion: string,
  formulario: FormularioOperacion
) {
  const regla = await buscarRegla(
    empresaId,
    formulario.operacion.trim(),
    formulario.categoria.trim(),
    formulario.formaPago.trim()
  );

  if (!regla) {
    throw new Error(
      `No se encontró una regla contable para "${formulario.operacion}" / "${formulario.categoria}" / "${formulario.formaPago}". Revisá la Matriz de Operaciones antes de editar.`
    );
  }

  const erroresLimpieza = await limpiarOperacion(empresaId, idOperacion);

  if (erroresLimpieza.length > 0) {
    throw new Error(
      `No se pudo borrar por completo la versión anterior de ${idOperacion} (quedó pendiente: ${erroresLimpieza.join(', ')}) — se canceló la edición para no dejar datos duplicados. Revisalo con un administrador.`
    );
  }

  try {
    return await registrarOperacion(empresaId, formulario, idOperacion);
  } catch (error) {
    throw new Error(
      `La operación ${idOperacion} se borró para editarla pero no se pudo volver a generar (${
        error instanceof Error ? error.message : 'error desconocido'
      }). Cargala de nuevo manualmente con los datos correctos.`
    );
  }
}
