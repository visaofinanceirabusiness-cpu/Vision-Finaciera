'use client';

// ESCÁNER DE CÓDIGO DE BARRAS — con la cámara del celular/tablet, sin
// instalar nada aparte: el navegador pide permiso de cámara una sola
// vez (como para una videollamada) y ya funciona. Reutilizable para
// los dos usos: dar de alta un producto y agregar una línea de Venta.
//
// Se abre como overlay a pantalla completa (mejor uso del espacio en
// celular, que es el dispositivo real donde se va a usar esto).
//
// EL DECODIFICADOR NO ANALIZA EL FRAME COMPLETO DE LA CÁMARA: cada
// pocos milisegundos se recorta SOLO la zona del recuadro verde y se
// la agranda digitalmente antes de analizarla (ver bucleEscaneo). Con
// un código grande esto no hace falta — pero con uno chico, dentro de
// una foto de 1920x1080, el patrón real ocupa muy pocos píxeles y el
// lector no llega a distinguir las barras finas por más nítida que
// esté la imagen. Recortar + agrandar le da mucha más resolución
// efectiva al patrón sin depender de que la cámara pueda enfocar de
// cerca (varios celulares simplemente no tienen esa capacidad de
// hardware, sin importar qué le pidamos por software).

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';

// Sin hints, el lector usa su modo "rápido": suficiente para una foto
// bien nítida de frente, pero en la cámara de un celular real (algo
// de ángulo, brillo disparejo, la mano que tiembla un poco) casi
// nunca llega a decodificar. TRY_HARDER prueba varias pasadas extra
// (rotaciones, binarizados distintos) para esos casos reales — cuesta
// más CPU por frame, pero acá se escanea a demanda (el usuario abre
// el escáner y lo cierra), no en un loop constante de fondo.
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
// misma que dibuja el div guía más abajo (inset: '35% 8%'). Vive acá
// arriba porque el recorte del canvas tiene que coincidir exacto con
// lo que el usuario ve marcado en pantalla.
const RECUADRO = { top: 0.35, bottom: 0.35, left: 0.08, right: 0.08 };

// Cuánto se agranda el recorte antes de analizarlo. Con un código
// chico que en el recuadro ocupa, digamos, 300px reales, llevarlo a
// ~1100px de ancho le da al decodificador casi 4x más resolución
// efectiva sobre las barras.
const ANCHO_RECORTE_ESCALADO = 1100;

const INTERVALO_ESCANEO_MS = 220;

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
  // Evita procesar el mismo código varias veces seguidas mientras
  // sigue en cuadro (se analiza un frame nuevo cada pocos ms) — se
  // resetea recién cuando se abre un escaneo nuevo.
  const ultimoCodigoRef = useRef<string | null>(null);

  const [error, setError] = useState('');
  const [codigoManual, setCodigoManual] = useState('');
  const [mostrarManual, setMostrarManual] = useState(false);
  // Diagnóstico: si este celular ni siquiera ofrece control de foco
  // por software, ningún botón de "reenfocar" va a poder hacer nada
  // — mejor saberlo con certeza que seguir probando a ciegas.
  const [diagnosticoFoco, setDiagnosticoFoco] = useState('');

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
      if (!video || video.readyState < video.HAVE_CURRENT_DATA || !video.videoWidth) return;

      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvasRef.current = canvas;

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
        // NotFoundException en cada frame sin código es lo esperado
        // (la mayoría de los frames, mientras se acomoda el celular)
        // — no es un error real, no hace falta hacer nada con él.
        if (!(e instanceof NotFoundException)) {
          console.warn('Error decodificando el frame:', e);
        }
      }
    }

    async function iniciar() {
      // "focusMode: continuous" (dentro de "advanced", así que es un
      // pedido best-effort — si el navegador no lo soporta, lo ignora
      // en vez de hacer fallar el getUserMedia) — sin esto, varias
      // cámaras de celular arrancan con el foco fijo en distancia
      // "normal" (pensado para videollamada).
      const intentos: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
          },
        },
        // Si el dispositivo no tiene/permite "exact environment"
        // (pasa en algunas notebooks/tablets con una sola cámara), se
        // pide "ideal" en vez de forzarlo.
        { video: { facingMode: 'environment', advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] } },
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
          try {
            const capacidades = track?.getCapabilities?.() as { focusMode?: string[] } | undefined;

            setDiagnosticoFoco(
              capacidades?.focusMode && capacidades.focusMode.length > 0
                ? (esPT ? `Foco controlável: ${capacidades.focusMode.join(', ')}` : `Foco controlable: ${capacidades.focusMode.join(', ')}`)
                : esPT
                  ? 'Este celular não permite controlar o foco pelo navegador.'
                  : 'Este celular no permite controlar el foco desde el navegador.'
            );
          } catch (e) {
            console.warn('No se pudo leer las capacidades de la cámara:', e);
          }

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

  // En varios Android el enfoque continuo se "traba" mirando fijo un
  // punto — pedirle DE NUEVO el mismo valor ("continuous") no dispara
  // nada, porque para el driver de la cámara no cambió nada. Hay que
  // pasar primero por OTRO valor ("manual") para que el cambio de
  // estado sea real, y recién ahí volver a "continuous" — ese vaivén
  // es lo que fuerza una búsqueda de foco nueva.
  async function reenfocar() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'manual' } as MediaTrackConstraintSet] });
      await new Promise((resolve) => setTimeout(resolve, 120));
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
    } catch (e) {
      console.warn('No se pudo reenfocar:', e);
    }
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
            <div
              onClick={reenfocar}
              style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', cursor: 'pointer' }}
            >
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

            <button
              type="button"
              onClick={reenfocar}
              style={{
                marginTop: 10,
                width: '100%',
                border: `1px solid ${colores.verde}`,
                background: 'transparent',
                color: colores.verde,
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔄 {esPT ? 'Não está focando? Toque para reenfocar' : '¿No enfoca? Tocá para reenfocar'}
            </button>

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
