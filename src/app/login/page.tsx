'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setCargando(false);

    if (error) {
      setError('No pudimos iniciar sesión. Revisá tu email y contraseña.');
      return;
    }

    router.push('/');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <form
        onSubmit={iniciarSesion}
        style={{
          background: 'white',
          padding: 32,
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          width: '100%',
          maxWidth: 360,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40 }}>🦉</div>
          <h1 style={{ fontSize: 22, color: '#0b2447', margin: '8px 0 0' }}>
            Visão Financeira
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
            Claridad para decidir. Seguridad para crecer.
          </p>
        </div>

        <label style={{ fontSize: 13, color: '#374151' }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <label style={{ fontSize: 13, color: '#374151' }}>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        {error && (
          <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>
        )}

        <button type="submit" disabled={cargando} style={buttonStyle}>
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  marginTop: 4,
  marginBottom: 16,
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: 8,
  border: 'none',
  background: '#0b2447',
  color: 'white',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
};
