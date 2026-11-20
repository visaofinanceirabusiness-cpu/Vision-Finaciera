// lib/cierres.ts — cierre mensual. Réplica en TypeScript de la función SQL estado_periodo (la base es la que hace cumplir el bloqueo;
// esto solo sirve para pintar el calendario y la pestaña sin una consulta por día). Si cambia una, cambia la otra.
import { supabase } from './supabase';

export type EstadoPeriodo = 'ABIERTO' | 'HABILITADO' | 'CERRADO' | 'BLOQUEADO';

export const DIAS_REAPERTURA = 5;
export const DIAS_AVISO_PREVIO = 5;

export type ConfigCierre = { activo: boolean; desde: string | null };

// Brasil/Argentina: UTC-3 todo el año. «Hoy» local, no el de UTC.
export function hoyLocalCierre(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const primerDiaDelMes = (f: string) => `${f.slice(0, 7)}-01`;

function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

// Último día en que el cliente puede reabrir el mes (día 5 del mes siguiente).
export function limiteReapertura(mes: string): string {
  return `${sumarMeses(primerDiaDelMes(mes), 1).slice(0, 7)}-${String(DIAS_REAPERTURA).padStart(2, '0')}`;
}

export function estadoPeriodo(
  config: ConfigCierre,
  fecha: string,
  hoy: string,
  abiertoHasta: Date | null = null,
  ahora: Date = new Date(),
): EstadoPeriodo {
  if (!config.activo) return 'ABIERTO';
  const mes = primerDiaDelMes(fecha);
  if (config.desde && mes < primerDiaDelMes(config.desde)) return 'ABIERTO';
  if (mes >= primerDiaDelMes(hoy)) return 'ABIERTO';
  if (abiertoHasta && abiertoHasta.getTime() > ahora.getTime()) return 'HABILITADO';
  return hoy <= limiteReapertura(mes) ? 'CERRADO' : 'BLOQUEADO';
}

export type SituacionCierre = {
  config: ConfigCierre;
  // mes (AAAA-MM-01) → vigencia del habilitado
  habilitados: Record<string, Date>;
};

export async function cargarSituacionCierre(empresaId: string): Promise<SituacionCierre> {
  const [{ data: emp }, { data: filas }] = await Promise.all([
    supabase.from('empresas').select('cierre_mensual_activo, cierre_mensual_desde').eq('id', empresaId).maybeSingle(),
    supabase.from('periodos_contables').select('periodo, abierto_hasta').eq('empresa_id', empresaId).not('abierto_hasta', 'is', null),
  ]);
  const habilitados: Record<string, Date> = {};
  for (const f of filas ?? []) habilitados[f.periodo as string] = new Date(f.abierto_hasta as string);
  return { config: { activo: Boolean(emp?.cierre_mensual_activo), desde: (emp?.cierre_mensual_desde as string) ?? null }, habilitados };
}

export function estadoDelMes(s: SituacionCierre, fecha: string, hoy: string = hoyLocalCierre(), ahora: Date = new Date()): EstadoPeriodo {
  return estadoPeriodo(s.config, fecha, hoy, s.habilitados[primerDiaDelMes(fecha)] ?? null, ahora);
}

// Días que faltan para que termine el mes de `hoy` (0 = hoy es el último día).
export function diasParaElCierre(hoy: string): number {
  const fin = new Date(`${sumarMeses(primerDiaDelMes(hoy), 1)}T12:00:00Z`);
  fin.setUTCDate(0);
  return Math.round((fin.getTime() - new Date(`${hoy}T12:00:00Z`).getTime()) / 86400000);
}

export const enPeriodoDeAviso = (hoy: string) => diasParaElCierre(hoy) < DIAS_AVISO_PREVIO;

// ---- Llamadas al servidor (la clave se verifica allá) ----
async function llamar(accion: string, cuerpo: Record<string, unknown>, mantener = false): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/cierres/${accion}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify(cuerpo),
    keepalive: mantener,
  });
  return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

export const habilitarPeriodo = (periodo: string, clave: string) => llamar('habilitar', { periodo, clave });
export const bloquearPeriodos = (periodo?: string) => llamar('bloquear', { periodo }, true);
export const latidoPeriodos = () => llamar('latido', {});

// Al cerrar la pestaña no hay cabeceras: sendBeacon lleva el token en el cuerpo. Si no llega, el vencimiento (3 min) igual lo cierra.
export async function bloquearAlSalir(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
  navigator.sendBeacon('/api/cierres/bloquear', new Blob([JSON.stringify({ token })], { type: 'application/json' }));
}

export const EVENTO_PERIODO_CAMBIO = 'visao:periodo-habilitado';

// ---- Marcas del calendario ----
export type MarcaCierre = { color: string; texto: string; titulo: string };

// Colores: ámbar = se acerca el cierre, rojo = último día, azul = mes recién cerrado (todavía reabrible).
export function marcaDelDia(config: ConfigCierre, fecha: string, _hoy: string, pt: boolean): MarcaCierre | null {
  if (!config.activo) return null;
  if (config.desde && fecha < config.desde) return null;
  const dia = Number(fecha.slice(8, 10));
  const ultimo = diasParaElCierre(fecha);
  if (ultimo === 0) return { color: '#dc2626', texto: pt ? 'Fecha' : 'Cierre', titulo: pt ? 'Último dia: o mês fecha automaticamente à meia-noite' : 'Último día: el mes se cierra solo a la medianoche' };
  if (ultimo < DIAS_AVISO_PREVIO) return { color: '#d97706', texto: pt ? `−${ultimo}d` : `−${ultimo}d`, titulo: pt ? `Faltam ${ultimo} dia(s) para o fechamento` : `Faltan ${ultimo} día(s) para el cierre` };
  if (dia === 1) return { color: '#2563eb', texto: pt ? 'Mês anterior fechado' : 'Mes anterior cerrado', titulo: pt ? 'Você pode reabri-lo até o dia 5' : 'Podés reabrirlo hasta el día 5' };
  if (dia === DIAS_REAPERTURA) return { color: '#7c3aed', texto: pt ? 'Últ. dia p/ reabrir' : 'Últ. día p/ reabrir', titulo: pt ? 'Último dia para reabrir o mês anterior' : 'Último día para reabrir el mes anterior' };
  return null;
}

// ---- Resumen de un asiento de cierre ----
export type LineaCierre = { ejercicio: number; cuenta_debito: string; cuenta_credito: string; importe: number; es_prueba?: boolean };
export type ResumenEjercicio = { ejercicio: number; ingresos: number; costos: number; gastos: number; resultado: number; lineas: number; esPrueba: boolean };

// `tipos`: nombre de cuenta → tipo_saldo. Una cuenta de ingreso se cierra con débito; costos y gastos, con crédito.
export function resumirCierres(lineas: LineaCierre[], tipos: Map<string, string>): ResumenEjercicio[] {
  const por = new Map<number, ResumenEjercicio>();
  for (const l of lineas) {
    const r = por.get(l.ejercicio) ?? { ejercicio: l.ejercicio, ingresos: 0, costos: 0, gastos: 0, resultado: 0, lineas: 0, esPrueba: false };
    r.lineas += 1;
    if (l.es_prueba) r.esPrueba = true;
    const tDebito = tipos.get(l.cuenta_debito);
    const tCredito = tipos.get(l.cuenta_credito);
    if (tDebito === 'INGRESO') r.ingresos += l.importe;
    if (tCredito === 'INGRESO') r.ingresos -= l.importe;
    if (tCredito === 'COSTO') r.costos += l.importe;
    if (tDebito === 'COSTO') r.costos -= l.importe;
    if (tCredito === 'GASTO') r.gastos += l.importe;
    if (tDebito === 'GASTO') r.gastos -= l.importe;
    por.set(l.ejercicio, r);
  }
  return [...por.values()]
    .map((r) => ({ ...r, resultado: Math.round((r.ingresos - r.costos - r.gastos) * 100) / 100 }))
    .sort((a, b) => b.ejercicio - a.ejercicio);
}
