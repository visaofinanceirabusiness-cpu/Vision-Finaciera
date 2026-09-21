'use client';

// ESCÁNER DE CÓDIGO DE BARRAS — con la cámara del celular/tablet, sin
// instalar nada aparte: el navegador pide permiso de cámara una sola
// vez (como para una videollamada) y ya funciona. Reutilizable para
// los dos usos: dar de alta un producto y agregar una línea de Venta.
//
// Se abre como overlay a pantalla completa (mejor uso del espacio en
// celular, que es el dispositivo real donde se va a usar esto).
//
// FOCO: muchos celulares NO soportan foco "continuous" (autofoco) por
// software — solo foco "manual" a una distancia fija que el navegador
// SÍ puede controlar (capabilities.focusDistance). Por eso, apenas se
// abre la cámara, se chequean sus capacidades reales: si soporta
// continuous se pide eso; si solo soporta manual con una distancia
// controlable, se muestra un deslizador para que el usuario ajuste la
// distancia de foco a mano — no hay forma de adivinar automáticamente
// a qué distancia va a estar el producto.
//
// EL DECODIFICADOR NO ANALIZA EL FRAME COMPLETO DE LA CÁMARA: cada
// pocos milisegundos se recorta SOLO la zona del recuadro verde y se
// la agranda digitalmente antes de analizarla (ver bucleEscaneo) — le
// da más resolución efectiva a un código chico, aunque esto solo
// ayuda si la imagen de esa zona ya está nítida (agrandar una zona
// borrosa sigue dando una imagen borrosa, por eso el foco de arriba
// es lo que más importa).

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';

const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ],
  ],
]);

// Proporción del recuadro verde respecto al video completo — la
// misma que dibuja el div guía más abajo. Vive acá arriba porque el
// recorte del canvas tiene que coincidir exacto con lo que el usuario
// ve marcado en pantalla.
const RECUADRO = { top: 0.35, bottom: 0.35, left: 0.08, right: 0.08 };
const ANCHO_RECORTE_ESCALADO = 1100;
const INTERVALO_ESCANEO_MS = 220;

type CapacidadesFoco = { focusMode?: string[]; focusDistance?: { min: number; max: number; step: number } };

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ultimoCodigoRef = useRef<string | null>(null);

  const [error, setError] = useState('');
  const [codigoManual, setCodigoManual] = useState('');
  const [mostrarManual, setMostrarManual] = useState(false);
  const [diagnosticoFoco, setDiagnosticoFoco] = useState('');
  const [focoManualRango, setFocoManualRango] = useState<{ min: number; max: number; step: number } | null>(null);
  const [focoManualValor, setFocoManualValor] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    const lector = new BrowserMultiFormatReader(HINTS);

    function detenerStream() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (intervaloRef.current) {
        clearInterval(intervaloRef.current);
        intervaloRef.current = null;
      }
    }

    function bucleEscaneo() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_CURRENT_DATA || !video.videoWidth) return;

      const sx = video.videoWidth * RECUADRO.left;
      const sy = video.videoHeight * RECUADRO.top;
      const sw = video.videoWidth * (1 - RECUADRO.left - RECUADRO.right);
      const sh = video.videoHeight * (1 - RECUADRO.top - RECUADRO.bottom);

      const escala = ANCHO_RECORTE_ESCALADO / sw;
      canvas.width = ANCHO_RECORTE_ESCALADO;
      canvas.height = Math.round(sh * escala);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      try {
        const resultado = lector.decodeFromCanvas(canvas);
        const texto = resultado.getText();

        if (texto !== ultimoCodigoRef.current) {
          ultimoCodigoRef.current = texto;
          onDetectado(texto);
        }
      } catch (e) {
        if (!(e instanceof NotFoundException)) {
          console.warn('Error decodificando el frame:', e);
        }
      }
    }

    // Ajusta el foco según lo que esta cámara realmente soporte —
    // nunca se asume de antemano, se lee de sus capacidades reales.
    async function ajustarFoco(track: MediaStreamTrack) {
      let capacidades: CapacidadesFoco = {};
      try {
        capacidades = (track.getCapabilities?.() ?? {}) as CapacidadesFoco;
      } catch (e) {
        console.warn('No se pudo leer las capacidades de la cámara:', e);
        return;
      }

      if (capacidades.focusMode?.includes('manual') && capacidades.focusDistance) {
        // Solo foco manual: el navegador SÍ puede fijar una distancia
        // exacta, pero no sabe a qué distancia va a estar el producto
        // — arranca en el extremo más cercano (lo más útil para un
        // código de barras) y queda un deslizador para que el usuario
        // lo ajuste a mano si no calza justo.
        const { min, max, step } = capacidades.focusDistance;
        const pasoSeguro = step > 0 ? step : (max - min) / 100 || 0.1;

        setFocoManualRango({ min, max, step: pasoSeguro });
        setFocoManualValor(min);
        setDiagnosticoFoco(
          esPT
            ? 'Este celular só tem foco manual — ajuste com a barra abaixo até a imagem ficar nítida.'
            : 'Este celular solo tiene foco manual — ajustalo con la barra de abajo hasta que se vea nítido.'
        );

        try {
          await track.applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: min } as MediaTrackConstraintSet] });
        } catch (e) {
          console.warn('No se pudo fijar el foco manual inicial:', e);
        }
      } else if (capacidades.focusMode?.includes('continuous')) {
        setDiagnosticoFoco('');
        try {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
        } catch (e) {
          console.warn('No se pudo activar el foco continuo:', e);
        }
      } else {
        setDiagnosticoFoco(
          esPT
            ? 'Este celular não permite controlar o foco pelo navegador.'
            : 'Este celular no permite controlar el foco desde el navegador.'
        );
      }
    }

    async function iniciar() {
      const intentos: MediaStreamConstraints[] = [
        { video: { facingMode: { exact: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
        // Si el dispositivo no tiene/permite "exact environment"
        // (pasa en algunas notebooks/tablets con una sola cámara).
        { video: { facingMode: 'environment' } },
        // Último recurso: la cámara que el navegador elija.
        { video: true },
      ];

      for (const constraints of intentos) {
        if (cancelado) return;

        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);

          if (cancelado) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;

          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            await video.play().catch(() => {});
          }

          intervaloRef.current = setInterval(bucleEscaneo, INTERVALO_ESCANEO_MS);

          const track = stream.getVideoTracks()[0];
          if (track) await ajustarFoco(track);

          return;
        } catch (e) {
          console.warn('No se pudo abrir la cámara con estas condiciones, probando la siguiente opción:', e);
        }
      }

      if (!cancelado) {
        setError(
          esPT
            ? 'Não foi possível acessar a câmera. Verifique se você deu a permissão no navegador.'
            : 'No se pudo acceder a la cámara. Revisá que le hayas dado permiso al navegador.'
        );
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      detenerStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirmarCodigoManual() {
    const codigo = codigoManual.trim();
    if (!codigo) return;
    onDetectado(codigo);
  }

  function moverFocoManual(valor: number) {
    setFocoManualValor(valor);
    const track = streamRef.current?.getVideoTracks()[0];
    track?.applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: valor } as MediaTrackConstraintSet] }).catch((e) => {
      console.warn('No se pudo mover el foco manual:', e);
    });
  }

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
          <>
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} style={{ width: '100%', display: 'block' }} muted playsInline />

              <div
                style={{
                  position: 'absolute',
                  inset: `${RECUADRO.top * 100}% ${RECUADRO.left * 100}%`,
                  border: `3px solid ${colores.verde}`,
                  borderRadius: 10,
                  pointerEvents: 'none',
                }}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ color: '#cbd5e1', fontSize: 10.5, textAlign: 'center', marginBottom: 4 }}>
                {esPT ? 'O que o leitor está analisando (ampliado):' : 'Lo que el lector está analizando (agrandado):'}
              </div>
              <canvas ref={canvasRef} style={{ width: '100%', display: 'block', borderRadius: 10, background: '#000' }} />
            </div>

            {focoManualRango && focoManualValor !== null && (
              <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
                  🔍 {esPT ? 'Ajuste o foco manualmente' : 'Ajustá el foco a mano'}
                </div>

                <input
                  type="range"
                  min={focoManualRango.min}
                  max={focoManualRango.max}
                  step={focoManualRango.step}
                  value={focoManualValor}
                  onChange={(e) => moverFocoManual(Number(e.target.value))}
                  style={{ width: '100%' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: 11 }}>
                  <span>🔎 {esPT ? 'Perto' : 'Cerca'}</span>
                  <span>{esPT ? 'Longe' : 'Lejos'} 🏔️</span>
                </div>
              </div>
            )}

            <p style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
              {esPT
                ? 'Centralize o código de barras dentro do quadro verde — a área do quadro é ampliada antes de analisar, então códigos pequenos também funcionam.'
                : 'Centrá el código de barras dentro del recuadro verde — esa zona se agranda antes de analizarla, así que los códigos chicos también funcionan.'}
            </p>

            {diagnosticoFoco && (
              <p style={{ color: '#94a3b8', fontSize: 10.5, textAlign: 'center', margin: '6px 0 0' }}>{diagnosticoFoco}</p>
            )}
          </>
        )}

        {!mostrarManual ? (
          <button
            type="button"
            onClick={() => setMostrarManual(true)}
            style={{ border: 'none', background: 'transparent', color: '#cbd5e1', fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', display: 'block', margin: '12px auto 0' }}
          >
            {esPT ? 'A câmera não está lendo? Digite o código' : '¿La cámara no lo lee? Escribilo a mano'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={codigoManual}
              onChange={(e) => setCodigoManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmarCodigoManual();
              }}
              placeholder={esPT ? 'Digite o código...' : 'Escribí el código...'}
              autoFocus
              style={{ flex: 1, borderRadius: 10, border: 'none', padding: '10px 12px', fontSize: 13 }}
            />
            <button
              type="button"
              onClick={confirmarCodigoManual}
              disabled={!codigoManual.trim()}
              style={{
                border: 'none',
                background: colores.verde,
                color: '#fff',
                borderRadius: 10,
                padding: '0 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                opacity: codigoManual.trim() ? 1 : 0.6,
              }}
            >
              OK
            </button>
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
