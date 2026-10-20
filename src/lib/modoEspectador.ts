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

// Lo único que el espectador puede abrir; el resto del sistema lo ve (bloqueado) en el lobby.
export const RUTAS_DEMO_PERMITIDAS = ['/', '/panel-de-control', '/informes', '/contabilidad', '/finanzas', '/demo', '/login'];

export function rutaPermitidaEnDemo(ruta: string | null | undefined): boolean {
  if (!ruta) return true;
  return RUTAS_DEMO_PERMITIDAS.some((permitida) => ruta === permitida || (permitida !== '/' && ruta.startsWith(`${permitida}/`)));
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

export function mensajePantallaBloqueada(idioma: Idioma): string {
  return idioma === 'PT'
    ? '🔒 Esta tela faz parte do sistema completo, mas não está disponível na demonstração.'
    : '🔒 Esta pantalla es parte del sistema completo, pero no está disponible en la demo.';
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
