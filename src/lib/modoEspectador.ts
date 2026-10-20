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
export const PREFIJO_INFORME = 'INFORMES_'; // + id de la pestaña: BALANCE, RESULTADO, FLUJO, MAYOR, SUMAS

const SIEMPRE_PERMITIDAS = ['/', '/demo', '/login'];

const SECCION_DE_RUTA: Record<string, string> = {
  '/panel-de-control': SECCION_PANEL,
  '/contabilidad': SECCION_CONTABILIDAD,
  '/finanzas': SECCION_FINANZAS,
};

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
