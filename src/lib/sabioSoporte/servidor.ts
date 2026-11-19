// lib/sabioSoporte/servidor.ts — SOLO SERVIDOR. Ayudas compartidas por las rutas de Sabio Soporte.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { configCompleta } from './config';

export const EMPRESA_DEMO_ID = 'c887a052-cbab-47f2-8ec7-a2102af43295';

// Brasil y Argentina están en UTC-3: se resta ese desfase para que «hoy» sea el día local y no el de UTC.
export function hoyLocal(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function clienteDeServicio(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && clave ? createClient(url, clave) : null;
}

export async function esAdminPlataforma(admin: SupabaseClient, jwt: string | undefined): Promise<boolean> {
  if (!jwt) return false;
  const { data: usuario } = await admin.auth.getUser(jwt);
  if (!usuario.user) return false;
  const { data: perfil } = await admin.from('perfiles').select('es_admin_plataforma').eq('id', usuario.user.id).maybeSingle();
  return Boolean(perfil?.es_admin_plataforma);
}

// Días entre el inicio del plan y hoy que todavía no se ejecutaron (los domingos sin actividad también cuentan como pendientes: el ejecutor los resuelve en un instante).
export async function diasPendientes(admin: SupabaseClient, empresaId: string, hoy: string): Promise<string[]> {
  const { data: fila } = await admin.from('sabio_soporte_config').select('config').eq('empresa_id', empresaId).maybeSingle();
  const inicio = configCompleta(fila?.config).inicio;
  const { data: hechos } = await admin.from('sabio_soporte_dias').select('fecha').eq('empresa_id', empresaId).gte('fecha', inicio);
  const ya = new Set((hechos ?? []).map((d) => d.fecha as string));
  const pendientes: string[] = [];
  for (let d = new Date(`${inicio}T12:00:00Z`); d.toISOString().slice(0, 10) <= hoy; d.setUTCDate(d.getUTCDate() + 1)) {
    const f = d.toISOString().slice(0, 10);
    if (!ya.has(f)) pendientes.push(f);
  }
  return pendientes;
}
