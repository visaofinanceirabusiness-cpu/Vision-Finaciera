'use client';

import { crearTraductor } from '@/lib/i18n';
import { diccionarioPanel } from './i18n';
import { SabioWidget } from './SabioWidget';

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
        <SabioWidget colores={colores} idioma={idioma} />
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
