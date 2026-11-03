'use client';

// Mide el tiempo de uso real (ver lib/actividad.ts): un latido cada 30 s mientras la pestaña está visible, sumado a la
// pantalla en la que está la persona. Al cambiar de pantalla se manda lo que quedó pendiente a la pantalla anterior,
// para que el tiempo no se le atribuya a la nueva.

import { useEffect, useRef } from 'react';
import { enviarLatido } from '@/lib/actividad';

const CADA_MS = 30000;
const SESION_VENCE_MS = 30 * 60 * 1000;
const CLAVE_SESION = 'vf_ultimo_latido';

function leerUltimoLatido(): number {
  try {
    return Number(window.sessionStorage.getItem(CLAVE_SESION) ?? 0);
  } catch {
    return 0;
  }
}

function guardarUltimoLatido(ms: number) {
  try {
    window.sessionStorage.setItem(CLAVE_SESION, String(ms));
  } catch {
    /* sin almacenamiento: solo se pierde la distinción de sesiones */
  }
}

export function useLatidoActividad(ruta: string | null, activo: boolean) {
  const rutaRef = useRef<string | null>(null);
  const desdeRef = useRef<number>(0);

  useEffect(() => {
    if (!activo || !ruta) return;

    // Una «sesión» nueva: primera vez en esta pestaña o más de 30 minutos sin latidos.
    const ahora = Date.now();
    const nueva = ahora - leerUltimoLatido() > SESION_VENCE_MS;
    guardarUltimoLatido(ahora);
    rutaRef.current = ruta;
    desdeRef.current = document.visibilityState === 'visible' ? ahora : 0;
    void enviarLatido(ruta, 0, true, nueva);

    function volcar() {
      if (!rutaRef.current || desdeRef.current === 0) return;
      const t = Date.now();
      const segundos = Math.min((t - desdeRef.current) / 1000, 120);
      desdeRef.current = t;
      guardarUltimoLatido(t);
      if (segundos >= 1) void enviarLatido(rutaRef.current, segundos, false, false);
    }

    function alCambiarVisibilidad() {
      if (document.visibilityState === 'hidden') {
        volcar();
        desdeRef.current = 0;
      } else {
        desdeRef.current = Date.now();
      }
    }

    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') volcar();
    }, CADA_MS);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      volcar();
    };
  }, [ruta, activo]);
}
