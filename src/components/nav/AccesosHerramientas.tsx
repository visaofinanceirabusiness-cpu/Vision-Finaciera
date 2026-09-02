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
import { empresaManejaMercaderia } from '@/lib/perfilCapacidades';

type Herramienta = {
  href: string;
  titulo: string;
  emoji: string;
  color: string;
};

const TODAS_LAS_HERRAMIENTAS: Herramienta[] = [
  { href: '/panel-de-control', titulo: 'Panel de Control', emoji: '📊', color: '#2e8b57' },
  { href: '/contabilidad', titulo: 'Contabilidad', emoji: '🧾', color: '#7c3aed' },
  { href: '/mercaderia', titulo: 'Mercadería', emoji: '📦', color: '#ea580c' },
  { href: '/informes', titulo: 'Informes', emoji: '📈', color: '#0891b2' },
  { href: '/produccion', titulo: 'Producción', emoji: '🏭', color: '#65a30d' },
  { href: '/recursos-humanos', titulo: 'Recursos Humanos', emoji: '👥', color: '#db2777' },
  { href: '/configuracoes', titulo: 'Configurações', emoji: '⚙️', color: '#475569' },
];

export function AccesosHerramientas({ variante = 'oscuro' }: { variante?: 'oscuro' | 'claro' }) {
  const pathname = usePathname();
  const [disponibles, setDisponibles] = useState<Herramienta[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id) {
        return;
      }

      const { data: empresa } = await supabase
        .from('empresas')
        .select('perfil_empresa_id')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      let tieneProduccion = false;

      if (empresa?.perfil_empresa_id) {
        const { data: modulosData } = await supabase
          .from('perfil_modulos')
          .select('modulo')
          .eq('perfil_empresa_id', empresa.perfil_empresa_id)
          .eq('activo', true);

        tieneProduccion = (modulosData ?? []).some((fila) => fila.modulo === 'PRODUCCION');
      }

      // El perfil MIXTO no tiene fila en perfil_modulos — depende de
      // qué componentes eligió la empresa al darse de alta (ver misma
      // nota en app/page.tsx).
      if (!tieneProduccion) {
        const { data: componentesMixtoData } = await supabase
          .from('empresa_mixto_componentes')
          .select('componente')
          .eq('empresa_id', perfil.empresa_id);

        tieneProduccion = (componentesMixtoData ?? []).some((fila) => fila.componente === 'PRODUCCION');
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
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {disponibles.map((herramienta) => {
        const activa = pathname === herramienta.href;

        return (
          <Link
            key={herramienta.href}
            href={herramienta.href}
            onMouseEnter={() => setHover(herramienta.href)}
            onMouseLeave={() => setHover(null)}
            style={{
              position: 'relative',
              width: 38,
              height: 38,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              textDecoration: 'none',
              background: activa
                ? `${herramienta.color}22`
                : variante === 'claro'
                  ? '#f3f4f6'
                  : 'rgba(255,255,255,0.14)',
              border: activa
                ? `1px solid ${herramienta.color}`
                : variante === 'claro'
                  ? '1px solid #d1d5db'
                  : '1px solid rgba(255,255,255,0.25)',
              cursor: 'pointer',
            }}
          >
            {herramienta.emoji}

            {hover === herramienta.href && (
              <span
                style={{
                  position: 'absolute',
                  top: '115%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#142a3d',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 10px',
                  borderRadius: 8,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
                  zIndex: 20,
                }}
              >
                {herramienta.titulo}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
