'use client';

// RESTABLECER CONTRASEÑA — paso 2: la persona llega acá desde el link
// del mail que mandó /recuperar-senha.
//
// Supabase Auth (con detectSessionInUrl activo por defecto) procesa
// solo el token que viene en la URL y abre una sesión temporal de
// tipo "recovery", avisando con el evento PASSWORD_RECOVERY. Desde
// acá alcanza con pedir la contraseña nueva y llamar
// supabase.auth.updateUser({ password }) — no hace falta leer nada
// de la URL a mano.
//
// Si el link ya venció o es inválido, no llega ningún evento de
// sesión: se lo detecta con un timeout corto y se muestra un error
// pidiendo pedir un link nuevo, en vez de dejar el formulario
// colgado sin explicación.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioRestablecerSenha } from './i18n';

export default function RestablecerSenhaPage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [linkValido, setLinkValido] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [idioma, setIdioma] = useState<'ES' | 'PT'>('PT');

  const t = crearTraductor(diccionarioRestablecerSenha, idioma);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') {
        setLinkValido(true);
        setListo(true);
      }
    });

    // Si el link ya estableció la sesión de recovery ANTES de que este
    // efecto se suscribiera (puede pasar), el evento ya se disparó y
    // se lo perdimos — por eso también se chequea la sesión actual
    // directamente, con un margen corto para que detectSessionInUrl
    // termine de procesar el link.
    const verificar = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setListo((actual) => {
        if (!actual) {
          setLinkValido(Boolean(data.session));
        }
        return true;
      });
    }, 1200);

    return () => {
      subscription.unsubscribe();
      clearTimeout(verificar);
    };
  }, []);

  async function guardarNuevaContrasena(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(t('errorContrasenaCorta'));
      return;
    }

    if (password !== password2) {
      setError(t('errorNoCoincide'));
      return;
    }

    setEnviando(true);

    const { error: errorUpdate } = await supabase.auth.updateUser({ password });

    setEnviando(false);

    if (errorUpdate) {
      setError(t('errorGenerico'));
      return;
    }

    // Se cierra la sesión de recovery a propósito: que la persona
    // entre de nuevo con su contraseña nueva, no que quede logueada
    // "de rebote" desde un link que puede haber quedado abierto en
    // un mail compartido.
    await supabase.auth.signOut();
    setExito(true);
  }

  if (exito) {
    return (
      <PantallaBase idioma={idioma} onCambiarIdioma={setIdioma} titulo={t('titulo')}>
        <p style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>
          {t('mensajeExito')}
        </p>
        <button type="button" onClick={() => router.push('/login')} style={buttonStyle}>
          {t('irAIniciarSesion')}
        </button>
      </PantallaBase>
    );
  }

  if (!listo) {
    return (
      <PantallaBase idioma={idioma} onCambiarIdioma={setIdioma} titulo={t('titulo')}>
        <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>{t('verificando')}</p>
      </PantallaBase>
    );
  }

  if (linkValido === false) {
    return (
      <PantallaBase idioma={idioma} onCambiarIdioma={setIdioma} titulo={t('titulo')}>
        <p style={{ color: '#dc2626', fontSize: 13, lineHeight: 1.5 }}>{t('errorLinkInvalido')}</p>
        <a href="/recuperar-senha" style={{ display: 'block', textAlign: 'center', marginTop: 16, color: '#1E8C3C', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
          {t('pedirLinkNuevo')}
        </a>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase idioma={idioma} onCambiarIdioma={setIdioma} titulo={t('titulo')} subtitulo={t('subtitulo')}>
      <form onSubmit={guardarNuevaContrasena}>
        <label style={{ fontSize: 13, color: '#374151' }}>{t('contrasenaNueva')}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />

        <label style={{ fontSize: 13, color: '#374151' }}>{t('confirmarContrasena')}</label>
        <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required style={inputStyle} />

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}

        <button type="submit" disabled={enviando} style={buttonStyle}>
          {enviando ? t('guardando') : t('guardarContrasena')}
        </button>
      </form>
    </PantallaBase>
  );
}

function PantallaBase({
  idioma,
  onCambiarIdioma,
  titulo,
  subtitulo,
  children,
}: {
  idioma: 'ES' | 'PT';
  onCambiarIdioma: (idioma: 'ES' | 'PT') => void;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SelectorIdioma idioma={idioma} onCambiar={onCambiarIdioma} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="Visão Financeira" style={{ width: 96, height: 96, objectFit: 'contain' }} />
          <h1 style={{ fontSize: 18, color: '#0b2447', margin: '10px 0 4px' }}>{titulo}</h1>
          {subtitulo && <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{subtitulo}</p>}
        </div>

        {children}
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
const buttonStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#0b2447', color: 'white', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 6 };
