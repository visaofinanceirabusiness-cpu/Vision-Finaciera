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

  // =====================================================
  // 1. REGISTRO DE OPERACIONES
  // =====================================================

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
        cliente_proveedor: formulario.clienteProveedor,
        cuenta_debito: regla.cuenta_debito,
        cuenta_credito: regla.cuenta_credito,
        estado: 'PENDIENTE',
      });

    if (error) throw error;
  }

  // =====================================================
  // 2. MOVIMIENTOS DE STOCK
  // =====================================================

  if (regla.stock === 'SI') {
    const tipoMovimiento =
      formulario.operacion === 'COMPRA'
        ? 'ENTRADA'
        : 'SALIDA';

    const movimientos = [];

    for (const linea of formulario.lineas) {
      if (!linea.producto || linea.cantidad <= 0) {
        continue;
      }

      let costoUnitario = linea.monto;

      // -------------------------------------------------
      // COMPRA
      // El monto ingresado es el costo de adquisición.
      // -------------------------------------------------

      if (formulario.operacion === 'COMPRA') {
        costoUnitario = linea.monto;
      }

      // -------------------------------------------------
      // VENTA
      // El monto ingresado es precio de venta.
      // Para stock necesitamos costo medio.
      // -------------------------------------------------

      if (formulario.operacion === 'VENTA') {
        const { data: entradas, error } = await supabase
          .from('movimientos_stock')
          .select('cantidad, costo_unitario')
          .eq('empresa_id', empresaId)
          .eq('producto_id', linea.producto)
          .eq('tipo', 'ENTRADA');

        if (error) throw error;

        const cantidadEntrada = (entradas ?? []).reduce(
          (total, movimiento) =>
            total + Number(movimiento.cantidad ?? 0),
          0
        );

        const valorEntrada = (entradas ?? []).reduce(
          (total, movimiento) =>
            total +
            Number(movimiento.cantidad ?? 0) *
              Number(movimiento.costo_unitario ?? 0),
          0
        );

        if (cantidadEntrada <= 0) {
          throw new Error(
            `No existe costo de compra para el producto seleccionado. Producto: ${linea.producto}`
          );
        }

        costoUnitario =
          valorEntrada / cantidadEntrada;
      }

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

    if (movimientos.length > 0) {
      const { error } = await supabase
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
