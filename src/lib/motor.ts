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
