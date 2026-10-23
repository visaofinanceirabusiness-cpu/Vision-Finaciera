// lib/modoEspectador.ts
//
// MODO ESPECTADOR (demo en vivo, ej. clases / presentaciones)
// =====================================================
//
// Un espectador entra por un código/QR sin registrarse: se le crea un usuario con
// tipo_usuario 'ESPECTADOR' ligado a la empresa demo. En la base nunca puede
// escribir (políticas restrictivas en todas las tablas); acá se guarda, en el
// navegador, quién es y en qué idioma quiere ver la demo, para que lib/supabase.ts
// le conteste con un mensaje claro en vez de un error de permisos y le muestre el
// sistema en el idioma que eligió (la empresa demo tiene uno solo).

export type Idioma = 'ES' | 'PT';

export type EstadoEspectador = {
  userId: string;
  idioma: Idioma;
  apodo?: string;
  sabio?: string;
};

const CLAVE = 'demo:espectador';

// Qué puede abrir el espectador: el lobby (con el Mini-Juego simulado) siempre; el resto lo libera
// quien presenta, de a una (demo_accesos.habilitadas). Lo demás del sistema se ve, pero bloqueado.
export const SECCION_PANEL = 'PANEL';
export const SECCION_CONTABILIDAD = 'CONTABILIDAD';
export const SECCION_FINANZAS = 'FINANZAS';
export const SECCION_MERCADERIA = 'MERCADERIA';
export const SECCION_PRODUCCION = 'PRODUCCION';
export const SECCION_RRHH = 'RRHH';
export const SECCION_VISAO3D = 'VISAO3D';
export const SECCION_PLAN_ACCION = 'PLAN_ACCION';
export const SECCION_SUENO = 'NUESTRO_SUENO';
export const SECCION_MENSAJES = 'MENSAJES';
export const SECCION_CONFIG = 'CONFIGURACOES';
export const PREFIJO_INFORME = 'INFORMES_'; // + id de la pestaña: BALANCE, RESULTADO, FLUJO, MAYOR, SUMAS

const SIEMPRE_PERMITIDAS = ['/', '/demo', '/login'];

// Cada herramienta del sistema se habilita de a una. Las pantallas que cuelgan de una herramienta (libro diario, registros y
// lanzamiento rápido de Contabilidad; stock y movimientos de Mercadería) se abren con la herramienta madre.
const SECCION_DE_RUTA: Record<string, string> = {
  '/panel-de-control': SECCION_PANEL,
  '/contabilidad': SECCION_CONTABILIDAD,
  '/libro-diario': SECCION_CONTABILIDAD,
  '/diario': SECCION_CONTABILIDAD,
  '/registros': SECCION_CONTABILIDAD,
  '/lanzamiento-rapido': SECCION_CONTABILIDAD,
  '/finanzas': SECCION_FINANZAS,
  '/mercaderia': SECCION_MERCADERIA,
  '/stock': SECCION_MERCADERIA,
  '/movimientos-stock': SECCION_MERCADERIA,
  '/produccion': SECCION_PRODUCCION,
  '/recursos-humanos': SECCION_RRHH,
  '/visao-3d': SECCION_VISAO3D,
  '/plan-accion': SECCION_PLAN_ACCION,
  '/nuestro-sueno': SECCION_SUENO,
  '/mensajes': SECCION_MENSAJES,
  '/configuracoes': SECCION_CONFIG,
};

// Lista que ven quien presenta (lobby de la demo) y el Panel Maestro para ir habilitando. Los Informes van aparte, pestaña por pestaña.
export const HERRAMIENTAS_DEMO: { clave: string; es: string; pt: string }[] = [
  { clave: SECCION_PANEL, es: 'Panel de Control', pt: 'Painel de Controle' },
  { clave: SECCION_CONTABILIDAD, es: 'Contabilidad', pt: 'Contabilidade' },
  { clave: SECCION_FINANZAS, es: 'Finanzas', pt: 'Finanças' },
  { clave: SECCION_MERCADERIA, es: 'Mercadería', pt: 'Mercadoria' },
  { clave: SECCION_PRODUCCION, es: 'Producción', pt: 'Produção' },
  { clave: SECCION_RRHH, es: 'Recursos Humanos', pt: 'Recursos Humanos' },
  { clave: SECCION_VISAO3D, es: 'Visión 3D', pt: 'Visão 3D' },
  { clave: SECCION_PLAN_ACCION, es: 'Plan de Acción', pt: 'Plano de Ação' },
  { clave: SECCION_SUENO, es: 'Nuestro Sueño', pt: 'Nosso Sonho' },
  { clave: SECCION_MENSAJES, es: 'Mensajes', pt: 'Mensagens' },
  { clave: SECCION_CONFIG, es: 'Configuraciones', pt: 'Configurações' },
];

export const INFORMES_DEMO: { clave: string; es: string; pt: string }[] = [
  { clave: `${PREFIJO_INFORME}BALANCE`, es: 'Balance Patrimonial (ESP)', pt: 'Balanço Patrimonial (ESP)' },
  { clave: `${PREFIJO_INFORME}RESULTADO`, es: 'DRE — Estado de Resultado', pt: 'DRE — Demonstração de Resultado' },
  { clave: `${PREFIJO_INFORME}FLUJO`, es: 'Flujo de Caja', pt: 'Fluxo de Caixa' },
  { clave: `${PREFIJO_INFORME}MAYOR`, es: 'Mayor', pt: 'Razão' },
  { clave: `${PREFIJO_INFORME}SUMAS`, es: 'Sumas y Saldos', pt: 'Balancete' },
];

export function rutaPermitidaEnDemo(ruta: string | null | undefined, habilitadas: string[]): boolean {
  if (!ruta || SIEMPRE_PERMITIDAS.some((p) => ruta === p || (p !== '/' && ruta.startsWith(`${p}/`)))) return true;
  if (ruta === '/informes' || ruta.startsWith('/informes/')) return habilitadas.some((h) => h.startsWith(PREFIJO_INFORME));

  const base = Object.keys(SECCION_DE_RUTA).find((r) => ruta === r || ruta.startsWith(`${r}/`));
  return base ? habilitadas.includes(SECCION_DE_RUTA[base]) : false;
}

export function pestanaInformeHabilitada(pestana: string, habilitadas: string[]): boolean {
  return habilitadas.includes(`${PREFIJO_INFORME}${pestana.toUpperCase()}`);
}

export function leerEspectador(): EstadoEspectador | null {
  if (typeof window === 'undefined') return null;

  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as EstadoEspectador;
    return dato?.userId && (dato.idioma === 'ES' || dato.idioma === 'PT') ? dato : null;
  } catch {
    return null;
  }
}

export function guardarEspectador(estado: EstadoEspectador): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // sin almacenamiento el espectador igual queda bloqueado por la base
  }
}

export function limpiarEspectador(): void {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // nada que limpiar
  }
}

export function mensajeSoloLectura(idioma: Idioma): string {
  return idioma === 'PT'
    ? 'Modo demonstração: você só pode ver. Esta ação está disponível no sistema completo.'
    : 'Modo demo: solo podés mirar. Esta acción está disponible en el sistema completo.';
}

export const EVENTO_ACCION_DEMO = 'demo:accion';

// Tablas donde el espectador participa (crea y edita), pero nunca borra: así siente que forma parte.
export const TABLAS_CALENDARIO_DEMO = ['eventos_calendario', 'calendario_anotaciones'];

export function mensajeNoBorrarEnDemo(idioma: Idioma): string {
  return idioma === 'PT'
    ? 'Na demonstração você pode criar e editar eventos, mas não excluir.'
    : 'En la demo podés crear y editar eventos, pero no eliminarlos.';
}

export function mensajePantallaBloqueada(idioma: Idioma): string {
  return idioma === 'PT'
    ? '🔒 Esta tela será liberada em breve (ou faz parte do sistema completo).'
    : '🔒 Esta pantalla se habilitará en breve (o es parte del sistema completo).';
}

export const EVENTO_PANTALLA_BLOQUEADA = 'demo:pantalla-bloqueada';

// Aplica el idioma elegido a las filas de `empresas` que devuelve la API.
export function aplicarIdiomaEspectador(json: unknown, idioma: Idioma): unknown {
  const ajustar = (fila: unknown) => {
    if (fila && typeof fila === 'object' && 'idioma' in (fila as Record<string, unknown>)) {
      return { ...(fila as Record<string, unknown>), idioma };
    }
    return fila;
  };

  return Array.isArray(json) ? json.map(ajustar) : ajustar(json);
}
