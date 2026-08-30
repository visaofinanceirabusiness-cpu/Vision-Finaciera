// lib/perfiles.ts
//
// INICIALIZACIÓN DE EMPRESA A PARTIR DE SU PERFIL
// =====================================================
//
// Copia el "plan maestro" del perfil de empresa (plan de cuentas,
// operaciones, formas de pago, categorías universales y reglas
// contables plantilla) a las tablas reales de una empresa puntual.
//
// Esto es lo que corre CONFIGURAÇÕES → Inicialização do Sistema la
// primera vez. Después de esto, la empresa ya tiene su Plano de
// Contas y puede empezar a dar de alta categorías de producto/gasto
// en CONFIGURAÇÕES → Categorias e Formas de Pagamento (eso es lo que
// crea las cuentas y reglas específicas de cada categoría, ver
// crearCategoriaProducto / crearCategoriaGasto más abajo).
//
// No genera la Matriz de Operações: eso sigue siendo un paso aparte
// (el botón de CONFIGURAÇÕES → Inicialização do Sistema, que llama a
// generarMatrizOperaciones() en motor.ts) y solo tiene sentido
// correrlo después de que el usuario haya dado de alta sus
// categorías reales de producto/gasto en la pestaña 2. Por eso esta
// función NO toca empresas.matriz_generada — ese campo lo marca
// exclusivamente generarMatrizInicial(), más abajo.

import { supabase } from './supabase';
import { crearObjetivosModelo } from './objetivos';

export async function empresaYaTieneEsqueleto(empresaId: string) {
  const { count, error } = await supabase
    .from('plan_cuentas')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId);

  if (error) {
    throw error;
  }

  return Boolean(count && count > 0);
}

export async function inicializarEmpresaDesdePerfil(
  empresaId: string,
  perfilEmpresaId: string,
  idioma: string
) {
  const yaTieneEsqueleto = await empresaYaTieneEsqueleto(empresaId);

  if (yaTieneEsqueleto) {
    throw new Error(
      'Esta empresa ya tiene un Plano de Contas cargado. No se puede volver a aplicar un perfil sobre una empresa existente.'
    );
  }

  const [
    { data: cuentasMaestro, error: errorCuentas },
    { data: operacionesMaestro, error: errorOperaciones },
    { data: formasPagoMaestro, error: errorFormasPago },
    { data: formasPagoOperacionMaestro, error: errorFPO },
    { data: categoriasOperacionMaestro, error: errorCatOp },
    { data: reglasMaestro, error: errorReglas },
  ] = await Promise.all([
    supabase.from('perfil_plan_cuentas_maestro').select('*').eq('perfil_empresa_id', perfilEmpresaId).eq('idioma', idioma),
    supabase.from('perfil_operaciones_maestro').select('*').eq('perfil_empresa_id', perfilEmpresaId).eq('idioma', idioma),
    supabase.from('perfil_formas_pago_maestro').select('*').eq('perfil_empresa_id', perfilEmpresaId).eq('idioma', idioma),
    supabase.from('perfil_formas_pago_operacion_maestro').select('*').eq('perfil_empresa_id', perfilEmpresaId).eq('idioma', idioma),
    supabase.from('perfil_categorias_operacion_maestro').select('*').eq('perfil_empresa_id', perfilEmpresaId).eq('idioma', idioma),
    supabase.from('perfil_reglas_contables_maestro').select('*').eq('perfil_empresa_id', perfilEmpresaId).eq('idioma', idioma),
  ]);

  const primerError =
    errorCuentas || errorOperaciones || errorFormasPago || errorFPO || errorCatOp || errorReglas;

  if (primerError) {
    throw primerError;
  }

  if (!cuentasMaestro || cuentasMaestro.length === 0) {
    throw new Error(
      `Todavía no existe un plan maestro cargado para este perfil en idioma "${idioma}". Avisale al administrador.`
    );
  }

  // ---------------------------------------------------
  // 1. PLAN DE CUENTAS
  //
  // Se inserta en dos pasadas: primero todas las cuentas sin padre,
  // para tener el id real de cada código; después se resuelve
  // cuenta_padre_id y se actualiza.
  // ---------------------------------------------------

  const filasCuentas = cuentasMaestro.map((c) => ({
    empresa_id: empresaId,
    codigo: c.codigo,
    nombre: c.nombre,
    naturaleza: c.naturaleza,
    tipo_saldo: c.tipo_saldo,
    clasificacion: c.clasificacion,
    rol_contable: c.rol_contable,
    activo: true,
    saldo_inicial: 0,
  }));

  const { data: cuentasCreadas, error: errorInsertCuentas } =
    await supabase.from('plan_cuentas').insert(filasCuentas).select('id, codigo');

  if (errorInsertCuentas) {
    throw errorInsertCuentas;
  }

  const idPorCodigo = new Map(
    (cuentasCreadas ?? []).map((c) => [c.codigo, c.id])
  );

  const actualizacionesPadre = cuentasMaestro
    .filter((c) => c.cuenta_padre_codigo)
    .map((c) => ({
      id: idPorCodigo.get(c.codigo),
      cuenta_padre_id: idPorCodigo.get(c.cuenta_padre_codigo as string),
    }))
    .filter((fila) => fila.id && fila.cuenta_padre_id);

  for (const fila of actualizacionesPadre) {
    const { error } = await supabase
      .from('plan_cuentas')
      .update({ cuenta_padre_id: fila.cuenta_padre_id })
      .eq('id', fila.id);

    if (error) {
      throw error;
    }
  }

  // ---------------------------------------------------
  // 2. OPERACIONES
  // ---------------------------------------------------

  const { data: operacionesCreadas, error: errorInsertOperaciones } =
    await supabase
      .from('operaciones')
      .insert(
        (operacionesMaestro ?? []).map((o) => ({
          empresa_id: empresaId,
          nombre: o.nombre,
          activo: true,
        }))
      )
      .select('id, nombre');

  if (errorInsertOperaciones) {
    throw errorInsertOperaciones;
  }

  const operacionIdPorNombre = new Map(
    (operacionesCreadas ?? []).map((o) => [o.nombre, o.id])
  );

  // ---------------------------------------------------
  // 3. FORMAS DE PAGO + SUS CUENTAS
  // ---------------------------------------------------

  const { data: formasPagoCreadas, error: errorInsertFormasPago } =
    await supabase
      .from('formas_pago')
      .insert(
        (formasPagoMaestro ?? []).map((f) => ({
          empresa_id: empresaId,
          codigo: f.codigo,
          nombre: f.nombre,
        }))
      )
      .select('id, codigo');

  if (errorInsertFormasPago) {
    throw errorInsertFormasPago;
  }

  const formaPagoIdPorCodigo = new Map(
    (formasPagoCreadas ?? []).map((f) => [f.codigo, f.id])
  );

  const filasFormaPagoCuentas = (formasPagoMaestro ?? [])
    .map((f) => ({
      empresa_id: empresaId,
      forma_pago_id: formaPagoIdPorCodigo.get(f.codigo),
      cuenta_id: idPorCodigo.get(f.cuenta_codigo),
      activo: true,
    }))
    .filter((fila) => fila.forma_pago_id && fila.cuenta_id);

  if (filasFormaPagoCuentas.length > 0) {
    const { error } = await supabase.from('forma_pago_cuentas').insert(filasFormaPagoCuentas);

    if (error) {
      throw error;
    }
  }

  // ---------------------------------------------------
  // 4. FORMAS DE PAGO VÁLIDAS POR OPERACIÓN
  // ---------------------------------------------------

  const filasFormasPagoOperacion = (formasPagoOperacionMaestro ?? [])
    .map((f) => ({
      empresa_id: empresaId,
      operacion_id: operacionIdPorNombre.get(f.operacion_nombre),
      forma_pago_id: formaPagoIdPorCodigo.get(f.forma_pago_codigo),
      activo: true,
    }))
    .filter((fila) => fila.operacion_id && fila.forma_pago_id);

  if (filasFormasPagoOperacion.length > 0) {
    const { error } = await supabase.from('formas_pago_operacion').insert(filasFormasPagoOperacion);

    if (error) {
      throw error;
    }
  }

  // ---------------------------------------------------
  // 5. CATEGORÍAS DE OPERACIÓN UNIVERSALES (Retiro, Aporte)
  // ---------------------------------------------------

  const { data: categoriasOperacionCreadas, error: errorInsertCatOp } =
    await supabase
      .from('categorias_operacion')
      .insert(
        (categoriasOperacionMaestro ?? []).map((c) => ({
          empresa_id: empresaId,
          operacion: c.operacion_nombre,
          codigo: c.codigo,
          nombre: c.nombre,
          tipo: c.tipo,
          activo: true,
        }))
      )
      .select('id, operacion, codigo');

  if (errorInsertCatOp) {
    throw errorInsertCatOp;
  }

  const catOpIdPorClave = new Map(
    (categoriasOperacionCreadas ?? []).map((c) => [`${c.operacion}.${c.codigo}`, c.id])
  );

  const filasCatOpCuentas = (categoriasOperacionMaestro ?? [])
    .map((c) => ({
      empresa_id: empresaId,
      categoria_operacion_id: catOpIdPorClave.get(`${c.operacion_nombre}.${c.codigo}`),
      cuenta_id: idPorCodigo.get(c.cuenta_codigo),
      rol: c.rol,
      activo: true,
    }))
    .filter((fila) => fila.categoria_operacion_id && fila.cuenta_id);

  if (filasCatOpCuentas.length > 0) {
    const { error } = await supabase.from('categorias_operacion_cuentas').insert(filasCatOpCuentas);

    if (error) {
      throw error;
    }
  }

  // ---------------------------------------------------
  // 6. REGLAS CONTABLES (las universales con categoría real;
  //    las plantilla de COMPRA/VENTA/PAGO/PERDIDA se guardan
  //    tal cual, con categoria_codigo/categoria_nombre en null,
  //    y se completan cuando el usuario crea sus categorías)
  // ---------------------------------------------------

  const filasReglas = (reglasMaestro ?? []).map((r) => ({
    empresa_id: empresaId,
    operacion: r.operacion_nombre,
    categoria_codigo: r.categoria_codigo,
    categoria_nombre: r.categoria_nombre,
    rol_debito: r.rol_debito,
    rol_credito: r.rol_credito,
    stock: r.stock,
    libro: r.libro,
    cmv: r.cmv,
    motor: r.motor,
  }));

  if (filasReglas.length > 0) {
    const { error } = await supabase.from('reglas_contables').insert(filasReglas);

    if (error) {
      throw error;
    }
  }

  // ---------------------------------------------------
  // 7. SEMBRAR LOS OBJETIVOS MODELO
  //
  // No tiene nada que ver con el Plano de Contas, pero es el mismo
  // momento en el que una empresa nueva queda lista para operar —
  // así arranca con sus 9 objetivos base (editables/borrables
  // después solo por un admin).
  // ---------------------------------------------------

  await crearObjetivosModelo(empresaId);

  return {
    cuentasCreadas: filasCuentas.length,
    operacionesCreadas: (operacionesCreadas ?? []).length,
    formasPagoCreadas: (formasPagoCreadas ?? []).length,
  };
}
