// lib/visao3dDatos.ts
//
// Lee lo mismo que Informes → Balance (plan de cuentas + asientos VALIDADOS de operaciones y registros
// automáticos), con el mismo cliente de Supabase: la autorización y el aislamiento por empresa los
// resuelve RLS, no este archivo.

import { supabase } from './supabase';
import { nombreOperacionDisplay } from './i18n';
import type { AsientoVisao, CuentaPlan } from './visao3d';

export async function cargarDatosVisao3D(empresaId: string, idioma: string | null): Promise<{ cuentas: CuentaPlan[]; asientos: AsientoVisao[] }> {
  const [cuentasR, operacionesR, automaticosR] = await Promise.all([
    supabase.from('plan_cuentas').select('id, codigo, nombre, cuenta_padre_id, tipo_saldo, naturaleza, saldo_inicial').eq('empresa_id', empresaId),
    supabase.from('registro_operaciones').select('id_operacion, fecha, operacion, historico, cuenta_debito, cuenta_credito, total').eq('empresa_id', empresaId).eq('estado', 'VALIDADO'),
    supabase.from('registros_automaticos').select('id_operacion, fecha, tipo_registro, historico, cuenta_debito, cuenta_credito, importe').eq('empresa_id', empresaId).eq('estado', 'VALIDADO'),
  ]);

  if (cuentasR.error) throw cuentasR.error;
  if (operacionesR.error) throw operacionesR.error;
  if (automaticosR.error) throw automaticosR.error;

  const deOperaciones: AsientoVisao[] = (operacionesR.data ?? []).map((f) => ({
    id_operacion: f.id_operacion,
    fecha: String(f.fecha ?? ''),
    descripcion: [f.operacion ? nombreOperacionDisplay(idioma, f.operacion) : null, f.historico].filter(Boolean).join(' · '),
    debito: f.cuenta_debito,
    credito: f.cuenta_credito,
    importe: Number(f.total ?? 0),
  }));

  const automaticos: AsientoVisao[] = (automaticosR.data ?? []).map((f) => ({
    id_operacion: f.id_operacion,
    fecha: String(f.fecha ?? ''),
    descripcion: [f.tipo_registro, f.historico].filter(Boolean).join(' · '),
    debito: f.cuenta_debito,
    credito: f.cuenta_credito,
    importe: Number(f.importe ?? 0),
  }));

  return { cuentas: (cuentasR.data ?? []) as CuentaPlan[], asientos: [...deOperaciones, ...automaticos] };
}
