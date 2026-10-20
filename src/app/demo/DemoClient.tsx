'use client';

// DEMO — entrada de espectadores (QR / código)
// =====================================================
//
// 1) Primero se elige el idioma (obligatorio, nada viene marcado).
// 2) Después: bienvenida, nombre opcional y 6 Sabios para elegir. Entrar crea un
//    usuario espectador propio (ver app/api/demo/entrar) y lleva al lobby de la demo.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { guardarEspectador, limpiarEspectador, type Idioma } from '@/lib/modoEspectador';

const SABIOS = ['activo', 'azar', 'bot', 'calendario', 'fondo', 'surfista'];

const TEXTOS = {
  ES: {
    hola: '¡Hola! Te damos la bienvenida a nuestra empresa',
    intro: 'Vas a recorrer el sistema en vivo: podés mirar y probar el Mini-Juego, pero no modificar nada. Las pantallas se van habilitando durante la presentación.',
    nombre: '¿Cómo te llamamos? (opcional)',
    placeholder: 'Tu nombre o apodo',
    sabio: 'Elegí tu Sabio',
    entrar: 'Entrar a la empresa',
    entrando: 'Entrando...',
    aviso: 'Tu actividad en esta demo se registra para fines educativos.',
    inactivo: 'Este acceso ya no está activo.',
    lleno: 'La demo llegó al máximo de personas. Avisale a quien te la presentó.',
    error: 'No pudimos entrar. Probá de nuevo.',
    sinCodigo: 'Este enlace no tiene un código válido. Escaneá otra vez el QR.',
  },
  PT: {
    hola: 'Olá! Seja bem-vindo(a) à nossa empresa',
    intro: 'Você vai percorrer o sistema ao vivo: pode olhar e testar o Mini-Jogo, mas não modificar nada. As telas serão liberadas aos poucos durante a apresentação.',
    nombre: 'Como podemos te chamar? (opcional)',
    placeholder: 'Seu nome ou apelido',
    sabio: 'Escolha o seu Sábio',
    entrar: 'Entrar na empresa',
    entrando: 'Entrando...',
    aviso: 'Sua atividade nesta demonstração é registrada para fins educacionais.',
    inactivo: 'Este acesso não está mais ativo.',
    lleno: 'A demonstração atingiu o máximo de pessoas. Avise quem apresentou.',
    error: 'Não foi possível entrar. Tente de novo.',
    sinCodigo: 'Este link não tem um código válido. Escaneie o QR de novo.',
  },
} as const;

export function DemoClient({ empresa }: { empresa: string | null }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<Idioma | null>(null);
  const [apodo, setApodo] = useState('');
  const [sabio, setSabio] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCodigo(new URLSearchParams(window.location.search).get('c')?.trim() ?? '');
  }, []);

  async function entrar() {
    if (!idioma || !codigo) return;
    const t = TEXTOS[idioma];

    setEntrando(true);
    setError('');

    try {
      const respuesta = await fetch('/api/demo/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, idioma, apodo, sabio: sabio || SABIOS[Math.floor(Math.random() * SABIOS.length)] }),
      });
      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        setError(datos.motivo === 'inactivo' ? t.inactivo : datos.motivo === 'lleno' ? t.lleno : t.error);
        setEntrando(false);
        return;
      }

      // Si este navegador ya había usado la demo o tenía otra cuenta, se parte de cero.
      limpiarEspectador();
      await supabase.auth.signOut();

      const { error: errorLogin } = await supabase.auth.signInWithPassword({ email: datos.email, password: datos.password });

      if (errorLogin) {
        setError(t.error);
        setEntrando(false);
        return;
      }

      guardarEspectador({ userId: datos.userId, idioma, apodo: apodo.trim() || undefined, sabio: sabio || undefined });
      router.push('/');
    } catch {
      setError(t.error);
      setEntrando(false);
    }
  }

  const fondo: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #1f3a5f 0%, #2e5a8a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  };

  const tarjeta: React.CSSProperties = {
    width: '100%',
    maxWidth: 560,
    background: '#fff',
    borderRadius: 24,
    padding: '28px 24px',
    boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
    textAlign: 'center',
  };

  if (codigo === null) return <main style={fondo} />;

  if (!codigo) {
    return (
      <main style={fondo}>
        <div style={tarjeta}>
          <p style={{ color: '#374151' }}>{TEXTOS.ES.sinCodigo}</p>
          <p style={{ color: '#374151' }}>{TEXTOS.PT.sinCodigo}</p>
        </div>
      </main>
    );
  }

  if (!idioma) {
    return (
      <main style={fondo}>
        <div style={tarjeta}>
          <img src="/sabio/sabio-surfista.webp" alt="" style={{ height: 120, width: 'auto' }} />
          <h1 style={{ color: '#1f3a5f', fontSize: 24, margin: '8px 0 4px' }}>Visão Financeira</h1>
          {empresa && <p style={{ color: '#2e8b57', fontWeight: 800, margin: '0 0 6px' }}>{empresa}</p>}
          <p style={{ color: '#4b5563', margin: '0 0 20px' }}>Escolha seu idioma · Elegí tu idioma</p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {(['PT', 'ES'] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setIdioma(valor)}
                style={{ flex: '1 1 180px', padding: '16px 12px', borderRadius: 16, border: '2px solid #1f3a5f', background: '#fff', color: '#1f3a5f', fontWeight: 800, fontSize: 18, cursor: 'pointer' }}
              >
                {valor === 'ES' ? '🇦🇷 Español' : '🇧🇷 Português'}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const t = TEXTOS[idioma];

  return (
    <main style={fondo}>
      <div style={tarjeta}>
        <h1 style={{ color: '#1f3a5f', fontSize: 24, margin: '0 0 8px' }}>{t.hola}</h1>
        <p style={{ color: '#4b5563', margin: '0 0 20px', lineHeight: 1.45 }}>{t.intro}</p>

        <label style={{ display: 'block', textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#1f3a5f', marginBottom: 6 }} htmlFor="apodo">
          {t.nombre}
        </label>
        <input
          id="apodo"
          type="text"
          value={apodo}
          maxLength={40}
          onChange={(e) => setApodo(e.target.value)}
          placeholder={t.placeholder}
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #d1d5db', fontSize: 16, marginBottom: 20 }}
        />

        <div style={{ textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#1f3a5f', marginBottom: 10 }}>{t.sabio}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
          {SABIOS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSabio(id)}
              aria-pressed={sabio === id}
              style={{
                padding: 8,
                borderRadius: 16,
                border: sabio === id ? '3px solid #2e8b57' : '2px solid #e5e7eb',
                background: sabio === id ? '#edf6f0' : '#fff',
                cursor: 'pointer',
              }}
            >
              <img src={`/sabio/sabio-${id}.webp`} alt="" style={{ width: '100%', height: 84, objectFit: 'contain' }} />
            </button>
          ))}
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 14, margin: '0 0 12px' }}>{error}</p>}

        <button
          type="button"
          onClick={entrar}
          disabled={entrando}
          style={{ width: '100%', padding: '15px 16px', borderRadius: 14, border: 'none', background: '#2e8b57', color: '#fff', fontWeight: 800, fontSize: 17, cursor: entrando ? 'wait' : 'pointer', opacity: entrando ? 0.7 : 1 }}
        >
          {entrando ? t.entrando : t.entrar}
        </button>

        <p style={{ color: '#6b7280', fontSize: 12, margin: '14px 0 0' }}>{t.aviso}</p>
      </div>
    </main>
  );
}
