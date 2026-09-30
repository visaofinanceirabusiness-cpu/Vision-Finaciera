'use client';

// FESTEJO MODAL — versión genérica de GamificacionHitoModal, para
// festejar cualquier logro que use la misma escala Bronce/Plata/Oro
// (confetti + estrellas + fuegos + sonido) pero con su propio texto:
// hoy se usa para los checkpoints de Objetivos Escalonados y para los
// Trofeos, sin repetir el nivel de gamificación.

import { useEffect, useState } from 'react';
import type { TipoFestejo } from '@/lib/festejoVisual';
import { CONFIG_FESTEJO, POSICIONES_FUEGOS_FESTEJO, reproducirSonidoFestejo } from '@/lib/festejoVisual';

export function FestejoModal({
  tipo,
  claveAnimacion,
  emoji,
  tituloEs,
  tituloPt,
  subtituloEs,
  subtituloPt,
  idioma,
  onCerrar,
}: {
  tipo: TipoFestejo;
  // Cambia entre festejos consecutivos para reiniciar la animación y
  // el sonido, aunque el padre reutilice el mismo componente montado.
  claveAnimacion: string;
  // Ícono a mostrar en vez del emoji de medalla/copa por defecto (ej.
  // el emoji del tipo de operación o del trofeo) — opcional.
  emoji?: string;
  tituloEs: string;
  tituloPt: string;
  subtituloEs: string;
  subtituloPt: string;
  idioma?: string | null;
  onCerrar: () => void;
}) {
  const esPT = idioma === 'PT';
  const config = CONFIG_FESTEJO[tipo];
  const esOro = tipo === 'ORO';

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    reproducirSonidoFestejo(config.notasSonido);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveAnimacion]);

  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: config.overlayFondo,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes festejoCaePieza {
          0% { transform: translateY(-40px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(260px) rotate(360deg); opacity: 0; }
        }
        @keyframes festejoPop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes festejoBounce {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          55% { transform: scale(1.25) rotate(8deg); opacity: 1; }
          75% { transform: scale(0.95) rotate(-4deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes festejoGlow {
          0%, 100% { filter: drop-shadow(0 0 10px currentColor); }
          50% { filter: drop-shadow(0 0 28px currentColor); }
        }
        @keyframes festejoEstrellaTitila {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes festejoFuego {
          0% { transform: scale(0); opacity: 1; }
          70% { opacity: 0.9; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes festejoTitulo {
          0%, 100% { letter-spacing: 0.5px; }
          50% { letter-spacing: 2px; }
        }
      `}</style>

      {POSICIONES_FUEGOS_FESTEJO.slice(0, config.cantFuegos).map((fuego, i) => (
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
            background: `repeating-conic-gradient(from 0deg, ${config.color} 0deg 12deg, transparent 12deg 30deg)`,
            opacity: 0.85,
            animation: `festejoFuego 1.6s ease-out ${fuego.delay}s infinite`,
          }}
        />
      ))}

      {Array.from({ length: config.cantEstrellas }).map((_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${(i * 37 + 5) % 100}%`,
            top: `${(i * 53 + 8) % 100}%`,
            fontSize: 14 + (i % 3) * 6,
            animation: `festejoEstrellaTitila ${1.2 + (i % 4) * 0.3}s ease-in-out ${i * 0.15}s infinite`,
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
          background: config.cardFondo,
          borderRadius: 24,
          padding: esOro ? '44px 30px 32px' : '38px 28px 28px',
          maxWidth: config.cardMaxWidth,
          width: '100%',
          textAlign: 'center',
          boxShadow: config.cardSombra,
          border: config.cardBorde,
          transform: visible ? 'scale(1)' : 'scale(0.6)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease',
        }}
      >
        {Array.from({ length: config.piezasConfetti }).map((_, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: `${(i * 41) % 100}%`,
              width: esOro ? 9 : 7,
              height: esOro ? 9 : 7,
              borderRadius: i % 2 === 0 ? '50%' : 2,
              background: config.paletaConfetti[i % config.paletaConfetti.length],
              animation: `festejoCaePieza ${1.4 + (i % 5) * 0.2}s ease-in ${i * 0.05}s infinite`,
            }}
          />
        ))}

        <div
          style={{
            fontSize: config.tamañoEmoji,
            lineHeight: 1,
            color: config.color,
            animation: esOro
              ? 'festejoBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), festejoGlow 1.6s ease-in-out 0.7s infinite'
              : 'festejoPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), festejoGlow 1.8s ease-in-out 0.5s infinite',
          }}
        >
          {emoji ?? config.emoji}
        </div>

        <h2
          style={{
            margin: esOro ? '10px 0 0' : '14px 0 0',
            fontSize: esOro ? 28 : 22,
            color: config.color,
            fontWeight: 900,
            animation: esOro ? 'festejoTitulo 1.2s ease-in-out infinite' : undefined,
          }}
        >
          {esPT ? tituloPt : tituloEs}
        </h2>

        <p style={{ margin: '10px 0 0', fontSize: esOro ? 17 : 15, color: '#1f2937', fontWeight: 700 }}>
          {esPT ? subtituloPt : subtituloEs}
        </p>

        <button
          type="button"
          onClick={onCerrar}
          style={{
            marginTop: esOro ? 26 : 22,
            border: 'none',
            background: esOro ? 'linear-gradient(135deg, #fbbf24, #ca8a04)' : config.color,
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
