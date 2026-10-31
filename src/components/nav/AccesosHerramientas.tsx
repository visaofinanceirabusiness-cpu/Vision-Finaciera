'use client';

// ACCESOS RÁPIDOS ENTRE HERRAMIENTAS
// =====================================================
//
// Antes, para pasar de una herramienta a otra había que volver al
// lobby y entrar de nuevo. Esta fila de íconos (solo el emoji, con el
// nombre apareciendo al pasar el mouse) va al lado del "Volver" de
// cada herramienta, y deja saltar directo a cualquier otra — sin
// perder el botón de Volver, que sigue sirviendo para ir al lobby.
//
// Qué herramientas se muestran depende del perfil de la empresa,
// igual que en el lobby: Mercadería solo si maneja mercadería,
// Producción solo si tiene ese módulo habilitado.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CAJA_SABIO } from '@/components/panel/SabioWidget';
import { empresaManejaMercaderia, empresaTieneModulo, empresaVendeServicios } from '@/lib/perfilCapacidades';
import { useEspectador } from '@/components/demo/ProveedorEspectador';
import { useEstadoDemo } from '@/lib/demoEstado';
import { EVENTO_PANTALLA_BLOQUEADA, rutaPermitidaEnDemo } from '@/lib/modoEspectador';
import { TODAS_LAS_HERRAMIENTAS, herramientaDisponible, type Herramienta } from '@/lib/herramientasMenu';
import { useEnShell } from '@/components/shell/ShellContext';
import { cargarAperturaVisao3D } from '@/lib/visao3dApertura';

export function AccesosHerramientas({ variante = 'oscuro' }: { variante?: 'oscuro' | 'claro' }) {
  const pathname = usePathname();
  const enShell = useEnShell();
  const espectador = useEspectador();
  const demo = useEstadoDemo();
  const [disponibles, setDisponibles] = useState<Herramienta[]>([]);
  const [esPT, setEsPT] = useState(false);
  const [mensajesSinLeer, setMensajesSinLeer] = useState(0);

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id, tipo_usuario')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id) {
        return;
      }

      const { data: empresa } = await supabase.from('empresas').select('idioma, perfiles_empresa(codigo)').eq('id', perfil.empresa_id).maybeSingle();
      setEsPT(empresa?.idioma === 'PT');
      const relacionPerfil = empresa?.perfiles_empresa as { codigo: string }[] | { codigo: string } | null | undefined;
      const perfilCodigo = (Array.isArray(relacionPerfil) ? relacionPerfil[0]?.codigo : relacionPerfil?.codigo) ?? null;

      // Aviso de mensajes nuevos sobre el acceso a Mensajes (el aislamiento entre
      // empresas lo garantiza la política RLS, igual que en el lobby).
      const { count } = await supabase
        .from('mensajes_financieros')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', perfil.empresa_id)
        .eq('leido', false);
      setMensajesSinLeer(count ?? 0);

      const aperturaVisao3D = await cargarAperturaVisao3D();

      let tieneProduccion = false;

      try {
        tieneProduccion = await empresaTieneModulo(perfil.empresa_id, 'PRODUCCION');
      } catch (errorProduccion) {
        console.warn('No se pudo determinar si la empresa tiene Producción:', errorProduccion);
      }

      let manejaMercaderia = true;

      try {
        manejaMercaderia = await empresaManejaMercaderia(perfil.empresa_id);
      } catch (errorMercaderia) {
        console.warn('No se pudo determinar si la empresa maneja mercadería:', errorMercaderia);
      }

      let vendeServicios = false;

      try {
        vendeServicios = await empresaVendeServicios(perfil.empresa_id);
      } catch (errorServicios) {
        console.warn('No se pudo determinar si la empresa vende servicios:', errorServicios);
      }

      setDisponibles(
        TODAS_LAS_HERRAMIENTAS.filter((herramienta) =>
          herramientaDisponible(herramienta.href, {
            empresaId: perfil.empresa_id,
            perfilCodigo,
            tipoUsuario: perfil.tipo_usuario,
            manejaMercaderia,
            vendeServicios,
            tieneProduccion,
            aperturaVisao3D,
          })
        )
      );
    }

    cargar();
  }, []);

  // En el nuevo diseño las herramientas viven en el menú lateral.
  if (enShell || disponibles.length === 0) {
    return null;
  }

  return (
    // Misma caja que Sabio (CAJA_SABIO): los accesos se acomodan adentro, en grilla.
    <div
      style={{
        width: CAJA_SABIO.ancho,
        maxWidth: '100%',
        minHeight: CAJA_SABIO.altoMinimo,
        alignSelf: 'stretch',
        boxSizing: 'border-box',
        borderRadius: 24,
        background: variante === 'claro' ? '#f8fafc' : 'rgba(255,255,255,0.10)',
        border: variante === 'claro' ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.18)',
        padding: 12,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes accesos-mensajes-aviso-anim {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
        .accesos-mensajes-aviso { animation: accesos-mensajes-aviso-anim 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .accesos-mensajes-aviso { animation: none; } }
      `}</style>

      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: variante === 'claro' ? '#6b7280' : '#ffffff',
          opacity: 0.78,
          textAlign: 'center',
          margin: '2px 0 8px',
        }}
      >
        {esPT ? 'Suas ferramentas' : 'Tus herramientas'}
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          // Hasta 9 accesos en 3 columnas; con más, 4, para no pasar la altura de Sabio.
          gridTemplateColumns: `repeat(${disponibles.length > 9 ? 4 : 3}, 1fr)`,
          gridAutoRows: '1fr',
          gap: 8,
        }}
      >
        {disponibles.map((herramienta) => {
          const activa = pathname === herramienta.href;
          // En la demo se ven todas las herramientas, pero solo se abren las permitidas.
          const bloqueada = Boolean(espectador) && !rutaPermitidaEnDemo(herramienta.href, demo.habilitadas);

          return (
            <Link
              key={herramienta.href}
              href={bloqueada ? '#' : herramienta.href}
              onClick={
                bloqueada
                  ? (evento) => {
                      evento.preventDefault();
                      window.dispatchEvent(new Event(EVENTO_PANTALLA_BLOQUEADA));
                    }
                  : undefined
              }
              title={herramienta.titulo}
              style={{
                opacity: bloqueada ? 0.55 : 1,
                minWidth: 0,
                borderRadius: 14,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '6px 2px',
                textDecoration: 'none',
                background: activa
                  ? `${herramienta.color}33`
                  : variante === 'claro'
                    ? '#f3f4f6'
                    : 'rgba(255,255,255,0.14)',
                border: activa
                  ? `1.5px solid ${herramienta.color}`
                  : variante === 'claro'
                    ? '1px solid #d1d5db'
                    : '1px solid rgba(255,255,255,0.25)',
                cursor: 'pointer',
              }}
            >
              <span style={{ position: 'relative', fontSize: 26, lineHeight: 1 }}>
                {bloqueada ? '🔒' : herramienta.emoji}
                {herramienta.href === '/mensajes' && mensajesSinLeer > 0 && (
                  <span
                    className="accesos-mensajes-aviso"
                    style={{
                      position: 'absolute',
                      top: -7,
                      right: -10,
                      minWidth: 18,
                      height: 18,
                      padding: '0 4px',
                      borderRadius: 9,
                      background: '#dc2626',
                      border: '2px solid #1f3a5f',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      boxSizing: 'content-box',
                    }}
                  >
                    {mensajesSinLeer > 9 ? '9+' : mensajesSinLeer}
                  </span>
                )}
              </span>
              <span
                style={{
                  maxWidth: '100%',
                  fontSize: 10.5,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  color: variante === 'claro' ? '#374151' : '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {herramienta.corto[esPT ? 'pt' : 'es']}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
