'use client';

// MENSAJES / VISÃO FINANCEIRA
//
// Bandeja de mensajes financieros para el emprendedor.
// Sabio utiliza este espacio para explicar qué están diciendo
// los números del negocio.
//
// Los mensajes viven en la tabla mensajes_financieros (empresa_id,
// periodo, título, texto, leído). El aislamiento entre empresas ya
// NO depende de ningún chequeo en este código: lo garantiza la
// política RLS de la tabla (cada usuario solo puede leer las filas
// de su propia empresa, o un admin de plataforma). Al abrir un
// mensaje se marca leído en el momento.
//
// Todavía pendiente (no es parte de esta pantalla):
// - Generación automática mensual de los mensajes (hoy se cargan a
//   mano, por empresa, insertando filas en mensajes_financieros).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioMensajes, type ClaveMensajes } from './i18n';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  fondo: '#f5f7f9',
};

type Empresa = {
  nombre: string;
  idioma: string | null;
};

type MensajeFinanciero = {
  id: string;
  titulo: string;
  texto: string;
  leido: boolean;
  creado_en: string;
};

export default function MensajesPage() {
  const router = useRouter();

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [mensajes, setMensajes] = useState<MensajeFinanciero[]>([]);
  const [mensajeAbierto, setMensajeAbierto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargarDatos() {
      setError('');

      const { data: usuarioData } = await supabase.auth.getUser();

      if (!usuarioData.user) {
        router.push('/login');
        return;
      }

      const { data: perfilData, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', usuarioData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfilData?.empresa_id) {
        setError('No se pudo identificar la empresa del usuario.');
        setCargando(false);
        return;
      }

      const [{ data: empresaData, error: errorEmpresa }, { data: mensajesData, error: errorMensajes }] =
        await Promise.all([
          supabase.from('empresas').select('nombre, idioma').eq('id', perfilData.empresa_id).maybeSingle(),

          supabase
            .from('mensajes_financieros')
            .select('id, titulo, texto, leido, creado_en')
            .eq('empresa_id', perfilData.empresa_id)
            .order('creado_en', { ascending: false }),
        ]);

      if (errorEmpresa) {
        setError(`No se pudo cargar la empresa: ${errorEmpresa.message}`);
        setCargando(false);
        return;
      }

      if (errorMensajes) {
        setError(`No se pudieron cargar los mensajes: ${errorMensajes.message}`);
        setCargando(false);
        return;
      }

      setEmpresa(empresaData);
      setMensajes((mensajesData ?? []) as MensajeFinanciero[]);
      setCargando(false);
    }

    cargarDatos();
  }, [router]);

  const idioma = empresa?.idioma ?? 'ES';
  const t = crearTraductor(diccionarioMensajes, idioma);

  async function abrirMensaje(mensaje: MensajeFinanciero) {
    const yaAbierto = mensajeAbierto === mensaje.id;
    setMensajeAbierto(yaAbierto ? null : mensaje.id);

    if (!yaAbierto && !mensaje.leido) {
      setMensajes((actual) => actual.map((m) => (m.id === mensaje.id ? { ...m, leido: true } : m)));

      const { error: errorLeido } = await supabase
        .from('mensajes_financieros')
        .update({ leido: true })
        .eq('id', mensaje.id);

      if (errorLeido) {
        console.warn('No se pudo marcar el mensaje como leído:', errorLeido);
      }
    }
  }

  if (cargando) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORES.fondo,
          color: COLORES.azul,
          fontWeight: 700,
        }}
      >
        {t('cargandoMensajes')}
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORES.fondo,
          padding: 24,
        }}
      >
        <section
          style={{
            background: COLORES.blanco,
            borderRadius: 20,
            padding: 30,
            maxWidth: 500,
            textAlign: 'center',
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ fontSize: 38, marginBottom: 12 }}>⚠️</div>

          <h1
            style={{
              margin: '0 0 10px',
              color: COLORES.azul,
              fontSize: 21,
            }}
          >
            {t('errorTitulo')}
          </h1>

          <p
            style={{
              margin: 0,
              color: COLORES.gris,
              lineHeight: 1.6,
            }}
          >
            {error}
          </p>

          <button
            onClick={() => router.push('/inicio')}
            style={{
              marginTop: 20,
              background: COLORES.azul,
              border: 'none',
              borderRadius: 12,
              padding: '11px 18px',
              color: COLORES.blanco,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('volverAlInicioBoton')}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #edf4f1 0%, transparent 34%), #f5f7f9',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        {/* VOLVER */}

        <button
          onClick={() => router.push('/?vista=empresa')}
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORES.azul,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '8px 0',
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          {t('volverAlInicio')}
        </button>

        {/* ENCABEZADO */}

        <section
          style={{
            background: COLORES.blanco,
            borderRadius: 24,
            border: '1px solid #e5e7eb',
            padding: 30,
            marginBottom: 20,
            boxShadow: '0 12px 30px rgba(31,58,95,0.06)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 15,
                background: `${COLORES.verde}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              ✉️
            </div>

            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.4,
                  color: COLORES.verde,
                  textTransform: 'uppercase',
                }}
              >
                {t('marcaVisaoFinanceira')}
              </div>

              <div
                style={{
                  color: COLORES.azul,
                  fontSize: 13,
                  marginTop: 3,
                }}
              >
                {t('mensajesPara')} {empresa?.nombre ?? 'tu negocio'}
              </div>
            </div>
          </div>

          <h1
            style={{
              margin: 0,
              color: COLORES.azul,
              fontSize: 28,
              lineHeight: 1.2,
            }}
          >
            {t('tituloPagina')}
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              color: COLORES.gris,
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            {t('subtituloPagina')}
          </p>
        </section>

        {/* MENSAJES */}

        {mensajes.length === 0 ? (
          <section
            style={{
              background: COLORES.blanco,
              borderRadius: 18,
              border: '1px dashed #d6dee5',
              padding: '36px 28px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>✉️</div>

            <h2 style={{ margin: '0 0 6px', color: COLORES.azul, fontSize: 17 }}>
              {t('sinMensajesTitulo')}
            </h2>

            <p style={{ margin: 0, color: COLORES.gris, fontSize: 13.5, lineHeight: 1.6 }}>
              {t('sinMensajesTexto')}
            </p>
          </section>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 12,
            }}
          >
            {mensajes.map((mensaje, indice) => {
              const estaAbierto = mensajeAbierto === mensaje.id;

              return (
                <section
                  key={mensaje.id}
                  style={{
                    background: COLORES.blanco,
                    borderRadius: 18,
                    border: estaAbierto
                      ? `1px solid ${COLORES.verde}`
                      : '1px solid #e5e7eb',
                    overflow: 'hidden',
                    boxShadow: estaAbierto
                      ? '0 10px 25px rgba(46,139,87,0.08)'
                      : '0 5px 15px rgba(31,58,95,0.04)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <button
                    onClick={() => abrirMensaje(mensaje)}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '20px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      textAlign: 'left',
                    }}
                  >
                    {/* ICONO */}

                    <div
                      style={{
                        position: 'relative',
                        width: 44,
                        height: 44,
                        borderRadius: 13,
                        background: `${COLORES.verde}12`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 21,
                        flexShrink: 0,
                      }}
                    >
                      ✉️
                      {!mensaje.leido && (
                        <span
                          aria-label="No leído"
                          style={{
                            position: 'absolute',
                            top: -3,
                            right: -3,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: '#dc2626',
                            border: `2px solid ${COLORES.blanco}`,
                          }}
                        />
                      )}
                    </div>

                    {/* TITULO */}

                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: 1.2,
                          color: COLORES.verde,
                          marginBottom: 5,
                        }}
                      >
                        {t('mensajeNumero')} {indice + 1}
                      </div>

                      <div
                        style={{
                          color: COLORES.azul,
                          fontSize: 17,
                          fontWeight: 800,
                          lineHeight: 1.35,
                        }}
                      >
                        {mensaje.titulo}
                      </div>
                    </div>

                    {/* FLECHA */}

                    <div
                      style={{
                        color: COLORES.azul,
                        fontSize: 22,
                        fontWeight: 700,
                        transform: estaAbierto
                          ? 'rotate(180deg)'
                          : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      ⌄
                    </div>
                  </button>

                  {/* CONTENIDO */}

                  {estaAbierto && (
                    <div
                      style={{
                        borderTop: '1px solid #edf0f2',
                        padding: '24px 28px 28px',
                        color: '#374151',
                        fontSize: 15,
                        lineHeight: 1.75,
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {mensaje.texto}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* PIE */}

        <div
          style={{
            textAlign: 'center',
            marginTop: 28,
            paddingBottom: 20,
            color: COLORES.gris,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {t('pieMensajes')}
        </div>
      </div>
    </main>
  );
}
