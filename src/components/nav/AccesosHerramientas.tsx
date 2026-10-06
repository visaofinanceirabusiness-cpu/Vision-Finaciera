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
import { empresaManejaMercaderia, empresaTieneModulo, empresaTienePlanAccion, empresaTieneNuestroSueno } from '@/lib/perfilCapacidades';

type Herramienta = {
  href: string;
  titulo: string;
  // Nombre corto que queda siempre a la vista debajo del ícono.
  corto: { es: string; pt: string };
  emoji: string;
  color: string;
};

const TODAS_LAS_HERRAMIENTAS: Herramienta[] = [
  { href: '/panel-de-control', titulo: 'Panel de Control', corto: { es: 'Panel', pt: 'Painel' }, emoji: '📊', color: '#2e8b57' },
  { href: '/contabilidad', titulo: 'Contabilidad', corto: { es: 'Contab.', pt: 'Contab.' }, emoji: '🧾', color: '#7c3aed' },
  { href: '/finanzas', titulo: 'Finanzas', corto: { es: 'Finanzas', pt: 'Finanças' }, emoji: '💼', color: '#0d9488' },
  { href: '/mercaderia', titulo: 'Mercadería', corto: { es: 'Mercad.', pt: 'Mercad.' }, emoji: '📦', color: '#ea580c' },
  { href: '/informes', titulo: 'Informes', corto: { es: 'Informes', pt: 'Relat.' }, emoji: '📈', color: '#0891b2' },
  { href: '/produccion', titulo: 'Producción', corto: { es: 'Produc.', pt: 'Produç.' }, emoji: '🏭', color: '#65a30d' },
  { href: '/recursos-humanos', titulo: 'Recursos Humanos', corto: { es: 'RR. HH.', pt: 'RH' }, emoji: '👥', color: '#db2777' },
  { href: '/plan-accion', titulo: 'Plan de Acción', corto: { es: 'Plan', pt: 'Plano' }, emoji: '🎯', color: '#1f3a5f' },
  { href: '/nuestro-sueno', titulo: 'Nuestro Sueño', corto: { es: 'Sueño', pt: 'Sonho' }, emoji: '💞', color: '#db2777' },
  { href: '/mensajes', titulo: 'Mensajes', corto: { es: 'Mensajes', pt: 'Mensag.' }, emoji: '✉️', color: '#2563eb' },
  { href: '/configuracoes', titulo: 'Configurações', corto: { es: 'Config.', pt: 'Config.' }, emoji: '⚙️', color: '#475569' },
];

export function AccesosHerramientas({ variante = 'oscuro' }: { variante?: 'oscuro' | 'claro' }) {
  const pathname = usePathname();
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

      const { data: empresa } = await supabase.from('empresas').select('idioma').eq('id', perfil.empresa_id).maybeSingle();
      setEsPT(empresa?.idioma === 'PT');

      // Aviso de mensajes nuevos sobre el acceso a Mensajes (el aislamiento entre
      // empresas lo garantiza la política RLS, igual que en el lobby).
      const { count } = await supabase
        .from('mensajes_financieros')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', perfil.empresa_id)
        .eq('leido', false);
      setMensajesSinLeer(count ?? 0);

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

      setDisponibles(
        TODAS_LAS_HERRAMIENTAS.filter((herramienta) => {
          if (herramienta.href === '/mercaderia') return manejaMercaderia;
          if (herramienta.href === '/produccion') return tieneProduccion;
          if (herramienta.href === '/plan-accion') return empresaTienePlanAccion(perfil.empresa_id);
          if (herramienta.href === '/nuestro-sueno') return empresaTieneNuestroSueno(perfil.empresa_id);
          // Igual que en el lobby: el asistente no ve Informes.
          if (herramienta.href === '/informes') return perfil.tipo_usuario !== 'ASISTENTE';
          return true;
        })
      );
    }

    cargar();
  }, []);

  if (disponibles.length === 0) {
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

          return (
            <Link
              key={herramienta.href}
              href={herramienta.href}
              title={herramienta.titulo}
              style={{
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
                {herramienta.emoji}
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
