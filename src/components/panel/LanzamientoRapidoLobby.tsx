'use client';

// LANZAMIENTO RÁPIDO — banner del lobby (debajo del Sabio del Azar) que lleva
// a la pantalla de tarjetas con las operaciones más repetidas. Solo español:
// es una función a medida del piloto (ver lanzamientoRapidoEmpresas.ts).

import Link from 'next/link';
import { SABIO_SURFISTA_URL } from '@/lib/lanzamientoRapidoEmpresas';

export function LanzamientoRapidoLobby() {
  return (
    <Link
      href="/lanzamiento-rapido"
      className="lanzamiento-rapido-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        background: 'linear-gradient(125deg, #0e5a8a 0%, #0e5a8a 55%, #0b2f4a 100%)',
        border: '2px solid #38bdf8',
        borderRadius: 24,
        padding: '20px 26px',
        marginBottom: 20,
        textDecoration: 'none',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SABIO_SURFISTA_URL}
        alt="Sabio Surfista"
        style={{ width: 120, height: 120, flexShrink: 0, objectFit: 'cover', borderRadius: '50%', border: '3px solid #38bdf8', boxShadow: '0 6px 14px rgba(0,0,0,0.25)' }}
      />

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', color: '#7dd3fc', fontWeight: 800, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>
          Lanzamiento rápido
        </span>
        <span style={{ display: 'block', color: '#fff', fontWeight: 800, fontSize: 19, marginBottom: 4 }}>
          ¿Surfeamos la ola del día?
        </span>
        <span style={{ display: 'block', color: 'rgba(255,255,255,0.85)', fontSize: 13.5 }}>
          Tus 10 operaciones de siempre, a un toque: solo ponés el valor
        </span>
      </span>

      <span style={{ color: '#7dd3fc', fontSize: 26, fontWeight: 700, flexShrink: 0 }}>→</span>

      <style>{`
        @media (max-width: 480px) {
          .lanzamiento-rapido-banner {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
        }
      `}</style>
    </Link>
  );
}
