// lib/actividad.ts
//
// USO DEL SISTEMA — base de la pantalla «ADN de la empresa» (/adn)
// =====================================================
// Desde el día de la puesta en marcha se mide de verdad (tabla
// actividad_uso, un latido cada 30 s con la pestaña visible). Lo anterior
// es un ESTIMADO ÚNICO, cargado una sola vez en la base con filas
// `estimado = true`:
//   minutos del día = (3 + 1·operaciones + 0,35·otros movimientos + 5·ingresos)
//                     × (1 + 0,04·(nivel − 1)), tope 180 min por día.
// Buenaventura, la empresa con más historia, queda como el máximo. La
// fórmula no se vuelve a usar: desde hoy cada empresa solo suma lo medido.
//
// Acá viven las cuentas puras (sin base de datos) y el envío del latido.

import { supabase } from './supabase';

export type FilaActividad = {
  usuario_id: string;
  fecha: string; // YYYY-MM-DD
  ruta: string;
  segundos: number;
  visitas: number;
  sesiones: number;
  estimado: boolean;
};

export type ResumenActividad = {
  totalSegundos: number;
  medidoSegundos: number;
  estimadoSegundos: number;
  sesiones: number;
  diasActivos: number;
  rachaActual: number;
  mejorRacha: number;
  medidoDesde: string | null;
  primeraFecha: string | null;
};

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// `hoy` entra por parámetro para poder probarlo sin depender del reloj.
export function resumirActividad(filas: FilaActividad[], hoy: string): ResumenActividad {
  const dias = new Set<string>();
  let medido = 0;
  let estimado = 0;
  let sesiones = 0;
  let medidoDesde: string | null = null;

  for (const f of filas) {
    dias.add(f.fecha);
    sesiones += f.sesiones;
    if (f.estimado) estimado += f.segundos;
    else {
      medido += f.segundos;
      if (!medidoDesde || f.fecha < medidoDesde) medidoDesde = f.fecha;
    }
  }

  const ordenados = [...dias].sort();
  let mejor = 0;
  let corrida = 0;
  let anterior: string | null = null;
  for (const d of ordenados) {
    corrida = anterior && sumarDias(anterior, 1) === d ? corrida + 1 : 1;
    mejor = Math.max(mejor, corrida);
    anterior = d;
  }

  // La racha sigue viva si hubo actividad hoy o ayer.
  let racha = 0;
  let cursor = dias.has(hoy) ? hoy : sumarDias(hoy, -1);
  while (dias.has(cursor)) {
    racha += 1;
    cursor = sumarDias(cursor, -1);
  }

  return {
    totalSegundos: medido + estimado,
    medidoSegundos: medido,
    estimadoSegundos: estimado,
    sesiones,
    diasActivos: dias.size,
    rachaActual: racha,
    mejorRacha: mejor,
    medidoDesde,
    primeraFecha: ordenados[0] ?? null,
  };
}

export type UsoHerramienta = { ruta: string; segundos: number; visitas: number };

// Agrupa por pantalla (lo estimado y lo medido de la misma ruta se suman) y ordena de mayor a menor.
export function usoPorHerramienta(filas: FilaActividad[]): UsoHerramienta[] {
  const mapa = new Map<string, UsoHerramienta>();
  for (const f of filas) {
    const actual = mapa.get(f.ruta) ?? { ruta: f.ruta, segundos: 0, visitas: 0 };
    actual.segundos += f.segundos;
    actual.visitas += f.visitas;
    mapa.set(f.ruta, actual);
  }
  return [...mapa.values()].sort((a, b) => b.segundos - a.segundos);
}

const ETIQUETAS_RUTA: Record<string, { es: string; pt: string; emoji: string }> = {
  '/': { es: 'Inicio', pt: 'Início', emoji: '🏠' },
  '/panel-de-control': { es: 'Panel de Control', pt: 'Painel de Controle', emoji: '📊' },
  '/contabilidad': { es: 'Contabilidad', pt: 'Contabilidade', emoji: '🧾' },
  '/libro-diario': { es: 'Libro Diario', pt: 'Livro Diário', emoji: '📒' },
  '/diario': { es: 'Diario', pt: 'Diário', emoji: '📒' },
  '/registros': { es: 'Registros', pt: 'Registros', emoji: '🗂️' },
  '/lanzamiento-rapido': { es: 'Lanzamiento rápido', pt: 'Lançamento rápido', emoji: '⚡' },
  '/finanzas': { es: 'Finanzas', pt: 'Finanças', emoji: '💼' },
  '/mercaderia': { es: 'Mercadería', pt: 'Mercadoria', emoji: '📦' },
  '/stock': { es: 'Stock', pt: 'Estoque', emoji: '📦' },
  '/movimientos-stock': { es: 'Movimientos de stock', pt: 'Movimentos de estoque', emoji: '📦' },
  '/mi-local': { es: 'Mi Local', pt: 'Meu Local', emoji: '🛍️' },
  '/informes': { es: 'Informes', pt: 'Relatórios', emoji: '📈' },
  '/visao-3d': { es: 'Visión 3D', pt: 'Visão 3D', emoji: '🏢' },
  '/produccion': { es: 'Producción', pt: 'Produção', emoji: '🏭' },
  '/recursos-humanos': { es: 'Recursos Humanos', pt: 'Recursos Humanos', emoji: '👥' },
  '/plan-accion': { es: 'Plan de Acción', pt: 'Plano de Ação', emoji: '🎯' },
  '/nuestro-sueno': { es: 'Nuestro Sueño', pt: 'Nosso Sonho', emoji: '💞' },
  '/mensajes': { es: 'Mensajes', pt: 'Mensagens', emoji: '✉️' },
  '/configuracoes': { es: 'Configuraciones', pt: 'Configurações', emoji: '⚙️' },
  '/sabio-bot': { es: 'Chat con Sabio', pt: 'Conversa com o Sábio', emoji: '💬' },
  '/familia-unida': { es: 'Familia Unida', pt: 'Família Unida', emoji: '👨‍👩‍👧‍👦' },
  '/adn': { es: 'ADN de la empresa', pt: 'DNA da empresa', emoji: '🧬' },
  // El estimado del pasado no sabe en qué pantalla estuvo la persona: solo en qué tipo de tarea.
  'estimado:operaciones': { es: 'Registrar operaciones', pt: 'Registrar operações', emoji: '✍️' },
  'estimado:configuracion': { es: 'Configurar cuentas y reglas', pt: 'Configurar contas e regras', emoji: '🧩' },
  'estimado:ingreso': { es: 'Ingresar y revisar', pt: 'Entrar e revisar', emoji: '🔑' },
};

export function etiquetaRuta(ruta: string, idioma: string | null | undefined): { texto: string; emoji: string } {
  const base = ETIQUETAS_RUTA[ruta] ?? ETIQUETAS_RUTA[`/${ruta.split('/')[1] ?? ''}`];
  if (!base) return { texto: ruta, emoji: '🧭' };
  return { texto: idioma === 'PT' ? base.pt : base.es, emoji: base.emoji };
}

export function formatearDuracion(segundos: number, idioma: string | null | undefined): string {
  const pt = idioma === 'PT';
  const minutos = Math.round(segundos / 60);
  if (minutos < 1) return pt ? '< 1 min' : '< 1 min';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

export type MesActividad = { mes: string; operaciones: number; diasConOperaciones: number };

// Últimos `cantidad` meses (incluido el actual), siempre todos aunque no tengan nada: la comparación mes a mes
// es por cantidad de operaciones cargadas, nunca por montos (eso es del Panel de Control).
export function operacionesPorMes(fechas: string[], hoy: string, cantidad = 3): MesActividad[] {
  const [anio, mes] = hoy.split('-').map(Number);
  const meses: MesActividad[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const total = anio * 12 + (mes - 1) - i;
    const clave = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
    meses.push({ mes: clave, operaciones: 0, diasConOperaciones: 0 });
  }
  const dias = new Map<string, Set<string>>();
  for (const f of fechas) {
    const m = meses.find((x) => x.mes === f.slice(0, 7));
    if (!m) continue;
    m.operaciones += 1;
    const set = dias.get(m.mes) ?? new Set<string>();
    set.add(f);
    dias.set(m.mes, set);
  }
  for (const m of meses) m.diasConOperaciones = dias.get(m.mes)?.size ?? 0;
  return meses;
}

export type CuentaUsada = { cuenta: string; movimientos: number };

// Cuentas con más movimientos (débito + crédito). Cuenta movimientos, no saldos.
export function cuentasMasUsadas(filas: Array<{ cuenta_debito: string | null; cuenta_credito: string | null }>, tope = 5): CuentaUsada[] {
  const mapa = new Map<string, number>();
  for (const f of filas) {
    for (const c of [f.cuenta_debito, f.cuenta_credito]) {
      const nombre = c?.trim();
      if (nombre) mapa.set(nombre, (mapa.get(nombre) ?? 0) + 1);
    }
  }
  return [...mapa.entries()]
    .map(([cuenta, movimientos]) => ({ cuenta, movimientos }))
    .sort((a, b) => b.movimientos - a.movimientos || a.cuenta.localeCompare(b.cuenta))
    .slice(0, tope);
}

export type Franja = 'madrugada' | 'manana' | 'tarde' | 'noche';

export const FRANJAS: Array<{ clave: Franja; desde: number; hasta: number; es: string; pt: string; emoji: string }> = [
  { clave: 'madrugada', desde: 0, hasta: 5, es: 'Madrugada', pt: 'Madrugada', emoji: '🌙' },
  { clave: 'manana', desde: 6, hasta: 11, es: 'Mañana', pt: 'Manhã', emoji: '🌅' },
  { clave: 'tarde', desde: 12, hasta: 18, es: 'Tarde', pt: 'Tarde', emoji: '☀️' },
  { clave: 'noche', desde: 19, hasta: 23, es: 'Noche', pt: 'Noite', emoji: '🌃' },
];

export type ResumenFranja = { dominante: Franja | null; porcentajes: Record<Franja, number> };

// `horas` son 24 conteos de eventos (ingresos, cargas, cambios) por hora local. Con menos de 3 eventos no se opina.
export function franjaHoraria(horas: number[] | null | undefined): ResumenFranja {
  const porcentajes: Record<Franja, number> = { madrugada: 0, manana: 0, tarde: 0, noche: 0 };
  const total = (horas ?? []).reduce((a, n) => a + (n || 0), 0);
  if (!horas || total < 3) return { dominante: null, porcentajes };
  const sumas: Record<Franja, number> = { madrugada: 0, manana: 0, tarde: 0, noche: 0 };
  for (const f of FRANJAS) for (let h = f.desde; h <= f.hasta; h++) sumas[f.clave] += horas[h] || 0;
  let dominante: Franja = 'manana';
  for (const f of FRANJAS) {
    porcentajes[f.clave] = Math.round((sumas[f.clave] / total) * 100);
    if (sumas[f.clave] > sumas[dominante]) dominante = f.clave;
  }
  return { dominante, porcentajes };
}

export type RolEquipo = 'carga' | 'corrige' | 'configura';

// Qué hace más cada persona: cargar operaciones, corregirlas o configurar cuentas y reglas.
export function rolDelEquipo(v: { operaciones: number; ediciones: number; configuracion: number }): RolEquipo | null {
  const mayor = Math.max(v.operaciones, v.ediciones, v.configuracion);
  if (mayor < 3) return null;
  if (v.operaciones === mayor) return 'carga';
  if (v.configuracion === mayor) return 'configura';
  return 'corrige';
}

// % de operaciones cargadas que no hizo falta corregir; sin opinión con menos de 5 cargas.
export function prolijidad(operaciones: number, ediciones: number): number | null {
  if (operaciones < 5) return null;
  return Math.round(Math.max(0, 1 - ediciones / operaciones) * 100);
}

export function haceCuanto(iso: string | null, ahoraMs: number, idioma: string | null | undefined): string {
  const pt = idioma === 'PT';
  if (!iso) return '—';
  const dias = Math.floor((ahoraMs - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return pt ? 'hoje' : 'hoy';
  if (dias === 1) return pt ? 'ontem' : 'ayer';
  return pt ? `há ${dias} dias` : `hace ${dias} días`;
}

export type UsoPersona = { segundos: number; sesiones: number; dias: number; rutaFavorita: string | null };

// Tiempo, sesiones, días y pantalla favorita por persona. Entre las pantallas se prefieren las medidas de verdad; el estimado
// del pasado solo decide si todavía no hay nada medido.
export function usoPorPersona(filas: FilaActividad[]): Map<string, UsoPersona> {
  const porUsuario = new Map<string, FilaActividad[]>();
  for (const f of filas) porUsuario.set(f.usuario_id, [...(porUsuario.get(f.usuario_id) ?? []), f]);
  const salida = new Map<string, UsoPersona>();
  for (const [id, fs] of porUsuario) {
    const medidas = fs.filter((f) => !f.estimado);
    const top = usoPorHerramienta(medidas.length > 0 ? medidas : fs)[0];
    salida.set(id, {
      segundos: fs.reduce((a, f) => a + f.segundos, 0),
      sesiones: fs.reduce((a, f) => a + f.sesiones, 0),
      dias: new Set(fs.map((f) => f.fecha)).size,
      rutaFavorita: top?.ruta ?? null,
    });
  }
  return salida;
}

export type PuntoAcumulado = { semana: string; total: number };

function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Curva de crecimiento: operaciones acumuladas semana a semana desde la primera, incluyendo las semanas sin movimiento.
export function acumuladoSemanal(fechas: string[], hoy: string): PuntoAcumulado[] {
  if (fechas.length === 0) return [];
  const porSemana = new Map<string, number>();
  for (const f of fechas) porSemana.set(lunesDe(f), (porSemana.get(lunesDe(f)) ?? 0) + 1);
  const ultima = lunesDe(hoy);
  const puntos: PuntoAcumulado[] = [];
  let acumulado = 0;
  for (let s = lunesDe([...fechas].sort()[0]); s <= ultima; s = sumarDias(s, 7)) {
    acumulado += porSemana.get(s) ?? 0;
    puntos.push({ semana: s, total: acumulado });
  }
  return puntos;
}

// ---------------------------------------------------------------- latido (cliente)

export async function enviarLatido(ruta: string, segundos: number, visita: boolean, nuevaSesion: boolean): Promise<void> {
  try {
    await supabase.rpc('registrar_actividad', { p_ruta: ruta, p_segundos: Math.max(0, Math.round(segundos)), p_visita: visita, p_nueva_sesion: nuevaSesion });
  } catch {
    /* medir nunca debe romper la pantalla */
  }
}

export async function obtenerActividad(empresaId: string): Promise<FilaActividad[]> {
  const { data, error } = await supabase
    .from('actividad_uso')
    .select('usuario_id, fecha, ruta, segundos, visitas, sesiones, estimado')
    .eq('empresa_id', empresaId)
    .order('fecha', { ascending: true })
    .limit(10000);
  if (error) throw error;
  return (data ?? []) as FilaActividad[];
}
