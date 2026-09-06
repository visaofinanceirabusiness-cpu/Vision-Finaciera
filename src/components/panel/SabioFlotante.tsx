'use client';

// SABIO FLOTANTE — versión "siempre visible" de SabioWidget.
//
// SabioWidget (el paquete completo: imagen 3D + globo de diálogo) hoy
// vive fijo en el lugar donde se lo pone en el JSX — típicamente el
// encabezado de la pantalla — así que en cuanto el usuario hace
// scroll hacia abajo, deja de verse. Este componente lo complementa:
// mientras el widget original sigue en su lugar (arriba), este se
// mantiene oculto; apenas el usuario scrollea más allá de `umbral`
// (o sea, el widget de arriba ya no está a la vista), aparece una
// burbuja compacta anclada abajo a la derecha con el mismo mensaje.
// Al tocarla, se expande al SabioWidget de siempre (mismo paquete,
// misma imagen, mismo texto) flotando sobre el contenido; al volver
// a scrollear cerca del origen, se repliega sola.
//
// Prototipo: por ahora solo se usa en Panel de Controle. La idea es
// llevarlo al resto de las pantallas (Contabilidad, Configurações,
// etc.) una vez que se valide cómo queda acá.

import { useEffect, useState } from 'react';
import { SabioWidget, SABIO_URL } from './SabioWidget';

const UMBRAL_SCROLL_PX = 260;

export function SabioFlotante({
  colores,
  idioma,
  frase,
  onClickFrase,
  frases,
}: {
  colores: {
    azul: string;
    verde: string;
    blanco: string;
  };
  idioma?: string | null;
  frase?: string;
  onClickFrase?: () => void;
  frases?: string[];
}) {
  const [visible, setVisible] = useState(false);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    function alScrollear() {
      const pasoElUmbral = window.scrollY > UMBRAL_SCROLL_PX;

      setVisible(pasoElUmbral);

      if (!pasoElUmbral) {
        setExpandido(false);
      }
    }

    alScrollear();
    window.addEventListener('scroll', alScrollear, { passive: true });

    return () => window.removeEventListener('scroll', alScrollear);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      {expandido && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setExpandido(false)}
            aria-label="Cerrar"
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              zIndex: 1,
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: 'none',
              background: colores.azul,
              color: colores.blanco,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
            }}
          >
            ×
          </button>

          <div
            style={{
              background: colores.azul,
              borderRadius: 24,
              boxShadow: '0 16px 32px rgba(0,0,0,0.28)',
            }}
          >
            <SabioWidget colores={colores} idioma={idioma} frase={frase} onClickFrase={onClickFrase} frases={frases} />
          </div>
        </div>
      )}

      {!expandido && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          aria-label="Sabio"
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            border: 'none',
            background: colores.azul,
            boxShadow: '0 10px 22px rgba(0,0,0,0.28)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SABIO_URL}
            alt="Sabio"
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
          />
        </button>
      )}
    </div>
  );
}
