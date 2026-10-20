'use client';

// Todo lo que cambia cuando quien mira es un espectador de la demo (ver lib/modoEspectador.ts):
//   - cinta "modo demo" con salida,
//   - corta el acceso a las pantallas que no son de la demo y avisa,
//   - registra qué mira y qué toca (para el seguimiento posterior).
// Con cualquier otro usuario no hace nada.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  EVENTO_PANTALLA_BLOQUEADA,
  leerEspectador,
  limpiarEspectador,
  mensajePantallaBloqueada,
  rutaPermitidaEnDemo,
  type EstadoEspectador,
} from '@/lib/modoEspectador';

type EventoPendiente = { user_id: string; ruta: string; tipo: string; detalle: string | null };

export function useEspectador(): EstadoEspectador | null {
  const [estado, setEstado] = useState<EstadoEspectador | null>(null);

  useEffect(() => {
    setEstado(leerEspectador());
  }, []);

  return estado;
}

export function ProveedorEspectador() {
  const pathname = usePathname();
  const router = useRouter();
  const espectador = useEspectador();
  const [aviso, setAviso] = useState('');
  const cola = useRef<EventoPendiente[]>([]);

  const mostrarAviso = useCallback(() => {
    const actual = leerEspectador();
    if (!actual) return;
    setAviso(mensajePantallaBloqueada(actual.idioma));
    window.setTimeout(() => setAviso(''), 5000);
  }, []);

  const vaciar = useCallback(async () => {
    if (cola.current.length === 0) return;
    const lote = cola.current.splice(0, cola.current.length);
    await supabase.from('espectador_eventos').insert(lote);
  }, []);

  const registrar = useCallback((tipo: string, detalle: string | null) => {
    const actual = leerEspectador();
    if (!actual) return;
    cola.current.push({ user_id: actual.userId, ruta: window.location.pathname, tipo, detalle });
  }, []);

  // Pantallas que no son de la demo: vuelven al lobby con un aviso.
  useEffect(() => {
    if (!espectador || rutaPermitidaEnDemo(pathname)) return;
    mostrarAviso();
    router.replace('/');
  }, [espectador, pathname, router, mostrarAviso]);

  // Cada pantalla que mira.
  useEffect(() => {
    if (!espectador) return;
    registrar('VISTA', null);
  }, [espectador, pathname, registrar]);

  // Cada botón o pestaña que toca (solo su texto corto) y los avisos de bloqueo.
  useEffect(() => {
    if (!espectador) return;

    const alTocar = (evento: MouseEvent) => {
      const boton = (evento.target as HTMLElement | null)?.closest('button, a, [role="tab"]');
      const texto = boton?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60);
      if (texto) registrar('CLICK', texto);
    };

    const alBloquear = () => {
      mostrarAviso();
      registrar('BLOQUEADO', null);
    };

    document.addEventListener('click', alTocar, true);
    window.addEventListener(EVENTO_PANTALLA_BLOQUEADA, alBloquear);
    const intervalo = window.setInterval(vaciar, 5000);
    const alSalir = () => {
      void vaciar();
    };
    window.addEventListener('pagehide', alSalir);

    return () => {
      document.removeEventListener('click', alTocar, true);
      window.removeEventListener(EVENTO_PANTALLA_BLOQUEADA, alBloquear);
      window.clearInterval(intervalo);
      window.removeEventListener('pagehide', alSalir);
    };
  }, [espectador, registrar, vaciar, mostrarAviso]);

  async function salir() {
    await vaciar();
    limpiarEspectador();
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (!espectador || pathname?.startsWith('/demo')) return null;

  const esPT = espectador.idioma === 'PT';

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          borderRadius: 999,
          background: 'rgba(31,58,95,0.94)',
          color: '#fff',
          fontSize: 12.5,
          fontWeight: 700,
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        }}
      >
        <span>{esPT ? '👀 Modo demonstração: só leitura' : '👀 Modo demo: solo lectura'}</span>
        <button
          type="button"
          onClick={salir}
          style={{ border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 11.5, cursor: 'pointer' }}
        >
          {esPT ? 'Sair' : 'Salir'}
        </button>
      </div>

      {aviso && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 64,
            transform: 'translateX(-50%)',
            zIndex: 9999,
            maxWidth: 'min(92vw, 520px)',
            padding: '12px 18px',
            borderRadius: 14,
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            color: '#78350f',
            fontWeight: 700,
            fontSize: 14,
            textAlign: 'center',
            boxShadow: '0 10px 28px rgba(0,0,0,0.25)',
          }}
        >
          {aviso}
        </div>
      )}
    </>
  );
}

// Envuelve algo que el espectador ve pero no puede usar: lo tapa con un candado y avisa al tocarlo.
export function BloqueoDemo({ children, radio = 24 }: { children: React.ReactNode; radio?: number }) {
  const espectador = useEspectador();

  if (!espectador) return <>{children}</>;

  return (
    <div style={{ position: 'relative' }}>
      {children}
      <button
        type="button"
        aria-label="🔒"
        onClick={() => window.dispatchEvent(new Event(EVENTO_PANTALLA_BLOQUEADA))}
        style={{
          position: 'absolute',
          inset: 0,
          border: 'none',
          borderRadius: radio,
          background: 'rgba(255,255,255,0.35)',
          cursor: 'not-allowed',
          fontSize: 28,
        }}
      >
        🔒
      </button>
    </div>
  );
}
