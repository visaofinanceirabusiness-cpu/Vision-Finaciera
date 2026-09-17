'use client';

// MODAL DE FESTEJO — medallas Bronce/Plata/Oro dentro de cada nivel
// (25/50/75 operaciones) y el level-up que coincide con el Oro.
//
// Se abre una sola vez por hito (lib/gamificacion.ts se encarga de no
// repetirlo, vía gamificacion_hitos_vistos) y, si hay más de uno
// pendiente (ej. un lote grande de operaciones cruzó varias medallas
// de una), el que lo abre vuelve a pedir el siguiente al cerrar este.

import { useEffect, useState } from 'react';
import type { HitoPendiente, TipoHito } from '@/lib/gamificacion';

const ESTILO_HITO: Record<TipoHito, { emoji: string; color: string; tituloEs: string; tituloPt: string }> = {
  BRONCE: { emoji: '🥉', color: '#b45309', tituloEs: '¡Medalla de Bronce!', tituloPt: 'Medalha de Bronze!' },
  PLATA: { emoji: '🥈', color: '#6b7280', tituloEs: '¡Medalla de Plata!', tituloPt: 'Medalha de Prata!' },
  ORO: { emoji: '🥇', color: '#ca8a04', tituloEs: '¡Medalla de Oro!', tituloPt: 'Medalha de Ouro!' },
};

const COLORES_CONFETTI = ['#86efac', '#fbbf24', '#60a5fa', '#f472b6', '#ffffff'];

export function GamificacionHitoModal({
  hito,
  idioma,
  onCerrar,
}: {
  hito: HitoPendiente;
  idioma?: string | null;
  onCerrar: () => void;
}) {
  const esPT = idioma === 'PT';
  const estilo = ESTILO_HITO[hito.tipo];
  const subioDeNivel = hito.tipo === 'ORO' && Boolean(hito.nombreNivelNuevo);

  // Entrada con un pequeño "pop" — arranca en escala 0 y anima a 1.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <style>{`
        @keyframes hitoCaePieza {
          0% { transform: translateY(-40px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(220px) rotate(360deg); opacity: 0; }
        }
        @keyframes hitoPop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: 24,
          padding: '36px 28px 28px',
          maxWidth: 360,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          transform: visible ? 'scale(1)' : 'scale(0.6)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease',
        }}
      >
        {/* Confetti — un puñado de piezas de colores cayendo */}
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: `${(i * 71) % 100}%`,
              width: 7,
              height: 7,
              borderRadius: i % 2 === 0 ? '50%' : 2,
              background: COLORES_CONFETTI[i % COLORES_CONFETTI.length],
              animation: `hitoCaePieza ${1.4 + (i % 5) * 0.2}s ease-in ${i * 0.06}s infinite`,
            }}
          />
        ))}

        <div style={{ fontSize: 72, lineHeight: 1, animation: 'hitoPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          {subioDeNivel ? hito.emojiNivelNuevo : estilo.emoji}
        </div>

        <h2 style={{ margin: '14px 0 0', fontSize: 22, color: estilo.color }}>
          {esPT ? estilo.tituloPt : estilo.tituloEs}
        </h2>

        {subioDeNivel ? (
          <p style={{ margin: '10px 0 0', fontSize: 15, color: '#1f2937', fontWeight: 600 }}>
            {esPT
              ? `Subiste de nível: agora você é ${hito.nombreNivelNuevo}!`
              : `Subiste de nivel: ¡ahora sos ${hito.nombreNivelNuevo}!`}
          </p>
        ) : (
          <p style={{ margin: '10px 0 0', fontSize: 14, color: '#6e7781' }}>
            {esPT
              ? 'Continue registrando as operações do seu negócio — falta pouco para a próxima.'
              : 'Seguí registrando las operaciones de tu negocio — falta poco para la próxima.'}
          </p>
        )}

        <button
          type="button"
          onClick={onCerrar}
          style={{
            marginTop: 22,
            border: 'none',
            background: estilo.color,
            color: '#fff',
            borderRadius: 12,
            padding: '11px 28px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {esPT ? 'Continuar' : 'Seguir'}
        </button>
      </div>
    </div>
  );
}
