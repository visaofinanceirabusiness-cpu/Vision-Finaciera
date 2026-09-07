// lib/calendario.ts
//
// Calendário Organizador del lobby — eventos/actividades, prioridades
// del mes y una nota libre, todo por empresa. Cualquier usuario de la
// empresa puede crear, editar o borrar (no es exclusivo del admin) —
// el aislamiento entre empresas lo da RLS, no un chequeo acá.

import { supabase } from './supabase';

export type CategoriaEvento =
  | 'FINANCEIRO'
  | 'CONTABIL'
  | 'COMERCIAL'
  | 'OPERACIONAL'
  | 'PESSOAL'
  | 'REUNIAO'
  | 'ESTRATEGICO'
  | 'OUTROS';

export type EventoCalendario = {
  id: string;
  empresa_id: string;
  titulo: string;
  categoria: CategoriaEvento;
  fecha: string; // 'YYYY-MM-DD'
  hora: string | null; // 'HH:MM:SS'
  notas: string | null;
  notificar: boolean;
  antelacion_minutos: number;
};

export type PrioridadCalendario = {
  id: string;
  texto: string;
  completado: boolean;
  orden: number;
};

export type AnotacionCalendario = {
  id: string;
  texto: string;
  completada: boolean;
  orden: number;
};

type InfoCategoria = {
  color: string;
  labelES: string;
  labelPT: string;
  icono: string;
};

export const CATEGORIAS_EVENTO: Record<CategoriaEvento, InfoCategoria> = {
  FINANCEIRO: { color: '#16a34a', labelES: 'Financiero', labelPT: 'Financeiro', icono: '🏦' },
  CONTABIL: { color: '#2563eb', labelES: 'Contable', labelPT: 'Contábil', icono: '📘' },
  COMERCIAL: { color: '#d97706', labelES: 'Comercial', labelPT: 'Comercial', icono: '🧑‍🤝‍🧑' },
  OPERACIONAL: { color: '#7c3aed', labelES: 'Operacional', labelPT: 'Operacional', icono: '📦' },
  PESSOAL: { color: '#db2777', labelES: 'Personal', labelPT: 'Pessoal', icono: '👤' },
  REUNIAO: { color: '#0891b2', labelES: 'Reunión', labelPT: 'Reunião', icono: '🗓️' },
  ESTRATEGICO: { color: '#1f3a5f', labelES: 'Estratégico', labelPT: 'Estratégico', icono: '🎯' },
  OUTROS: { color: '#6b7280', labelES: 'Otros', labelPT: 'Outros', icono: '📌' },
};

export function nombreCategoria(categoria: CategoriaEvento, idioma?: string): string {
  return idioma === 'PT' ? CATEGORIAS_EVENTO[categoria].labelPT : CATEGORIAS_EVENTO[categoria].labelES;
}

function primerDiaDelMes(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
}

function ultimoDiaDelMes(fecha: Date): string {
  const ultimo = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

// =====================================================
// EVENTOS
// =====================================================

export async function listarEventosDelMes(empresaId: string, mesReferencia: Date): Promise<EventoCalendario[]> {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .select('id, empresa_id, titulo, categoria, fecha, hora, notas, notificar, antelacion_minutos')
    .eq('empresa_id', empresaId)
    .gte('fecha', primerDiaDelMes(mesReferencia))
    .lte('fecha', ultimoDiaDelMes(mesReferencia))
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as EventoCalendario[];
}

export async function crearEvento(
  empresaId: string,
  creadoPor: string,
  datos: {
    titulo: string;
    categoria: CategoriaEvento;
    fecha: string;
    hora: string | null;
    notas: string;
    notificar: boolean;
    antelacionMinutos: number;
  }
) {
  const { error } = await supabase.from('eventos_calendario').insert({
    empresa_id: empresaId,
    creado_por: creadoPor,
    titulo: datos.titulo,
    categoria: datos.categoria,
    fecha: datos.fecha,
    hora: datos.hora,
    notas: datos.notas || null,
    notificar: datos.notificar,
    antelacion_minutos: datos.antelacionMinutos,
  });

  if (error) throw error;
}

export async function actualizarEvento(
  id: string,
  datos: {
    titulo: string;
    categoria: CategoriaEvento;
    fecha: string;
    hora: string | null;
    notas: string;
    notificar: boolean;
    antelacionMinutos: number;
  }
) {
  const { error } = await supabase
    .from('eventos_calendario')
    .update({
      titulo: datos.titulo,
      categoria: datos.categoria,
      fecha: datos.fecha,
      hora: datos.hora,
      notas: datos.notas || null,
      notificar: datos.notificar,
      antelacion_minutos: datos.antelacionMinutos,
      // Si se edita fecha/hora/recordatorio, vuelve a habilitarse el aviso.
      notificado: false,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function eliminarEvento(id: string) {
  const { error } = await supabase.from('eventos_calendario').delete().eq('id', id);
  if (error) throw error;
}

// =====================================================
// PRIORIDADES DEL MES
// =====================================================

export async function listarPrioridadesDelMes(empresaId: string, mesReferencia: Date): Promise<PrioridadCalendario[]> {
  const { data, error } = await supabase
    .from('calendario_prioridades')
    .select('id, texto, completado, orden')
    .eq('empresa_id', empresaId)
    .eq('mes', primerDiaDelMes(mesReferencia))
    .order('orden', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PrioridadCalendario[];
}

export async function crearPrioridad(empresaId: string, mesReferencia: Date, texto: string, orden: number) {
  const { error } = await supabase.from('calendario_prioridades').insert({
    empresa_id: empresaId,
    mes: primerDiaDelMes(mesReferencia),
    texto,
    orden,
  });

  if (error) throw error;
}

export async function alternarPrioridad(id: string, completado: boolean) {
  const { error } = await supabase.from('calendario_prioridades').update({ completado }).eq('id', id);
  if (error) throw error;
}

export async function eliminarPrioridad(id: string) {
  const { error } = await supabase.from('calendario_prioridades').delete().eq('id', id);
  if (error) throw error;
}

// =====================================================
// ANOTAÇÕES DEL MES (papeletas: se agregan, se tachan, se borran —
// misma mecánica que las prioridades, pero para notas sueltas)
// =====================================================

export async function listarAnotacionesDelMes(empresaId: string, mesReferencia: Date): Promise<AnotacionCalendario[]> {
  const { data, error } = await supabase
    .from('calendario_anotaciones')
    .select('id, texto, completada, orden')
    .eq('empresa_id', empresaId)
    .eq('mes', primerDiaDelMes(mesReferencia))
    .order('orden', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AnotacionCalendario[];
}

export async function crearAnotacion(empresaId: string, mesReferencia: Date, texto: string, orden: number) {
  const { error } = await supabase.from('calendario_anotaciones').insert({
    empresa_id: empresaId,
    mes: primerDiaDelMes(mesReferencia),
    texto,
    orden,
  });

  if (error) throw error;
}

export async function alternarAnotacion(id: string, completada: boolean) {
  const { error } = await supabase.from('calendario_anotaciones').update({ completada }).eq('id', id);
  if (error) throw error;
}

export async function eliminarAnotacion(id: string) {
  const { error } = await supabase.from('calendario_anotaciones').delete().eq('id', id);
  if (error) throw error;
}
