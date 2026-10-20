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
  guardarEspectador,
  leerEspectador,
  limpiarEspectador,
  mensajePantallaBloqueada,
  rutaPermitidaEnDemo,
  type EstadoEspectador,
  type Idioma,
} from '@/lib/modoEspectador';
import { fijarEstadoDemo, useEstadoDemo } from '@/lib/demoEstado';

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
  const demo = useEstadoDemo();
  const [aviso, setAviso] = useState('');
  const cola = useRef<EventoPendiente[]>([]);

  // Lo que quien presenta habilitó (y el nombre de la empresa para el título): se relee cada pocos segundos.
  useEffect(() => {
    if (!espectador) return;
    let cancelado = false;

    async function leer() {
      const { data } = await supabase.rpc('demo_estado');
      if (cancelado || !data) return;
      const estado = data as { habilitadas?: string[]; activo?: boolean };
      fijarEstadoDemo({ habilitadas: estado.habilitadas ?? [], activo: estado.activo !== false, cargado: true });
    }

    async function leerEmpresa() {
      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', espectador!.userId).maybeSingle();
      if (!perfil?.empresa_id || cancelado) return;
      const { data: empresa } = await supabase.from('empresas').select('nombre').eq('id', perfil.empresa_id).maybeSingle();
      if (!cancelado && empresa?.nombre) fijarEstadoDemo({ empresa: empresa.nombre });
    }

    void leer();
    void leerEmpresa();
    const intervalo = window.setInterval(leer, 4000);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void leer();
    };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [espectador]);

  // Pestaña del navegador: "Visão Financeira - <empresa demo>".
  useEffect(() => {
    if (!espectador || !demo.empresa) return;
    document.title = `Visão Financeira - ${demo.empresa}`;
  }, [espectador, demo.empresa, pathname]);

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

  // Pantallas que todavía no están habilitadas: vuelven al lobby con un aviso.
  useEffect(() => {
    if (!espectador || !demo.cargado) return;
    if (!demo.activo ? pathname !== '/' && !pathname?.startsWith('/demo') : rutaPermitidaEnDemo(pathname, demo.habilitadas)) return;
    mostrarAviso();
    router.replace('/');
  }, [espectador, demo.cargado, demo.activo, demo.habilitadas, pathname, router, mostrarAviso]);

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
    // Latido cada ~30 s: quien presenta ve quién sigue conectado aunque no toque nada.
    let vuelta = 0;
    const intervalo = window.setInterval(() => {
      vuelta += 1;
      if (vuelta % 6 === 0) registrar('LATIDO', null);
      void vaciar();
    }, 5000);
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

  // Reversible: se puede volver al otro idioma cuando se quiera.
  function cambiarIdioma(nuevo: Idioma) {
    if (!espectador || nuevo === espectador.idioma) return;
    guardarEspectador({ ...espectador, idioma: nuevo });
    window.location.reload();
  }

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
        <span>{!demo.activo ? (esPT ? '⏹ Demonstração encerrada' : '⏹ Demo finalizada') : esPT ? '👀 Modo demonstração: só leitura' : '👀 Modo demo: solo lectura'}</span>
        <span style={{ display: 'inline-flex', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 999, overflow: 'hidden' }}>
          {(['PT', 'ES'] as const).map((codigo) => (
            <button
              key={codigo}
              type="button"
              onClick={() => cambiarIdioma(codigo)}
              aria-pressed={espectador.idioma === codigo}
              style={{
                border: 'none',
                padding: '3px 9px',
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
                background: espectador.idioma === codigo ? '#fff' : 'transparent',
                color: espectador.idioma === codigo ? '#1f3a5f' : '#fff',
              }}
            >
              {codigo}
            </button>
          ))}
        </span>
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
// Con `seccion`, solo queda bloqueado mientras quien presenta no la habilite (ej. el banner del Panel de Control).
export function BloqueoDemo({ children, radio = 24, seccion }: { children: React.ReactNode; radio?: number; seccion?: string }) {
  const espectador = useEspectador();
  const demo = useEstadoDemo();

  if (!espectador || (seccion && demo.habilitadas.includes(seccion))) return <>{children}</>;

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
