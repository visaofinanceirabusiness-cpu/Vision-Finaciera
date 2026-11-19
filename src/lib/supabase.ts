// lib/supabase.ts
// Conexión central a la base de datos. Todas las pantallas de la app
// importan este archivo en vez de conectarse "a mano" cada vez.

import { createClient } from '@supabase/supabase-js';
import {
  aplicarIdiomaEspectador,
  EVENTO_ACCION_DEMO,
  leerEspectador,
  limpiarEspectador,
  mensajeNoBorrarEnDemo,
  mensajeSoloLectura,
  TABLAS_CALENDARIO_DEMO,
} from './modoEspectador';

// Estas dos claves las vas a copiar desde Supabase:
// Project Settings → API → "Project URL" y "anon public key"
// En Vercel se configuran como variables de entorno (te guío en ese paso).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Solo para el espectador de la demo (ver lib/modoEspectador.ts): sus escrituras se
// cortan acá con un mensaje claro (la base igual las bloquea) y la empresa se le
// muestra en el idioma que eligió. Para cualquier otro usuario pasa derecho.
async function fetchConModoEspectador(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const espectador = leerEspectador();
  if (!espectador) return fetch(input, init);

  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const metodo = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  const esDatos = url.includes('/rest/v1/') || url.includes('/storage/v1/');
  const esLectura = metodo === 'GET' || metodo === 'HEAD';
  // El espectador registra su propia actividad y los rpc son consultas (la base cuida los que escriben).
  const esExcepcion = url.includes('/rest/v1/espectador_eventos') || url.includes('/rest/v1/rpc/');

  const tablaCalendario = TABLAS_CALENDARIO_DEMO.find((tabla) => url.includes(`/rest/v1/${tabla}`));
  const esEscrituraCalendario = Boolean(tablaCalendario) && (metodo === 'POST' || metodo === 'PATCH');

  if (esEscrituraCalendario) {
    let titulo = '';
    try {
      const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      const fila = Array.isArray(cuerpo) ? cuerpo[0] : cuerpo;
      titulo = String(fila?.titulo ?? fila?.texto ?? '').slice(0, 60);
    } catch {
      // sin título legible: se registra igual la acción
    }
    const accion = metodo === 'POST' ? 'creó' : 'editó';
    const objeto = tablaCalendario === 'eventos_calendario' ? 'evento' : 'anotación';
    window.dispatchEvent(new CustomEvent(EVENTO_ACCION_DEMO, { detail: { tipo: 'CALENDARIO', detalle: `${accion} ${objeto}${titulo ? `: ${titulo}` : ''}` } }));
  }

  if (tablaCalendario && metodo === 'DELETE') {
    window.dispatchEvent(new CustomEvent(EVENTO_ACCION_DEMO, { detail: { tipo: 'BLOQUEADO', detalle: `intentó eliminar ${tablaCalendario === 'eventos_calendario' ? 'evento' : 'anotación'}` } }));
    return new Response(JSON.stringify({ message: mensajeNoBorrarEnDemo(espectador.idioma), code: 'ESPECTADOR_SOLO_LECTURA' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (esDatos && !esLectura && !esExcepcion && !esEscrituraCalendario) {
    return new Response(JSON.stringify({ message: mensajeSoloLectura(espectador.idioma), code: 'ESPECTADOR_SOLO_LECTURA' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const respuesta = await fetch(input, init);

  if (esLectura && url.includes('/rest/v1/empresas') && respuesta.ok) {
    try {
      const texto = await respuesta.clone().text();
      const ajustado = JSON.stringify(aplicarIdiomaEspectador(JSON.parse(texto), espectador.idioma));
      const cabeceras = new Headers(respuesta.headers);
      cabeceras.delete('content-length');
      return new Response(ajustado, { status: respuesta.status, statusText: respuesta.statusText, headers: cabeceras });
    } catch {
      return respuesta;
    }
  }

  return respuesta;
}

const clienteDelNavegador = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConModoEspectador },
});

// SOLO SERVIDOR — lo usa Sabio Soporte (lib/sabioSoporte): el motor contable y sus ayudantes importan `supabase` de acá, y desde una ruta de
// servidor hay que hacerlos trabajar con un cliente de servicio (sin sesión de navegador). Se activa dentro de una ruta que procesa de a una
// tarea y siempre se restaura en un `finally` (ver ejecutor de Sabio Soporte). En el navegador nunca se usa.
let clienteAlternativo: typeof clienteDelNavegador | null = null;

export function usarClienteDeServicio(cliente: typeof clienteDelNavegador | null): void {
  clienteAlternativo = cliente;
}

export const supabase: typeof clienteDelNavegador = new Proxy(clienteDelNavegador, {
  get(destino, propiedad) {
    const actual = clienteAlternativo ?? destino;
    const valor = Reflect.get(actual, propiedad, actual);
    return typeof valor === 'function' ? valor.bind(actual) : valor;
  },
});

// Si alguien entra con otra cuenta en un navegador que había usado la demo, deja de ser espectador.
if (typeof window !== 'undefined') {
  clienteDelNavegador.auth.onAuthStateChange((evento, sesion) => {
    const espectador = leerEspectador();
    if (!espectador) return;
    if (evento === 'SIGNED_OUT' || (evento === 'SIGNED_IN' && sesion?.user && sesion.user.id !== espectador.userId)) {
      limpiarEspectador();
    }
  });
}
