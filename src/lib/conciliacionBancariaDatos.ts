// lib/conciliacionBancariaDatos.ts
//
// Lectura y escritura de la conciliación bancaria (ver lib/conciliacionBancaria.ts para la lógica). Todo va por el navegador con las
// políticas RLS de cada empresa. Lo único que escribe en la contabilidad es «aprobar», y lo hace con registrarOperacion (el motor de siempre).

import { supabase } from './supabase';
import { registrarOperacion } from './motor';
import { saldoDeFormaDePago } from './saldoCuenta';
import { fechaLocalHoy } from './fecha';
import { conciliar, estadoDeSaldos, proponerOperacion, type EstadoSaldos, type MovBanco, type OpVisao, type Propuesta } from './conciliacionBancaria';

export type ConexionBanco = { id: string; proveedor: string; banco_codigo: string; banco_nombre: string; estado: string; consentimiento_vence: string | null; ultima_sincronizacion: string | null };
export type CuentaBanco = { id: string; conexion_id: string; nombre: string; numero_mascara: string | null; moneda: string; saldo_banco: number | null; saldo_actualizado_en: string | null; forma_pago_nombre: string | null };
export type MovimientoBanco = { id: string; cuenta_banco_id: string; fecha: string; monto: number; descripcion: string | null; contraparte: string | null; estado: 'PENDIENTE' | 'CONCILIADO' | 'APROBADO' | 'IGNORADO'; id_operacion: string | null; sugerencia: Propuesta | null };

export async function cargarConciliacion(empresaId: string): Promise<{ conexiones: ConexionBanco[]; cuentas: CuentaBanco[]; movimientos: MovimientoBanco[] }> {
  const [c, k, m] = await Promise.all([
    supabase.from('bancos_conexiones').select('id, proveedor, banco_codigo, banco_nombre, estado, consentimiento_vence, ultima_sincronizacion').eq('empresa_id', empresaId).order('creado_en'),
    supabase.from('bancos_cuentas').select('id, conexion_id, nombre, numero_mascara, moneda, saldo_banco, saldo_actualizado_en, forma_pago_nombre').eq('empresa_id', empresaId).order('creado_en'),
    supabase.from('bancos_movimientos').select('id, cuenta_banco_id, fecha, monto, descripcion, contraparte, estado, id_operacion, sugerencia').eq('empresa_id', empresaId).order('fecha', { ascending: false }).limit(1000),
  ]);
  if (c.error) throw c.error;
  if (k.error) throw k.error;
  if (m.error) throw m.error;
  return {
    conexiones: (c.data ?? []) as ConexionBanco[],
    cuentas: ((k.data ?? []) as CuentaBanco[]).map((x) => ({ ...x, saldo_banco: x.saldo_banco === null ? null : Number(x.saldo_banco) })),
    movimientos: ((m.data ?? []) as MovimientoBanco[]).map((x) => ({ ...x, monto: Number(x.monto) })),
  };
}

export async function vincularCuenta(cuentaBancoId: string, formaPagoNombre: string | null): Promise<void> {
  const { error } = await supabase.from('bancos_cuentas').update({ forma_pago_nombre: formaPagoNombre }).eq('id', cuentaBancoId);
  if (error) throw error;
}

// Formas de pago que son una cuenta de plata (Banco, Caja…) para poder vincular: las de la matriz de cobros y pagos.
export async function formasPagoVinculables(empresaId: string): Promise<string[]> {
  const { data, error } = await supabase.from('formas_pago').select('nombre').eq('empresa_id', empresaId).order('nombre');
  if (error) throw error;
  return (data ?? []).map((f) => f.nombre as string);
}

// Operaciones de Visão que tocan la cuenta vinculada, con el efecto de cada una en el banco (+ entra, − sale), a partir de los asientos.
async function operacionesDeLaCuenta(empresaId: string, cuentaPlan: string, desde: string): Promise<OpVisao[]> {
  const [d, c] = await Promise.all([
    supabase.from('registro_operaciones').select('id_operacion, fecha, operacion, categoria, total, historico, cliente_proveedor').eq('empresa_id', empresaId).eq('cuenta_debito', cuentaPlan).gte('fecha', desde),
    supabase.from('registro_operaciones').select('id_operacion, fecha, operacion, categoria, total, historico, cliente_proveedor').eq('empresa_id', empresaId).eq('cuenta_credito', cuentaPlan).gte('fecha', desde),
  ]);
  if (d.error) throw d.error;
  if (c.error) throw c.error;
  const aOp = (f: { id_operacion: string; fecha: string; operacion: string; categoria: string | null; total: number | string; historico: string | null; cliente_proveedor: string | null }, signo: 1 | -1): OpVisao => ({
    idOperacion: f.id_operacion,
    fecha: f.fecha,
    monto: signo * Number(f.total),
    texto: `${f.historico ?? ''} ${f.cliente_proveedor ?? ''} ${f.categoria ?? ''}`,
    operacion: f.operacion,
    categoria: f.categoria ?? '',
  });
  return [...(d.data ?? []).map((f) => aOp(f, 1)), ...(c.data ?? []).map((f) => aOp(f, -1))];
}

// Recalcula una cuenta: marca como CONCILIADO lo que ya está cargado en Visão y deja una propuesta en lo que falta. No toca la contabilidad.
export async function recalcularCuenta(empresaId: string, cuenta: CuentaBanco): Promise<{ estadoSaldos: EstadoSaldos | null; sinBanco: OpVisao[]; saldoVisao: number | null }> {
  if (!cuenta.forma_pago_nombre) return { estadoSaldos: null, sinBanco: [], saldoVisao: null };

  const saldo = await saldoDeFormaDePago(empresaId, cuenta.forma_pago_nombre, fechaLocalHoy());
  if (!saldo) return { estadoSaldos: null, sinBanco: [], saldoVisao: null };

  const { data: pendientesDb, error } = await supabase
    .from('bancos_movimientos')
    .select('id, fecha, monto, descripcion, contraparte')
    .eq('empresa_id', empresaId)
    .eq('cuenta_banco_id', cuenta.id)
    .eq('estado', 'PENDIENTE');
  if (error) throw error;

  const movs: MovBanco[] = (pendientesDb ?? []).map((m) => ({ id: m.id as string, fecha: m.fecha as string, monto: Number(m.monto), descripcion: (m.descripcion as string) ?? '', contraparte: (m.contraparte as string | null) ?? null }));
  const desde = movs.reduce((min, m) => (m.fecha < min ? m.fecha : min), fechaLocalHoy());
  const desdeConMargen = new Date(`${desde}T12:00:00Z`);
  desdeConMargen.setUTCDate(desdeConMargen.getUTCDate() - 5);
  const ops = await operacionesDeLaCuenta(empresaId, saldo.cuenta, desdeConMargen.toISOString().slice(0, 10));

  // Operaciones ya usadas por otros movimientos (conciliados o aprobados antes) no se vuelven a ofrecer.
  const { data: usadas } = await supabase.from('bancos_movimientos').select('id_operacion').eq('empresa_id', empresaId).eq('cuenta_banco_id', cuenta.id).not('id_operacion', 'is', null);
  const idsUsados = new Set((usadas ?? []).map((u) => u.id_operacion as string));
  const libres = ops.filter((o) => !idsUsados.has(o.idOperacion));

  const r = conciliar(movs, libres);
  for (const e of r.emparejados) {
    await supabase.from('bancos_movimientos').update({ estado: 'CONCILIADO', id_operacion: e.idOperacion, sugerencia: null }).eq('id', e.movId).eq('estado', 'PENDIENTE');
  }

  const historial = ops.map((o) => ({ texto: o.texto, categoria: o.categoria, operacion: o.operacion }));
  for (const m of r.sinOperacion) {
    await supabase.from('bancos_movimientos').update({ sugerencia: proponerOperacion(m, historial) }).eq('id', m.id).eq('estado', 'PENDIENTE');
  }

  return {
    estadoSaldos: cuenta.saldo_banco === null ? null : estadoDeSaldos(cuenta.saldo_banco, saldo.saldo, r.sinOperacion),
    sinBanco: r.sinBanco,
    saldoVisao: saldo.saldo,
  };
}

// APROBAR: crea en Visão la operación propuesta (o la que la persona editó) con el motor contable y deja el movimiento enlazado.
export async function aprobarMovimiento(
  empresaId: string,
  mov: MovimientoBanco,
  formaPagoNombre: string,
  datos: { operacion: 'PAGO' | 'COBRO'; categoria: string; contacto: string; detalle: string }
): Promise<string> {
  if (!datos.categoria) throw new Error('Elegí la categoría antes de aprobar.');

  // Se «reserva» el movimiento antes de registrar para que un doble toque no cree la operación dos veces.
  const { data: reservado, error: errorReserva } = await supabase.from('bancos_movimientos').update({ estado: 'APROBADO' }).eq('id', mov.id).eq('estado', 'PENDIENTE').select('id');
  if (errorReserva) throw errorReserva;
  if (!reservado || reservado.length === 0) throw new Error('Este movimiento ya fue resuelto.');

  try {
    const resultado = await registrarOperacion(empresaId, {
      fecha: mov.fecha,
      operacion: datos.operacion,
      categoria: datos.categoria,
      formaPago: formaPagoNombre,
      historico: datos.detalle || mov.descripcion || datos.categoria,
      clienteProveedor: datos.contacto,
      lineas: [{ producto: '', cantidad: 1, monto: Math.abs(mov.monto) }],
    });
    await supabase.from('bancos_movimientos').update({ id_operacion: resultado.idOperacion, sugerencia: null }).eq('id', mov.id);
    return resultado.idOperacion as string;
  } catch (e) {
    await supabase.from('bancos_movimientos').update({ estado: 'PENDIENTE' }).eq('id', mov.id);
    throw e;
  }
}

export async function ignorarMovimiento(movId: string): Promise<void> {
  const { error } = await supabase.from('bancos_movimientos').update({ estado: 'IGNORADO' }).eq('id', movId).eq('estado', 'PENDIENTE');
  if (error) throw error;
}

export async function reabrirMovimiento(movId: string): Promise<void> {
  const { error } = await supabase.from('bancos_movimientos').update({ estado: 'PENDIENTE' }).eq('id', movId).eq('estado', 'IGNORADO');
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------------------------------
// IMPORTAR EXTRACTO (OFX / CSV): la alternativa sin costo a Open Finance. Usa una conexión «manual» del banco elegido y las mismas tablas.
// ---------------------------------------------------------------------------------------------------------------------

export async function crearCuentaManual(empresaId: string, bancoCodigo: string, bancoNombre: string, nombreCuenta: string): Promise<CuentaBanco> {
  const unica = `manual-${bancoCodigo}-${Date.now().toString(36)}`;
  const { data: conexion, error } = await supabase
    .from('bancos_conexiones')
    .insert({ empresa_id: empresaId, proveedor: 'manual', conexion_externa_id: unica, banco_codigo: bancoCodigo, banco_nombre: bancoNombre, estado: 'ACTIVA' })
    .select('id')
    .single();
  if (error) throw error;

  const { data: cuenta, error: errorCuenta } = await supabase
    .from('bancos_cuentas')
    .insert({ empresa_id: empresaId, conexion_id: conexion.id, cuenta_externa_id: unica, nombre: nombreCuenta.trim() || 'Conta corrente', moneda: 'BRL' })
    .select('id, conexion_id, nombre, numero_mascara, moneda, saldo_banco, saldo_actualizado_en, forma_pago_nombre')
    .single();
  if (errorCuenta) throw errorCuenta;
  return { ...(cuenta as CuentaBanco), saldo_banco: null };
}

// Mete los movimientos del extracto en la cuenta: los que ya estaban (mismo id) se saltean y conservan su estado; solo entran los nuevos.
export async function importarMovimientos(
  empresaId: string,
  cuentaBancoId: string,
  movimientos: Array<{ idExterno: string; fecha: string; monto: number; descripcion: string; contraparte: string | null }>,
  saldoBanco: number | null
): Promise<{ nuevos: number; repetidos: number }> {
  let nuevos = 0;
  for (let i = 0; i < movimientos.length; i += 200) {
    const tanda = movimientos.slice(i, i + 200);
    const { data, error } = await supabase
      .from('bancos_movimientos')
      .upsert(
        tanda.map((m) => ({ empresa_id: empresaId, cuenta_banco_id: cuentaBancoId, id_externo: m.idExterno, fecha: m.fecha, monto: m.monto, descripcion: m.descripcion, contraparte: m.contraparte })),
        { onConflict: 'cuenta_banco_id,id_externo', ignoreDuplicates: true }
      )
      .select('id');
    if (error) throw error;
    nuevos += data?.length ?? 0;
  }

  if (saldoBanco !== null) {
    const { error } = await supabase.from('bancos_cuentas').update({ saldo_banco: saldoBanco, saldo_actualizado_en: new Date().toISOString() }).eq('id', cuentaBancoId);
    if (error) throw error;
  }
  return { nuevos, repetidos: movimientos.length - nuevos };
}
