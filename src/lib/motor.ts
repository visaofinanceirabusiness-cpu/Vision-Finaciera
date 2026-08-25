// lib/motor.ts
//
// EL MOTOR — corazón Configuration Driven de Sabio.
//
// Lee exclusivamente la configuración de cada empresa:
//
// reglas_contables
// formas_pago
// formas_pago_operacion
// forma_pago_cuentas
// categorias_productos_cuentas
// categorias_operacion_cuentas
//
// y genera automáticamente matriz_operaciones.
//
// Ninguna cuenta contable está hardcodeada.
// Todo se resuelve mediante configuración.

import { supabase } from './supabase';

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

type Operacion = {
  id: string;
  nombre: string;
};

type FormaPago = {
  id: string;
  codigo: string;
  nombre: string;
};

type FormaPagoOperacion = {
  operacion_id: string;
  forma_pago_id: string;
};

type FormaPagoCuenta = {
  forma_pago_id: string;
  cuenta_id: string;
};

type CategoriaProducto = {
  id: string;
  codigo: string;
};

type CategoriaProductoCuenta = {
  categoria_producto_id: string;
  cuenta_stock_id: string;
  cuenta_ingreso_id: string;
  cuenta_cmv_id: string;
};

type CategoriaOperacion = {
  id: string;
  operacion: string;
  codigo: string;
};

type CategoriaOperacionCuenta = {
  categoria_operacion_id: string;
  cuenta_id: string;
  rol: string;
};

type Cuenta = {
  id: string;
  nombre: string;
};

type LineaOperacion = {
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
  lineas: LineaOperacion[];
};

function claveCategoriaOperacion(operacion: string, codigo: string) {
  return `${operacion}.${codigo}`;
}

function claveCategoriaProducto(codigo: string) {
  return codigo;
}

function claveFormaPagoOperacion(operacionId: string, formaPagoId: string) {
  return `${operacionId}.${formaPagoId}`;
}

function normalizar(texto: string | null | undefined) {
  return String(texto ?? '').trim().toUpperCase();
}

export async function generarMatrizOperaciones(empresaId: string) {

  // =====================================================
  // 1. CARGAR TODA LA CONFIGURACIÓN
  // =====================================================

  const [
    reglasRes,
    operacionesRes,
    formasPagoRes,
    formasPagoOperacionRes,
    formasPagoCuentasRes,
    categoriasProductoRes,
    categoriasProductoCuentasRes,
    categoriasOperacionRes,
    categoriasOperacionCuentasRes,
    cuentasRes,
  ] = await Promise.all([

    supabase
      .from('reglas_contables')
      .select('*')
      .eq('empresa_id', empresaId),

    supabase
      .from('operaciones')
      .select('id,nombre')
      .eq('empresa_id', empresaId),

    supabase
      .from('formas_pago')
      .select('id,codigo,nombre')
      .eq('empresa_id', empresaId),

    supabase
      .from('formas_pago_operacion')
      .select('operacion_id,forma_pago_id')
      .eq('empresa_id', empresaId)
      .eq('activo', true),

    supabase
      .from('forma_pago_cuentas')
      .select('forma_pago_id,cuenta_id')
      .eq('empresa_id', empresaId)
      .eq('activo', true),

    supabase
      .from('categorias_productos')
      .select('id,codigo')
      .eq('empresa_id', empresaId),

    supabase
      .from('categorias_productos_cuentas')
      .select('categoria_producto_id,cuenta_stock_id,cuenta_ingreso_id,cuenta_cmv_id')
      .eq('empresa_id', empresaId)
      .eq('activo', true),

    supabase
      .from('categorias_operacion')
      .select('id,operacion,codigo')
      .eq('empresa_id', empresaId),

    supabase
      .from('categorias_operacion_cuentas')
      .select('categoria_operacion_id,cuenta_id,rol')
      .eq('empresa_id', empresaId)
      .eq('activo', true),

    supabase
      .from('plan_cuentas')
      .select('id,nombre')
      .eq('empresa_id', empresaId)
      .eq('activo', true),
  ]);

  const respuestas = [
    reglasRes,
    operacionesRes,
    formasPagoRes,
    formasPagoOperacionRes,
    formasPagoCuentasRes,
    categoriasProductoRes,
    categoriasProductoCuentasRes,
    categoriasOperacionRes,
    categoriasOperacionCuentasRes,
    cuentasRes,
  ];

  for (const respuesta of respuestas) {
    if (respuesta.error) throw respuesta.error;
  }

  const reglas = (reglasRes.data ?? []) as ReglaContable[];
  const operaciones = (operacionesRes.data ?? []) as Operacion[];
  const formasPago = (formasPagoRes.data ?? []) as FormaPago[];
  const formasPagoOperacion =
    (formasPagoOperacionRes.data ?? []) as FormaPagoOperacion[];
  const formasPagoCuentas =
    (formasPagoCuentasRes.data ?? []) as FormaPagoCuenta[];
  const categoriasProducto =
    (categoriasProductoRes.data ?? []) as CategoriaProducto[];
  const categoriasProductoCuentas =
    (categoriasProductoCuentasRes.data ?? []) as CategoriaProductoCuenta[];
  const categoriasOperacion =
    (categoriasOperacionRes.data ?? []) as CategoriaOperacion[];
  const categoriasOperacionCuentas =
    (categoriasOperacionCuentasRes.data ?? []) as CategoriaOperacionCuenta[];
  const cuentas = (cuentasRes.data ?? []) as Cuenta[];

  // =====================================================
  // 2. MAPAS DE RESOLUCIÓN
  // =====================================================

  const operacionPorNombre = new Map<string, Operacion>();

  for (const op of operaciones) {
    operacionPorNombre.set(normalizar(op.nombre), op);
  }

  const formaPorId = new Map<string, FormaPago>();

  for (const fp of formasPago) {
    formaPorId.set(fp.id, fp);
  }

  const formasPorOperacion = new Map<string, FormaPago[]>();

  for (const relacion of formasPagoOperacion) {

    const forma = formaPorId.get(relacion.forma_pago_id);

    if (!forma) continue;

    const lista =
      formasPorOperacion.get(relacion.operacion_id) ?? [];

    lista.push(forma);

    formasPorOperacion.set(
      relacion.operacion_id,
      lista
    );
  }

  const cuentaPorId = new Map<string, string>();

  for (const cuenta of cuentas) {
    cuentaPorId.set(cuenta.id, cuenta.nombre);
  }

  const cuentaFormaPago = new Map<string, string>();

  for (const relacion of formasPagoCuentas) {

    const cuenta = cuentaPorId.get(relacion.cuenta_id);

    if (!cuenta) continue;

    cuentaFormaPago.set(
      relacion.forma_pago_id,
      cuenta
    );
  }

  const categoriaProductoPorCodigo =
    new Map<string, CategoriaProducto>();

  for (const categoria of categoriasProducto) {
    categoriaProductoPorCodigo.set(
      normalizar(categoria.codigo),
      categoria
    );
  }

  const cuentasCategoriaProducto =
    new Map<string, CategoriaProductoCuenta>();

  for (const relacion of categoriasProductoCuentas) {

    const categoria = categoriasProducto.find(
      c => c.id === relacion.categoria_producto_id
    );

    if (!categoria) continue;

    cuentasCategoriaProducto.set(
      claveCategoriaProducto(normalizar(categoria.codigo)),
      relacion
    );
  }

  const categoriaOperacionPorClave =
    new Map<string, CategoriaOperacion>();

  for (const categoria of categoriasOperacion) {

    categoriaOperacionPorClave.set(
      claveCategoriaOperacion(
        normalizar(categoria.operacion),
        normalizar(categoria.codigo)
      ),
      categoria
    );
  }

  const cuentasCategoriaOperacion =
    new Map<string, CategoriaOperacionCuenta>();

  for (const relacion of categoriasOperacionCuentas) {

    const categoria = categoriasOperacion.find(
      c => c.id === relacion.categoria_operacion_id
    );

    if (!categoria) continue;

    cuentasCategoriaOperacion.set(
      `${claveCategoriaOperacion(
        normalizar(categoria.operacion),
        normalizar(categoria.codigo)
      )}.${normalizar(relacion.rol)}`,
      relacion
    );
  }

  // =====================================================
  // 3. RESOLVER ROLES
  // =====================================================

  function resolverCuenta(
    rol: string,
    regla: ReglaContable,
    formaPago?: FormaPago
  ) {

    const rolNormal = normalizar(rol);

    // MEDIO FINANCIERO
    if (rolNormal === 'MEDIO_FINANCIERO') {

      if (!formaPago) {
        throw new Error(
          `La regla ${regla.operacion}/${regla.categoria_codigo} requiere forma de pago.`
        );
      }

      const cuenta = cuentaFormaPago.get(formaPago.id);

      if (!cuenta) {
        throw new Error(
          `No existe cuenta configurada para la forma de pago ${formaPago.nombre}.`
        );
      }

      return cuenta;
    }

    // CATEGORÍA PRODUCTO
    if (
      rolNormal === 'STOCK_CATEGORIA' ||
      rolNormal === 'INGRESO_CATEGORIA' ||
      rolNormal === 'CMV_CATEGORIA'
    ) {

      const codigo = normalizar(regla.categoria_codigo);

      const relacion =
        cuentasCategoriaProducto.get(
          claveCategoriaProducto(codigo)
        );

      if (!relacion) {
        throw new Error(
          `No existe configuración contable para la categoría ${codigo}.`
        );
      }

      if (rolNormal === 'STOCK_CATEGORIA') {
        return cuentaPorId.get(relacion.cuenta_stock_id) ?? '';
      }

      if (rolNormal === 'INGRESO_CATEGORIA') {
        return cuentaPorId.get(relacion.cuenta_ingreso_id) ?? '';
      }

      return cuentaPorId.get(relacion.cuenta_cmv_id) ?? '';
    }

    // CATEGORÍAS OPERACIÓN
    const mapaRol: Record<string, string> = {
      GASTO_CATEGORIA: 'GASTO',
      APORTE_SOCIA: 'APORTE',
      RETIRO_PERSONAL: 'RETIRO',
      PERDIDA_STOCK: 'PERDIDA',
    };

    const rolBusqueda = mapaRol[rolNormal];

    if (rolBusqueda) {

      const clave =
        `${claveCategoriaOperacion(
          normalizar(regla.operacion),
          normalizar(regla.categoria_codigo ?? '')
        )}.${rolBusqueda}`;

      const relacion =
        cuentasCategoriaOperacion.get(clave);

      if (!relacion) {
        throw new Error(
          `No existe cuenta para ${regla.operacion}/${regla.categoria_codigo} rol ${rolBusqueda}.`
        );
      }

      return cuentaPorId.get(relacion.cuenta_id) ?? '';
    }

    throw new Error(
      `Rol contable desconocido: ${rol}`
    );
  }

  // =====================================================
  // 4. GENERAR MATRIZ
  // =====================================================

  const filas: Record<string, unknown>[] = [];

  for (const regla of reglas) {

    const operacionNombre =
      normalizar(regla.operacion);

    const operacion =
      operacionPorNombre.get(operacionNombre);

    if (!operacion) {
      throw new Error(
        `No existe la operación ${regla.operacion}.`
      );
    }

    const formas =
      formasPorOperacion.get(operacion.id) ?? [];

    const usaMedio =
      normalizar(regla.rol_debito) === 'MEDIO_FINANCIERO' ||
      normalizar(regla.rol_credito) === 'MEDIO_FINANCIERO';

    // -----------------------------------------------
    // OPERACIONES CON MEDIO FINANCIERO
    // -----------------------------------------------

    if (usaMedio) {

      for (const forma of formas) {

        const cuentaDebito =
          resolverCuenta(
            regla.rol_debito,
            regla,
            forma
          );

        const cuentaCredito =
          resolverCuenta(
            regla.rol_credito,
            regla,
            forma
          );

        filas.push({

          empresa_id: empresaId,

          clave:
            `${regla.operacion}.${regla.categoria_codigo ?? ''}.${forma.codigo}`,

          operacion: regla.operacion,

          categoria: regla.categoria_nombre,

          forma_pago: forma.nombre,

          cuenta_debito: cuentaDebito,

          cuenta_credito: cuentaCredito,

          stock: regla.stock,

          libro: regla.libro,

          cmv: regla.cmv,

          motor: regla.motor,

        });
      }

      continue;
    }

    // -----------------------------------------------
    // OPERACIONES SIN MEDIO
    // Ejemplo: PERDIDA
    // -----------------------------------------------

    const cuentaDebito =
      resolverCuenta(
        regla.rol_debito,
        regla
      );

    const cuentaCredito =
      resolverCuenta(
        regla.rol_credito,
        regla
      );

    filas.push({

      empresa_id: empresaId,

      clave:
        `${regla.operacion}.${regla.categoria_codigo ?? ''}.AJU`,

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
  }

  // =====================================================
  // 5. REEMPLAZAR MATRIZ
  // =====================================================

  const { error: errorBorrar } = await supabase
    .from('matriz_operaciones')
    .delete()
    .eq('empresa_id', empresaId);

  if (errorBorrar) throw errorBorrar;

  if (filas.length > 0) {

    const { error: errorInsertar } =
      await supabase
        .from('matriz_operaciones')
        .insert(filas);

    if (errorInsertar) throw errorInsertar;
  }

  return {
    reglasGeneradas: filas.length,
  };
}

// =======================================================
// BUSCAR REGLA
// =======================================================

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

  if (error) throw error;

  return data;
}

// =======================================================
// ID OPERACIÓN
// =======================================================

async function generarIdOperacion(
  empresaId: string
) {

  const { data, error } = await supabase
    .from('registro_operaciones')
    .select('id_operacion')
    .eq('empresa_id', empresaId);

  if (error) throw error;

  const numeros = (data ?? [])
    .map((fila) =>
      parseInt(
        String(fila.id_operacion ?? '').replace('OP-', ''),
        10
      )
    )
    .filter(
      (n) => !Number.isNaN(n)
    );

  const siguiente =
    numeros.length > 0
      ? Math.max(...numeros) + 1
      : 1;

  return `OP-${String(siguiente).padStart(5, '0')}`;
}

// =======================================================
// REGISTRAR OPERACIÓN
// =======================================================

export async function registrarOperacion(
  empresaId: string,
  formulario: FormularioOperacion
) {

  const total = formulario.lineas.reduce(
    (suma, linea) =>
      suma + linea.cantidad * linea.monto,
    0
  );

  if (total <= 0) {
    throw new Error(
      'El total debe ser mayor que cero.'
    );
  }

  const regla = await buscarRegla(
    empresaId,
    formulario.operacion,
    formulario.categoria,
    formulario.formaPago
  );

  if (!regla) {

    throw new Error(
      `No se encontró una regla contable para "${formulario.operacion}" / "${formulario.categoria}" / "${formulario.formaPago}". Revisá la Matriz de Operaciones.`
    );
  }

  const idOperacion =
    await generarIdOperacion(empresaId);

  if (regla.libro === 'SI') {

    const { error } =
      await supabase
        .from('registro_operaciones')
        .insert({

          empresa_id: empresaId,

          id_operacion: idOperacion,

          fecha: formulario.fecha,

          operacion: formulario.operacion,

          categoria: formulario.categoria,

          forma_pago: formulario.formaPago,

          total,

          historico: formulario.historico,

          cliente_proveedor:
            formulario.clienteProveedor,

          cuenta_debito:
            regla.cuenta_debito,

          cuenta_credito:
            regla.cuenta_credito,

          estado: 'PENDIENTE',

        });

    if (error) throw error;
  }

  if (regla.stock === 'SI') {

    const tipoMovimiento =
      formulario.operacion === 'COMPRA'
        ? 'ENTRADA'
        : 'SALIDA';

    const movimientos =
      formulario.lineas
        .filter(
          (l) =>
            l.producto &&
            l.cantidad > 0
        )
        .map((l) => ({

          empresa_id: empresaId,

          id_operacion: idOperacion,

          fecha: formulario.fecha,

          tipo: tipoMovimiento,

          categoria: formulario.categoria,

          producto_id: l.producto,

          cantidad: l.cantidad,

          costo_unitario: l.monto,

          historico: formulario.historico,

          estado: 'PENDIENTE',

        }));

    if (movimientos.length > 0) {

      const { error } =
        await supabase
          .from('movimientos_stock')
          .insert(movimientos);

      if (error) throw error;
    }
  }

  return {
    total,
    regla,
    idOperacion,
  };
}

// =======================================================
// ELIMINAR OPERACIÓN
// =======================================================

export async function eliminarOperacion(
  empresaId: string,
  idOperacion: string
) {

  const { error: errorStock } =
    await supabase
      .from('movimientos_stock')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id_operacion', idOperacion);

  if (errorStock) throw errorStock;

  const { error: errorRegistro } =
    await supabase
      .from('registro_operaciones')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id_operacion', idOperacion);

  if (errorRegistro) throw errorRegistro;
}
