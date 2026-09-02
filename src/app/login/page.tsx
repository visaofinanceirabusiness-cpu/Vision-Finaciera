'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioLogin } from './i18n';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [idioma, setIdioma] = useState<'ES' | 'PT'>('PT');

  const t = crearTraductor(diccionarioLogin, idioma);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);

    const { error: errorAuth } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);

      if (errorAuth) {
      setError(
        errorAuth.message.toLowerCase().includes('email not confirmed')
          ? t('errorEmailNoConfirmado')
          : t('errorCredenciales')
      );
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('es_admin_plataforma')
      .eq('id', userData.user?.id)
      .maybeSingle();

    router.push(perfil?.es_admin_plataforma ? '/panel-maestro' : '/');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={iniciarSesion} style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SelectorIdioma idioma={idioma} onCambiar={setIdioma} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt={'Visão Financeira'} style={{ width: 96, height: 96, objectFit: 'contain' }} />
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>{t('eslogan')}</p>
          <a href="https://visao-financeira-web.vercel.app" style={{ display: 'inline-block', marginTop: 14, color: '#1E8C3C', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>{t('volverAlSitio')}</a>
        </div>

        <label style={{ fontSize: 13, color: '#374151' }}>{t('email')}</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
        <label style={{ fontSize: 13, color: '#374151' }}>{t('contrasena')}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <button type="submit" disabled={cargando} style={buttonStyle}>{cargando ? t('entrando') : t('entrar')}</button>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7280' }}>
          {t('noTenesCuenta')}{' '}
          <a href="/crear-cuenta" style={{ color: '#1E8C3C', fontWeight: 600, textDecoration: 'none' }}>
            {t('creaUnaAca')}
          </a>
        </p>
      </form>
    </div>
  );
}

function SelectorIdioma({
  idioma,
  onCambiar,
}: {
  idioma: 'ES' | 'PT';
  onCambiar: (idioma: 'ES' | 'PT') => void;
}) {
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
