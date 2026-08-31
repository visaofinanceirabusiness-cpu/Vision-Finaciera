'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type PerfilEmpresa = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
};

const COMPONENTES_MIXTO = [
  { valor: 'COMERCIAL', etiqueta: 'Comercial (compra y venta de mercadería)' },
  { valor: 'SERVICIOS', etiqueta: 'Servicios' },
  { valor: 'PRODUCCION', etiqueta: 'Producción' },
];

export default function CrearCuentaPage() {
  const [perfiles, setPerfiles] = useState<PerfilEmpresa[]>([]);
  const [cargandoPerfiles, setCargandoPerfiles] = useState(true);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [rubro, setRubro] = useState('');
  const [perfilElegido, setPerfilElegido] = useState('');
  const [componentesMixto, setComponentesMixto] = useState<string[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    async function cargarPerfiles() {
      const { data, error: errorPerfiles } = await supabase
        .from('perfiles_empresa')
        .select('id, codigo, nombre, descripcion')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (!errorPerfiles) {
        setPerfiles(data ?? []);
      }
      setCargandoPerfiles(false);
    }

    cargarPerfiles();
  }, []);

  function alternarComponente(valor: string) {
    setComponentesMixto((actual) =>
      actual.includes(valor) ? actual.filter((c) => c !== valor) : [...actual, valor]
    );
  }

  const esMixto = perfiles.find((p) => p.id === perfilElegido)?.codigo === 'MIXTO';

  async function enviarSolicitud() {
    setError('');

    if (!nombre.trim() || !email.trim() || !contrasena || !nombreEmpresa.trim() || !perfilElegido) {
      setError('Completá todos los campos obligatorios.');
      return;
    }

    if (contrasena.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }

    if (esMixto && componentesMixto.length === 0) {
      setError('Para el perfil Mixto, elegí al menos un componente (Comercial, Servicios o Producción).');
      return;
    }

    setEnviando(true);

    const { data: signUpData, error: errorSignUp } = await supabase.auth.signUp({
      email: email.trim(),
      password: contrasena,
      options: {
        // Sin esto, el link del mail de confirmación usa el "Site URL"
        // configurado en Supabase — que hoy apunta a localhost (quedó
        // así de cuando se armó el proyecto). Forzando el destino acá
        // el link funciona sin depender de esa configuración.
        emailRedirectTo: 'https://vision-finaciera.vercel.app/login',
      },
    });

    if (errorSignUp || !signUpData.user) {
      setError(
        errorSignUp?.message === 'User already registered'
          ? 'Ya existe una cuenta con ese email.'
          : `No se pudo crear la cuenta: ${errorSignUp?.message ?? 'error desconocido'}.`
      );
      setEnviando(false);
      return;
    }

    // Por seguridad, si el email YA existe Supabase no tira error acá
    // (para no revelar qué emails están registrados) — devuelve un
    // usuario "de mentira" que nunca se guarda de verdad. La única
    // forma de detectarlo es que "identities" venga vacío. Sin este
    // chequeo, quedaba creada una solicitud apuntando a un usuario
    // que no existe, imposible de vincular después.
    if (signUpData.user.identities && signUpData.user.identities.length === 0) {
      setError('Ya existe una cuenta con ese email — probá iniciar sesión, o pedí que te reenvíen la confirmación.');
      setEnviando(false);
      return;
    }

    const { error: errorSolicitud } = await supabase.from('solicitudes_alta').insert({
      user_id: signUpData.user.id,
      email: email.trim(),
      nombre: nombre.trim(),
      nombre_empresa: nombreEmpresa.trim(),
      rubro: rubro.trim() || null,
      perfil_empresa_id: perfilElegido,
      componentes_mixto: esMixto ? componentesMixto : [],
    });

    if (errorSolicitud) {
      setError(`La cuenta se creó pero no se pudo enviar la solicitud: ${errorSolicitud.message}`);
      setEnviando(false);
      return;
    }

    setEnviado(true);
    setEnviando(false);
  }

  if (enviado) {
    return (
      <main style={fondoStyle}>
        <div style={{ ...tarjetaStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>✅</div>
          <h1 style={{ color: COLORES.azul, fontSize: 22, margin: '0 0 10px' }}>
            ¡Solicitud enviada!
          </h1>
          <p style={{ color: COLORES.gris, fontSize: 14, lineHeight: 1.6 }}>
            Ya está registrada. Un administrador va a revisarla y aprobarla — en cuanto eso pase,
            vas a poder entrar con tu email y contraseña.
          </p>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              marginTop: 16,
              color: COLORES.verde,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Ir a iniciar sesión →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={fondoStyle}>
      <div style={tarjetaStyle}>
        <h1 style={{ color: COLORES.azul, fontSize: 24, margin: '0 0 6px' }}>Crear cuenta</h1>
        <p style={{ color: COLORES.gris, fontSize: 13, margin: '0 0 22px' }}>
          Completá tus datos y los de tu negocio. Un administrador va a revisar y aprobar tu
          solicitud antes de que puedas empezar a operar.
        </p>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Tu nombre *</label>
            <input style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Brenda" />
          </div>

          <div>
            <label style={labelStyle}>Email *</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tuemail@ejemplo.com"
            />
          </div>

          <div>
            <label style={labelStyle}>Contraseña *</label>
            <input
              style={inputStyle}
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Al menos 6 caracteres"
            />
          </div>

          <div>
            <label style={labelStyle}>Nombre de tu empresa/negocio *</label>
            <input
              style={inputStyle}
              value={nombreEmpresa}
              onChange={(e) => setNombreEmpresa(e.target.value)}
              placeholder="Ej: Mi Negocio"
            />
          </div>

          <div>
            <label style={labelStyle}>Rubro (opcional)</label>
            <input style={inputStyle} value={rubro} onChange={(e) => setRubro(e.target.value)} placeholder="Ej: Venta de ropa" />
          </div>

          <div>
            <label style={labelStyle}>¿Cómo funciona tu negocio? *</label>
            {cargandoPerfiles ? (
              <p style={{ fontSize: 13, color: COLORES.gris }}>Cargando opciones...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {perfiles.map((perfil) => (
                  <label
                    key={perfil.id}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${perfilElegido === perfil.id ? COLORES.verde : '#e5e7eb'}`,
                      background: perfilElegido === perfil.id ? `${COLORES.verde}0d` : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="perfil"
                      checked={perfilElegido === perfil.id}
                      onChange={() => setPerfilElegido(perfil.id)}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <span style={{ fontWeight: 700, color: COLORES.azul, fontSize: 13.5 }}>{perfil.nombre}</span>
                      {perfil.descripcion && (
                        <span style={{ display: 'block', fontSize: 12, color: COLORES.gris, marginTop: 2 }}>
                          {perfil.descripcion}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {esMixto && (
            <div>
              <label style={labelStyle}>¿Qué combina tu negocio? *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {COMPONENTES_MIXTO.map((c) => (
                  <label key={c.valor} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: COLORES.azul }}>
                    <input
                      type="checkbox"
                      checked={componentesMixto.includes(c.valor)}
                      onChange={() => alternarComponente(c.valor)}
                    />
                    {c.etiqueta}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={enviando}
          onClick={enviarSolicitud}
          style={{
            marginTop: 22,
            width: '100%',
            padding: '13px 0',
            borderRadius: 12,
            border: 'none',
            background: COLORES.verde,
            color: COLORES.blanco,
            fontWeight: 700,
            fontSize: 15,
            cursor: enviando ? 'wait' : 'pointer',
            opacity: enviando ? 0.7 : 1,
          }}
        >
          {enviando ? 'Enviando...' : 'Enviar solicitud'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          <Link href="/login" style={{ color: COLORES.gris, textDecoration: 'none' }}>
            ¿Ya tenés cuenta? Iniciá sesión
          </Link>
        </p>
      </div>
    </main>
  );
}

const fondoStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(circle at top left, #edf4f1 0%, transparent 34%), #f5f7f9',
  padding: 24,
};

const tarjetaStyle: CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: '32px 30px',
  maxWidth: 480,
  width: '100%',
  boxShadow: '0 18px 40px rgba(31,58,95,0.10)',
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLORES.gris,
  marginBottom: 5,
  display: 'block',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #d7dde3',
  fontSize: 14,
  boxSizing: 'border-box',
};
