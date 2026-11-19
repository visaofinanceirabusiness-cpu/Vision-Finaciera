// lib/evolucionDatos.ts — lectura de lo que necesita la herramienta «Evolución» (pantalla /evolucion y Panel Maestro → Sabio Soporte).
// Va por el navegador con las políticas RLS de cada empresa; lee por tandas porque PostgREST corta cada respuesta en 1000 filas.

import { supabase } from './supabase';
import { idsCuentasPorCobrar } from './cuentasPorCobrar';
import { calcularEvolucion, type AsientoSimple, type CuentaPlan, type Evolucion } from './sabioSoporte/evolucion';

type Consulta = ReturnType<typeof consultaBase>;
const consultaBase = (tabla: string, columnas: string) => supabase.from(tabla).select(columnas);

async function leerTodo<T>(tabla: string, columnas: string, filtro: (q: Consulta) => Consulta): Promise<T[]> {
  const salida: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await filtro(consultaBase(tabla, columnas)).order('id').range(desde, desde + 999);
    if (error) throw error;
    salida.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return salida;
  }
}

export type OperacionLeida = { fecha: string; operacion: string; total: number | string; parte: number; cuenta_debito: string | null; cuenta_credito: string | null };
export type AutomaticoLeido = { fecha: string; importe: number | string; tipo_registro: string; cuenta_debito: string | null; cuenta_credito: string | null };
export type DatosEvolucion = { ops: OperacionLeida[]; cmvs: AutomaticoLeido[]; cuentas: CuentaPlan[]; disponibles: Set<string> };

export function hoyLocalEvolucion(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function leerDatosEvolucion(empresaId: string): Promise<DatosEvolucion> {
  const [ops, cmvs, plan, formas, porCobrar] = await Promise.all([
    leerTodo<OperacionLeida & { id: string }>('registro_operaciones', 'id, fecha, operacion, total, parte, cuenta_debito, cuenta_credito', (q) => q.eq('empresa_id', empresaId)),
    leerTodo<AutomaticoLeido & { id: string }>('registros_automaticos', 'id, fecha, importe, tipo_registro, cuenta_debito, cuenta_credito', (q) => q.eq('empresa_id', empresaId)),
    leerTodo<{ id: string; codigo: string | null; nombre: string; cuenta_padre_id: string | null; naturaleza: string; tipo_saldo: string; rol_contable: string | null; saldo_inicial: number | string | null }>('plan_cuentas', 'id, codigo, nombre, cuenta_padre_id, naturaleza, tipo_saldo, rol_contable, saldo_inicial', (q) => q.eq('empresa_id', empresaId)),
    supabase.from('formas_pago').select('forma_pago_cuentas(cuenta_id, activo)').eq('empresa_id', empresaId),
    idsCuentasPorCobrar(empresaId).catch(() => new Set<string>()),
  ]);

  const tipoDe = new Map(plan.map((p) => [p.id, p.tipo_saldo]));
  const disponibles = new Set<string>();
  for (const f of formas.data ?? []) {
    for (const v of (f.forma_pago_cuentas ?? []) as unknown as Array<{ cuenta_id: string; activo: boolean }>) {
      // Plata de verdad: la cuenta de un medio de pago que es Activo y no una cuenta «a cobrar».
      if (v.activo && tipoDe.get(v.cuenta_id) === 'ACTIVO' && !porCobrar.has(v.cuenta_id)) disponibles.add(v.cuenta_id);
    }
  }

  const cuentas: CuentaPlan[] = plan
    .filter((p) => p.codigo)
    .map((p) => ({ id: p.id, codigo: p.codigo as string, nombre: p.nombre, padreId: p.cuenta_padre_id, naturaleza: p.naturaleza, tipo: p.tipo_saldo, saldoInicial: Number(p.saldo_inicial ?? 0), rol: p.rol_contable }));
  return { ops, cmvs, cuentas, disponibles };
}

export function armarEvolucion(d: DatosEvolucion, hasta: string = hoyLocalEvolucion()): Evolucion {
  const asientos: AsientoSimple[] = [
    ...d.ops.map((o) => ({ fecha: o.fecha, debito: o.cuenta_debito, credito: o.cuenta_credito, importe: Number(o.total) })),
    ...d.cmvs.map((x) => ({ fecha: x.fecha, debito: x.cuenta_debito, credito: x.cuenta_credito, importe: Number(x.importe) })),
  ];
  return calcularEvolucion(d.cuentas, asientos, hasta, { disponibles: d.disponibles });
}

export async function cargarEvolucion(empresaId: string): Promise<Evolucion> {
  return armarEvolucion(await leerDatosEvolucion(empresaId));
}
