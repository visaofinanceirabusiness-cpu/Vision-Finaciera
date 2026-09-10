'use client';

// RECUPERAR CONTRASEÑA — paso 1: pedir el email
//
// Bloque D del Día 1 de seguridad: hasta ahora no existía ninguna
// forma de recuperar el acceso si alguien olvidaba su contraseña —
// quedaba afuera de la app para siempre. Este es el primer paso: el
// usuario carga su email y Supabase Auth le manda un link (a
// /restablecer-senha, ver esa pantalla) para elegir una nueva.
//
// Por seguridad (no revelar qué emails están registrados) el mensaje
// que se muestra es el mismo exista o no una cuenta con ese email —
// Supabase Auth ya se comporta así: resetPasswordForEmail no informa
// si el email existe.

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioRecuperarSenha } from './i18n';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [idioma, setIdioma] = useState<'ES' | 'PT'>('PT');

  const t = crearTraductor(diccionarioRecuperarSenha, idioma);

  async function enviarEnlace(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    const { error: errorReset } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Mismo motivo que en crear-cuenta: el "Site URL" de Supabase
      // quedó apuntando a localhost, así que hay que forzar el
      // destino acá para que el link del mail funcione en producción.
      redirectTo: 'https://vision-finaciera.vercel.app/restablecer-senha',
    });

    setEnviando(false);

    if (errorReset) {
      setError(t('errorGenerico'));
      return;
    }

    setEnviado(true);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SelectorIdioma idioma={idioma} onCambiar={setIdioma} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="Visão Financeira" style={{ width: 96, height: 96, objectFit: 'contain' }} />
          <h1 style={{ fontSize: 18, color: '#0b2447', margin: '10px 0 4px' }}>{t('titulo')}</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{t('subtitulo')}</p>
        </div>

        {enviado ? (
          <p style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>
            {t('mensajeEnviado')}
          </p>
        ) : (
          <form onSubmit={enviarEnlace}>
            <label style={{ fontSize: 13, color: '#374151' }}>{t('email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />

            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}

            <button type="submit" disabled={enviando} style={buttonStyle}>
              {enviando ? t('enviando') : t('enviarEnlace')}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7280' }}>
          <a href="/login" style={{ color: '#1E8C3C', fontWeight: 600, textDecoration: 'none' }}>
            {t('volverAlLogin')}
          </a>
        </p>
      </div>
    </div>
  );
}

function SelectorIdioma({ idioma, onCambiar }: { idioma: 'ES' | 'PT'; onCambiar: (idioma: 'ES' | 'PT') => void }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid #1E8C3C', overflow: 'hidden' }}>
      {(['ES', 'PT'] as const).map((opcion) => (
        <button
          key={opcion}
          type="button"
          onClick={() => onCambiar(opcion)}
          style={{
            border: 'none',
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            background: idioma === opcion ? '#1E8C3C' : '#ffffff',
            color: idioma === opcion ? '#ffffff' : '#1E8C3C',
          }}
        >
          {opcion}
        </button>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', marginTop: 4, marginBottom: 16, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' };
const buttonStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#0b2447', color: 'white', fontWeight: 600, fontSize: 15, cursor: 'pointer' };
