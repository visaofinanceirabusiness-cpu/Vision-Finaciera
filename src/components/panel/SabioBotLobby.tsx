'use client';
// SABIO BOT — tarjeta grande del lobby.
//
// Reemplaza al Sabio chiquito que vivía adentro de SabioHero y al
// flotante de esta pantalla — ahora es EL lugar para cargar
// operaciones desde acá, con una invitación directa. Al tocarla se
// despliega el chat (SabioBotChat, mismo motor que /sabio-bot) en el
// momento, sin cambiar de pantalla.

import { useState } from 'react';
import { SabioBotChat } from './SabioBotChat';
import { SABIO_URL } from './SabioWidget';

export function SabioBotLobby({
  empresaId,
  idioma,
  colores,
}: {
  empresaId: string;
  idioma: string;
  colores: { azul: string; verde: string; gris: string; blanco: string };
}) {
  const [abierto, setAbierto] = useState(false);
  const esPT = idioma === 'PT';

  return (
    <section
      style={{
        background: colores.blanco,
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        border: '1px solid #e5e7eb',
        boxShadow: abierto ? '0 10px 26px rgba(31,58,95,0.07)' : 'none',
      }}
    >
      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="sabio-lobby-banner"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            background: `linear-gradient(125deg, ${colores.azul} 0%, ${colores.azul} 58%, ${colores.verde} 100%)`,
            border: 'none',
            borderRadius: 20,
            padding: '22px 26px',
            cursor: 'pointer',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SABIO_URL}
            alt="Sabio"
            style={{ width: 130, height: 130, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.25))' }}
          />

          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.75)', fontWeight: 800, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>
              {esPT ? 'Sábio, seu assistente financeiro' : 'Sabio, tu asistente financiero'}
            </span>
            <span style={{ display: 'block', color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>
              {esPT ? 'Olá, como você está hoje?' : 'Hola, ¿cómo estás hoy?'}
            </span>
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.88)', fontSize: 14.5 }}>
              {esPT ? 'Vamos registrar as operações do dia?' : '¿Registramos las operaciones del día?'}
            </span>
          </span>

          <span className="sabio-lobby-banner-flecha" style={{ color: '#fff', fontSize: 26, fontWeight: 700, flexShrink: 0 }}>→</span>

          <style>{`
            .sabio-lobby-banner {
              text-align: left;
            }
            @media (max-width: 480px) {
              .sabio-lobby-banner {
                flex-direction: column;
                align-items: center;
                text-align: center;
              }
              .sabio-lobby-banner-flecha {
                display: none;
              }
            }
          `}</style>
        </button>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SABIO_URL} alt="Sabio" style={{ width: 52, height: 52, objectFit: 'contain' }} />
              <span style={{ fontWeight: 800, color: colores.azul, fontSize: 18 }}>
                {esPT ? 'Sábio, seu assistente financeiro' : 'Sabio, tu asistente financiero'}
              </span>
            </div>

            <button
              onClick={() => setAbierto(false)}
              style={{
                border: '1px solid #d1d5db',
                background: colores.blanco,
                borderRadius: 10,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: colores.azul,
                cursor: 'pointer',
              }}
            >
              {esPT ? 'Fechar' : 'Cerrar'}
            </button>
          </div>

          <SabioBotChat empresaId={empresaId} colores={colores} altura="50vh" />
        </div>
      )}
    </section>
  );
}
