// lib/presupuestoDatos.ts
//
// Datos del presupuesto: los topes viven en `presupuestos` (uno por empresa,
// categoría y mes); lo gastado se lee de los asientos ya registrados, con el
// mismo criterio que "Gastos por categoría" del Panel (débito a una cuenta de
// tipo GASTO).

import { supabase } from './supabase';
import {
  armarPresupuesto,
  mesAnterior,
  promedioPorCategoria,
  MESES_PROMEDIO,
  type GastoMensual,
  type ResumenPresupuesto,
  type TopeCategoria,
} from './presupuesto';

function ultimoDiaDelMes(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${periodo.slice(0, 7)}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`;
}

// Las categorías de PAGO que debitan una cuenta de gasto: las que se pueden presupuestar.
export async function listarCategoriasGasto(empresaId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('reglas_contables')
    .select('categoria_nombre')
    .eq('empresa_id', empresaId)
    .eq('operacion', 'PAGO')
    .eq('rol_debito', 'GASTO_CATEGORIA');

  if (error) throw error;

  return Array.from(new Set((data ?? []).map((r) => r.categoria_nombre).filter(Boolean))) as string[];
}

// Gasto por mes y categoría desde `desde` ('YYYY-MM-01') hasta el cierre de `hasta`.
async function gastosMensuales(empresaId: string, desde: string, hasta: string): Promise<GastoMensual[]> {
  const [{ data: cuentas, error: errorCuentas }, { data: operaciones, error: errorOperaciones }] = await Promise.all([
    supabase.from('plan_cuentas').select('nombre').eq('empresa_id', empresaId).eq('tipo_saldo', 'GASTO'),
    supabase
      .from('registro_operaciones')
      .select('fecha, categoria, total, cuenta_debito')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', ultimoDiaDelMes(hasta)),
  ]);

  if (errorCuentas) throw errorCuentas;
  if (errorOperaciones) throw errorOperaciones;

  const cuentasGasto = new Set((cuentas ?? []).map((c) => c.nombre));
  const acumulado = new Map<string, GastoMensual>();

  for (const fila of operaciones ?? []) {
    if (!fila.cuenta_debito || !cuentasGasto.has(fila.cuenta_debito)) continue;

    const periodo = `${String(fila.fecha).slice(0, 7)}-01`;
    const categoria = String(fila.categoria ?? 'Sin categoría');
    const clave = `${periodo}|${categoria}`;
    const actual = acumulado.get(clave) ?? { periodo, categoria, monto: 0 };
    actual.monto += Number(fila.total ?? 0);
    acumulado.set(clave, actual);
  }

  return Array.from(acumulado.values());
}

async function listarTopes(empresaId: string, periodo: string): Promise<TopeCategoria[]> {
  const { data, error } = await supabase.from('presupuestos').select('categoria, monto').eq('empresa_id', empresaId).eq('periodo', periodo);

  if (error) throw error;

  return (data ?? []).map((t) => ({ categoria: t.categoria as string, monto: Number(t.monto) }));
}

export async function cargarPresupuesto(empresaId: string, periodo: string): Promise<ResumenPresupuesto> {
  const [topes, categorias, gastos] = await Promise.all([
    listarTopes(empresaId, periodo),
    listarCategoriasGasto(empresaId),
    gastosMensuales(empresaId, periodo, periodo),
  ]);

  return armarPresupuesto(
    topes,
    gastos.map((g) => ({ categoria: g.categoria, monto: g.monto })),
    categorias
  );
}

// Un monto vacío o en cero quita el tope de esa categoría.
export async function guardarTope(empresaId: string, categoria: string, periodo: string, monto: number) {
  if (!(monto > 0)) {
    const { error } = await supabase.from('presupuestos').delete().eq('empresa_id', empresaId).eq('categoria', categoria).eq('periodo', periodo);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('presupuestos')
    .upsert(
      { empresa_id: empresaId, categoria, periodo, monto, actualizado_en: new Date().toISOString() },
      { onConflict: 'empresa_id,categoria,periodo' }
    );

  if (error) throw error;
}

async function insertarSinPisar(empresaId: string, periodo: string, nuevos: TopeCategoria[]): Promise<number> {
  const existentes = new Set((await listarTopes(empresaId, periodo)).map((t) => t.categoria));
  const filas = nuevos
    .filter((t) => t.monto > 0 && !existentes.has(t.categoria))
    .map((t) => ({ empresa_id: empresaId, categoria: t.categoria, periodo, monto: t.monto }));

  if (filas.length === 0) return 0;

  const { error } = await supabase.from('presupuestos').insert(filas);
  if (error) throw error;

  return filas.length;
}

// Copia los topes del mes anterior a las categorías que todavía no tienen el suyo.
export async function copiarMesAnterior(empresaId: string, periodo: string): Promise<number> {
  return insertarSinPisar(empresaId, periodo, await listarTopes(empresaId, mesAnterior(periodo)));
}

// Propone, para las categorías sin tope, el promedio de los últimos 3 meses.
export async function sugerirConPromedio(empresaId: string, periodo: string): Promise<number> {
  const gastos = await gastosMensuales(empresaId, mesAnterior(periodo, MESES_PROMEDIO), mesAnterior(periodo));
  const promedios = promedioPorCategoria(gastos, periodo);

  return insertarSinPisar(
    empresaId,
    periodo,
    Array.from(promedios.entries()).map(([categoria, monto]) => ({ categoria, monto: Math.round(monto) }))
  );
}
