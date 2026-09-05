'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { notificarPendienteAlAdmin } from '@/lib/notificarPush';
import { PAISES_TELEFONO } from '@/lib/paises';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioCrearCuenta, msgErrorCrearCuenta, perfilEmpresaDisplay } from './i18n';

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

function componentesMixtoOpciones(t: (clave: 'comercial' | 'servicios' | 'produccion') => string) {
  return [
    { valor: 'COMERCIAL', etiqueta: t('comercial') },
    { valor: 'SERVICIOS', etiqueta: t('servicios') },
    { valor: 'PRODUCCION', etiqueta: t('produccion') },
  ];
}

// Define qué esquema impositivo recibe el Plano de Contas (ver
// paisDesdeMoneda en lib/perfiles.ts) — es la moneda real en la que
// opera el negocio, independiente del idioma en el que trabaje.
function monedasOpciones(idioma: 'ES' | 'PT') {
  return idioma === 'PT'
    ? [
        { valor: 'ARS', etiqueta: 'Peso argentino (ARS)' },
        { valor: 'BRL', etiqueta: 'Real brasileiro (BRL)' },
        { valor: 'USD', etiqueta: 'Dólar (USD)' },
      ]
    : [
        { valor: 'ARS', etiqueta: 'Peso argentino (ARS)' },
        { valor: 'BRL', etiqueta: 'Real brasileño (BRL)' },
        { valor: 'USD', etiqueta: 'Dólar (USD)' },
      ];
}

export default function CrearCuentaPage() {
  const [perfiles, setPerfiles] = useState<PerfilEmpresa[]>([]);
  const [cargandoPerfiles, setCargandoPerfiles] = useState(true);

  const [nombre, setNombre] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [paisTelefono, setPaisTelefono] = useState('+55');
  const [numeroTelefono, setNumeroTelefono] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [rubro, setRubro] = useState('');
  const [idioma, setIdioma] = useState<'ES' | 'PT'>('PT');
  const [moneda, setMoneda] = useState('BRL');
  const [perfilElegido, setPerfilElegido] = useState('');
  const [componentesMixto, setComponentesMixto] = useState<string[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const t = crearTraductor(diccionarioCrearCuenta, idioma);

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

    if (
      !nombre.trim() ||
      !sexo ||
      !email.trim() ||
      !contrasena ||
      !numeroTelefono.trim() ||
      !nombreEmpresa.trim() ||
      !rubro.trim() ||
      !perfilElegido
    ) {
      setError(t('errorCompletarCampos'));
      return;
    }

    if (contrasena.length < 6) {
      setError(t('errorContrasenaCorta'));
      return;
    }

    if (esMixto && componentesMixto.length === 0) {
      setError(t('errorPerfilMixto'));
      return;
    }

    setEnviando(true);

    const { data: existeNombre, error: errorNombreDuplicado } = await supabase.rpc('existe_nombre_empresa', {
      p_nombre: nombreEmpresa.trim(),
    });

    if (errorNombreDuplicado) {
      setError(msgErrorCrearCuenta(idioma, errorNombreDuplicado.message));
      setEnviando(false);
      return;
    }

    if (existeNombre) {
      setError(t('errorNombreEmpresaDuplicado'));
      setEnviando(false);
      return;
    }

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
          ? t('errorCuentaExistente')
          : msgErrorCrearCuenta(idioma, errorSignUp?.message ?? (idioma === 'PT' ? 'erro desconhecido' : 'error desconocido'))
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
      setError(t('errorConfirmacionPendiente'));
      setEnviando(false);
      return;
    }

    const { error: errorSolicitud } = await supabase.from('solicitudes_alta').insert({
      user_id: signUpData.user.id,
      email: email.trim(),
      nombre: nombre.trim(),
      sexo,
      telefono: `${paisTelefono} ${numeroTelefono.trim()}`,
      nombre_empresa: nombreEmpresa.trim(),
      rubro: rubro.trim(),
      perfil_empresa_id: perfilElegido,
      componentes_mixto: esMixto ? componentesMixto : [],
      moneda,
      idioma,
    });

    if (errorSolicitud) {
      setError(`${t('errorSolicitud')}: ${errorSolicitud.message}`);
      setEnviando(false);
      return;
    }

    notificarPendienteAlAdmin({
      titulo: 'Nueva solicitud de alta',
      cuerpo: `${nombreEmpresa.trim()} · ${nombre.trim()}`,
      url: '/panel-maestro',
    });

    setEnviado(true);
    setEnviando(false);
  }

  if (enviado) {
    return (
      <main style={fondoStyle}>
        <div style={{ ...tarjetaStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>✅</div>
          <h1 style={{ color: COLORES.azul, fontSize: 22, margin: '0 0 10px' }}>
            {t('solicitudEnviadaTitulo')}
          </h1>
          <p style={{ color: COLORES.gris, fontSize: 14, lineHeight: 1.6 }}>
            {t('solicitudEnviadaTexto')}
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
            {t('irAIniciarSesion')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={fondoStyle}>
      <div style={tarjetaStyle}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <SelectorIdioma idioma={idioma} onCambiar={setIdioma} />
        </div>

        <h1 style={{ color: COLORES.azul, fontSize: 24, margin: '0 0 6px' }}>{t('titulo')}</h1>
        <p style={{ color: COLORES.gris, fontSize: 13, margin: '0 0 22px' }}>
          {t('subtitulo')}
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
            <label style={labelStyle}>{t('tuNombre')}</label>
            <input style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('tuNombrePlaceholder')} />
          </div>

          <div>
            <label style={labelStyle}>{t('tuSexo')}</label>
            <select style={inputStyle} value={sexo} onChange={(e) => setSexo(e.target.value as 'M' | 'F' | '')}>
              <option value="">{t('seleccionar')}</option>
              <option value="F">{t('sexoFemenino')}</option>
              <option value="M">{t('sexoMasculino')}</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>{t('email')}</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
            />
          </div>

          <div>
            <label style={labelStyle}>{t('contrasena')}</label>
            <input
              style={inputStyle}
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder={t('contrasenaPlaceholder')}
            />
          </div>

          <div>
            <label style={labelStyle}>{t('telefono')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                style={{ ...inputStyle, width: 130, flexShrink: 0 }}
                value={paisTelefono}
                onChange={(e) => setPaisTelefono(e.target.value)}
              >
                {PAISES_TELEFONO.map((pais) => (
                  <option key={`${pais.nombre}-${pais.codigo}`} value={pais.codigo}>
                    {pais.codigo} {pais.nombre}
                  </option>
                ))}
              </select>
              <input
                style={inputStyle}
                type="tel"
                value={numeroTelefono}
                onChange={(e) => setNumeroTelefono(e.target.value)}
                placeholder={t('numero')}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>{t('nombreEmpresa')}</label>
            <input
              style={inputStyle}
              value={nombreEmpresa}
              onChange={(e) => setNombreEmpresa(e.target.value)}
              placeholder={t('nombreEmpresaPlaceholder')}
            />
          </div>

          <div>
            <label style={labelStyle}>{t('rubro')}</label>
            <input style={inputStyle} value={rubro} onChange={(e) => setRubro(e.target.value)} placeholder={t('rubroPlaceholder')} />
          </div>

          <div>
            <label style={labelStyle}>{t('monedaLabel')}</label>
            <select style={inputStyle} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              {monedasOpciones(idioma).map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>{t('comoFuncionaTuNegocio')}</label>
            {cargandoPerfiles ? (
              <p style={{ fontSize: 13, color: COLORES.gris }}>{t('cargandoOpciones')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {perfiles.map((perfil) => {
                  const { nombre: nombrePerfil, descripcion: descripcionPerfil } = perfilEmpresaDisplay(
                    idioma,
                    perfil.codigo,
                    perfil.nombre,
                    perfil.descripcion
                  );

                  return (
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
                      <span style={{ fontWeight: 700, color: COLORES.azul, fontSize: 13.5 }}>{nombrePerfil}</span>
                      {descripcionPerfil && (
                        <span style={{ display: 'block', fontSize: 12, color: COLORES.gris, marginTop: 2 }}>
                          {descripcionPerfil}
                        </span>
                      )}
                    </span>
                  </label>
                  );
                })}
              </div>
            )}
          </div>

          {esMixto && (
            <div>
              <label style={labelStyle}>{t('queCombinaTuNegocio')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {componentesMixtoOpciones(t).map((c) => (
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
          {enviando ? t('enviando') : t('enviarSolicitud')}
        </button>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          <Link href="/login" style={{ color: COLORES.gris, textDecoration: 'none' }}>
            {t('yaTenesCuenta')}
          </Link>
        </p>
      </div>
    </main>
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
    <div style={{ display: 'inline-flex', borderRadius: 999, border: `1px solid ${COLORES.verde}`, overflow: 'hidden' }}>
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
            background: idioma === opcion ? COLORES.verde : COLORES.blanco,
            color: idioma === opcion ? COLORES.blanco : COLORES.verde,
          }}
        >
          {opcion}
        </button>
      ))}
    </div>
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
