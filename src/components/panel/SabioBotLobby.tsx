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
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 44, lineHeight: 1 }}>🦉</span>

          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>
              {esPT ? 'Olá, como você está hoje?' : 'Hola, ¿cómo estás hoy?'}
            </span>
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.88)', fontSize: 14.5 }}>
              {esPT ? 'Vamos registrar as operações do dia?' : '¿Registramos las operaciones del día?'}
            </span>
          </span>

          <span style={{ color: '#fff', fontSize: 26, fontWeight: 700, flexShrink: 0 }}>→</span>
        </button>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>🦉</span>
              <span style={{ fontWeight: 800, color: colores.azul, fontSize: 18 }}>Sabio Bot</span>
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
