// lib/cajaMaterialesDatos.ts
//
// Lee y escribe el estado de la caja (tabla `caja_materiales_estado`). Leer lo puede cualquier usuario (el lobby y las
// pantallas necesitan saber qué está guardado); escribir, solo el administrador de plataforma (lo impone la base).
// Si la lectura falla se asume "nada en la caja": un error nunca debe esconder herramientas a las empresas.

import { supabase } from './supabase';

export type EstadoCaja = { clave: string; en_caja: boolean; motivo: string | null; movido_en: string };

export async function cargarCaja(): Promise<EstadoCaja[]> {
  try {
    const { data, error } = await supabase.from('caja_materiales_estado').select('clave, en_caja, motivo, movido_en').eq('en_caja', true);
    if (error || !data) return [];
    return data as EstadoCaja[];
  } catch {
    return [];
  }
}

export async function mandarALaCaja(clave: string, motivo: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('caja_materiales_estado')
    .upsert({ clave, en_caja: true, motivo: motivo.trim() || null, movido_en: new Date().toISOString(), movido_por: u.user?.id ?? null }, { onConflict: 'clave' });
  if (error) throw error;
}

export async function sacarDeLaCaja(clave: string): Promise<void> {
  const { error } = await supabase.from('caja_materiales_estado').delete().eq('clave', clave);
  if (error) throw error;
}

// Cuántas empresas tienen tarjetas fijadas en Lanzamiento rápido (dato real para el aviso de consecuencias).
export async function empresasConTarjetasFijadas(): Promise<number | null> {
  const { data, error } = await supabase.from('operaciones_rapidas_fijadas').select('empresa_id');
  if (error || !data) return null;
  return new Set(data.map((f) => f.empresa_id as string)).size;
}
