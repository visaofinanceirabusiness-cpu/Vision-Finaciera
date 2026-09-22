'use client';

// SABIO DEL AZAR — banner del lobby que invita al Mini-Juego, mismo
// modelo visual que SabioBotLobby (avatar + texto + flecha) pero con
// el "Sabio Lúdico" (galera, moño y bastón, dibujado especialmente
// para el Mini-Juego) en vez del 3D de siempre. Va arriba de
// SabioBotLobby en el lobby.

import { SABIO_LUDICO_URL } from '@/lib/iconosJuego';

export function SabioAzarLobby({
  idioma,
  onJugar,
}: {
  idioma: string;
  onJugar: () => void;
}) {
  const esPT = idioma === 'PT';

  return (
    <button
      type="button"
      onClick={onJugar}
      className="sabio-azar-banner"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        background: 'linear-gradient(125deg, #0b6e4f 0%, #0b6e4f 55%, #163a2e 100%)',
        border: '2px solid #f4b400',
        borderRadius: 24,
        padding: '20px 26px',
        marginBottom: 20,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SABIO_LUDICO_URL}
          alt="Sabio"
          style={{ width: 120, height: 120, objectFit: 'contain', filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.3))' }}
        />
        <span style={{ position: 'absolute', top: -4, left: -8, fontSize: 24 }}>🎲</span>
        <span style={{ position: 'absolute', bottom: 2, right: -8, fontSize: 22 }}>🃏</span>
      </div>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', color: '#f4b400', fontWeight: 800, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>
          {esPT ? 'Sábio do Acaso' : 'Sabio del Azar'}
        </span>
        <span style={{ display: 'block', color: '#fff', fontWeight: 800, fontSize: 19, marginBottom: 4 }}>
          {esPT ? 'Vamos jogar uma jogada?' : '¿Jugamos una jugada?'}
        </span>
        <span style={{ display: 'block', color: 'rgba(255,255,255,0.85)', fontSize: 13.5 }}>
          {esPT
            ? 'Mini-Jogo: carregue operações com cartas, não com formulário'
            : 'Mini-Juego: cargá operaciones con cartas, no con formulario'}
        </span>
      </span>

      <span className="sabio-azar-banner-flecha" style={{ color: '#f4b400', fontSize: 26, fontWeight: 700, flexShrink: 0 }}>→</span>

      <style>{`
        .sabio-azar-banner-flecha {
          transform: rotate(0deg);
        }
        @media (max-width: 480px) {
          .sabio-azar-banner {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .sabio-azar-banner-flecha {
            transform: rotate(90deg);
          }
        }
      `}</style>
    </button>
  );
}
