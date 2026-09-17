'use client';

// MODAL DE FESTEJO — medallas Bronce/Plata/Oro dentro de cada nivel
// (25/50/75 operaciones) y el level-up que coincide con el Oro.
//
// Se abre una sola vez por hito (lib/gamificacion.ts se encarga de no
// repetirlo, vía gamificacion_hitos_vistos) y, si hay más de uno
// pendiente (ej. un lote grande de operaciones cruzó varias medallas
// de una), el que lo abre vuelve a pedir el siguiente al cerrar este.
//
// El Oro (que siempre coincide con subir de nivel) es el festejo
// grande: copa gigante en vez de la medalla, fuegos artificiales +
// estrellas titilando además del confetti, y una tarjeta más grande
// con brillo dorado — el resto (Bronce/Plata) se queda con el festejo
// chico original.

import { useEffect, useState } from 'react';
import type { HitoPendiente, TipoHito } from '@/lib/gamificacion';

const ESTILO_HITO: Record<TipoHito, { emoji: string; color: string; tituloEs: string; tituloPt: string }> = {
  BRONCE: { emoji: '🥉', color: '#b45309', tituloEs: '¡Medalla de Bronce!', tituloPt: 'Medalha de Bronze!' },
  PLATA: { emoji: '🥈', color: '#6b7280', tituloEs: '¡Medalla de Plata!', tituloPt: 'Medalha de Prata!' },
  ORO: { emoji: '🏆', color: '#ca8a04', tituloEs: '¡MEDALLA DE ORO!', tituloPt: 'MEDALHA DE OURO!' },
};

const COLORES_CONFETTI = ['#86efac', '#fbbf24', '#60a5fa', '#f472b6', '#ffffff'];
const COLORES_CONFETTI_ORO = ['#fde047', '#fbbf24', '#f59e0b', '#fff7cc', '#ffffff'];

// Posiciones (en % del contenedor) de cada estallido de fuegos
// artificiales — repartidas para que no se pisen entre sí.
const FUEGOS = [
  { left: '15%', top: '20%', delay: 0 },
  { left: '82%', top: '15%', delay: 0.35 },
  { left: '50%', top: '10%', delay: 0.7 },
  { left: '25%', top: '55%', delay: 1.05 },
  { left: '75%', top: '50%', delay: 0.5 },
];

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
  const esOro = hito.tipo === 'ORO';

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
        background: esOro
          ? 'radial-gradient(circle at 50% 40%, rgba(202,138,4,0.35), rgba(15,23,42,0.72))'
          : 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes hitoCaePieza {
          0% { transform: translateY(-40px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(260px) rotate(360deg); opacity: 0; }
        }
        @keyframes hitoPop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes hitoCopaBounce {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          55% { transform: scale(1.25) rotate(8deg); opacity: 1; }
          75% { transform: scale(0.95) rotate(-4deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes hitoCopaGlow {
          0%, 100% { filter: drop-shadow(0 0 12px #fde047); }
          50% { filter: drop-shadow(0 0 34px #fbbf24); }
        }
        @keyframes hitoEstrellaTitila {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes hitoFuego {
          0% { transform: scale(0); opacity: 1; }
          70% { opacity: 0.9; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes hitoTitulo {
          0%, 100% { letter-spacing: 0.5px; }
          50% { letter-spacing: 2px; }
        }
      `}</style>

      {/* Fuegos artificiales — solo para el Oro, por fuera de la
          tarjeta, ocupando toda la pantalla. */}
      {esOro &&
        FUEGOS.map((fuego, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: fuego.left,
              top: fuego.top,
              width: 140,
              height: 140,
              borderRadius: '50%',
              pointerEvents: 'none',
              background:
                'repeating-conic-gradient(from 0deg, #fde047 0deg 12deg, transparent 12deg 30deg)',
              animation: `hitoFuego 1.6s ease-out ${fuego.delay}s infinite`,
            }}
          />
        ))}

      {/* Estrellas titilando de fondo — solo para el Oro. */}
      {esOro &&
        Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${(i * 37 + 5) % 100}%`,
              top: `${(i * 53 + 8) % 100}%`,
              fontSize: 14 + (i % 3) * 6,
              animation: `hitoEstrellaTitila ${1.2 + (i % 4) * 0.3}s ease-in-out ${i * 0.15}s infinite`,
            }}
          >
            ⭐
          </span>
        ))}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: esOro ? 'linear-gradient(180deg, #fffdf5, #ffffff)' : '#ffffff',
          borderRadius: 24,
          padding: esOro ? '44px 30px 32px' : '36px 28px 28px',
          maxWidth: esOro ? 420 : 360,
          width: '100%',
          textAlign: 'center',
          boxShadow: esOro ? '0 30px 80px rgba(202,138,4,0.45)' : '0 24px 60px rgba(0,0,0,0.3)',
          border: esOro ? '2px solid #fbbf24' : 'none',
          transform: visible ? 'scale(1)' : 'scale(0.6)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease',
        }}
      >
        {/* Confetti — un puñado de piezas de colores cayendo (más y
            más grandes para el Oro). */}
        {Array.from({ length: esOro ? 26 : 14 }).map((_, i) => {
          const paleta = esOro ? COLORES_CONFETTI_ORO : COLORES_CONFETTI;
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                left: `${(i * 41) % 100}%`,
                width: esOro ? 9 : 7,
                height: esOro ? 9 : 7,
                borderRadius: i % 2 === 0 ? '50%' : 2,
                background: paleta[i % paleta.length],
                animation: `hitoCaePieza ${1.4 + (i % 5) * 0.2}s ease-in ${i * 0.05}s infinite`,
              }}
            />
          );
        })}

        <div
          style={{
            fontSize: esOro ? 120 : 72,
            lineHeight: 1,
            animation: esOro
              ? 'hitoCopaBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), hitoCopaGlow 1.6s ease-in-out 0.7s infinite'
              : 'hitoPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {estilo.emoji}
        </div>

        <h2
          style={{
            margin: esOro ? '10px 0 0' : '14px 0 0',
            fontSize: esOro ? 28 : 22,
            color: estilo.color,
            fontWeight: 900,
            animation: esOro ? 'hitoTitulo 1.2s ease-in-out infinite' : undefined,
          }}
        >
          {esPT ? estilo.tituloPt : estilo.tituloEs}
        </h2>

        {subioDeNivel ? (
          <p style={{ margin: '10px 0 0', fontSize: esOro ? 17 : 15, color: '#1f2937', fontWeight: 700 }}>
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
            marginTop: esOro ? 26 : 22,
            border: 'none',
            background: esOro ? 'linear-gradient(135deg, #fbbf24, #ca8a04)' : estilo.color,
            color: '#fff',
            borderRadius: 12,
            padding: esOro ? '13px 34px' : '11px 28px',
            fontSize: esOro ? 15 : 14,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: esOro ? '0 10px 24px rgba(202,138,4,0.45)' : 'none',
          }}
        >
          {esPT ? 'Continuar' : 'Seguir'}
        </button>
      </div>
    </div>
  );
}
