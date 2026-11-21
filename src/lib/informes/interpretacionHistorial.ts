// lib/informes/interpretacionHistorial.ts — historial de interpretaciones por empresa y período (tabla `interpretaciones`).
// Cada empresa lee y guarda solo lo suyo (RLS); el historial no se edita ni se borra: cada «Generar» crea una versión nueva.

import { supabase } from '../supabase';
import type { Conversacion } from './conversacion';

export type VersionGuardada = { id: string; periodo: string; version: number; origen: 'AUTO' | 'MANUAL'; generado_en: string; huella: string };
export type VersionConContenido = VersionGuardada & { contenido: Conversacion };

const fechaDe = (periodo: string) => `${periodo}-01`;

export async function listarVersiones(empresaId: string): Promise<VersionGuardada[]> {
  const { data } = await supabase
    .from('interpretaciones')
    .select('id, periodo, version, origen, generado_en, huella')
    .eq('empresa_id', empresaId)
    .order('periodo', { ascending: false })
    .order('version', { ascending: false })
    .limit(200);
  return (data ?? []).map((f) => ({ ...f, periodo: String(f.periodo).slice(0, 7) })) as VersionGuardada[];
}

export async function ultimaVersion(empresaId: string, periodo: string): Promise<VersionConContenido | null> {
  const { data } = await supabase
    .from('interpretaciones')
    .select('id, periodo, version, origen, generado_en, huella, contenido')
    .eq('empresa_id', empresaId)
    .eq('periodo', fechaDe(periodo))
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? ({ ...data, periodo: String(data.periodo).slice(0, 7) } as VersionConContenido) : null;
}

export async function versionPorId(id: string): Promise<VersionConContenido | null> {
  const { data } = await supabase.from('interpretaciones').select('id, periodo, version, origen, generado_en, huella, contenido').eq('id', id).maybeSingle();
  return data ? ({ ...data, periodo: String(data.periodo).slice(0, 7) } as VersionConContenido) : null;
}

// Devuelve true si se pudo guardar. Quien solo mira (espectador, asistente) no guarda: el relato se ve igual, sin historial.
export async function guardarVersion(empresaId: string, periodo: string, contenido: Conversacion, huella: string, origen: 'AUTO' | 'MANUAL'): Promise<boolean> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return false;
  const { error } = await supabase.from('interpretaciones').insert({ empresa_id: empresaId, periodo: fechaDe(periodo), contenido, huella, origen, generado_por: sesion.user.id });
  return !error;
}
