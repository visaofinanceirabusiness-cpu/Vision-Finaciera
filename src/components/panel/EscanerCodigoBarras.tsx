'use client';

// ESCÁNER DE CÓDIGO DE BARRAS — con la cámara del celular/tablet, sin
// instalar nada aparte: el navegador pide permiso de cámara una sola
// vez (como para una videollamada) y ya funciona. Reutilizable para
// los dos usos: dar de alta un producto y agregar una línea de Venta.
//
// Se abre como overlay a pantalla completa (mejor uso del espacio en
// celular, que es el dispositivo real donde se va a usar esto).
//
// Pide la cámara TRASERA explícitamente y en una resolución decente
// (decodeFromVideoDevice con deviceId=undefined, la opción más
// simple, deja que el navegador elija cámara y a veces trae la
// frontal o una resolución muy baja — con eso el lector "ve" la
// imagen pero nunca llega a distinguir las barras). Si aun así no
// logra leerlo (código gastado, muy chico, poca luz), siempre queda
// la opción de escribirlo a mano.

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

// Sin hints, el lector usa su modo "rápido": suficiente para una foto
// bien nítida de frente, pero en la cámara de un celular real (algo
// de ángulo, brillo disparejo, la mano que tiembla un poco) casi
// nunca llega a decodificar — la imagen se ve perfecta en pantalla
// pero el algoritmo no reconoce el patrón. TRY_HARDER prueba varias
// pasadas extra (rotaciones, binarizados distintos) para esos casos
// reales — cuesta más CPU por frame, pero acá se escanea a demanda
// (el usuario abre el escáner y lo cierra), no en un loop constante
// de fondo, así que el costo no importa.
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
  const [codigoManual, setCodigoManual] = useState('');
  const [mostrarManual, setMostrarManual] = useState(false);
  // Diagnóstico: si este celular ni siquiera ofrece control de foco
  // por software, ningún botón de "reenfocar" va a poder hacer nada
  // — mejor saberlo con certeza que seguir probando a ciegas.
  const [diagnosticoFoco, setDiagnosticoFoco] = useState('');

  useEffect(() => {
    let cancelado = false;
    const lector = new BrowserMultiFormatReader(HINTS);

    async function iniciar() {
      // "focusMode: continuous" (dentro de "advanced", así que es un
      // pedido best-effort — si el navegador no lo soporta, lo ignora
      // en vez de hacer fallar el getUserMedia) es la parte que más
      // importa acá: sin esto, varias cámaras de celular arrancan con
      // el foco fijo en distancia "normal" (pensado para video-
      // llamada) y a la distancia corta que necesita un código de
      // barras la imagen queda borrosa todo el tiempo, sin importar
      // la resolución que se pida.
      const intentos: MediaStreamConstraints[] = [
        // 1) Cámara trasera, buena resolución, foco continuo.
        {
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
          },
        },
        // 2) Si el dispositivo no tiene/permite "exact environment"
        //    (pasa en algunas notebooks/tablets con una sola cámara),
        //    se pide "ideal" en vez de forzarlo.
        { video: { facingMode: 'environment', advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] } },
        // 3) Último recurso: la cámara que el navegador elija.
        { video: true },
      ];

      for (const constraints of intentos) {
        if (cancelado) return;

        try {
          const controls = await lector.decodeFromConstraints(constraints, videoRef.current ?? undefined, (resultado) => {
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

          try {
            const capacidades = controls.streamVideoCapabilitiesGet?.((track) => [track]);
            const focoSoportado = Array.isArray((capacidades as { focusMode?: string[] })?.focusMode)
              ? (capacidades as { focusMode?: string[] }).focusMode
              : null;

            setDiagnosticoFoco(
              focoSoportado && focoSoportado.length > 0
                ? (esPT ? `Foco controlável: ${focoSoportado.join(', ')}` : `Foco controlable: ${focoSoportado.join(', ')}`)
                : esPT
                  ? 'Este celular não permite controlar o foco pelo navegador — o zoom/distância da câmera é o único jeito de ajudar.'
                  : 'Este celular no permite controlar el foco desde el navegador — el zoom/distancia de la cámara es la única forma de ayudar.'
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
      controlsRef.current?.stop();
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
  // pasar primero por OTRO valor ("manual", aunque este celular no lo
  // vaya a usar de verdad) para que el cambio de estado sea real, y
  // recién ahí volver a "continuous" — ese vaivén es lo que fuerza una
  // búsqueda de foco nueva, similar a tocar la pantalla en una app de
  // cámara nativa.
  async function reenfocar() {
    const controls = controlsRef.current;
    if (!controls?.streamVideoConstraintsApply) return;

    try {
      await controls.streamVideoConstraintsApply({ advanced: [{ focusMode: 'manual' } as MediaTrackConstraintSet] });
      await new Promise((resolve) => setTimeout(resolve, 120));
      await controls.streamVideoConstraintsApply({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
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
                  inset: '35% 8%',
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
                ? 'Se a imagem ficar borrada: afaste um pouco (uns 15 cm), com boa luz, e mantenha firme uns segundos — muito perto, a câmera não consegue focar.'
                : 'Si se ve borroso: alejalo un poco (unos 15 cm), con buena luz, y mantenelo firme unos segundos — muy cerca, la cámara no puede enfocar.'}
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
