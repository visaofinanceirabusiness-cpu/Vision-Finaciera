// lib/nuestroSueno.ts
//
// NUESTRO SUEÑO — espacio compartido de pareja
// =====================================================
//
// Vincula dos empresas (hoy Buenaventura y Ocaña, ver
// nuestroSuenoEmpresas.ts) para que construyan juntas un proyecto
// (por ahora: la Casa Propia). El vínculo es por código de invitación
// y de una sola vez — ver el check de RLS y los índices únicos en la
// migración de sueno_parejas.
//
// Generar el código es una operación directa (RLS: la empresa crea
// su propia fila). ACEPTAR un código ajeno pasa por
// /api/nuestro-sueno/vincular (service_role) porque hay que leer una
// fila que todavía no pertenece a la empresa que se une.

import { supabase } from './supabase';

export type EstadoPareja = 'PENDIENTE' | 'VINCULADA';

export type SuenoPareja = {
  id: string;
  empresa_a_id: string;
  empresa_b_id: string | null;
  codigo: string;
  estado: EstadoPareja;
  creado_en: string;
  expira_en: string;
  vinculado_en: string | null;
};

export type SuenoCampo = {
  clave: string;
  valor: string | null;
  actualizado_en: string;
};

export type SuenoMensaje = {
  id: string;
  autor_perfil_id: string;
  autor_empresa_id: string;
  texto: string;
  creado_en: string;
};

// Las claves fijas del panel de campos compartidos (fase 1). El orden
// acá define el orden en pantalla.
export const CAMPOS_SUENO: { clave: string; etiqueta: string; tipo: 'texto' | 'monto' | 'fecha' }[] = [
  { clave: 'meta_ahorro', etiqueta: 'Meta de ahorro', tipo: 'monto' },
  { clave: 'ahorro_actual', etiqueta: 'Ahorro acumulado hoy', tipo: 'monto' },
  { clave: 'banco', etiqueta: 'Banco / financiamiento elegido', tipo: 'texto' },
  { clave: 'fecha_objetivo', etiqueta: 'Fecha objetivo de compra', tipo: 'fecha' },
  { clave: 'notas', etiqueta: 'Por qué este sueño', tipo: 'texto' },
];

function generarCodigo(): string {
  // Sin caracteres ambiguos (0/O, 1/I) — se va a transcribir a mano.
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return codigo;
}

// Busca el vínculo (pendiente creado por mí, o ya vinculado) de una
// empresa. null si nunca generó ni recibió una invitación.
export async function obtenerMiPareja(empresaId: string): Promise<SuenoPareja | null> {
  const { data, error } = await supabase
    .from('sueno_parejas')
    .select('id, empresa_a_id, empresa_b_id, codigo, estado, creado_en, expira_en, vinculado_en')
    .or(`empresa_a_id.eq.${empresaId},empresa_b_id.eq.${empresaId}`)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as SuenoPareja | null;
}

export async function crearInvitacion(empresaId: string, perfilId: string): Promise<SuenoPareja> {
  const { data, error } = await supabase
    .from('sueno_parejas')
    .insert({ empresa_a_id: empresaId, codigo: generarCodigo(), creado_por: perfilId })
    .select('id, empresa_a_id, empresa_b_id, codigo, estado, creado_en, expira_en, vinculado_en')
    .single();

  if (error) throw error;
  return data as SuenoPareja;
}

export async function obtenerEmpresaDelOtroLado(pareja: SuenoPareja, miEmpresaId: string): Promise<string | null> {
  const otroLadoId = pareja.empresa_a_id === miEmpresaId ? pareja.empresa_b_id : pareja.empresa_a_id;
  if (!otroLadoId) return null;

  const { data } = await supabase.from('empresas').select('nombre').eq('id', otroLadoId).maybeSingle();
  return data?.nombre ?? null;
}

export async function listarCampos(parejaId: string): Promise<Record<string, SuenoCampo>> {
  const { data, error } = await supabase
    .from('sueno_campos')
    .select('clave, valor, actualizado_en')
    .eq('pareja_id', parejaId);

  if (error) throw error;

  const mapa: Record<string, SuenoCampo> = {};
  for (const fila of (data ?? []) as SuenoCampo[]) {
    mapa[fila.clave] = fila;
  }
  return mapa;
}

export async function guardarCampo(parejaId: string, perfilId: string, clave: string, valor: string) {
  const { error } = await supabase
    .from('sueno_campos')
    .upsert(
      { pareja_id: parejaId, clave, valor, actualizado_por: perfilId, actualizado_en: new Date().toISOString() },
      { onConflict: 'pareja_id,clave' }
    );

  if (error) throw error;
}

export async function listarMensajes(parejaId: string): Promise<SuenoMensaje[]> {
  const { data, error } = await supabase
    .from('sueno_mensajes')
    .select('id, autor_perfil_id, autor_empresa_id, texto, creado_en')
    .eq('pareja_id', parejaId)
    .order('creado_en', { ascending: true });

  if (error) throw error;
  return (data ?? []) as SuenoMensaje[];
}

export async function enviarMensaje(parejaId: string, perfilId: string, empresaId: string, texto: string) {
  const { error } = await supabase
    .from('sueno_mensajes')
    .insert({ pareja_id: parejaId, autor_perfil_id: perfilId, autor_empresa_id: empresaId, texto: texto.trim() });

  if (error) throw error;
}
