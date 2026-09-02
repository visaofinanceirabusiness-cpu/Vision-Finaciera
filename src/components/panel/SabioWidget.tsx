'use client';

// EL WIDGET DE SABIO — imagen 3D + globo de diálogo + movimiento al
// mouse. Extraído de SabioHero (que lo sigue usando tal cual, sin
// ningún cambio visual) para poder reusarlo, grande y solo, arriba de
// otras pantallas — hoy la Central de Lançamentos y el Panel de
// Controle durante el onboarding guiado (ver app/bienvenida).
//
// Por default rota las frases genéricas de contabilidad
// (FRASES_SABIO_POR_IDIOMA), igual que en el lobby — se le puede pasar
// `frases` para que rote, en cambio, una lista propia de tips (ej. los
// de Contabilidad o los del Panel de Controle). Si se le pasa `frase`
// (singular), muestra ESE texto fijo (control total de quien lo usa,
// sin rotar nada) y el click dispara `onClickFrase` — así es como el
// onboarding guiado avanza sus propios pasos.

import { useEffect, useRef, useState } from 'react';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioPanel, FRASES_SABIO_POR_IDIOMA } from './i18n';

const SABIO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/SABIO_3D_WEBP_ligero.webp';

const INTERVALO_FRASE_MS = 5 * 60 * 1000;

export function SabioWidget({
  colores,
  idioma = 'ES',
  frase,
  onClickFrase,
  frases,
}: {
  colores: {
    azul: string;
    verde: string;
    blanco: string;
  };
  idioma?: string;
  frase?: string;
  onClickFrase?: () => void;
  frases?: string[];
}) {
  const t = crearTraductor(diccionarioPanel, idioma);
  const frasesSabio = frases && frases.length > 0 ? frases : FRASES_SABIO_POR_IDIOMA[idioma === 'PT' ? 'PT' : 'ES'];
  const sabioRef = useRef<HTMLDivElement | null>(null);
  const [fraseIndex, setFraseIndex] = useState(0);

  const esControlado = frase !== undefined;
  const textoMostrado = esControlado ? frase : frasesSabio[fraseIndex];

  function handleClick() {
    if (esControlado) {
      onClickFrase?.();
    } else {
      setFraseIndex((actual) => (actual + 1) % frasesSabio.length);
    }
  }

  useEffect(() => {
    if (esControlado) return;

    const intervalo = setInterval(() => {
      setFraseIndex((actual) => (actual + 1) % frasesSabio.length);
    }, INTERVALO_FRASE_MS);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esControlado]);

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
    <div
      style={{
        width: 260,
        minHeight: 250,
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
        {t('sabioEyebrow')}
      </div>

      {/* Globo de diálogo — rota frases genéricas de contabilidad cada
          5 minutos o al toque (modo lobby), o muestra un texto fijo
          controlado desde afuera (modo tutorial guiado). */}
      <div
        onClick={handleClick}
        style={{
          position: 'relative',
          background: colores.blanco,
          color: colores.azul,
          borderRadius: 14,
          padding: '10px 14px',
          marginBottom: 12,
          maxWidth: 220,
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.4,
          textAlign: 'center',
          boxShadow: '0 8px 16px rgba(0,0,0,0.18)',
          cursor: 'pointer',
        }}
      >
        {textoMostrado}

        <div
          style={{
            position: 'absolute',
            bottom: -6,
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: 12,
            height: 12,
            background: colores.blanco,
          }}
        />
      </div>

      <div
        ref={sabioRef}
        onClick={handleClick}
        style={{
          position: 'relative',
          width: 230,
          height: 225,
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
            width: 230,
            height: 230,
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
        {t('companeroFinanciero')}
      </div>
    </div>
  );
}
