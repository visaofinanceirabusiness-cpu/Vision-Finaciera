'use client';
// SABIO BOT — ventana de chat reutilizable.
//
// Misma lógica que el simulador interno (antes vivía solo en
// /sabio-bot/page.tsx): ahora es un componente aparte para poder
// embeberlo directo en el lobby (ver SabioBotLobby.tsx) además de
// seguir usándolo como pantalla completa. El motor que responde
// (lib/sabioBot.ts) es el mismo en los dos lugares.

import { useEffect, useRef, useState } from 'react';
import { iniciarConversacionSabioBot, procesarMensajeSabioBot } from '@/lib/sabioBot';

type Mensaje = {
  autor: 'bot' | 'yo';
  texto: string;
};

export function SabioBotChat({
  empresaId,
  colores,
  altura = '60vh',
}: {
  empresaId: string;
  colores: { azul: string; verde: string; gris: string; blanco: string };
  altura?: string;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;

    iniciarConversacionSabioBot(empresaId).then((respuesta) => {
      if (!cancelado) {
        setMensajes([{ autor: 'bot', texto: respuesta }]);
        setCargando(false);
      }
    });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function enviar() {
    const textoLimpio = texto.trim();
    if (!textoLimpio || enviando) return;

    setMensajes((prev) => [...prev, { autor: 'yo', texto: textoLimpio }]);
    setTexto('');
    setEnviando(true);

    try {
      const respuesta = await procesarMensajeSabioBot(empresaId, textoLimpio);
      setMensajes((prev) => [...prev, { autor: 'bot', texto: respuesta }]);
    } catch (error) {
      setMensajes((prev) => [...prev, { autor: 'bot', texto: `⚠️ Error inesperado: ${(error as Error).message}` }]);
    } finally {
      setEnviando(false);
    }
  }

  async function reiniciar() {
    setEnviando(true);
    const respuesta = await procesarMensajeSabioBot(empresaId, 'reiniciar');
    setMensajes((prev) => [...prev, { autor: 'bot', texto: respuesta }]);
    setEnviando(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={reiniciar}
          disabled={enviando || cargando}
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
          Reiniciar
        </button>
      </div>

      <div
        style={{
          background: colores.blanco,
          borderRadius: 20,
          border: '1px solid #e5e7eb',
          padding: 16,
          height: altura,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {cargando ? (
          <p style={{ color: colores.gris, fontSize: 13 }}>Cargando...</p>
        ) : (
          mensajes.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.autor === 'yo' ? 'flex-end' : 'flex-start',
                background: m.autor === 'yo' ? colores.verde : '#eef2f5',
                color: m.autor === 'yo' ? '#fff' : colores.azul,
                borderRadius: 14,
                padding: '10px 14px',
                maxWidth: '85%',
                whiteSpace: 'pre-wrap',
                fontSize: 14,
                lineHeight: 1.4,
              }}
            >
              {m.texto}
            </div>
          ))
        )}
        <div ref={finRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder="Escribí tu respuesta..."
          disabled={enviando || cargando}
          style={{
            flex: 1,
            padding: '11px 14px',
            borderRadius: 12,
            border: '1px solid #d1d5db',
            fontSize: 14,
          }}
        />
        <button
          onClick={enviar}
          disabled={enviando || cargando || !texto.trim()}
          style={{
            border: 'none',
            background: colores.verde,
            color: '#fff',
            borderRadius: 12,
            padding: '0 18px',
            fontWeight: 700,
            cursor: 'pointer',
            opacity: enviando ? 0.7 : 1,
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
