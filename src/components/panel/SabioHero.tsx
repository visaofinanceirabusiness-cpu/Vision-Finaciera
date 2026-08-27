'use client';

import { useEffect, useRef } from 'react';

const SABIO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/SABIO_3D_WEBP_ligero.webp';

export function SabioHero({
  colores,
  nombreEmpresa,
  mensajeBienvenida,
  subtitulo,
  hoy,
}: {
  colores: {
    azul: string;
    verde: string;
    blanco: string;
  };
  nombreEmpresa: string | null | undefined;
  mensajeBienvenida: string;
  subtitulo: string;
  hoy: string;
}) {
  const sabioRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const elemento = sabioRef.current;

    if (!elemento) {
      return;
    }

    const mover = (e: MouseEvent) => {
      const rect = elemento.getBoundingClientRect();
      const centroX = rect.left + rect.width / 2;
      const centroY = rect.top + rect.height / 2;
      const distanciaX = e.clientX - centroX;
      const distanciaY = e.clientY - centroY;

      const rotacionY = Math.max(-10, Math.min(10, distanciaX / 18));
      const rotacionX = Math.max(-8, Math.min(8, -(distanciaY / 22)));
      const movimientoX = Math.max(-8, Math.min(8, distanciaX / 35));
      const movimientoY = Math.max(-8, Math.min(8, distanciaY / 35));

      elemento.style.transform = `translate3d(${movimientoX}px, ${movimientoY}px, 0) rotateX(${rotacionX}deg) rotateY(${rotacionY}deg) scale(1.04)`;
    };

    const entrar = () => {
      elemento.style.transition = 'transform 120ms ease-out';
      elemento.style.transform = 'translate3d(0, -6px, 0) scale(1.04)';
    };

    const salir = () => {
      elemento.style.transition = 'transform 500ms ease-out';
      elemento.style.transform =
        'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1)';
    };

    elemento.addEventListener('mousemove', mover);
    elemento.addEventListener('mouseenter', entrar);
    elemento.addEventListener('mouseleave', salir);

    return () => {
      elemento.removeEventListener('mousemove', mover);
      elemento.removeEventListener('mouseenter', entrar);
      elemento.removeEventListener('mouseleave', salir);
    };
  }, []);

  return (
    <section
      style={{
        background: `linear-gradient(125deg, ${colores.azul} 0%, ${colores.azul} 58%, ${colores.verde} 100%)`,
        color: colores.blanco,
        borderRadius: 28,
        padding: '30px 32px',
        marginBottom: 20,
        boxShadow: '0 18px 40px rgba(31,58,95,0.16)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 280 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              opacity: 0.75,
              marginBottom: 8,
            }}
          >
            MI NEGOCIO
          </div>

          <h1 style={{ margin: 0, fontSize: 34 }}>{nombreEmpresa}</h1>

          <p style={{ margin: '10px 0 0', fontSize: 19, fontWeight: 600 }}>
            {mensajeBienvenida}
          </p>

          <p style={{ margin: '6px 0 0', opacity: 0.82, fontSize: 14 }}>{subtitulo}</p>

          <p style={{ margin: '10px 0 0', opacity: 0.68, fontSize: 12 }}>{hoy}</p>
        </div>

        <div
          style={{
            width: 240,
            minHeight: 220,
            borderRadius: 24,
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 18px',
            flexShrink: 0,
            overflow: 'visible',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.5,
              opacity: 0.78,
              marginBottom: 4,
            }}
          >
            SABIO
          </div>

          <div
            ref={sabioRef}
            style={{
              position: 'relative',
              width: 210,
              height: 205,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              overflow: 'visible',
              transformStyle: 'preserve-3d',
              perspective: 800,
              cursor: 'pointer',
              willChange: 'transform',
              transition: 'transform 500ms ease-out',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SABIO_URL}
              alt="Sabio - asistente inteligente de Visão Financeira"
              style={{
                width: 205,
                height: 205,
                objectFit: 'contain',
                display: 'block',
                pointerEvents: 'none',
                filter: 'drop-shadow(0 18px 18px rgba(0,0,0,0.25))',
              }}
            />
          </div>

          <div
            style={{
              marginTop: 2,
              fontSize: 13,
              fontWeight: 600,
              opacity: 0.9,
              textAlign: 'center',
            }}
          >
            Tu compañero financiero
          </div>
        </div>
      </div>
    </section>
  );
}
