'use client';
// SABIO BOT — SIMULADOR INTERNO
//
// Prueba del motor de conversación (lib/sabioBot.ts) sin depender de
// una cuenta de WhatsApp real todavía: acá el "canal" es esta misma
// pantalla, pero la lógica que responde es EXACTAMENTE la misma que
// va a usar el webhook de WhatsApp el día que se conecte una cuenta
// — se prueba el diseño de la conversación primero, la conexión con
// Meta/un proveedor queda para después.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { iniciarConversacionSabioBot, procesarMensajeSabioBot } from '@/lib/sabioBot';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  fondo: '#f5f7f9',
};

type Mensaje = {
  autor: 'bot' | 'yo';
  texto: string;
};

export default function SabioBotPage() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function iniciar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id) {
        setCargando(false);
        return;
      }

      setEmpresaId(perfil.empresa_id);

      const primeraRespuesta = await iniciarConversacionSabioBot(perfil.empresa_id);
      setMensajes([{ autor: 'bot', texto: primeraRespuesta }]);
      setCargando(false);
    }

    iniciar();
  }, [router]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function enviar() {
    const textoLimpio = texto.trim();
    if (!textoLimpio || !empresaId || enviando) return;

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
    if (!empresaId) return;
    setEnviando(true);
    const primeraRespuesta = await procesarMensajeSabioBot(empresaId, 'reiniciar');
    setMensajes((prev) => [...prev, { autor: 'bot', texto: primeraRespuesta }]);
    setEnviando(false);
  }

  return (
    <main style={{ minHeight: '100vh', background: COLORES.fondo, padding: 24 }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Link
          href="/?vista=empresa"
          style={{ color: COLORES.gris, fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}
        >
          ← Volver
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22, color: COLORES.azul }}>🦉 Sabio Bot</h1>

          <button
            onClick={reiniciar}
            disabled={enviando || cargando}
            style={{
              border: '1px solid #d1d5db',
              background: COLORES.blanco,
              borderRadius: 10,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: COLORES.azul,
              cursor: 'pointer',
            }}
          >
            Reiniciar
          </button>
        </div>

        <p style={{ fontSize: 12.5, color: COLORES.gris, marginTop: 0, marginBottom: 16 }}>
          Simulador interno — probá cómo respondería el bot antes de conectarlo a un WhatsApp real.
        </p>

        <div
          style={{
            background: COLORES.blanco,
            borderRadius: 20,
            border: '1px solid #e5e7eb',
            padding: 16,
            height: '60vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {cargando ? (
            <p style={{ color: COLORES.gris, fontSize: 13 }}>Cargando...</p>
          ) : (
            mensajes.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.autor === 'yo' ? 'flex-end' : 'flex-start',
                  background: m.autor === 'yo' ? COLORES.verde : '#eef2f5',
                  color: m.autor === 'yo' ? '#fff' : COLORES.azul,
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
              background: COLORES.verde,
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
    </main>
  );
}
