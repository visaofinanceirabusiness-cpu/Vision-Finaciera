// lib/cajaMaterialesDatos.ts
//
// Lee y escribe el estado de la caja (tabla `caja_materiales_estado`). Leer lo puede cualquier usuario (el lobby y las
// pantallas necesitan saber qué está guardado); escribir, solo el administrador de plataforma (lo impone la base).
// Si la lectura falla se asume "nada en la caja": un error nunca debe esconder herramientas a las empresas.

import { supabase } from './supabase';
import { estaEnCajaParaPerfil } from './cajaMateriales';

export type EstadoCaja = { clave: string; en_caja: boolean; motivo: string | null; movido_en: string; perfiles: string[] | null; empresas_abiertas?: string[] | null };

export async function cargarCaja(): Promise<EstadoCaja[]> {
  try {
    const { data, error } = await supabase.from('caja_materiales_estado').select('clave, en_caja, motivo, movido_en, perfiles, empresas_abiertas').eq('en_caja', true);
    if (error || !data) return [];
    return data as EstadoCaja[];
  } catch {
    return [];
  }
}

export async function mandarALaCaja(clave: string, motivo: string, perfiles: string[] | null = null): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('caja_materiales_estado')
    .upsert({ clave, en_caja: true, motivo: motivo.trim() || null, movido_en: new Date().toISOString(), movido_por: u.user?.id ?? null, perfiles: perfiles && perfiles.length > 0 ? perfiles : null }, { onConflict: 'clave' });
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

// Código del perfil de empresa de quien está conectado (COMERCIAL, FAMILIAR…). Se guarda por sesión: no cambia mientras se usa.
let perfilCache: { userId: string; codigo: string | null; empresaId: string | null } | null = null;

// Perfil y empresa de quien está conectado (para el alcance por perfil y las excepciones por empresa de la caja).
export async function miContextoCaja(): Promise<{ codigo: string | null; empresaId: string | null }> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { codigo: null, empresaId: null };
    if (perfilCache && perfilCache.userId === u.user.id) return { codigo: perfilCache.codigo, empresaId: perfilCache.empresaId };
    const { data: perfil } = await supabase.from('perfiles').select('empresa_id, empresas(perfiles_empresa(codigo))').eq('id', u.user.id).maybeSingle();
    const emp = perfil?.empresas as unknown as { perfiles_empresa: { codigo: string } | { codigo: string }[] | null } | null;
    const rel = emp?.perfiles_empresa;
    const codigo = (Array.isArray(rel) ? rel[0]?.codigo : rel?.codigo) ?? null;
    const empresaId = (perfil?.empresa_id as string | null | undefined) ?? null;
    perfilCache = { userId: u.user.id, codigo, empresaId };
    return { codigo, empresaId };
  } catch {
    return { codigo: null, empresaId: null };
  }
}

export async function miPerfilCodigo(): Promise<string | null> {
  return (await miContextoCaja()).codigo;
}

// Para código que no es una pantalla (p. ej. el chat de Sabio): ¿esta pieza está guardada para mi perfil?
export async function piezaEnCajaParaMi(clave: string): Promise<boolean> {
  const [filas, ctx] = await Promise.all([cargarCaja(), miContextoCaja()]);
  return estaEnCajaParaPerfil(filas.find((f) => f.clave === clave), ctx.codigo, ctx.empresaId);
}
