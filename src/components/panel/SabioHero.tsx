'use client';

import { useEffect, useRef, useState } from 'react';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioPanel, FRASES_SABIO_POR_IDIOMA } from './i18n';

const SABIO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/SABIO_3D_WEBP_ligero.webp';

const INTERVALO_FRASE_MS = 5 * 60 * 1000;

type NivelHero = {
  nivel: number;
  nombre: string;
  emoji: string;
  mensaje: string;
  mision: string;
  progreso: number;
  operaciones: number;
  operacionesMax: number | null;
  faltan: number;
};

type ObjetivoHero = {
  nombre: string;
  porcentaje: number;
};

export function SabioHero({
  colores,
  idioma = 'ES',
  nombreEmpresa,
  mensajeBienvenida,
  subtitulo,
  hoy,
  gamificacion,
  antiguedad,
  objetivos,
}: {
  colores: {
    azul: string;
    verde: string;
    blanco: string;
  };
  idioma?: string;
  nombreEmpresa: string | null | undefined;
  mensajeBienvenida: string;
  subtitulo: string;
  hoy: string;
  gamificacion?: NivelHero | null;
  antiguedad?: string | null;
  objetivos?: ObjetivoHero[];
}) {
  const t = crearTraductor(diccionarioPanel, idioma);
  const frasesSabio = FRASES_SABIO_POR_IDIOMA[idioma === 'PT' ? 'PT' : 'ES'];
  const sabioRef = useRef<HTMLDivElement | null>(null);
  const [fraseIndex, setFraseIndex] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setFraseIndex((actual) => (actual + 1) % frasesSabio.length);
    }, INTERVALO_FRASE_MS);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {/* =========================================
            COLUMNA 1 — El saludo
        ========================================== */}
        <div style={{ flex: '1 1 260px', minWidth: 250 }}>
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
            {t('miNegocioEyebrow')}
          </div>

          <h1 style={{ margin: 0, fontSize: 34 }}>
            {nombreEmpresa}
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              fontSize: 19,
              fontWeight: 600,
            }}
          >
            {mensajeBienvenida}
          </p>

          <p
            style={{
              margin: '6px 0 0',
              opacity: 0.82,
              fontSize: 14,
            }}
          >
            {subtitulo}
          </p>

          <p
            style={{
              margin: '10px 0 0',
              opacity: 0.68,
              fontSize: 12,
            }}
          >
            {hoy}
          </p>

          {/* Mini resumen de objetivos del mes: solo nombre + % */}
          {objetivos && objetivos.length > 0 && (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {objetivos.map((objetivo) => (
                <div
                  key={objetivo.nombre}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 12,
                  }}
                >
                  <span style={{ opacity: 0.85 }}>{objetivo.nombre}</span>

                  <span
                    style={{
                      fontWeight: 800,
                      color: objetivo.porcentaje >= 100 ? '#86efac' : colores.blanco,
                    }}
                  >
                    {objetivo.porcentaje}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =========================================
            COLUMNA 2 — El nivel del emprendedor
        ========================================== */}
        {gamificacion && (
          <div
            style={{
              flex: '1 1 340px',
              minWidth: 280,
              borderRadius: 24,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '20px 22px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 170,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 1.3,
                    opacity: 0.78,
                    marginBottom: 7,
                  }}
                >
                  {t('progresoNegocio')}
                </div>

                <div
                  style={{
                    fontSize: 21,
                    fontWeight: 700,
                    lineHeight: 1.25,
                  }}
                >
                  {gamificacion.emoji} {t('nivel')} {gamificacion.nivel}

                  <span
                    style={{
                      opacity: 0.85,
                    }}
                  >
                    {' '}
                    · {gamificacion.nombre}
                  </span>
                </div>

                {antiguedad && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      opacity: 0.78,
                      fontWeight: 600,
                    }}
                  >
                    🕒 {antiguedad} {t('enElSistema')}
                  </div>
                )}
              </div>

              <div
                style={{
                  textAlign: 'right',
                }}
              >
                <strong
                  style={{
                    fontSize: 26,
                    display: 'block',
                    lineHeight: 1.1,
                  }}
                >
                  {gamificacion.operaciones}
                </strong>

                <span
                  style={{
                    fontSize: 11,
                    opacity: 0.8,
                  }}
                >
                  {t('operacionesRegistradas')}
                </span>
              </div>
            </div>

            <p
              style={{
                margin: '10px 0 0',
                fontSize: 13,
                opacity: 0.85,
                lineHeight: 1.5,
              }}
            >
              {gamificacion.mensaje}
            </p>

            {/* Barra de progreso */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                margin: '16px 0 7px',
                fontSize: 12,
                fontWeight: 700,
                opacity: 0.85,
              }}
            >
              <span>{t('progreso')}</span>

              <span>
                {gamificacion.progreso}%
              </span>
            </div>

            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.18)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${gamificacion.progreso}%`,
                  height: '100%',
                  borderRadius: 999,
                  background:
                    'linear-gradient(90deg, #86efac, #ffffff)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Misión · Faltan */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 10,
                marginTop: 16,
              }}
            >
              <DatoNivel
                etiqueta={t('mision')}
                valor={gamificacion.mision}
              />

              <DatoNivel
                etiqueta={t('faltan')}
                valor={
                  gamificacion.operacionesMax === null
                    ? t('faltanCero')
                    : `${gamificacion.faltan} ${t('operacionesPalabra')}`
                }
              />
            </div>
          </div>
        )}

        {/* =========================================
            COLUMNA 3 — Sabio
        ========================================== */}
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

          {/* Globo de diálogo — va rotando frases básicas de contabilidad,
              cada 5 minutos solo o al toque con un click */}
          <div
            onClick={() => setFraseIndex((actual) => (actual + 1) % frasesSabio.length)}
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
            {frasesSabio[fraseIndex]}

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
            onClick={() => setFraseIndex((actual) => (actual + 1) % frasesSabio.length)}
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
                filter:
                  'drop-shadow(0 18px 18px rgba(0,0,0,0.25))',
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
      </div>
    </section>
  );
}

/* =========================================
   COMPONENTE AUXILIAR — DATO DEL NIVEL
========================================= */

function DatoNivel({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: 14,
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: 'uppercase',
          opacity: 0.75,
          marginBottom: 4,
        }}
      >
        {etiqueta}
      </div>

      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        {valor}
      </div>
    </div>
  );
}
