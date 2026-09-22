// lib/calendario.ts
//
// Calendário Organizador del lobby — eventos/actividades y anotações
// del mes, todo por empresa. Cualquier usuario de la empresa puede
// crear, editar o borrar (no es exclusivo del admin) — el aislamiento
// entre empresas lo da RLS, no un chequeo acá.

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
  serie_id: string | null;
};

// =====================================================
// REPETICIÓN — un evento nuevo puede generar varias ocurrencias de
// una sola vez (ej. "todos los lunes y jueves hasta fin de año"), en
// vez de tener que cargarlo a mano cada semana/mes. Se materializa
// cada ocurrencia como una fila propia en eventos_calendario (mismo
// criterio que las cuotas de un pasivo, ver lib/cuotas.ts) — así cada
// una se puede editar/marcar sin tocar el resto, y las que comparten
// serie_id se pueden borrar todas juntas (ver eliminarSerie).
export type FrecuenciaRepeticion = 'DIARIA' | 'SEMANAL' | 'MENSUAL';

export type RepeticionEvento = {
  frecuencia: FrecuenciaRepeticion;
  // Solo aplica a SEMANAL — 0=lunes ... 6=domingo (mismo orden que
  // DIAS_SEMANA_ES en CalendarioOrganizador). Vacío o ausente: se usa
  // el día de la semana de la fecha de inicio.
  diasSemana?: number[];
  hasta: string; // 'YYYY-MM-DD', inclusive
};

const TOPE_OCURRENCIAS = 366;

function sumarDias(fechaIso: string, dias: number): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia + dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

// Mismo criterio que sumarMeses en lib/cuotas.ts: si el mes de
// destino no tiene ese día (ej. 31 en un mes de 30), lo clampea al
// último día real de ese mes en vez de desbordar al siguiente.
function sumarMeses(fechaIso: string, meses: number): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + meses, dia);

  if (fecha.getDate() !== dia) {
    fecha.setDate(0);
  }

  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function diaDeLaSemana(fechaIso: string): number {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  // JS: domingo=0..sábado=6 → se convierte a 0=lunes..6=domingo.
  return (new Date(anio, mes - 1, dia).getDay() + 6) % 7;
}

// Arma la lista de fechas (incluida la de inicio) según la
// repetición elegida, sin pasarse de TOPE_OCURRENCIAS ni de la fecha
// "hasta". Nunca tira: si "hasta" queda antes que la fecha de inicio,
// devuelve solo la fecha de inicio.
export function generarFechasRepeticion(fechaInicio: string, repeticion: RepeticionEvento): string[] {
  const fechas: string[] = [];

  if (repeticion.hasta < fechaInicio) {
    return [fechaInicio];
  }

  if (repeticion.frecuencia === 'MENSUAL') {
    for (let i = 0; fechas.length < TOPE_OCURRENCIAS; i++) {
      const fecha = sumarMeses(fechaInicio, i);
      if (fecha > repeticion.hasta) break;
      fechas.push(fecha);
    }
    return fechas;
  }

  if (repeticion.frecuencia === 'DIARIA') {
    for (let i = 0; fechas.length < TOPE_OCURRENCIAS; i++) {
      const fecha = sumarDias(fechaInicio, i);
      if (fecha > repeticion.hasta) break;
      fechas.push(fecha);
    }
    return fechas;
  }

  // SEMANAL — un día por semana como mínimo (el de la fecha de
  // inicio), o varios si se tildó más de uno.
  const dias = repeticion.diasSemana && repeticion.diasSemana.length > 0 ? repeticion.diasSemana : [diaDeLaSemana(fechaInicio)];

  for (let i = 0; fechas.length < TOPE_OCURRENCIAS && sumarDias(fechaInicio, i) <= repeticion.hasta; i++) {
    const fecha = sumarDias(fechaInicio, i);
    if (dias.includes(diaDeLaSemana(fecha))) {
      fechas.push(fecha);
    }
  }

  return fechas.length > 0 ? fechas : [fechaInicio];
}

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
    .select('id, empresa_id, titulo, categoria, fecha, hora, notas, notificar, antelacion_minutos, serie_id')
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
    repeticion?: RepeticionEvento;
  }
) {
  const fechas = datos.repeticion ? generarFechasRepeticion(datos.fecha, datos.repeticion) : [datos.fecha];
  // Con una sola fecha no hay serie que agrupar — serie_id se guarda
  // null y el evento se borra individual, como cualquier otro.
  const serieId = fechas.length > 1 ? crypto.randomUUID() : null;

  const { error } = await supabase.from('eventos_calendario').insert(
    fechas.map((fecha) => ({
      empresa_id: empresaId,
      creado_por: creadoPor,
      titulo: datos.titulo,
      categoria: datos.categoria,
      fecha,
      hora: datos.hora,
      notas: datos.notas || null,
      notificar: datos.notificar,
      antelacion_minutos: datos.antelacionMinutos,
      serie_id: serieId,
    }))
  );

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

// Borra TODAS las ocurrencias de una serie repetida (ver
// generarFechasRepeticion) — pasadas y futuras, no solo las que
// quedan por venir. Un evento sin repetición no tiene serie_id, así
// que nunca llega a llamar esto por accidente.
export async function eliminarSerie(serieId: string) {
  const { error } = await supabase.from('eventos_calendario').delete().eq('serie_id', serieId);
  if (error) throw error;
}

// =====================================================
// ANOTAÇÕES DEL MES (papeletas: se agregan, se tachan, se borran)
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
