// lib/motor.ts
//
// EL MOTOR — el corazón de "Sabio".
// Es el equivalente exacto a tu función generarMatrizOperaciones()
// de Apps Script, pero acá lee y escribe en la base de datos real
// en vez de en una hoja de cálculo.
//
// Qué hace, paso a paso:
// 1. Lee las REGLAS_CONTABLES de la empresa (ej: "VENTA, MERCADERIA,
//    debe ir a Caja/PIX débito y Ventas crédito, sí mueve stock, sí
//    va al libro, sí genera CMV").
// 2. Lee los MEDIOS_FINANCIEROS disponibles (PIX, Efectivo, Cliente, etc).
// 3. Combina cada regla con cada medio financiero válido para armar
//    una "clave" única, ej: VENTA.MERCADERIA.PIX
// 4. Guarda el resultado en matriz_operaciones — esa tabla es la que
//    consulta la app cada vez que alguien registra una operación.

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

// Misma lógica que tenías en Apps Script: qué medios financieros
// son válidos para cada tipo de operación.
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

  // 3. Armar cada combinación válida
  const filas: Record<string, unknown>[] = [];

  for (const regla of (reglas as ReglaContable[]) ?? []) {
    const operacion = regla.operacion.trim().toUpperCase();
    const mediosValidos = mediosValidosParaOperacion(
      operacion,
      (medios as MedioFinanciero[]) ?? []
    );

    for (const medio of mediosValidos) {
      // Si el rol de débito/crédito dice "MEDIO_FINANCIERO", se resuelve
      // dinámicamente con el nombre del medio de pago elegido.
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

// Busca la regla exacta para una operación que se está registrando
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
  precio: number;
};

export type FormularioOperacion = {
  fecha: string;
  operacion: string;
  categoria: string;
  formaPago: string;
  historico: string;
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
    (suma, linea) => suma + linea.cantidad * linea.precio,
    0
  );

  if (total <= 0) {
    throw new Error('El total debe ser mayor que cero.');
  }

  const clave = `${formulario.operacion}.${formulario.categoria}.${formulario.formaPago}`;
  const regla = await buscarReglaPorClave(empresaId, clave);

  if (!regla) {
    throw new Error(
      `No se encontró una regla contable para la combinación "${clave}". ` +
        'Revisá la Matriz de Operaciones.'
    );
  }

  // 1. Registro de Operaciones (si la regla dice que va al libro)
  if (regla.libro === 'SI') {
    const { error } = await supabase.from('registro_operaciones').insert({
      empresa_id: empresaId,
      fecha: formulario.fecha,
      operacion: formulario.operacion,
      categoria: formulario.categoria,
      forma_pago: formulario.formaPago,
      total,
      historico: formulario.historico,
      cuenta_debito: regla.cuenta_debito,
      cuenta_credito: regla.cuenta_credito,
      estado: 'PENDIENTE',
    });

    if (error) throw error;
  }

  // 2. Movimientos de Stock (si la regla dice que mueve stock)
  if (regla.stock === 'SI') {
    const tipoMovimiento =
      formulario.operacion === 'COMPRA' ? 'ENTRADA' : 'SALIDA';

    const movimientos = formulario.lineas
      .filter((l) => l.producto && l.cantidad > 0)
      .map((l) => ({
        empresa_id: empresaId,
        fecha: formulario.fecha,
        tipo: tipoMovimiento,
        categoria: formulario.categoria,
        producto_id: l.producto,
        cantidad: l.cantidad,
        costo_unitario: l.precio,
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

// Borra una operación y TODO lo que generó, en cascada, usando el
// mismo id_operacion como hilo conductor (tal como se había planificado).
// Por ahora cubre: Registro de Operaciones y Movimientos de Stock.
// El Saldo de Stock no hay que tocarlo aparte: es una vista calculada
// a partir de movimientos_stock, así que se actualiza sola.
// Cuando se armen los "Registros Automáticos" (CMV), se agrega acá
// un tercer borrado por el mismo id_operacion.
export async function eliminarOperacion(empresaId: string, idOperacion: string) {
  const { error: errorStock } = await supabase
    .from('movimientos_stock')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id_operacion', idOperacion);

  if (errorStock) throw errorStock;

  const { error: errorRegistro } = await supabase
    .from('registro_operaciones')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id_operacion', idOperacion);

  if (errorRegistro) throw errorRegistro;
}

