'use client';

// MODAL DE FESTEJO — medallas Bronce/Plata/Oro dentro de cada nivel
// (25/50/75 operaciones) y el level-up que coincide con el Oro.
//
// Se abre una sola vez por hito (lib/gamificacion.ts se encarga de no
// repetirlo, vía gamificacion_hitos_vistos) y, si hay más de uno
// pendiente (ej. un lote grande de operaciones cruzó varias medallas
// de una), el que lo abre vuelve a pedir el siguiente al cerrar este.
//
// Los tres hitos comparten el mismo tipo de festejo (confetti +
// estrellas + fuegos + sonido), pero escalado en intensidad: Bronce
// es el más chico, Oro (que siempre coincide con subir de nivel) es
// el más grande — copa gigante en vez de medalla, tarjeta más grande
// y brillo dorado.

import { useEffect, useState } from 'react';
import type { HitoPendiente, TipoHito } from '@/lib/gamificacion';

type ConfigHito = {
  emoji: string;
  color: string;
  tituloEs: string;
  tituloPt: string;
  paletaConfetti: string[];
  piezasConfetti: number;
  cantEstrellas: number;
  cantFuegos: number;
  tamañoEmoji: number;
  cardMaxWidth: number;
  overlayFondo: string;
  cardFondo: string;
  cardBorde: string;
  cardSombra: string;
  tituloAnimado: boolean;
  notasSonido: number[];
};

const CONFIG_HITO: Record<TipoHito, ConfigHito> = {
  BRONCE: {
    emoji: '🥉',
    color: '#b45309',
    tituloEs: '¡Medalla de Bronce!',
    tituloPt: 'Medalha de Bronze!',
    paletaConfetti: ['#f97316', '#fbbf24', '#fde68a', '#ffffff'],
    piezasConfetti: 16,
    cantEstrellas: 4,
    cantFuegos: 0,
    tamañoEmoji: 84,
    cardMaxWidth: 360,
    overlayFondo: 'radial-gradient(circle at 50% 40%, rgba(180,83,9,0.22), rgba(15,23,42,0.6))',
    cardFondo: '#ffffff',
    cardBorde: 'none',
    cardSombra: '0 24px 60px rgba(0,0,0,0.3)',
    tituloAnimado: false,
    notasSonido: [523.25],
  },
  PLATA: {
    emoji: '🥈',
    color: '#6b7280',
    tituloEs: '¡Medalla de Plata!',
    tituloPt: 'Medalha de Prata!',
    paletaConfetti: ['#cbd5e1', '#94a3b8', '#e2e8f0', '#60a5fa', '#ffffff'],
    piezasConfetti: 20,
    cantEstrellas: 7,
    cantFuegos: 2,
    tamañoEmoji: 100,
    cardMaxWidth: 390,
    overlayFondo: 'radial-gradient(circle at 50% 40%, rgba(100,116,139,0.28), rgba(15,23,42,0.65))',
    cardFondo: 'linear-gradient(180deg, #f8fafc, #ffffff)',
    cardBorde: '2px solid #cbd5e1',
    cardSombra: '0 28px 70px rgba(100,116,139,0.4)',
    tituloAnimado: false,
    notasSonido: [523.25, 659.25],
  },
  ORO: {
    emoji: '🏆',
    color: '#ca8a04',
    tituloEs: '¡MEDALLA DE ORO!',
    tituloPt: 'MEDALHA DE OURO!',
    paletaConfetti: ['#fde047', '#fbbf24', '#f59e0b', '#fff7cc', '#ffffff'],
    piezasConfetti: 26,
    cantEstrellas: 10,
    cantFuegos: 5,
    tamañoEmoji: 120,
    cardMaxWidth: 420,
    overlayFondo: 'radial-gradient(circle at 50% 40%, rgba(202,138,4,0.35), rgba(15,23,42,0.72))',
    cardFondo: 'linear-gradient(180deg, #fffdf5, #ffffff)',
    cardBorde: '2px solid #fbbf24',
    cardSombra: '0 30px 80px rgba(202,138,4,0.45)',
    tituloAnimado: true,
    notasSonido: [523.25, 659.25, 783.99],
  },
};

// Posiciones (en % del contenedor) de cada estallido de fuegos
// artificiales — repartidas para que no se pisen entre sí.
const POSICIONES_FUEGOS = [
  { left: '15%', top: '20%', delay: 0 },
  { left: '82%', top: '15%', delay: 0.35 },
  { left: '50%', top: '10%', delay: 0.7 },
  { left: '25%', top: '55%', delay: 1.05 },
  { left: '75%', top: '50%', delay: 0.5 },
];

// Sonido cortito sintetizado en el navegador (sin archivos externos):
// una nota para Bronce, dos para Plata, tres para Oro (un mini
// arpegio). Si el navegador bloquea el audio automático (el modal se
// abre solo, no por un clic) simplemente no suena — el festejo visual
// sigue andando igual, nunca rompe nada.
function reproducirSonidoHito(notas: number[]) {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const duracion = 0.16;

    notas.forEach((frecuencia, i) => {
      const oscilador = ctx.createOscillator();
      const ganancia = ctx.createGain();
      const inicio = ctx.currentTime + i * duracion;

      oscilador.type = 'sine';
      oscilador.frequency.value = frecuencia;

      ganancia.gain.setValueAtTime(0, inicio);
      ganancia.gain.linearRampToValueAtTime(0.2, inicio + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.001, inicio + duracion);

      oscilador.connect(ganancia);
      ganancia.connect(ctx.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + duracion + 0.02);
    });

    setTimeout(() => ctx.close().catch(() => {}), (notas.length * duracion + 0.3) * 1000);
  } catch {
    // Autoplay bloqueado u otro problema — no pasa nada, sigue sin sonido.
  }
}

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
  const config = CONFIG_HITO[hito.tipo];
  const subioDeNivel = hito.tipo === 'ORO' && Boolean(hito.nombreNivelNuevo);
  const esOro = hito.tipo === 'ORO';

  // Entrada con un pequeño "pop" — arranca en escala 0 y anima a 1.
  // Depende de hito.nivel/tipo para volver a jugar la animación (y el
  // sonido) si el padre reutiliza el mismo componente para encadenar
  // varios hitos seguidos sin desmontarlo.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    reproducirSonidoHito(config.notasSonido);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hito.nivel, hito.tipo]);

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
          0%, 100% { filter: drop-shadow(0 0 10px currentColor); }
          50% { filter: drop-shadow(0 0 28px currentColor); }
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

      {/* Fuegos artificiales — cantidad según el hito (0 en Bronce). */}
      {POSICIONES_FUEGOS.slice(0, config.cantFuegos).map((fuego, i) => (
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
            animation: `hitoFuego 1.6s ease-out ${fuego.delay}s infinite`,
          }}
        />
      ))}

      {/* Estrellas titilando de fondo — cantidad según el hito. */}
      {Array.from({ length: config.cantEstrellas }).map((_, i) => (
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
        {/* Confetti — cantidad y paleta según el hito. */}
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
              animation: `hitoCaePieza ${1.4 + (i % 5) * 0.2}s ease-in ${i * 0.05}s infinite`,
            }}
          />
        ))}

        <div
          style={{
            fontSize: config.tamañoEmoji,
            lineHeight: 1,
            color: config.color,
            animation: esOro
              ? 'hitoCopaBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), hitoCopaGlow 1.6s ease-in-out 0.7s infinite'
              : 'hitoPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), hitoCopaGlow 1.8s ease-in-out 0.5s infinite',
          }}
        >
          {config.emoji}
        </div>

        <h2
          style={{
            margin: esOro ? '10px 0 0' : '14px 0 0',
            fontSize: esOro ? 28 : 22,
            color: config.color,
            fontWeight: 900,
            animation: config.tituloAnimado ? 'hitoTitulo 1.2s ease-in-out infinite' : undefined,
          }}
        >
          {esPT ? config.tituloPt : config.tituloEs}
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
