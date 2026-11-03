// lib/adn.ts
//
// ADN DE LA EMPRESA — datos de la pantalla /adn
// =====================================================
// Todo es USO DEL SISTEMA: horas, herramientas, personas, ritmo, logros,
// cambios e historia. Nada contable: los montos, saldos y resultados son del
// Panel de Control y no se repiten acá. Lo único de las operaciones que se
// usa es CUÁNTAS y CUÁNDO (y qué cuentas se mueven más, por cantidad).
//
// La parte pura (fechas e historia) está acá y se prueba en adn.test.ts; la
// lectura de la base va aparte, en cargarAdn.

import { supabase } from './supabase';
import { obtenerProgresoGamificacion, type ProgresoGamificacion } from './gamificacion';
import { obtenerObjetivosEscalonados, tiposEscalonadosDelPerfil, type ObjetivoEscalonado } from './objetivosEscalonados';
import { obtenerTrofeosGanados, type TrofeoGanado } from './trofeos';
import { cuentasMasUsadas, obtenerActividad, type CuentaUsada, type FilaActividad } from './actividad';
import { empresaManejaMercaderia } from './perfilCapacidades';

const ZONA = 'America/Argentina/Buenos_Aires';
export const OPERACIONES_POR_NIVEL = 75;

// Misma zona que usa la base al guardar la actividad: una jornada no se parte entre dos fechas.
export function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONA });
}

export type UsuarioAdn = {
  id: string;
  nombre: string;
  tipoUsuario: string | null;
  activo: boolean;
  creadoEn: string;
  ultimoAcceso: string | null;
  accesos: number;
  operaciones: number;
};

export type CambioAdn = { tipo: string; cantidad: number; primero: string; ultimo: string };

export type HitoAdn = { nivel: number; tipo: 'BRONCE' | 'PLATA' | 'ORO'; vistoEn: string };

export type EventoHistoria = {
  fecha: string; // ISO
  emoji: string;
  titulo: string;
  detalle?: string;
  clave: string;
};

export type DatosAdn = {
  empresa: { nombre: string; creadoEn: string; logoUrl: string | null; idioma: 'ES' | 'PT'; onboardingCompletado: boolean; matrizGenerada: boolean };
  esFamiliar: boolean;
  progreso: ProgresoGamificacion;
  actividad: FilaActividad[];
  usuarios: UsuarioAdn[];
  cambios: CambioAdn[];
  fechasOperaciones: string[]; // YYYY-MM-DD locales, una por operación
  momentosOperaciones: string[]; // ISO, orden ascendente
  cuentas: CuentaUsada[];
  escalonados: ObjetivoEscalonado[];
  trofeos: TrofeoGanado[];
  hitos: HitoAdn[];
  niveles: Record<number, { nombre: string; emoji: string; mision: string; mensaje: string }>;
};

type EntradaHistoria = Pick<DatosAdn, 'empresa' | 'momentosOperaciones' | 'trofeos' | 'hitos' | 'usuarios' | 'actividad'> & { nombresNivel: Record<number, { nombre: string; emoji: string }> };

const NOMBRE_TIER_ES = { BRONCE: 'Bronce', PLATA: 'Plata', ORO: 'Oro' } as const;
const NOMBRE_TIER_PT = { BRONCE: 'Bronze', PLATA: 'Prata', ORO: 'Ouro' } as const;

// Línea de tiempo «cómo llegamos hasta acá», de lo más viejo a lo más nuevo.
export function construirHistoria(d: EntradaHistoria, idioma: string | null | undefined): EventoHistoria[] {
  const pt = idioma === 'PT';
  const t = (es: string, p: string) => (pt ? p : es);
  const eventos: EventoHistoria[] = [];

  eventos.push({ clave: 'alta', fecha: d.empresa.creadoEn, emoji: '🌱', titulo: t('Nace la empresa en Visão Financeira', 'A empresa nasce na Visão Financeira'), detalle: d.empresa.nombre });

  const primeros = d.momentosOperaciones;
  if (primeros.length > 0) {
    eventos.push({ clave: 'primera-op', fecha: primeros[0], emoji: '✍️', titulo: t('Primera operación registrada', 'Primeira operação registrada') });
  }

  // El nivel n se alcanza al cargar la operación número (n−1)·75: se toma su fecha.
  for (let n = 2; n <= 10; n++) {
    const indice = (n - 1) * OPERACIONES_POR_NIVEL - 1;
    if (primeros.length <= indice) break;
    const nivel = d.nombresNivel[n];
    eventos.push({
      clave: `nivel-${n}`,
      fecha: primeros[indice],
      emoji: nivel?.emoji ?? '⭐',
      titulo: t(`Sube al nivel ${n}: ${nivel?.nombre ?? ''}`, `Sobe ao nível ${n}: ${nivel?.nombre ?? ''}`),
      detalle: t(`${indice + 1} operaciones registradas`, `${indice + 1} operações registradas`),
    });
  }

  for (const h of d.hitos) {
    eventos.push({ clave: `hito-${h.nivel}-${h.tipo}`, fecha: h.vistoEn, emoji: h.tipo === 'ORO' ? '🥇' : h.tipo === 'PLATA' ? '🥈' : '🥉', titulo: t(`Medalla de ${NOMBRE_TIER_ES[h.tipo]} del nivel ${h.nivel}`, `Medalha de ${NOMBRE_TIER_PT[h.tipo]} do nível ${h.nivel}`) });
  }

  for (const tr of d.trofeos) {
    eventos.push({ clave: `trofeo-${tr.tipo}-${tr.rango}-${tr.tier}`, fecha: tr.obtenidoEn, emoji: '🏆', titulo: t(`Trofeo ${tr.tipo.toLowerCase()} · ${NOMBRE_TIER_ES[tr.tier]}`, `Troféu ${tr.tipo.toLowerCase()} · ${NOMBRE_TIER_PT[tr.tier]}`) });
  }

  const otros = [...d.usuarios].filter((u) => u.creadoEn > d.empresa.creadoEn).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  for (const u of otros) {
    eventos.push({ clave: `usuario-${u.id}`, fecha: u.creadoEn, emoji: '👋', titulo: t('Se suma una persona al equipo', 'Uma pessoa entra na equipe'), detalle: u.nombre });
  }

  const medido = d.actividad.filter((f) => !f.estimado).map((f) => f.fecha).sort()[0];
  if (medido) {
    eventos.push({ clave: 'medicion', fecha: `${medido}T12:00:00Z`, emoji: '⏱️', titulo: t('Empezamos a medir tu tiempo de uso', 'Começamos a medir seu tempo de uso'), detalle: t('Antes de esta fecha el tiempo es una estimación', 'Antes desta data o tempo é uma estimativa') });
  }

  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function normalizarUsuarios(
  perfiles: Array<{ id: string; nombre: string | null; tipo_usuario: string | null; activo: boolean | null; creado_en: string }>,
  auditoria: Array<{ id: string; ultimo_acceso: string | null; accesos: number; operaciones: number }>
): UsuarioAdn[] {
  const porId = new Map(auditoria.map((a) => [a.id, a]));
  return perfiles.map((p) => {
    const a = porId.get(p.id);
    return {
      id: p.id,
      nombre: p.nombre?.trim() || '—',
      tipoUsuario: p.tipo_usuario,
      activo: p.activo !== false,
      creadoEn: p.creado_en,
      ultimoAcceso: a?.ultimo_acceso ?? null,
      accesos: Number(a?.accesos ?? 0),
      operaciones: Number(a?.operaciones ?? 0),
    };
  });
}

export async function cargarAdn(empresaId: string, esFamiliar: boolean): Promise<DatosAdn> {
  const hace90 = new Date(Date.now() - 90 * 86400000).toISOString();

  const [empresaRes, progreso, actividad, perfilesRes, auditoriaRes, momentosRes, recientesRes, trofeos, hitosRes, nivelesRes, manejaMercaderia] = await Promise.all([
    supabase.from('empresas').select('nombre, creado_en, logo_url, idioma, onboarding_completado, matriz_generada').eq('id', empresaId).maybeSingle(),
    obtenerProgresoGamificacion(empresaId),
    obtenerActividad(empresaId).catch(() => [] as FilaActividad[]),
    supabase.from('perfiles').select('id, nombre, tipo_usuario, activo, creado_en').eq('empresa_id', empresaId),
    supabase.rpc('adn_auditoria_empresa'),
    supabase.from('registro_operaciones').select('creado_en').eq('empresa_id', empresaId).order('creado_en', { ascending: true }).limit(5000),
    supabase.from('registro_operaciones').select('cuenta_debito, cuenta_credito').eq('empresa_id', empresaId).gte('creado_en', hace90).limit(3000),
    obtenerTrofeosGanados(empresaId).catch(() => [] as TrofeoGanado[]),
    supabase.from('gamificacion_hitos_vistos').select('nivel, tipo_hito, visto_en').eq('empresa_id', empresaId),
    supabase.from('niveles_gamificacion').select('nivel, nombre, emoji, mision, mensaje'),
    empresaManejaMercaderia(empresaId).catch(() => true),
  ]);

  const e = empresaRes.data;
  const auditoria = (auditoriaRes.data ?? {}) as { usuarios?: Array<{ id: string; ultimo_acceso: string | null; accesos: number; operaciones: number }>; cambios?: CambioAdn[] };
  const momentos = (momentosRes.data ?? []).map((f) => f.creado_en as string);

  const escalonados = await obtenerObjetivosEscalonados(empresaId, progreso.nivel, progreso.operacionesMin, tiposEscalonadosDelPerfil(esFamiliar, manejaMercaderia)).catch(() => [] as ObjetivoEscalonado[]);

  return {
    empresa: {
      nombre: (e?.nombre as string) ?? '',
      creadoEn: (e?.creado_en as string) ?? new Date().toISOString(),
      logoUrl: (e?.logo_url as string | null) ?? null,
      idioma: e?.idioma === 'PT' ? 'PT' : 'ES',
      onboardingCompletado: Boolean(e?.onboarding_completado),
      matrizGenerada: Boolean(e?.matriz_generada),
    },
    esFamiliar,
    progreso,
    actividad,
    usuarios: normalizarUsuarios((perfilesRes.data ?? []) as never, auditoria.usuarios ?? []),
    cambios: (auditoria.cambios ?? []).map((c) => ({ ...c, cantidad: Number(c.cantidad) })),
    fechasOperaciones: momentos.map(fechaLocal),
    momentosOperaciones: momentos,
    cuentas: cuentasMasUsadas((recientesRes.data ?? []) as Array<{ cuenta_debito: string | null; cuenta_credito: string | null }>),
    escalonados,
    trofeos,
    niveles: Object.fromEntries((nivelesRes.data ?? []).map((n) => [Number(n.nivel), { nombre: n.nombre as string, emoji: (n.emoji as string | null) ?? '⭐', mision: n.mision as string, mensaje: n.mensaje as string }])),
    hitos: (hitosRes.data ?? []).map((h) => ({ nivel: Number(h.nivel), tipo: h.tipo_hito as HitoAdn['tipo'], vistoEn: h.visto_en as string })),
  };
}
