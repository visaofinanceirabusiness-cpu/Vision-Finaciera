'use client';

// ESCÁNER DE CÓDIGO DE BARRAS — con la cámara del celular/tablet, sin
// instalar nada aparte: el navegador pide permiso de cámara una sola
// vez (como para una videollamada) y ya funciona. Reutilizable para
// los dos usos: dar de alta un producto y agregar una línea de Venta.
//
// Se abre como overlay a pantalla completa (mejor uso del espacio en
// celular, que es el dispositivo real donde se va a usar esto).

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';

export function EscanerCodigoBarras({
  idioma,
  colores,
  onDetectado,
  onCerrar,
}: {
  idioma: string;
  colores: { azul: string; verde: string };
  onDetectado: (codigo: string) => void;
  onCerrar: () => void;
}) {
  const esPT = idioma === 'PT';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Evita procesar el mismo código varias veces seguidas mientras
  // sigue en cuadro (el escaneo continuo dispara un resultado por
  // frame) — se resetea recién cuando se abre un escaneo nuevo.
  const ultimoCodigoRef = useRef<string | null>(null);

  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    const lector = new BrowserMultiFormatReader();

    async function iniciar() {
      try {
        const controls = await lector.decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (resultado) => {
          if (cancelado || !resultado) return;

          const texto = resultado.getText();
          if (texto === ultimoCodigoRef.current) return;

          ultimoCodigoRef.current = texto;
          onDetectado(texto);
        });

        if (cancelado) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
      } catch (e) {
        if (!cancelado) {
          setError(
            esPT
              ? 'Não foi possível acessar a câmera. Verifique se você deu a permissão no navegador.'
              : 'No se pudo acceder a la cámara. Revisá que le hayas dado permiso al navegador.'
          );
        }
        console.error('Error iniciando el escáner de código de barras:', e);
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong style={{ color: '#fff', fontSize: 15 }}>
            📷 {esPT ? 'Aponte para o código de barras' : 'Apuntá al código de barras'}
          </strong>

          <button
            type="button"
            onClick={onCerrar}
            style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {error ? (
          <div style={{ color: '#fecaca', fontSize: 13, textAlign: 'center', padding: '30px 10px' }}>{error}</div>
        ) : (
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} style={{ width: '100%', display: 'block' }} muted playsInline />

            <div
              style={{
                position: 'absolute',
                inset: '30% 10%',
                border: `3px solid ${colores.verde}`,
                borderRadius: 10,
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={onCerrar}
          style={{
            marginTop: 16,
            width: '100%',
            border: `1px solid #fff`,
            background: 'transparent',
            color: '#fff',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {esPT ? 'Cancelar' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}
