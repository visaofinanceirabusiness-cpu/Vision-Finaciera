// lib/motor.ts
//
// EL MOTOR â€” el corazÃ³n de "Sabio".
// Es el equivalente exacto a tu funciÃ³n generarMatrizOperaciones()
// de Apps Script, pero acÃ¡ lee y escribe en la base de datos real
// en vez de en una hoja de cÃ¡lculo.
//
// QuÃ© hace, paso a paso:
// 1. Lee las REGLAS_CONTABLES de la empresa (ej: "VENTA, MERCADERIA,
//    debe ir a Caja/PIX dÃ©bito y Ventas crÃ©dito, sÃ­ mueve stock, sÃ­
//    va al libro, sÃ­ genera CMV").
// 2. Lee los MEDIOS_FINANCIEROS disponibles (PIX, Efectivo, Cliente, etc).
// 3. Combina cada regla con cada medio financiero vÃ¡lido para armar
//    una "clave" Ãºnica, ej: VENTA.MERCADERIA.PIX
// 4. Guarda el resultado en matriz_operaciones â€” esa tabla es la que
//    consulta la app cada vez que alguien registra una operaciÃ³n.

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

type MedioFinanciero = {
  codigo: string;
  nombre: string;
};

// Misma lÃ³gica que tenÃ­as en Apps Script: quÃ© medios financieros
// son vÃ¡lidos para cada tipo de operaciÃ³n.
function mediosValidosParaOperacion(
  operacion: string,
  medios: MedioFinanciero[]
): MedioFinanciero[] {
  return medios.filter((medio) => {
    const codigo = medio.codigo.toUpperCase();

    if (codigo === 'PIX' || codigo === 'DIN') return true;
    if (codigo === 'CLI' && (operacion === 'VENTA' || operacion === 'SERVICIO'))
      return true;
    if (codigo === 'PRO' && operacion === 'COMPRA') return true;

    return false;
  });
}

export async function generarMatrizOperaciones(empresaId: string) {
  // 1. Leer reglas contables de esta empresa
  const { data: reglas, error: errorReglas } = await supabase
    .from('reglas_contables')
    .select('*')
    .eq('empresa_id', empresaId);

  if (errorReglas) throw errorReglas;

  // 2. Leer medios financieros de esta empresa
  const { data: medios, error: errorMedios } = await supabase
    .from('medios_financieros')
    .select('*')
    .eq('empresa_id', empresaId);

  if (errorMedios) throw errorMedios;

  // 3. Armar cada combinaciÃ³n vÃ¡lida
  const filas: Record<string, unknown>[] = [];

  for (const regla of (reglas as ReglaContable[]) ?? []) {
    const operacion = regla.operacion.trim().toUpperCase();
    const mediosValidos = mediosValidosParaOperacion(
      operacion,
      (medios as MedioFinanciero[]) ?? []
    );

    for (const medio of mediosValidos) {
      // Si el rol de dÃ©bito/crÃ©dito dice "MEDIO_FINANCIERO", se resuelve
      // dinÃ¡micamente con el nombre del medio de pago elegido.
      const cuentaDebito =
        regla.rol_debito === 'MEDIO_FINANCIERO' ? medio.nombre : regla.rol_debito;

      const cuentaCredito =
        regla.rol_credito === 'MEDIO_FINANCIERO' ? medio.nombre : regla.rol_credito;

      const clave = `${regla.operacion}.${regla.categoria_codigo ?? ''}.${medio.codigo}`;

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

  // 4. Reemplazar la matriz anterior de esta empresa por la nueva
  const { error: errorBorrar } = await supabase
    .from('matriz_operaciones')
    .delete()
    .eq('empresa_id', empresaId);

  if (errorBorrar) throw errorBorrar;

  if (filas.length > 0) {
    const { error: errorInsertar } = await supabase
      .from('matriz_operaciones')
      .insert(filas);

    if (errorInsertar) throw errorInsertar;
  }

  return { reglasGeneradas: filas.length };
}

// Busca la regla exacta para una operaciÃ³n que se estÃ¡ registrando
// (equivalente a buscarReglaCatalogo(clave) de Apps Script)
export async function buscarReglaPorClave(empresaId: string, clave: string) {
  const { data, error } = await supabase
    .from('matriz_operaciones')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('clave', clave)
    .maybeSingle();

  if (error) throw error;
  return data;
}

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

// Equivalente a registrarOperacion() de Apps Script: busca la regla,
// guarda el Registro de Operaciones y, si corresponde, los Movimientos
// de Stock.
export async function registrarOperacion(
  empresaId: string,
  formulario: FormularioOperacion
) {
  const total = formulario.lineas.reduce(
    (suma, linea) => suma + linea.cantidad * linea.monto,
    0
  );

  if (total <= 0) {
    throw new Error('El total debe ser mayor que cero.');
  }

  const clave = `${formulario.operacion}.${formulario.categoria}.${formulario.formaPago}`;
  const regla = await buscarReglaPorClave(empresaId, clave);

  if (!regla) {
    throw new Error(
      `No se encontrÃ³ una regla contable para la combinaciÃ³n "${clave}". ` +
        'RevisÃ¡ la Matriz de Operaciones.'
    );
  }

  const tipoMovimiento = formulario.operacion === 'COMPRA' ? 'ENTRADA' : 'SALIDA';
  if (regla.stock === 'SI' && tipoMovimiento === 'SALIDA') {
    if (formulario.lineas.some((linea) => !linea.producto || linea.cantidad <= 0)) {
      throw new Error('Cada renglÃ³n de una salida debe tener producto y cantidad vÃ¡lida.');
    }

    const cantidadesPorProducto = formulario.lineas.reduce((acumulado, linea) => {
      if (linea.producto && linea.cantidad > 0) {
        acumulado.set(linea.producto, (acumulado.get(linea.producto) ?? 0) + linea.cantidad);
      }
      return acumulado;
    }, new Map<string, number>());

    const { data: saldos, error: errorLecturaStock } = await supabase
      .from('saldo_stock')
      .select('producto_id, saldo')
      .eq('empresa_id', empresaId)
      .in('producto_id', Array.from(cantidadesPorProducto.keys()));

    if (errorLecturaStock) throw errorLecturaStock;

    const saldoPorProducto = new Map(
      (saldos ?? []).map((fila) => [fila.producto_id, Number(fila.saldo ?? 0)])
    );
    const faltante = Array.from(cantidadesPorProducto.entries()).find(
      ([productoId, cantidad]) => (saldoPorProducto.get(productoId) ?? 0) < cantidad
    );

    if (faltante) {
      const saldoDisponible = saldoPorProducto.get(faltante[0]) ?? 0;
      throw new Error(
        `Stock insuficiente para el producto seleccionado. Disponible: ${saldoDisponible}; solicitado: ${faltante[1]}.`
      );
    }
  }

  const { data: registrosExistentes, error: errorLecturaIds } = await supabase
    .from('registro_operaciones')
    .select('id_operacion')
    .eq('empresa_id', empresaId)
    .not('id_operacion', 'is', null);

  if (errorLecturaIds) throw errorLecturaIds;

  const mayorId = (registrosExistentes ?? []).reduce((mayor, registro) => {
    const numero = Number(String(registro.id_operacion ?? '').replace('OP-', ''));
    return Number.isFinite(numero) ? Math.max(mayor, numero) : mayor;
  }, 0);
  const idOperacion = `OP-${String(mayorId + 1).padStart(5, '0')}`;

  // 1. Registro de Operaciones (si la regla dice que va al libro)
  if (regla.libro === 'SI') {
    const { error } = await supabase.from('registro_operaciones').insert({
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

  // 2. Movimientos de Stock (si la regla dice que mueve stock)
  if (regla.stock === 'SI') {
    const movimientos = formulario.lineas
      .filter((linea) => linea.producto && linea.cantidad > 0)
      .map((linea) => ({
        empresa_id: empresaId,
        id_operacion: idOperacion,
        fecha: formulario.fecha,
        tipo: tipoMovimiento,
        categoria: formulario.categoria,
        producto_id: linea.producto,
        cantidad: linea.cantidad,
        costo_unitario: linea.monto,
        historico: formulario.historico,
        estado: 'PENDIENTE',
      }));

    if (movimientos.length > 0) {
      const { error } = await supabase
        .from('movimientos_stock')
        .insert(movimientos);

      if (error) throw error;
    }
  }

  return { total, regla };
}

