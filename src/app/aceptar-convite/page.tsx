'use client';

// ACEPTAR CONVITE — pantalla pública a la que llega alguien invitado
// como Soporte (por el Desarrollador, desde Panel Maestro) o como
// Asistente/Colaborador (por un Cliente, desde Configurações →
// Equipe).
//
// El link trae ?token=... (tabla invitaciones). Acá se muestra qué
// invitación es (vía obtener_invitacion, que no requiere sesión),
// se le pide una contraseña, se crea la cuenta con ese mismo email
// (supabase.auth.signUp) y se llama a aceptar_invitacion — esa
// función busca al usuario recién creado por email (no por sesión,
// porque puede no haber una todavía si el proyecto pide confirmar el
// email) y arma la fila de perfiles con el tipo de usuario que
// corresponda.
//
// El idioma sigue el de la empresa que invita (obtener_invitacion lo
// devuelve) — antes esta pantalla estaba fija en español, sin
// traducción, lo cual no tenía sentido para una empresa de idioma
// portugués (ver Equilibra).

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type EstadoInvitacion =
  | { cargando: true }
  | { cargando: false; valida: false; motivo: string; idioma: 'ES' | 'PT' }
  | {
      cargando: false;
      valida: true;
      email: string;
      nombre: string;
      tipoUsuario: 'SOPORTE' | 'ASISTENTE';
      esFamiliar: boolean;
      idioma: 'ES' | 'PT';
    };

function etiquetaTipo(tipo: string, esFamiliar: boolean, esPt: boolean) {
  if (tipo === 'SOPORTE') return 'Soporte';
  if (esFamiliar) return 'Colaborador';
  return esPt ? 'Assistente' : 'Asistente';
}

function AceptarConviteContenido() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [estado, setEstado] = useState<EstadoInvitacion>({ cargando: true });
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  useEffect(() => {
    async function cargar() {
      if (!token) {
        setEstado({ cargando: false, valida: false, motivo: 'no_existe', idioma: 'ES' });
        return;
      }

      const { data, error: errorObtener } = await supabase.rpc('obtener_invitacion', { p_token: token });

      if (errorObtener || !data) {
        setEstado({ cargando: false, valida: false, motivo: 'no_existe', idioma: 'ES' });
        return;
      }

      const idiomaInvitacion: 'ES' | 'PT' = data.idioma === 'PT' ? 'PT' : 'ES';

      if (!data.valida) {
        setEstado({ cargando: false, valida: false, motivo: data.motivo, idioma: idiomaInvitacion });
        return;
      }

      setEstado({
        cargando: false,
        valida: true,
        email: data.email,
        nombre: data.nombre,
        tipoUsuario: data.tipo_usuario,
        esFamiliar: Boolean(data.es_familiar),
        idioma: idiomaInvitacion,
      });
    }

    cargar();
  }, [token]);

  const esPt = !estado.cargando && estado.idioma === 'PT';

  async function crearCuentaYAceptar(e: React.FormEvent) {
    e.preventDefault();
    if (estado.cargando || !estado.valida) return;

    setError('');

    if (password.length < 6) {
      setError(esPt ? 'A senha precisa ter pelo menos 6 caracteres.' : 'La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }

    if (password !== password2) {
      setError(esPt ? 'As senhas não coincidem.' : 'Las contraseñas no coinciden.');
      return;
    }

    setEnviando(true);

    const { data: signUpData, error: errorSignUp } = await supabase.auth.signUp({
      email: estado.email,
      password,
      options: { emailRedirectTo: 'https://vision-finaciera.vercel.app/login' },
    });

    const mensajeYaExiste = esPt
      ? 'Já existe uma conta com esse email. Entre com ela e peça para quem te convidou revisar seu acesso.'
      : 'Ya existe una cuenta con ese email. Iniciá sesión con ella y pedile a quien te invitó que revise tu acceso.';

    if (errorSignUp || !signUpData.user) {
      setEnviando(false);
      setError(
        errorSignUp?.message === 'User already registered'
          ? mensajeYaExiste
          : `${esPt ? 'Não foi possível criar a conta' : 'No se pudo crear la cuenta'}: ${errorSignUp?.message ?? (esPt ? 'erro desconhecido' : 'error desconocido')}.`
      );
      return;
    }

    if (signUpData.user.identities && signUpData.user.identities.length === 0) {
      setEnviando(false);
      setError(mensajeYaExiste);
      return;
    }

    const { error: errorAceptar } = await supabase.rpc('aceptar_invitacion', { p_token: token });

    setEnviando(false);

    if (errorAceptar) {
      setError(
        esPt
          ? `Sua conta foi criada mas não foi possível vincular seu acesso: ${errorAceptar.message}. Escreva para nós pelo WhatsApp para resolver.`
          : `Se creó tu cuenta pero no se pudo vincular tu acceso: ${errorAceptar.message}. Escribinos por WhatsApp para resolverlo.`
      );
      return;
    }

    setExito(true);
  }

  if (estado.cargando) {
    return (
      <Base titulo="Aceptar invitación">
        <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>Verificando la invitación...</p>
      </Base>
    );
  }

  const titulo = esPt ? 'Aceitar convite' : 'Aceptar invitación';

  if (!estado.valida) {
    const mensajes: Record<string, string> = esPt
      ? {
          no_existe: 'Este link de convite não é válido.',
          ya_resuelta: 'Este convite já foi usado ou foi revogado.',
          vencida: 'Este convite venceu. Peça para quem te convidou enviar um novo.',
        }
      : {
          no_existe: 'Este link de invitación no es válido.',
          ya_resuelta: 'Esta invitación ya fue usada o fue revocada.',
          vencida: 'Esta invitación venció. Pedile a quien te invitó que te mande una nueva.',
        };

    return (
      <Base titulo={titulo}>
        <p style={{ color: '#dc2626', fontSize: 13, lineHeight: 1.5, textAlign: 'center' }}>
          {mensajes[estado.motivo] ?? mensajes.no_existe}
        </p>
      </Base>
    );
  }

  if (exito) {
    const etiqueta = etiquetaTipo(estado.tipoUsuario, estado.esFamiliar, esPt);

    return (
      <Base titulo={titulo}>
        <p style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>
          {esPt
            ? `Sua conta foi criada e seu acesso como ${etiqueta} já está pronto. Se seu email pedir confirmação, verifique sua caixa de entrada antes de entrar.`
            : `Tu cuenta se creó y tu acceso como ${etiqueta} ya está listo. Si tu email pide confirmación, revisá tu casilla antes de entrar.`}
        </p>
        <a href="/login" style={{ display: 'block', textAlign: 'center', marginTop: 16, color: '#1E8C3C', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
          {esPt ? 'Ir para entrar →' : 'Ir a iniciar sesión →'}
        </a>
      </Base>
    );
  }

  const etiqueta = etiquetaTipo(estado.tipoUsuario, estado.esFamiliar, esPt);

  return (
    <Base titulo={titulo}>
      <p style={{ color: '#374151', fontSize: 13, textAlign: 'center', marginBottom: 18 }}>
        {esPt ? (
          <>Você foi convidado(a) como <strong>{etiqueta}</strong> — {estado.nombre} ({estado.email}). Escolha uma senha para criar sua conta.</>
        ) : (
          <>Te invitaron como <strong>{etiqueta}</strong> — {estado.nombre} ({estado.email}). Elegí una contraseña para crear tu cuenta.</>
        )}
      </p>

      <form onSubmit={crearCuentaYAceptar}>
        <label style={{ fontSize: 13, color: '#374151' }}>{esPt ? 'Senha' : 'Contraseña'}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />

        <label style={{ fontSize: 13, color: '#374151' }}>{esPt ? 'Confirmar senha' : 'Confirmar contraseña'}</label>
        <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required style={inputStyle} />

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}

        <button type="submit" disabled={enviando} style={buttonStyle}>
          {enviando ? (esPt ? 'Criando conta...' : 'Creando cuenta...') : esPt ? 'Criar conta e aceitar' : 'Crear cuenta y aceptar'}
        </button>
      </form>
    </Base>
  );
}

function Base({ children, titulo }: { children: React.ReactNode; titulo: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="Visão Financeira" style={{ width: 84, height: 84, objectFit: 'contain' }} />
          <h1 style={{ fontSize: 18, color: '#0b2447', margin: '10px 0 0' }}>{titulo}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AceptarConvitePage() {
  return (
    <Suspense fallback={null}>
      <AceptarConviteContenido />
    </Suspense>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', marginTop: 4, marginBottom: 16, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' };
const buttonStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#0b2447', color: 'white', fontWeight: 600, fontSize: 15, cursor: 'pointer' };
