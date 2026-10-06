// lib/formasPagoOperacion.ts
//
// Medios (formas de pago) que se ofrecen para una operación + categoría.
// Mini Juego, Sabio Bot y Central de Lanzamientos son tres caminos al mismo
// registro: todos leen la lista de acá para que nunca difieran.

import { supabase } from './supabase';
import { nombresCuentasCompromiso } from '@/lib/cuentasCompromiso';
import { idsCuentasPorCobrar } from './cuentasPorCobrar';
import { tipoSaldoEnListaDeCategorias } from './saldoCuenta';

// Cuando la categoría SALDA una deuda (PAGO de una cuenta de Pasivo: "Préstamos
// Santander") o COBRA algo pendiente (COBRO de una cuenta a cobrar), el medio
// tiene que ser plata de verdad (caja, banco, billetera): pagar el préstamo
// con el mismo préstamo, o con una tarjeta, no tiene sentido. La matriz de
// operaciones combina cada categoría con todos los medios habilitados, así que
// el filtro vive acá, en la lista que usan los tres caminos de carga.
async function medioDeLiquidacionSolo(empresaId: string, operacion: string, categoria: string): Promise<Set<string> | null> {
  const tipo = tipoSaldoEnListaDeCategorias(operacion);
  if (!tipo) return null;

  const { data: categorias } = await supabase
    .from('categorias_operacion')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion)
    .eq('nombre', categoria);

  const idsCategoria = (categorias ?? []).map((c) => c.id as string);
  if (idsCategoria.length === 0) return null;

  const { data: vinculos } = await supabase
    .from('categorias_operacion_cuentas')
    .select('cuenta_id')
    .in('categoria_operacion_id', idsCategoria)
    .eq('activo', true);

  const idsCuentaCategoria = (vinculos ?? []).map((v) => v.cuenta_id as string);
  if (idsCuentaCategoria.length === 0) return null;

  const { data: cuentasCategoria } = await supabase.from('plan_cuentas').select('id').in('id', idsCuentaCategoria).eq('tipo_saldo', tipo);

  // La categoría no es una deuda / algo por cobrar: es un gasto o un ingreso
  // común y sus medios no se tocan.
  if ((cuentasCategoria ?? []).length === 0) return null;

  const [{ data: formas }, porCobrar] = await Promise.all([
    supabase.from('formas_pago').select('nombre, forma_pago_cuentas(cuenta_id, activo)').eq('empresa_id', empresaId),
    idsCuentasPorCobrar(empresaId),
  ]);

  const cuentaDeForma = new Map<string, string>();
  for (const forma of formas ?? []) {
    const vinculosForma = (forma.forma_pago_cuentas ?? []) as unknown as { cuenta_id: string; activo: boolean }[];
    const cuentaId = (vinculosForma.find((v) => v.activo) ?? vinculosForma[0])?.cuenta_id;
    if (cuentaId) cuentaDeForma.set(forma.nombre as string, cuentaId);
  }

  const idsCuentaMedios = Array.from(new Set(cuentaDeForma.values()));
  const { data: cuentasMedio } = await supabase.from('plan_cuentas').select('id').in('id', idsCuentaMedios).eq('tipo_saldo', 'ACTIVO');
  const activas = new Set((cuentasMedio ?? []).map((c) => c.id as string));

  const permitidos = new Set<string>();
  for (const [nombre, cuentaId] of cuentaDeForma) {
    if (activas.has(cuentaId) && !porCobrar.has(cuentaId)) permitidos.add(nombre);
  }

  return permitidos;
}

// Las cuentas internas de los compromisos (devengo) se saldan desde
// Compromisos, no son un medio del día a día. `conservar` es el medio que ya
// tiene un asiento que se está editando: no se oculta para no vaciar el campo.
export async function obtenerFormasPagoOperacion(
  empresaId: string,
  operacion: string,
  categoria: string,
  conservar?: string | null
): Promise<string[]> {
  const { data, error } = await supabase
    .from('matriz_operaciones')
    .select('forma_pago')
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion)
    .eq('categoria', categoria);

  if (error) throw error;

  const [internas, soloPlata] = await Promise.all([
    nombresCuentasCompromiso(empresaId),
    medioDeLiquidacionSolo(empresaId, operacion, categoria),
  ]);

  return (Array.from(new Set((data ?? []).map((f) => f.forma_pago).filter(Boolean))) as string[]).filter(
    (nombre) => nombre === conservar || (!internas.has(nombre) && (soloPlata === null || soloPlata.has(nombre)))
  );
}
