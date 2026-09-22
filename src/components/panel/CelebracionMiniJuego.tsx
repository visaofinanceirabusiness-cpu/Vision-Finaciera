'use client';

// CELEBRACIÓN DEL MINI-JUEGO — el festejo "chico" de cada jugada
// cargada, no el de un hito grande (eso lo sigue haciendo
// GamificacionHitoModal cada 25/50/75 operaciones). Se abre solo,
// dura un segundo y medio, y se cierra sola — no interrumpe el ritmo
// de "cargar la próxima".

import { useEffect, useState } from 'react';
import { SABIO_URL } from './SabioWidget';

const PALETA = ['#2e8b57', '#fbbf24', '#60a5fa', '#f97316', '#ffffff'];

function reproducirSonidoJugada() {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const oscilador = ctx.createOscillator();
    const ganancia = ctx.createGain();

    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(659.25, ctx.currentTime);
    oscilador.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.12);

    ganancia.gain.setValueAtTime(0, ctx.currentTime);
    ganancia.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);
    oscilador.start();
    oscilador.stop(ctx.currentTime + 0.24);

    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {
    // Autoplay bloqueado — sigue el festejo visual sin sonido.
  }
}

export function CelebracionMiniJuego({
  numeroDelDia,
  idioma,
  onTerminar,
}: {
  // Cuántas jugadas van cargadas hoy — le da sensación de racha.
  numeroDelDia: number;
  idioma?: string | null;
  onTerminar: () => void;
}) {
  const esPT = idioma === 'PT';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    reproducirSonidoJugada();
    const aparecer = requestAnimationFrame(() => setVisible(true));
    const cerrar = setTimeout(onTerminar, 3500);

    return () => {
      cancelAnimationFrame(aparecer);
      clearTimeout(cerrar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes miniJuegoCaePieza {
          0% { transform: translateY(-30px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(180px) rotate(360deg); opacity: 0; }
        }
        @keyframes miniJuegoPop {
          0% { transform: scale(0.4) rotate(-8deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes miniJuegoSabioFesteja {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-8px) rotate(4deg); }
        }
      `}</style>

      <div
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: 20,
          padding: '26px 34px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          textAlign: 'center',
          transform: visible ? 'scale(1)' : 'scale(0.7)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: `${(i * 37) % 100}%`,
              width: 6,
              height: 6,
              borderRadius: i % 2 === 0 ? '50%' : 2,
              background: PALETA[i % PALETA.length],
              animation: `miniJuegoCaePieza ${0.9 + (i % 4) * 0.15}s ease-in ${i * 0.04}s`,
            }}
          />
        ))}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SABIO_URL}
            alt="Sabio"
            style={{ width: 46, height: 46, objectFit: 'contain', animation: 'miniJuegoSabioFesteja 0.6s ease-in-out infinite' }}
          />
          <div style={{ fontSize: 56, animation: 'miniJuegoPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>✅</div>
        </div>

        <div style={{ marginTop: 6, fontSize: 17, fontWeight: 800, color: '#1f3a5f' }}>
          {esPT ? 'Jogada registrada!' : '¡Jugada registrada!'}
        </div>

        <div style={{ marginTop: 4, fontSize: 19, fontWeight: 800, color: '#2e8b57' }}>
          {esPT ? `Já são ${numeroDelDia} hoje 🔥` : `Van ${numeroDelDia} hoy 🔥`}
        </div>
      </div>
    </div>
  );
}
