'use client';

// PANEL DE CONTROL — banner destacado del lobby, arriba de Sabio del
// Azar. Antes vivía mezclado en la grilla de "Tus Herramientas" como
// un botón más — se le da esta ubicación propia porque es la
// herramienta que más se usa, no una más del montón. Mismo modelo
// visual que SabioAzarLobby/SabioBotLobby (avatar + texto + flecha),
// con un borde grueso "con textura" (degradado metálico en vez de un
// borde plano) para que se note que es jerárquicamente distinto.

import Link from 'next/link';

export function PanelControlLobby({ idioma }: { idioma: string }) {
  const esPT = idioma === 'PT';

  return (
    <Link
      href="/panel-de-control"
      className="panel-control-banner"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        background: 'linear-gradient(125deg, #10223f 0%, #16345f 55%, #0b1a30 100%)',
        borderRadius: 24,
        padding: '18px 26px',
        marginBottom: 16,
        cursor: 'pointer',
        textAlign: 'left',
        textDecoration: 'none',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0, width: 128, height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sabio/sabio-panel-control.png"
          alt="Sabio"
          style={{ width: 170, height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.4))' }}
        />
      </div>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', color: '#5eead4', fontWeight: 800, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>
          {esPT ? 'Sua ferramenta principal' : 'Tu herramienta principal'}
        </span>
        <span style={{ display: 'block', color: '#fff', fontWeight: 800, fontSize: 19, marginBottom: 4 }}>
          {esPT ? 'Painel de Controle' : 'Panel de Control'}
        </span>
        <span style={{ display: 'block', color: 'rgba(255,255,255,0.8)', fontSize: 13.5 }}>
          {esPT
            ? 'Indicadores, gráficos e objetivos — tudo o que você precisa ver hoje'
            : 'Indicadores, gráficos y objetivos — todo lo que necesitás ver hoy'}
        </span>
      </span>

      <span className="panel-control-banner-flecha" style={{ color: '#5eead4', fontSize: 26, fontWeight: 700, flexShrink: 0 }}>→</span>

      <style>{`
        .panel-control-banner {
          position: relative;
          border: 5px solid transparent;
          background-clip: padding-box, border-box;
          background-origin: padding-box, border-box;
          background-image:
            linear-gradient(125deg, #10223f 0%, #16345f 55%, #0b1a30 100%),
            linear-gradient(135deg, #8a97a8 0%, #e2e8f0 18%, #64748b 35%, #cbd5e1 52%, #475569 68%, #e2e8f0 85%, #8a97a8 100%);
        }
        .panel-control-banner-flecha {
          transform: rotate(0deg);
        }
        @media (max-width: 480px) {
          .panel-control-banner {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .panel-control-banner-flecha {
            transform: rotate(90deg);
          }
        }
      `}</style>
    </Link>
  );
}
