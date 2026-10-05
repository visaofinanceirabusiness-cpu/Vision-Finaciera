// lib/cuentasCompromiso.ts
//
// CUENTAS ESPECÍFICAS DE LOS COMPROMISOS (Compromisos Fase 2)
// =====================================================
//
// Cada gasto/ingreso recurrente que se devenga mes a mes tiene su
// PROPIA cuenta ("Alquiler Santihno a pagar", "Casita a cobrar"), así
// se sabe cuánto se debe/cobra de cada cosa. Opcionalmente cuelga de un
// GRUPO ("Alquileres a pagar"): una cuenta contenedora del plan bajo la
// que quedan las individuales — los informes leen las individuales y el
// grupo las conecta.
//
//   Pasivo  → cuenta + forma de pago (Gasto / A pagar) + categoría de
//             liquidación (A pagar / Banco), igual que crearPasivo.
//   Activo  → cuenta + forma de pago (A cobrar / Ingreso) + categoría de
//             liquidación (Banco / A cobrar), igual que una cuenta a
//             cobrar creada desde la Central de Lanzamientos.
//
// Todo se referencia por ID (la forma de pago) y los nombres se
// resuelven al usarlos: así un renombrado nunca deja un pago apuntando
// a un nombre viejo. Nada se borra: una cuenta que ya no se usa se
// desactiva (ver liberarCuentaSiCorresponde).

import { supabase } from './supabase';
import {
  buscarCuentaContenedora,
  buscarContenedorPorEjemploPasivo,
  crearCuentaHija,
  crearCuentaParaMedioPago,
  crearFormaPago,
  habilitarLiquidacionCuentaCobrar,
  habilitarLiquidacionCuentaPagar,
  renombrarCuentaPlan,
  renombrarFormaPago,
  siguienteCodigoDeCuenta,
} from './categorias';
import { generarMatrizOperaciones } from './motor';
import {
  nombreCuentaCompromiso,
  nombreYaExiste,
  siguienteSegmentoLibre,
  codigoDeGrupo,
  type LadoCompromiso,
} from './cuentasCompromisoNombres';

export type { LadoCompromiso };

// Lo que se elige al activar "Mes a mes" en una plantilla (ver ActivarDevengoModal).
export type OpcionesActivacion = {
  montoFijo: boolean;
  // INDIVIDUAL: la cuenta lleva el nombre de la plantilla ("Netflix a pagar"):
  // se busca en el plan y, si no existe, se crea. EXISTENTE: se usa una del plan.
  cuenta: { modo: 'INDIVIDUAL' } | { modo: 'EXISTENTE'; formaPagoId: string };
  // Solo con INDIVIDUAL: colgarla de un grupo (existente o nuevo).
  grupo?: { id: string } | { nombre: string } | null;
};

export const ROL_GRUPO_COMPROMISO = 'GRUPO_COMPROMISO';

export type CuentaCompromiso = {
  formaPagoId: string;
  // Forma de pago con la que se devenga (acredita el pasivo / debita el activo).
  formaPago: string;
  cuentaId: string;
  cuentaNombre: string;
  // Categoría de un PAGO/COBRO que la salda.
  categoriaLiquidacion: string;
};

const TIPO_SALDO: Record<LadoCompromiso, 'PASIVO' | 'ACTIVO'> = { PAGAR: 'PASIVO', COBRAR: 'ACTIVO' };
const OPERACION_LIQUIDACION: Record<LadoCompromiso, 'PAGO' | 'COBRO'> = { PAGAR: 'PAGO', COBRAR: 'COBRO' };

// Resuelve, por id de forma de pago, los nombres vigentes de la cuenta y de
// su categoría de liquidación.
export async function resolverCuentaCompromiso(formaPagoId: string, lado: LadoCompromiso): Promise<CuentaCompromiso> {
  const { data: forma, error: errorForma } = await supabase
    .from('formas_pago')
    .select('id, nombre, forma_pago_cuentas(cuenta_id, activo)')
    .eq('id', formaPagoId)
    .maybeSingle();

  if (errorForma) {
    throw errorForma;
  }

  if (!forma) {
    throw new Error('La cuenta elegida para este compromiso ya no existe en el plan.');
  }

  const vinculos = (forma.forma_pago_cuentas ?? []) as unknown as { cuenta_id: string; activo: boolean }[];
  const cuentaId = (vinculos.find((v) => v.activo) ?? vinculos[0])?.cuenta_id;

  if (!cuentaId) {
    throw new Error(`"${forma.nombre}" no está vinculada a ninguna cuenta del plan.`);
  }

  const [{ data: cuenta, error: errorCuenta }, { data: vinculosCategoria, error: errorCategoria }] = await Promise.all([
    supabase.from('plan_cuentas').select('nombre').eq('id', cuentaId).maybeSingle(),
    supabase
      .from('categorias_operacion_cuentas')
      .select('categorias_operacion(nombre, operacion, activo)')
      .eq('cuenta_id', cuentaId)
      .eq('rol', TIPO_SALDO[lado])
      .eq('activo', true),
  ]);

  if (errorCuenta) throw errorCuenta;
  if (errorCategoria) throw errorCategoria;

  const categorias = (vinculosCategoria ?? []).map(
    (v) => v.categorias_operacion as unknown as { nombre: string; operacion: string; activo: boolean } | { nombre: string; operacion: string; activo: boolean }[]
  );
  const liquidacion = categorias
    .flatMap((c) => (Array.isArray(c) ? c : [c]))
    .find((c) => c && c.activo && c.operacion === OPERACION_LIQUIDACION[lado]);

  if (!liquidacion) {
    throw new Error(`"${forma.nombre}" no tiene categoría para ${lado === 'PAGAR' ? 'pagarla' : 'cobrarla'}.`);
  }

  return {
    formaPagoId: forma.id,
    formaPago: forma.nombre,
    cuentaId,
    cuentaNombre: cuenta?.nombre ?? forma.nombre,
    categoriaLiquidacion: liquidacion.nombre,
  };
}

async function nombresDelPlan(empresaId: string): Promise<string[]> {
  const [{ data: cuentas, error: errorCuentas }, { data: formas, error: errorFormas }] = await Promise.all([
    supabase.from('plan_cuentas').select('nombre').eq('empresa_id', empresaId),
    supabase.from('formas_pago').select('nombre').eq('empresa_id', empresaId),
  ]);

  if (errorCuentas) throw errorCuentas;
  if (errorFormas) throw errorFormas;

  return [...(cuentas ?? []).map((c) => c.nombre), ...(formas ?? []).map((f) => f.nombre)];
}

// Busca en el plan una cuenta ya hecha con ese nombre que sirva para el
// lado (forma de pago activa, vinculada a una cuenta del tipo correcto y
// con su categoría de liquidación) — para no crear duplicados.
export async function buscarCuentaCompromisoPorNombre(
  empresaId: string,
  nombre: string,
  lado: LadoCompromiso
): Promise<(CuentaCompromiso & { estabaInactiva: boolean }) | null> {
  // Incluye las desactivadas: una cuenta que quedó sin uso se reactiva si
  // el compromiso vuelve a existir, en vez de chocar con su propio nombre.
  const { data, error } = await supabase
    .from('formas_pago')
    .select('id, activo')
    .eq('empresa_id', empresaId)
    .ilike('nombre', nombre.trim());

  if (error) {
    throw error;
  }

  for (const fila of data ?? []) {
    try {
      const cuenta = await resolverCuentaCompromiso(fila.id, lado);
      const { data: plan } = await supabase.from('plan_cuentas').select('tipo_saldo').eq('id', cuenta.cuentaId).maybeSingle();

      if (plan?.tipo_saldo === TIPO_SALDO[lado]) {
        return { ...cuenta, estabaInactiva: !fila.activo };
      }
    } catch {
      // No sirve para este lado: se sigue buscando.
    }
  }

  return null;
}

// Vuelve a dejar activa una cuenta que se había desactivado por falta de uso.
export async function reactivarCuentaCompromiso(cuenta: CuentaCompromiso) {
  const { error } = await supabase.from('formas_pago').update({ activo: true }).eq('id', cuenta.formaPagoId);

  if (error) {
    throw error;
  }

  const { error: errorCuenta } = await supabase.from('plan_cuentas').update({ activo: true }).eq('id', cuenta.cuentaId);

  if (errorCuenta) {
    throw errorCuenta;
  }
}

export type OpcionCuenta = { formaPagoId: string; nombre: string; usadaPor: string[] };

// Las cuentas del plan que se pueden elegir (pasivos con categoría de pago /
// cuentas a cobrar con categoría de cobro), con los compromisos que ya las usan.
export async function listarCuentasElegibles(empresaId: string, lado: LadoCompromiso): Promise<OpcionCuenta[]> {
  const { data: formas, error } = await supabase
    .from('formas_pago')
    .select('id, nombre')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .order('nombre');

  if (error) {
    throw error;
  }

  const tabla = lado === 'PAGAR' ? 'gastos_recurrentes' : 'ingresos_recurrentes';
  const columna = lado === 'PAGAR' ? 'cuenta_a_pagar_forma_pago_id' : 'cuenta_a_cobrar_forma_pago_id';

  const { data: plantillas } = await supabase.from(tabla).select(`nombre, ${columna}`).eq('empresa_id', empresaId);

  const usos = new Map<string, string[]>();
  for (const plantilla of (plantillas ?? []) as unknown as Record<string, string | null>[]) {
    const id = plantilla[columna];
    if (id) usos.set(id, [...(usos.get(id) ?? []), plantilla.nombre as string]);
  }

  // En paralelo: cada forma de pago se resuelve con varias consultas.
  const candidatas = await Promise.all(
    (formas ?? []).map(async (forma) => {
      try {
        const cuenta = await resolverCuentaCompromiso(forma.id, lado);
        const { data: plan } = await supabase.from('plan_cuentas').select('tipo_saldo').eq('id', cuenta.cuentaId).maybeSingle();

        return plan?.tipo_saldo === TIPO_SALDO[lado]
          ? ({ formaPagoId: forma.id, nombre: forma.nombre, usadaPor: usos.get(forma.id) ?? [] } as OpcionCuenta)
          : null;
      } catch {
        // No es una cuenta de este lado.
        return null;
      }
    })
  );

  const opciones = candidatas.filter((opcion): opcion is OpcionCuenta => opcion !== null);

  return opciones;
}

export type GrupoCuentas = { id: string; nombre: string };

export async function listarGrupos(empresaId: string, lado: LadoCompromiso): Promise<GrupoCuentas[]> {
  const { data, error } = await supabase
    .from('plan_cuentas')
    .select('id, nombre')
    .eq('empresa_id', empresaId)
    .eq('tipo_saldo', TIPO_SALDO[lado])
    .eq('rol_contable', ROL_GRUPO_COMPROMISO)
    .eq('activo', true)
    .order('nombre');

  if (error) {
    throw error;
  }

  return (data ?? []) as GrupoCuentas[];
}

async function contenedorCorriente(empresaId: string, lado: LadoCompromiso): Promise<string> {
  if (lado === 'COBRAR') {
    return buscarCuentaContenedora(empresaId, 'CONTENEDOR_MEDIO_PAGO');
  }

  const contenedor = await buscarContenedorPorEjemploPasivo(empresaId);

  if (!contenedor) {
    throw new Error(
      'Tu empresa todavía no tiene ninguna cuenta de Pasivo configurada como forma de pago — pedile a soporte que la habilite antes de crear cuentas a pagar.'
    );
  }

  return contenedor;
}

// Crea un grupo nuevo ("Alquileres a pagar"): una cuenta contenedora bajo el
// corriente del plan, marcada como grupo. No recibe asientos: los reciben las
// individuales que cuelgan de ella.
export async function crearGrupo(empresaId: string, lado: LadoCompromiso, nombreBase: string): Promise<GrupoCuentas> {
  const nombre = nombreCuentaCompromiso(nombreBase, lado);

  if (nombreYaExiste(nombre, await nombresDelPlan(empresaId))) {
    throw new Error(`Ya existe una cuenta o forma de pago llamada "${nombre}". Elegila como grupo o usá otro nombre.`);
  }

  const padreId = await contenedorCorriente(empresaId, lado);

  const { data: padre, error: errorPadre } = await supabase.from('plan_cuentas').select('codigo').eq('id', padreId).single();

  if (errorPadre) {
    throw errorPadre;
  }

  const prefijo = (padre.codigo as string).split('.').slice(0, 2).join('.');

  const { data: codigos, error: errorCodigos } = await supabase.from('plan_cuentas').select('codigo').eq('empresa_id', empresaId);

  if (errorCodigos) {
    throw errorCodigos;
  }

  const codigo = codigoDeGrupo(prefijo, siguienteSegmentoLibre((codigos ?? []).map((c) => c.codigo), prefijo));

  const { data: creada, error } = await supabase
    .from('plan_cuentas')
    .insert({
      empresa_id: empresaId,
      codigo,
      nombre,
      cuenta_padre_id: padreId,
      naturaleza: lado === 'PAGAR' ? 'ACREEDORA' : 'DEUDORA',
      tipo_saldo: TIPO_SALDO[lado],
      rol_contable: ROL_GRUPO_COMPROMISO,
      activo: true,
      saldo_inicial: 0,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return { id: creada.id as string, nombre };
}

// Crea la cuenta individual de un compromiso con el nombre de su plantilla
// ("Netflix" → "Netflix a pagar"), colgando del grupo si se eligió uno.
export async function crearCuentaIndividual(
  empresaId: string,
  lado: LadoCompromiso,
  nombrePlantilla: string,
  grupoId?: string | null
): Promise<CuentaCompromiso> {
  const nombre = nombreCuentaCompromiso(nombrePlantilla, lado);

  if (nombreYaExiste(nombre, await nombresDelPlan(empresaId))) {
    throw new Error(`Ya existe una cuenta o forma de pago llamada "${nombre}".`);
  }

  let cuentaId: string;

  if (lado === 'PAGAR') {
    const padreId = grupoId ?? (await contenedorCorriente(empresaId, 'PAGAR'));
    cuentaId = await crearCuentaHija(empresaId, padreId, nombre, 'ACREEDORA', 'PASIVO');
    await crearFormaPago(empresaId, nombre, cuentaId, ['COMPRA', 'PAGO']);
    await habilitarLiquidacionCuentaPagar(empresaId, cuentaId, nombre);
  } else if (grupoId) {
    cuentaId = await crearCuentaHija(empresaId, grupoId, nombre, 'DEUDORA', 'ACTIVO');
    await crearFormaPago(empresaId, nombre, cuentaId, ['VENTA', 'COBRO']);
    await habilitarLiquidacionCuentaCobrar(empresaId, cuentaId, nombre);
  } else {
    cuentaId = await crearCuentaParaMedioPago(empresaId, nombre, 'ACTIVO');
    await crearFormaPago(empresaId, nombre, cuentaId, ['VENTA', 'COBRO']);
    await habilitarLiquidacionCuentaCobrar(empresaId, cuentaId, nombre);
  }

  await generarMatrizOperaciones(empresaId);

  const { data: forma, error } = await supabase
    .from('formas_pago')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('nombre', nombre)
    .single();

  if (error) {
    throw error;
  }

  return resolverCuentaCompromiso(forma.id, lado);
}

// Cuelga una cuenta ya existente de un grupo (cambia su padre y su código;
// el libro identifica por nombre, así que los asientos no se mueven).
export async function moverCuentaAGrupo(empresaId: string, cuentaId: string, grupoId: string) {
  const codigo = await siguienteCodigoDeCuenta(empresaId, grupoId);

  const { error } = await supabase.from('plan_cuentas').update({ cuenta_padre_id: grupoId, codigo }).eq('id', cuentaId);

  if (error) {
    throw error;
  }
}

// Si el compromiso se renombra, su cuenta automática lo acompaña (cuenta +
// forma de pago; la categoría de liquidación va con la cuenta, ver
// renombrarCuentaPlan). Las cuentas compartidas o elegidas a mano no se tocan:
// quien llama decide si corresponde (esCuentaNombradaComo).
export async function renombrarCuentaCompromiso(
  empresaId: string,
  cuenta: CuentaCompromiso,
  nombrePlantillaNuevo: string,
  lado: LadoCompromiso
) {
  const nombreNuevo = nombreCuentaCompromiso(nombrePlantillaNuevo, lado);

  if (nombreNuevo.toLowerCase() === cuenta.cuentaNombre.toLowerCase()) {
    return;
  }

  if (nombreYaExiste(nombreNuevo, await nombresDelPlan(empresaId))) {
    throw new Error(`Ya existe una cuenta o forma de pago llamada "${nombreNuevo}": elegí otro nombre.`);
  }

  await renombrarCuentaPlan(empresaId, cuenta.cuentaId, nombreNuevo);
  await renombrarFormaPago(empresaId, cuenta.formaPagoId, nombreNuevo);
}

// Una cuenta que ya nadie usa (ninguna plantilla activa apunta a ella y no
// queda nada devengado sin saldar) se DESACTIVA — no se borra: conserva su
// historial y no vuelve a ofrecerse.
export async function liberarCuentaSiCorresponde(empresaId: string, formaPagoId: string, lado: LadoCompromiso) {
  const tablaPlantillas = lado === 'PAGAR' ? 'gastos_recurrentes' : 'ingresos_recurrentes';
  const columnaPlantilla = lado === 'PAGAR' ? 'cuenta_a_pagar_forma_pago_id' : 'cuenta_a_cobrar_forma_pago_id';
  const tablaRecordatorios = lado === 'PAGAR' ? 'gastos_recurrentes_recordatorios' : 'ingresos_recurrentes_recordatorios';

  const [{ count: plantillasActivas }, { count: sinSaldar }] = await Promise.all([
    supabase
      .from(tablaPlantillas)
      .select('id', { count: 'exact', head: true })
      .eq(columnaPlantilla, formaPagoId)
      .eq('activo', true)
      .eq('devengar', true),
    supabase
      .from(tablaRecordatorios)
      .select('id', { count: 'exact', head: true })
      .eq('cuenta_devengo_forma_pago_id', formaPagoId)
      .eq('registrado', false),
  ]);

  if ((plantillasActivas ?? 0) > 0 || (sinSaldar ?? 0) > 0) {
    return false;
  }

  const { data: forma } = await supabase
    .from('forma_pago_cuentas')
    .select('cuenta_id')
    .eq('forma_pago_id', formaPagoId)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  await supabase.from('formas_pago').update({ activo: false }).eq('id', formaPagoId);

  if (forma?.cuenta_id) {
    await supabase.from('plan_cuentas').update({ activo: false }).eq('id', forma.cuenta_id);
  }

  return true;
}

// Cuentas internas de los compromisos (devengo): no son un medio con el que
// se pague o cobre una operación del día a día, así que los selectores de
// "medio" las ocultan. Se saldan desde Compromisos.
export async function nombresCuentasCompromiso(empresaId: string): Promise<Set<string>> {
  const [{ data: gastos }, { data: ingresos }, { data: empresa }] = await Promise.all([
    supabase.from('gastos_recurrentes').select('cuenta_a_pagar_forma_pago_id').eq('empresa_id', empresaId),
    supabase.from('ingresos_recurrentes').select('cuenta_a_cobrar_forma_pago_id').eq('empresa_id', empresaId),
    supabase.from('empresas').select('forma_pago_a_pagar, forma_pago_a_cobrar').eq('id', empresaId).maybeSingle(),
  ]);

  const ids = [
    ...(gastos ?? []).map((g) => g.cuenta_a_pagar_forma_pago_id),
    ...(ingresos ?? []).map((i) => i.cuenta_a_cobrar_forma_pago_id),
  ].filter((id): id is string => !!id);

  const nombres = new Set<string>();
  if (empresa?.forma_pago_a_pagar) nombres.add(empresa.forma_pago_a_pagar);
  if (empresa?.forma_pago_a_cobrar) nombres.add(empresa.forma_pago_a_cobrar);

  if (ids.length > 0) {
    const { data: formas } = await supabase.from('formas_pago').select('nombre').in('id', ids);
    for (const forma of formas ?? []) nombres.add(forma.nombre);
  }

  return nombres;
}
