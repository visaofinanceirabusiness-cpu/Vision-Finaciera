// lib/motor.ts
//
// EL MOTOR — el corazón de "Sabio".
// Lee las reglas configuradas para cada empresa.
// Genera la matriz y registra las operaciones.
// Mantiene un mismo id_operacion como hilo conductor.

import { supabase } from './supabase';

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

type MedioFinanciero = {
  codigo: string;
  nombre: string;
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
  lineas: LineaOperacion[];
};

// =====================================================
// MEDIOS VÁLIDOS POR OPERACIÓN
// =====================================================

function mediosValidosParaOperacion(
  operacion: string,
  medios: MedioFinanciero[]
): MedioFinanciero[] {
  return medios.filter((medio) => {
    const codigo = medio.codigo.toUpperCase();

    if (codigo === 'PIX' || codigo === 'DIN') {
      return true;
    }

    if (
      codigo === 'CLI' &&
      (operacion === 'VENTA' || operacion === 'SERVICIO')
    ) {
      return true;
    }

    if (codigo === 'PRO' && operacion === 'COMPRA') {
      return true;
    }

    return false;
  });
}

// =====================================================
// GENERAR MATRIZ DE OPERACIONES
// =====================================================

export async function generarMatrizOperaciones(
  empresaId: string
) {
  // 1. Leer reglas contables
  const { data: reglas, error: errorReglas } = await supabase
    .from('reglas_contables')
    .select('*')
    .eq('empresa_id', empresaId);

  if (errorReglas) {
    throw errorReglas;
  }

  // 2. Leer medios financieros
  const { data: medios, error: errorMedios } = await supabase
    .from('medios_financieros')
    .select('*')
    .eq('empresa_id', empresaId);

  if (errorMedios) {
    throw errorMedios;
  }

  // 3. Construir combinaciones
  const filas: Record<string, unknown>[] = [];

  for (const regla of (reglas as ReglaContable[]) ?? []) {
    const operacion = regla.operacion
      .trim()
      .toUpperCase();

    const mediosValidos = mediosValidosParaOperacion(
      operacion,
      (medios as MedioFinanciero[]) ?? []
    );

    for (const medio of mediosValidos) {
      const cuentaDebito =
        regla.rol_debito === 'MEDIO_FINANCIERO'
          ? medio.nombre
          : regla.rol_debito;

      const cuentaCredito =
        regla.rol_credito === 'MEDIO_FINANCIERO'
          ? medio.nombre
          : regla.rol_credito;

      const clave =
        `${regla.operacion}.${regla.categoria_codigo ?? ''}.${medio.codigo}`;

      filas.push({
        empresa_id: empresaId,
        clave,
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

  // 4. Eliminar matriz anterior de esta empresa
  const { error: errorBorrar } = await supabase
    .from('matriz_operaciones')
    .delete()
    .eq('empresa_id', empresaId);

  if (errorBorrar) {
    throw errorBorrar;
  }

  // 5. Insertar nueva matriz
  if (filas.length > 0) {
    const { error: errorInsertar } = await supabase
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
// REGISTRAR OPERACIÓN
// =====================================================

export async function registrarOperacion(
  empresaId: string,
  formulario: FormularioOperacion
) {
  // ---------------------------------------------------
  // TOTAL DE LA OPERACIÓN
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // BUSCAR REGLA
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // ID ÚNICO
  // ---------------------------------------------------

  const idOperacion =
    await generarIdOperacion(empresaId);

  // ===================================================
  // 1. REGISTRO DE OPERACIONES
  // ===================================================

  if (regla.libro === 'SI') {
    const { error } = await supabase
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

    if (error) {
      throw error;
    }
  }

  // ===================================================
  // 2. MOVIMIENTOS DE STOCK
  // ===================================================

  if (regla.stock === 'SI') {
    const tipoMovimiento =
      formulario.operacion === 'COMPRA'
        ? 'ENTRADA'
        : 'SALIDA';

    const movimientos: Record<
      string,
      unknown
    >[] = [];

    for (const linea of formulario.lineas) {
      if (
        !linea.producto ||
        linea.cantidad <= 0
      ) {
        continue;
      }

      let costoUnitario = linea.monto;

      // -------------------------------------------------
      // COMPRA
      // El monto ingresado representa el costo.
      // -------------------------------------------------

      if (
        formulario.operacion === 'COMPRA'
      ) {
        costoUnitario = linea.monto;
      }

      // -------------------------------------------------
      // VENTA
      // El monto ingresado es precio de venta.
      // Para stock utilizamos costo medio.
      // -------------------------------------------------

      if (
        formulario.operacion === 'VENTA'
      ) {
        const {
          data: entradas,
          error,
        } = await supabase
          .from('movimientos_stock')
          .select(
            'cantidad, costo_unitario'
          )
          .eq('empresa_id', empresaId)
          .eq(
            'producto_id',
            linea.producto
          )
          .eq('tipo', 'ENTRADA');

        if (error) {
          throw error;
        }

        const cantidadEntrada =
          (entradas ?? []).reduce(
            (acumulado, movimiento) =>
              acumulado +
              Number(
                movimiento.cantidad ?? 0
              ),
            0
          );

        const valorEntrada =
          (entradas ?? []).reduce(
            (acumulado, movimiento) =>
              acumulado +
              Number(
                movimiento.cantidad ?? 0
              ) *
              Number(
                movimiento.costo_unitario ?? 0
              ),
            0
          );

        if (cantidadEntrada <= 0) {
          throw new Error(
            `No existe costo de compra para el producto seleccionado. Producto: ${linea.producto}`
          );
        }

        costoUnitario =
          valorEntrada /
          cantidadEntrada;
      }

      // -------------------------------------------------
      // ARMAR MOVIMIENTO
      // -------------------------------------------------

      movimientos.push({
        empresa_id: empresaId,
        id_operacion: idOperacion,
        fecha: formulario.fecha,
        tipo: tipoMovimiento,
        categoria: formulario.categoria,
        producto_id: linea.producto,
        cantidad: linea.cantidad,
        costo_unitario: costoUnitario,
        historico: formulario.historico,
        estado: 'PENDIENTE',
      });
    }

    // -------------------------------------------------
    // GUARDAR MOVIMIENTOS
    // -------------------------------------------------

    if (movimientos.length > 0) {
      const { error } = await supabase
        .from('movimientos_stock')
        .insert(movimientos);

      if (error) {
        throw error;
      }
    }
  }

  return {
    total,
    regla,
    idOperacion,
  };
}

// =====================================================
// ELIMINAR OPERACIÓN
// =====================================================
//
// Elimina todos los movimientos relacionados con el
// mismo id_operacion y luego elimina el registro.
//
// Más adelante agregaremos aquí los registros
// automáticos de CMV para mantener la eliminación
// completamente vinculada por id_operacion.
//

export async function eliminarOperacion(
  empresaId: string,
  idOperacion: string
) {
  // 1. Eliminar movimientos de stock
  const {
    error: errorStock,
  } = await supabase
    .from('movimientos_stock')
    .delete()
    .eq('empresa_id', empresaId)
    .eq(
      'id_operacion',
      idOperacion
    );

  if (errorStock) {
    throw errorStock;
  }

  // 2. Eliminar registro de operación
  const {
    error: errorRegistro,
  } = await supabase
    .from('registro_operaciones')
    .delete()
    .eq('empresa_id', empresaId)
    .eq(
      'id_operacion',
      idOperacion
    );

  if (errorRegistro) {
    throw errorRegistro;
  }
}
