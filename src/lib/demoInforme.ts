// lib/demoInforme.ts
//
// Informe en vivo de la demo (Panel Maestro → Demo en vivo): arma, a partir de los eventos que registra
// cada espectador (VISTA, CLICK, BLOQUEADO, LATIDO), quién está conectado, dónde, qué toca y cuánto
// tiempo pasa en cada pantalla. Todo es lectura y suma: no consulta nada.

export type EventoDemo = { user_id: string; ruta: string; tipo: string; detalle: string | null; creado_en: string };
export type EspectadorDemo = { user_id: string; nombre: string; idioma: string; sabio: string | null; creado_en: string };

export const MS_EN_LINEA = 45_000;
// Entre dos eventos seguidos de la misma persona, hasta este tiempo cuenta como "estuvo ahí".
const MS_MAX_PERMANENCIA = 90_000;

const NOMBRES_RUTA: Record<string, string> = {
  '/': 'Lobby (Mini-Juego)',
  '/panel-de-control': 'Panel de Control',
  '/informes': 'Informes',
  '/contabilidad': 'Contabilidad',
  '/finanzas': 'Finanzas',
  '/demo': 'Entrada (QR)',
};

export function nombreRuta(ruta: string): string {
  return NOMBRES_RUTA[ruta] ?? ruta;
}

export type FilaEspectador = EspectadorDemo & {
  eventos: number;
  clicks: number;
  bloqueos: number;
  primeraActividad: string | null;
  ultimaActividad: string | null;
  enLinea: boolean;
  rutaActual: string | null;
  segundosPorRuta: Record<string, number>;
  vistasPorRuta: Record<string, number>;
};

// Lo que hacen en el calendario, las noticias y las cotizaciones (zonas marcadas con data-seguimiento).
export type ParticipacionDemo = {
  calendario: { creados: number; editados: number; intentosBorrar: number; personas: number; ultimos: { texto: string; cuando: string }[] };
  noticias: { texto: string; veces: number; personas: number }[];
  cotizaciones: { texto: string; veces: number; personas: number }[];
};

function contarPorZona(eventos: EventoDemo[], zona: string): { texto: string; veces: number; personas: number }[] {
  const prefijo = `${zona} › `;
  const mapa = new Map<string, { veces: number; quienes: Set<string> }>();
  for (const e of eventos) {
    if ((e.tipo !== 'CLICK' && e.tipo !== 'CAMBIO') || !e.detalle?.startsWith(prefijo)) continue;
    const texto = e.detalle.slice(prefijo.length);
    if (!texto) continue;
    const actual = mapa.get(texto) ?? { veces: 0, quienes: new Set<string>() };
    actual.veces += 1;
    actual.quienes.add(e.user_id);
    mapa.set(texto, actual);
  }
  return Array.from(mapa.entries())
    .map(([texto, v]) => ({ texto, veces: v.veces, personas: v.quienes.size }))
    .sort((a, b) => b.veces - a.veces);
}

export function armarParticipacion(eventos: EventoDemo[]): ParticipacionDemo {
  const calendario = eventos.filter((e) => e.tipo === 'CALENDARIO');
  return {
    calendario: {
      creados: calendario.filter((e) => e.detalle?.startsWith('creó')).length,
      editados: calendario.filter((e) => e.detalle?.startsWith('editó')).length,
      intentosBorrar: eventos.filter((e) => e.tipo === 'BLOQUEADO' && e.detalle?.startsWith('intentó eliminar')).length,
      personas: new Set(calendario.map((e) => e.user_id)).size,
      ultimos: calendario
        .slice()
        .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
        .slice(0, 8)
        .map((e) => ({ texto: e.detalle ?? '', cuando: e.creado_en })),
    },
    noticias: contarPorZona(eventos, 'Noticias'),
    cotizaciones: contarPorZona(eventos, 'Cotizaciones'),
  };
}

export type ResumenDemo = {
  total: number;
  enLinea: number;
  porIdioma: Record<string, number>;
  eventos: number;
  clicks: number;
  bloqueos: number;
  dondeEstan: Record<string, number>;
  pantallas: { ruta: string; vistas: number; segundos: number; personas: number }[];
  botones: { texto: string; veces: number; personas: number }[];
  filas: FilaEspectador[];
};

export function armarInforme(espectadores: EspectadorDemo[], eventos: EventoDemo[], ahora: number = Date.now()): ResumenDemo {
  const porUsuario = new Map<string, EventoDemo[]>();
  for (const e of eventos) porUsuario.set(e.user_id, [...(porUsuario.get(e.user_id) ?? []), e]);

  const filas: FilaEspectador[] = espectadores.map((esp) => {
    const lista = (porUsuario.get(esp.user_id) ?? []).slice().sort((a, b) => a.creado_en.localeCompare(b.creado_en));
    const segundosPorRuta: Record<string, number> = {};
    const vistasPorRuta: Record<string, number> = {};

    lista.forEach((e, i) => {
      if (e.tipo === 'VISTA') vistasPorRuta[e.ruta] = (vistasPorRuta[e.ruta] ?? 0) + 1;
      const siguiente = lista[i + 1];
      const hasta = siguiente ? new Date(siguiente.creado_en).getTime() : Math.min(ahora, new Date(e.creado_en).getTime() + MS_MAX_PERMANENCIA);
      const ms = Math.min(Math.max(hasta - new Date(e.creado_en).getTime(), 0), MS_MAX_PERMANENCIA);
      segundosPorRuta[e.ruta] = (segundosPorRuta[e.ruta] ?? 0) + Math.round(ms / 1000);
    });

    const ultimo = lista[lista.length - 1];
    const ultimaMs = ultimo ? new Date(ultimo.creado_en).getTime() : 0;

    return {
      ...esp,
      eventos: lista.length,
      clicks: lista.filter((e) => e.tipo === 'CLICK').length,
      bloqueos: lista.filter((e) => e.tipo === 'BLOQUEADO').length,
      primeraActividad: lista[0]?.creado_en ?? null,
      ultimaActividad: ultimo?.creado_en ?? null,
      enLinea: Boolean(ultimo) && ahora - ultimaMs <= MS_EN_LINEA,
      rutaActual: ultimo ? ultimo.ruta : null,
      segundosPorRuta,
      vistasPorRuta,
    };
  });

  const pantallasMapa = new Map<string, { vistas: number; segundos: number; personas: number }>();
  for (const f of filas) {
    for (const ruta of new Set([...Object.keys(f.segundosPorRuta), ...Object.keys(f.vistasPorRuta)])) {
      const actual = pantallasMapa.get(ruta) ?? { vistas: 0, segundos: 0, personas: 0 };
      actual.vistas += f.vistasPorRuta[ruta] ?? 0;
      actual.segundos += f.segundosPorRuta[ruta] ?? 0;
      actual.personas += 1;
      pantallasMapa.set(ruta, actual);
    }
  }

  const botonesMapa = new Map<string, { veces: number; quienes: Set<string> }>();
  for (const e of eventos) {
    if (e.tipo !== 'CLICK' || !e.detalle) continue;
    const actual = botonesMapa.get(e.detalle) ?? { veces: 0, quienes: new Set<string>() };
    actual.veces += 1;
    actual.quienes.add(e.user_id);
    botonesMapa.set(e.detalle, actual);
  }

  const dondeEstan: Record<string, number> = {};
  for (const f of filas) if (f.enLinea && f.rutaActual) dondeEstan[f.rutaActual] = (dondeEstan[f.rutaActual] ?? 0) + 1;

  const porIdioma: Record<string, number> = {};
  for (const e of espectadores) porIdioma[e.idioma] = (porIdioma[e.idioma] ?? 0) + 1;

  return {
    total: espectadores.length,
    enLinea: filas.filter((f) => f.enLinea).length,
    porIdioma,
    eventos: eventos.filter((e) => e.tipo !== 'LATIDO').length,
    clicks: eventos.filter((e) => e.tipo === 'CLICK').length,
    bloqueos: eventos.filter((e) => e.tipo === 'BLOQUEADO').length,
    dondeEstan,
    pantallas: Array.from(pantallasMapa.entries())
      .map(([ruta, v]) => ({ ruta, ...v }))
      .sort((a, b) => b.segundos - a.segundos || b.vistas - a.vistas),
    botones: Array.from(botonesMapa.entries())
      .map(([texto, v]) => ({ texto, veces: v.veces, personas: v.quienes.size }))
      .sort((a, b) => b.veces - a.veces),
    filas: filas.sort((a, b) => Number(b.enLinea) - Number(a.enLinea) || (b.ultimaActividad ?? '').localeCompare(a.ultimaActividad ?? '')),
  };
}

export function formatoDuracion(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const min = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto ? `${min} min ${resto} s` : `${min} min`;
}

function celdaCsv(valor: string): string {
  return /[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

// Para llevarse todo el detalle (análisis posterior al evento).
export function eventosACsv(espectadores: EspectadorDemo[], eventos: EventoDemo[]): string {
  const nombres = new Map(espectadores.map((e) => [e.user_id, e.nombre]));
  const filas = [['fecha_hora', 'espectador', 'user_id', 'tipo', 'pantalla', 'detalle']];
  for (const e of eventos.slice().sort((a, b) => a.creado_en.localeCompare(b.creado_en))) {
    if (e.tipo === 'LATIDO') continue;
    filas.push([e.creado_en, nombres.get(e.user_id) ?? '', e.user_id, e.tipo, nombreRuta(e.ruta), e.detalle ?? '']);
  }
  return filas.map((f) => f.map(celdaCsv).join(',')).join('\n');
}
