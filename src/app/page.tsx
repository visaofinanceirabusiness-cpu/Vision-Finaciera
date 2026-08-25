'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { obtenerProgresoGamificacion } from '@/lib/gamificacion';

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Perfil = {
  nombre: string;
  empresa_id: string;
  rol: string;
};

type Empresa = {
  nombre: string;
  rubro: string | null;
  logo_url: string | null;
};

type ConfiguracionDashboard = {
  color_primario: string;
  color_secundario: string;
  color_acento: string;
  mensaje_bienvenida: string | null;
  subtitulo_dashboard: string | null;
  mostrar_gamificacion: boolean;
  mostrar_objetivos: boolean;
  mostrar_graficos: boolean;
};

type ProgresoGamificacion = {
  operaciones: number;
  nivel: number;
  nombre: string;
  emoji: string;
  operacionesMin: number;
  operacionesMax: number | null;
  mision: string;
  mensaje: string;
  progreso: number;
  faltan: number;
};

type ObjetivoEmpresa = {
  id: string;
  periodo: string;
  indicador: string;
  objetivo: number;
  unidad: string;
  activo: boolean;
};

type ObjetivoDashboard = ObjetivoEmpresa & {
  resultado: number;
  porcentaje: number;
};

export default function MiNegocioPage() {
  const router = useRouter();

  const [perfil, setPerfil] =
    useState<Perfil | null>(null);

  const [empresa, setEmpresa] =
    useState<Empresa | null>(null);

  const [configuracion, setConfiguracion] =
    useState<ConfiguracionDashboard | null>(
      null
    );

  const [gamificacion, setGamificacion] =
    useState<ProgresoGamificacion | null>(
      null
    );

  const [objetivos, setObjetivos] =
    useState<ObjetivoDashboard[]>([]);

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function cargar() {
      setError('');

      const { data: userData } =
        await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      // =================================================
      // PERFIL
      // =================================================

      const {
        data: perfilData,
        error: errorPerfil,
      } = await supabase
        .from('perfiles')
        .select(
          'nombre, empresa_id, rol'
        )
        .eq(
          'id',
          userData.user.id
        )
        .maybeSingle();

      if (
        errorPerfil ||
        !perfilData?.empresa_id
      ) {
        setError(
          'No se pudo identificar la empresa del usuario.'
        );
        setCargando(false);
        return;
      }

      setPerfil(perfilData);

      // =================================================
      // EMPRESA
      // =================================================

      const {
        data: empresaData,
        error: errorEmpresa,
      } = await supabase
        .from('empresas')
        .select(
          'nombre, rubro, logo_url'
        )
        .eq(
          'id',
          perfilData.empresa_id
        )
        .maybeSingle();

      if (errorEmpresa) {
        setError(
          `No se pudo cargar la empresa: ${errorEmpresa.message}`
        );
        setCargando(false);
        return;
      }

      setEmpresa(empresaData);

      // =================================================
      // CONFIGURACIÓN VISUAL
      // =================================================

      const {
        data: configData,
        error: errorConfig,
      } = await supabase
        .from('configuracion_dashboard')
        .select(
          `
          color_primario,
          color_secundario,
          color_acento,
          mensaje_bienvenida,
          subtitulo_dashboard,
          mostrar_gamificacion,
          mostrar_objetivos,
          mostrar_graficos
          `
        )
        .eq(
          'empresa_id',
          perfilData.empresa_id
        )
        .maybeSingle();

      if (errorConfig) {
        console.warn(
          'No se pudo cargar configuracion_dashboard:',
          errorConfig
        );
      }

      const configFinal =
        configData ?? {
          color_primario:
            COLORES_BASE.azul,
          color_secundario:
            COLORES_BASE.verde,
          color_acento:
            COLORES_BASE.gris,
          mensaje_bienvenida:
            null,
          subtitulo_dashboard:
            null,
          mostrar_gamificacion:
            true,
          mostrar_objetivos:
            true,
          mostrar_graficos:
            true,
        };

      setConfiguracion(
        configFinal
      );

      // =================================================
      // GAMIFICACIÓN
      // =================================================
      //
      // IMPORTANTE:
      // Usamos una variable local para que los
      // objetivos puedan utilizar inmediatamente
      // el mismo resultado, sin depender de que
      // React actualice el estado.

      let progresoGamificacion:
        | ProgresoGamificacion
        | null = null;

      try {
        progresoGamificacion =
          await obtenerProgresoGamificacion(
            perfilData.empresa_id
          );

        setGamificacion(
          progresoGamificacion
        );
      } catch (errorGamificacion) {
        console.warn(
          'No se pudo calcular la gamificación:',
          errorGamificacion
        );

        setGamificacion(
          null
        );
      }

      // =================================================
      // OBJETIVOS DEL PERÍODO ACTUAL
      // =================================================

      const fechaActual =
        new Date();

      const periodoActual =
        `${fechaActual.getFullYear()}-${String(
          fechaActual.getMonth() + 1
        ).padStart(2, '0')}-01`;

      const {
        data: objetivosData,
        error: errorObjetivos,
      } = await supabase
        .from('objetivos_empresa')
        .select(
          `
          id,
          periodo,
          indicador,
          objetivo,
          unidad,
          activo
          `
        )
        .eq(
          'empresa_id',
          perfilData.empresa_id
        )
        .eq(
          'periodo',
          periodoActual
        )
        .eq(
          'activo',
          true
        )
        .order(
          'indicador',
          {
            ascending: true,
          }
        );

      if (errorObjetivos) {
        console.warn(
          'No se pudieron cargar los objetivos:',
          errorObjetivos
        );

        setObjetivos([]);
      } else {
        const objetivosCalculados =
          (
            (objetivosData ??
              []) as ObjetivoEmpresa[]
          ).map((objetivo) => {
            const resultado =
              obtenerResultadoObjetivo(
                objetivo,
                progresoGamificacion
              );

            const porcentaje =
              objetivo.objetivo > 0
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      (resultado /
                        Number(
                          objetivo.objetivo
                        )) *
                        100
                    )
                  )
                : 0;

            return {
              ...objetivo,
              resultado,
              porcentaje:
                Number(
                  porcentaje.toFixed(2)
                ),
            };
          });

        setObjetivos(
          objetivosCalculados
        );
      }

      setCargando(false);
    }

    cargar();
  }, [router]);

  // ===================================================
  // ESTADO DE CARGA
  // ===================================================

  if (cargando) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f7f9',
          color: COLORES_BASE.azul,
          fontWeight: 600,
        }}
      >
        Cargando tu negocio...
      </div>
    );
  }

  // ===================================================
  // COLORES DINÁMICOS
  // ===================================================

  const colores = {
    azul:
      configuracion?.color_primario ||
      COLORES_BASE.azul,

    verde:
      configuracion?.color_secundario ||
      COLORES_BASE.verde,

    acento:
      configuracion?.color_acento ||
      COLORES_BASE.gris,

    blanco:
      COLORES_BASE.blanco,
  };

  const hoy =
    new Date().toLocaleDateString(
      'es-AR',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }
    );

  const periodoTexto =
    new Date().toLocaleDateString(
      'es-AR',
      {
        month: 'long',
        year: 'numeric',
      }
    );

  const logoDisponible =
    Boolean(
      empresa?.logo_url?.trim()
    );

  const mensajeBienvenida =
    configuracion?.mensaje_bienvenida ||
    `Hola, ${
      perfil?.nombre ?? ''
    } 👋`;

  const subtitulo =
    configuracion?.subtitulo_dashboard ||
    'Tu negocio, tus números y tus próximos objetivos.';

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
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        {/* =================================================
            BARRA SUPERIOR
        ================================================= */}

        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background:
                  colores.blanco,
                border:
                  `2px solid ${colores.acento}`,
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                overflow:
                  'hidden',
              }}
            >
              {logoDisponible ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    empresa!.logo_url!
                  }
                  alt={`Logo de ${empresa?.nombre}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit:
                      'contain',
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    color:
                      colores.azul,
                  }}
                >
                  {(
                    empresa?.nombre ||
                    'M'
                  )
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <div
                style={{
                  fontWeight: 800,
                  color:
                    colores.azul,
                }}
              >
                {empresa?.nombre ||
                  'Mi Negocio'}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color:
                    COLORES_BASE.gris,
                }}
              >
                {empresa?.rubro ||
                  'Gestión financiera'}
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push(
                '/login'
              );
            }}
            style={{
              background:
                colores.blanco,
              border:
                '1px solid #d1d5db',
              borderRadius: 12,
              padding:
                '10px 14px',
              cursor:
                'pointer',
              color:
                colores.azul,
              fontWeight: 600,
            }}
          >
            Cerrar sesión
          </button>
        </div>

        {/* =================================================
            HERO
        ================================================= */}

        <section
          style={{
            background:
              `linear-gradient(125deg, ${colores.azul} 0%, ${colores.azul} 58%, ${colores.verde} 100%)`,
            color:
              colores.blanco,
            borderRadius: 26,
            padding:
              '28px 30px',
            marginBottom: 20,
            boxShadow:
              '0 18px 40px rgba(31,58,95,0.16)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems:
                'center',
              gap: 24,
              flexWrap:
                'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing:
                    1.4,
                  textTransform:
                    'uppercase',
                  opacity: 0.75,
                  marginBottom: 8,
                }}
              >
                MI NEGOCIO
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: 32,
                }}
              >
                {empresa?.nombre}
              </h1>

              <p
                style={{
                  margin:
                    '10px 0 0',
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {mensajeBienvenida}
              </p>

              <p
                style={{
                  margin:
                    '6px 0 0',
                  opacity: 0.82,
                  fontSize: 14,
                }}
              >
                {subtitulo}
              </p>

              <p
                style={{
                  margin:
                    '10px 0 0',
                  opacity: 0.68,
                  fontSize: 12,
                }}
              >
                {hoy}
              </p>
            </div>

            {/* SABIO */}

            <div
              style={{
                minWidth: 170,
                padding:
                  '16px 20px',
                borderRadius: 20,
                background:
                  'rgba(255,255,255,0.10)',
                border:
                  '1px solid rgba(255,255,255,0.16)',
                textAlign:
                  'center',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing:
                    1.2,
                  opacity: 0.72,
                  marginBottom:
                    8,
                }}
              >
                SABIO
              </div>

              <div
                style={{
                  fontSize: 42,
                  lineHeight: 1,
                }}
              >
                🦉
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  opacity: 0.85,
                }}
              >
                Tu compañero
                financiero
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            RESUMEN
        ================================================= */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 14,
            marginBottom: 20,
          }}
        >
          <ResumenCard
            titulo="Ventas hoy"
            valor="R$ 0,00"
            color={
              colores.verde
            }
          />

          <ResumenCard
            titulo="Caja disponible"
            valor="R$ 0,00"
            color={
              colores.azul
            }
          />

          <ResumenCard
            titulo="Gastos del mes"
            valor="R$ 0,00"
            color="#c2410c"
          />

          <ResumenCard
            titulo="Stock bajo"
            valor="0 productos"
            color={
              colores.acento
            }
          />
        </div>

        {/* =================================================
            OBJETIVOS DEL MES
        ================================================= */}

        {configuracion?.mostrar_objetivos && (
          <section
            style={{
              background:
                colores.blanco,
              borderRadius: 24,
              padding: 24,
              marginBottom: 20,
              border:
                '1px solid #e5e7eb',
              boxShadow:
                '0 10px 28px rgba(31,58,95,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                gap: 16,
                flexWrap:
                  'wrap',
                marginBottom:
                  18,
              }}
            >
              <div>
                <p
                  style={{
                    margin:
                      '0 0 5px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing:
                      1.3,
                    color:
                      colores.verde,
                  }}
                >
                  GESTIÓN
                </p>

                <h2
                  style={{
                    margin: 0,
                    color:
                      colores.azul,
                    fontSize: 22,
                  }}
                >
                  Objetivos del mes
                </h2>

                <p
                  style={{
                    margin:
                      '5px 0 0',
                    fontSize: 12,
                    color:
                      COLORES_BASE.gris,
                    textTransform:
                      'capitalize',
                  }}
                >
                  {periodoTexto}
                </p>
              </div>

              <div
                style={{
                  padding:
                    '8px 12px',
                  borderRadius: 999,
                  background:
                    `${colores.verde}14`,
                  color:
                    colores.verde,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Objetivos acordados
              </div>
            </div>

            {!objetivos.length ? (
              <div
                style={{
                  padding: 24,
                  border:
                    '1px dashed #d6dee5',
                  borderRadius: 14,
                  textAlign:
                    'center',
                  color:
                    COLORES_BASE.gris,
                  fontSize: 13,
                }}
              >
                No hay objetivos configurados
                para este período.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 14,
                }}
              >
                {objetivos.map(
                  (objetivo) => (
                    <ObjetivoCard
                      key={
                        objetivo.id
                      }
                      objetivo={
                        objetivo
                      }
                      colorPrimario={
                        colores.azul
                      }
                      colorSecundario={
                        colores.verde
                      }
                      colorAcento={
                        colores.acento
                      }
                    />
                  )
                )}
              </div>
            )}
          </section>
        )}

        {/* =================================================
            GAMIFICACIÓN
        ================================================= */}

        {configuracion?.mostrar_gamificacion &&
          gamificacion && (
            <section
              style={{
                background:
                  colores.blanco,
                borderRadius: 24,
                padding: 24,
                marginBottom: 20,
                border:
                  `1px solid ${colores.acento}33`,
                boxShadow:
                  '0 10px 28px rgba(31,58,95,0.08)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'flex-start',
                  gap: 20,
                  flexWrap:
                    'wrap',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 250,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color:
                        colores.verde,
                      letterSpacing:
                        1.3,
                      marginBottom:
                        6,
                    }}
                  >
                    PROGRESO DE TU NEGOCIO
                  </div>

                  <h2
                    style={{
                      margin: 0,
                      color:
                        colores.azul,
                      fontSize: 23,
                    }}
                  >
                    {
                      gamificacion.emoji
                    }{' '}
                    Nivel{' '}
                    {
                      gamificacion.nivel
                    }{' '}
                    ·{' '}
                    {
                      gamificacion.nombre
                    }
                  </h2>

                  <p
                    style={{
                      margin:
                        '8px 0 0',
                      color:
                        COLORES_BASE.gris,
                      fontSize: 14,
                    }}
                  >
                    {
                      gamificacion.mensaje
                    }
                  </p>
                </div>

                <div
                  style={{
                    textAlign:
                      'right',
                    minWidth: 170,
                  }}
                >
                  <strong
                    style={{
                      color:
                        colores.azul,
                      fontSize: 24,
                    }}
                  >
                    {
                      gamificacion.operaciones
                    }
                  </strong>

                  <div
                    style={{
                      fontSize: 12,
                      color:
                        COLORES_BASE.gris,
                    }}
                  >
                    operaciones registradas
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    marginBottom: 7,
                    fontSize: 12,
                    fontWeight: 700,
                    color:
                      COLORES_BASE.gris,
                  }}
                >
                  <span>
                    Progreso
                  </span>

                  <span>
                    {
                      gamificacion.progreso
                    }
                    %
                  </span>
                </div>

                <div
                  style={{
                    height: 12,
                    borderRadius:
                      999,
                    background:
                      '#e7edf1',
                    overflow:
                      'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${gamificacion.progreso}%`,
                      height: '100%',
                      borderRadius:
                        999,
                      background:
                        `linear-gradient(90deg, ${colores.verde}, ${colores.acento})`,
                      transition:
                        'width 0.4s ease',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <InfoCard
                  etiqueta="Misión"
                  valor={
                    gamificacion.mision
                  }
                  color={
                    colores.verde
                  }
                />

                <InfoCard
                  etiqueta="Próximo objetivo"
                  valor={
                    gamificacion.operacionesMax ===
                    null
                      ? 'Mantener la excelencia'
                      : `Alcanzar ${
                          gamificacion.operacionesMax +
                          1
                        } operaciones`
                  }
                  color={
                    colores.azul
                  }
                />

                <InfoCard
                  etiqueta="Faltan"
                  valor={
                    gamificacion.operacionesMax ===
                    null
                      ? '0 operaciones'
                      : `${gamificacion.faltan} operaciones`
                  }
                  color={
                    colores.acento
                  }
                />
              </div>
            </section>
          )}

        {/* =================================================
            ACCESOS
        ================================================= */}

        <section
          style={{
            background:
              colores.blanco,
            borderRadius: 24,
            padding: 24,
            border:
              '1px solid #e5e7eb',
          }}
        >
          <div
            style={{
              marginBottom:
                16,
            }}
          >
            <p
              style={{
                margin:
                  '0 0 4px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing:
                  1.3,
                color:
                  colores.verde,
              }}
            >
              GESTIÓN
            </p>

            <h2
              style={{
                margin: 0,
                color:
                  colores.azul,
                fontSize: 21,
              }}
            >
              Tus herramientas
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 12,
            }}
          >
            <BotonAcceso
              href="/lanzamientos"
              titulo="Central de Lanzamientos"
              principal
              colorPrincipal={
                colores.verde
              }
            />

            <BotonAcceso
              href="/registros"
              titulo="Registro de Operaciones"
              colorPrincipal={
                colores.azul
              }
            />

            <BotonAcceso
              href="/stock"
              titulo="Saldo de Stock"
              colorPrincipal={
                colores.azul
              }
            />

            <BotonAcceso
              href="/movimientos-stock"
              titulo="Movimientos de Stock"
              colorPrincipal={
                colores.azul
              }
            />

            <BotonAcceso
              href="/libro-diario"
              titulo="Libro Diario"
              destacado
              colorPrincipal={
                colores.verde
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}

// =====================================================
// RESULTADO TEMPORAL DE OBJETIVOS
// =====================================================
//
// Por ahora usamos datos reales únicamente para:
// OPERACIONES REGISTRADAS.
//
// Los demás indicadores quedan en 0 hasta que
// conectemos cada uno con sus fuentes reales.
//
// IMPORTANTE:
// recibimos explícitamente el progreso actual
// calculado dentro de cargar() para evitar problemas
// de estado asincrónico de React.
// =====================================================

function obtenerResultadoObjetivo(
  objetivo: ObjetivoEmpresa,
  gamificacion:
    | ProgresoGamificacion
    | null
): number {
  const indicador =
    objetivo.indicador
      .trim()
      .toUpperCase();

  if (
    indicador ===
      'OPERACIONES REGISTRADAS' &&
    gamificacion
  ) {
    return gamificacion.operaciones;
  }

  return 0;
}

// =====================================================
// CARD DE OBJETIVO
// =====================================================

function ObjetivoCard({
  objetivo,
  colorPrimario,
  colorSecundario,
  colorAcento,
}: {
  objetivo: ObjetivoDashboard;
  colorPrimario: string;
  colorSecundario: string;
  colorAcento: string;
}) {
  const cumplido =
    objetivo.porcentaje >= 100;

  const enCamino =
    objetivo.porcentaje >= 50 &&
    objetivo.porcentaje < 100;

  const colorEstado =
    cumplido
      ? colorSecundario
      : enCamino
        ? '#d97706'
        : '#dc2626';

  const fondoEstado =
    cumplido
      ? `${colorSecundario}12`
      : enCamino
        ? '#fff7ed'
        : '#fef2f2';

  const resultadoTexto =
    objetivo.unidad === 'R$'
      ? `R$ ${objetivo.resultado.toFixed(2)}`
      : `${objetivo.resultado}`;

  const objetivoTexto =
    objetivo.unidad === 'R$'
      ? `R$ ${Number(
          objetivo.objetivo
        ).toFixed(2)}`
      : `${Number(
          objetivo.objetivo
        )}`;

  return (
    <div
      style={{
        background:
          '#fbfcfd',
        border:
          '1px solid #e5e7eb',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems:
            'flex-start',
          gap: 12,
          marginBottom:
            12,
        }}
      >
        <div>
          <div
            style={{
              color:
                colorPrimario,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {formatearIndicador(
              objetivo.indicador
            )}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color:
                COLORES_BASE.gris,
            }}
          >
            {resultadoTexto} /{' '}
            {objetivoTexto}
          </div>
        </div>

        <span
          style={{
            padding:
              '5px 8px',
            borderRadius:
              999,
            background:
              fondoEstado,
            color:
              colorEstado,
            fontSize: 10,
            fontWeight: 800,
            whiteSpace:
              'nowrap',
          }}
        >
          {cumplido
            ? 'CUMPLIDO'
            : enCamino
              ? 'EN CAMINO'
              : 'PENDIENTE'}
        </span>
      </div>

      <div
        style={{
          height: 9,
          borderRadius:
            999,
          background:
            '#e7edf1',
          overflow:
            'hidden',
        }}
      >
        <div
          style={{
            width: `${objetivo.porcentaje}%`,
            height: '100%',
            borderRadius:
              999,
            background:
              colorEstado,
            transition:
              'width 0.4s ease',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          marginTop: 7,
          fontSize: 10,
          color:
            COLORES_BASE.gris,
        }}
      >
        <span>
          {objetivo.porcentaje}%
        </span>

        <span>
          Meta:{' '}
          {objetivoTexto}
        </span>
      </div>
    </div>
  );
}

// =====================================================
// FORMATEAR INDICADOR
// =====================================================

function formatearIndicador(
  indicador: string
): string {
  const mapa: Record<
    string,
    string
  > = {
    'VENTAS DEL MES':
      'Ventas del mes',

    'COMPRAS DEL MES':
      'Compras del mes',

    'OPERACIONES REGISTRADAS':
      'Operaciones registradas',

    'VALOR DEL INVENTARIO':
      'Valor del inventario',

    PUBLICACIONES:
      'Publicaciones',

    HISTORIAS:
      'Historias',

    'NUEVOS SEGUIDORES':
      'Nuevos seguidores',

    MENSAJES:
      'Mensajes',
  };

  return (
    mapa[
      indicador.trim().toUpperCase()
    ] ||
    indicador
  );
}

// =====================================================
// RESUMEN CARD
// =====================================================

function ResumenCard({
  titulo,
  valor,
  color,
}: {
  titulo: string;
  valor: string;
  color: string;
}) {
  return (
    <div
      style={{
        background:
          COLORES_BASE.blanco,
        borderRadius: 20,
        padding: 20,
        border:
          '1px solid #e5e7eb',
        minHeight: 112,
        display: 'flex',
        flexDirection:
          'column',
        justifyContent:
          'space-between',
      }}
    >
      <span
        style={{
          color:
            COLORES_BASE.gris,
          fontSize: 13,
        }}
      >
        {titulo}
      </span>

      <strong
        style={{
          color,
          fontSize: 23,
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

// =====================================================
// INFO CARD
// =====================================================

function InfoCard({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: string;
  color: string;
}) {
  return (
    <div
      style={{
        background:
          '#f8fafc',
        borderRadius: 14,
        padding: 14,
        border:
          '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          color,
          marginBottom:
            5,
        }}
      >
        {etiqueta.toUpperCase()}
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color:
            COLORES_BASE.azul,
          lineHeight: 1.4,
        }}
      >
        {valor}
      </div>
    </div>
  );
}

// =====================================================
// BOTÓN DE ACCESO
// =====================================================

function BotonAcceso({
  href,
  titulo,
  principal = false,
  destacado = false,
  colorPrincipal,
}: {
  href: string;
  titulo: string;
  principal?: boolean;
  destacado?: boolean;
  colorPrincipal: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration:
          'none',

        background:
          principal
            ? colorPrincipal
            : destacado
              ? `${colorPrincipal}18`
              : '#ffffff',

        color:
          principal
            ? '#ffffff'
            : colorPrincipal,

        border:
          principal ||
          destacado
            ? 'none'
            : '1px solid #d1d5db',

        borderRadius: 16,

        padding:
          '17px 18px',

        textAlign:
          'center',

        fontWeight: 700,

        boxShadow:
          principal
            ? `0 8px 20px ${colorPrincipal}33`
            : 'none',
      }}
    >
      {titulo}
    </Link>
  );
}
