'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { obtenerProgresoGamificacion } from '@/lib/gamificacion';
import { LucroChart } from '@/components/panel/LucroChart';
import { CategoryChart } from '@/components/panel/CategoryChart';
import { StockChart } from '@/components/panel/StockChart';
import { PieVisao } from '@/components/panel/PieVisao';
import { obtenerIndicadores, type IndicadoresPanel } from '@/lib/contabilidad';
import { obtenerDefiniciones, calcularObjetivos, CATALOGO_INDICADORES, type ObjetivoCalculado, type CategoriaObjetivo } from '@/lib/objetivos';

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
  es_admin_plataforma: boolean;
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

const CATEGORIAS_ORDEN: { categoria: CategoriaObjetivo; titulo: string; emoji: string }[] = [
  { categoria: 'CONTABLE', titulo: 'Contables', emoji: '📒' },
  { categoria: 'MERCADERIA', titulo: 'Mercadería', emoji: '📦' },
  { categoria: 'FINANCIERO', titulo: 'Financieros', emoji: '💹' },
  { categoria: 'MARKETING', titulo: 'Marketing', emoji: '📣' },
];

type PeriodoDisponible = {
  valor: string;
  etiqueta: string;
};

export default function MiNegocioPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionDashboard | null>(null);
  const [gamificacion, setGamificacion] = useState<ProgresoGamificacion | null>(null);
  const [objetivos, setObjetivos] = useState<ObjetivoCalculado[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresPanel | null>(null);
  const [periodos, setPeriodos] = useState<PeriodoDisponible[]>([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const periodoActual = useMemo(() => {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  useEffect(() => {
    async function cargarBase() {
      setError('');

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfilData, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('nombre, empresa_id, rol, es_admin_plataforma')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfilData?.empresa_id) {
        setError('No se pudo identificar la empresa del usuario.');
        setCargando(false);
        return;
      }

      setPerfil(perfilData);

      const { data: empresaData, error: errorEmpresa } = await supabase
        .from('empresas')
        .select('nombre, rubro, logo_url')
        .eq('id', perfilData.empresa_id)
        .maybeSingle();

      if (errorEmpresa) {
        setError(`No se pudo cargar la empresa: ${errorEmpresa.message}`);
        setCargando(false);
        return;
      }

      setEmpresa(empresaData);

      const { data: configData, error: errorConfig } = await supabase
        .from('configuracion_dashboard')
        .select(`
          color_primario,
          color_secundario,
          color_acento,
          mensaje_bienvenida,
          subtitulo_dashboard,
          mostrar_gamificacion,
          mostrar_objetivos,
          mostrar_graficos
        `)
        .eq('empresa_id', perfilData.empresa_id)
        .maybeSingle();

      if (errorConfig) {
        console.warn('No se pudo cargar configuracion_dashboard:', errorConfig);
      }

      const configFinal =
        configData ?? {
          color_primario: COLORES_BASE.azul,
          color_secundario: COLORES_BASE.verde,
          color_acento: COLORES_BASE.gris,
          mensaje_bienvenida: null,
          subtitulo_dashboard: null,
          mostrar_gamificacion: true,
          mostrar_objetivos: true,
          mostrar_graficos: true,
        };

      setConfiguracion(configFinal);

      try {
        const progreso = await obtenerProgresoGamificacion(perfilData.empresa_id);
        setGamificacion(progreso);
      } catch (errorGamificacion) {
        console.warn('No se pudo calcular la gamificación:', errorGamificacion);
        setGamificacion(null);
      }

      const { data: registrosFechas, error: errorFechas } = await supabase
        .from('registro_operaciones')
        .select('fecha')
        .eq('empresa_id', perfilData.empresa_id)
        .order('fecha', { ascending: false });

      if (errorFechas) {
        console.warn('No se pudieron cargar las fechas:', errorFechas);
      }

      const periodosUnicos = new Set<string>();
      periodosUnicos.add(periodoActual);

      for (const fila of registrosFechas ?? []) {
        if (!fila.fecha) {
          continue;
        }

        const fecha = String(fila.fecha);
        periodosUnicos.add(`${fecha.slice(0, 7)}-01`);
      }

      const listaPeriodos = Array.from(periodosUnicos)
        .sort((a, b) => b.localeCompare(a))
        .map((valor) => ({
          valor,
          etiqueta: formatearPeriodo(valor),
        }));

      setPeriodos(listaPeriodos);
      setPeriodoSeleccionado(periodoActual);
      setCargando(false);
    }

    cargarBase();
  }, [router, periodoActual]);

  useEffect(() => {
    async function cargarObjetivos() {
      if (!perfil?.empresa_id || !periodoSeleccionado) {
        return;
      }

      try {
        const definiciones = await obtenerDefiniciones(perfil.empresa_id);
        const calculados = await calcularObjetivos(perfil.empresa_id, periodoSeleccionado, definiciones);
        setObjetivos(calculados);
      } catch (errorObjetivos) {
        console.warn('No se pudieron cargar los objetivos:', errorObjetivos);
        setObjetivos([]);
      }
    }

    cargarObjetivos();
  }, [perfil?.empresa_id, periodoSeleccionado]);

  // Indicadores reales: se recalculan cada vez que cambia el período.
  useEffect(() => {
    async function cargarIndicadores() {
      if (!perfil?.empresa_id || !periodoSeleccionado) {
        return;
      }

      try {
        const datos = await obtenerIndicadores(perfil.empresa_id, periodoSeleccionado);
        setIndicadores(datos);
      } catch (errorIndicadores) {
        console.warn('No se pudieron calcular los indicadores:', errorIndicadores);
        setIndicadores(null);
      }
    }

    cargarIndicadores();
  }, [perfil?.empresa_id, periodoSeleccionado]);

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

  const colores = {
    azul: configuracion?.color_primario ?? COLORES_BASE.azul,
    verde: configuracion?.color_secundario ?? COLORES_BASE.verde,
    acento: configuracion?.color_acento ?? COLORES_BASE.gris,
    blanco: COLORES_BASE.blanco,
  };

  const esTodosLosPeriodos = periodoSeleccionado === 'TODOS';

  const periodoTexto = esTodosLosPeriodos
    ? 'Todos los períodos'
    : formatearPeriodo(periodoSeleccionado);

  const logoDisponible = Boolean(empresa?.logo_url?.trim());

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #edf4f1 0%, transparent 34%), #f5f7f9',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* =================================================
            CABECERA
        ================================================== */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 78,
                height: 78,
                borderRadius: 20,
                background: colores.blanco,
                border: `2px solid ${colores.acento}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 8px 20px rgba(31,58,95,0.10)',
                flexShrink: 0,
              }}
            >
              {logoDisponible ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={empresa!.logo_url!}
                  alt={`Logo de ${empresa?.nombre ?? 'empresa'}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    padding: 6,
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: colores.azul,
                  }}
                >
                  {(empresa?.nombre ?? 'M').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: colores.azul,
                }}
              >
                {empresa?.nombre ?? 'Mi Negocio'}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: COLORES_BASE.gris,
                  marginTop: 3,
                }}
              >
                {empresa?.rubro ?? 'Gestión financiera'}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Link
              href="/"
              style={{
                background: colores.blanco,
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: '11px 16px',
                color: colores.azul,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              ← Inicio
            </Link>

            {perfil?.es_admin_plataforma && (
              <Link
                href="/panel-maestro"
                style={{
                  background: colores.azul,
                  border: 'none',
                  borderRadius: 12,
                  padding: '11px 16px',
                  cursor: 'pointer',
                  color: '#ffffff',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                🔱 Volver a mi Panel
              </Link>
            )}

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/login');
              }}
              style={{
                background: colores.blanco,
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: '11px 16px',
                cursor: 'pointer',
                color: colores.azul,
                fontWeight: 700,
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* =================================================
            AVISO DE CONSISTENCIA CONTABLE
            Activo debe ser igual a Pasivo + Patrimonio + Resultado.
            Si no cierra, casi siempre son los saldos iniciales del
            plan de cuentas los que están descuadrados.
        ================================================== */}

        {indicadores && Math.abs(indicadores.descuadre) >= 0.01 && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              borderRadius: 16,
              padding: '13px 18px',
              marginBottom: 20,
              fontSize: 13,
            }}
          >
            <strong>⚠️ La ecuación contable no cierra por R${' '}
            {formatearNumero(Math.abs(indicadores.descuadre))}.</strong>{' '}
            Activo ({formatearNumero(indicadores.activos)}) no coincide con
            Pasivo + Patrimonio + Resultado. Revisá los saldos iniciales del
            plan de cuentas.
          </div>
        )}

        {/* =================================================
            SITUACIÓN A LA FECHA
            Estas tarjetas NO dependen del selector de período:
            son saldos acumulados, o ventanas fijas (hoy / mes en curso).
            Por eso van ARRIBA del selector.
        ================================================== */}

        <section
          style={{
            background: colores.blanco,
            borderRadius: 24,
            padding: 24,
            marginBottom: 20,
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 28px rgba(31,58,95,0.06)',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                marginBottom: 5,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.3,
                color: colores.verde,
              }}
            >
              SITUACIÓN ACTUAL
            </div>

            <h2 style={{ margin: 0, color: colores.azul, fontSize: 23 }}>
              Tu negocio hoy
            </h2>

            <p
              style={{
                margin: '5px 0 0',
                fontSize: 12,
                color: COLORES_BASE.gris,
              }}
            >
              Saldos acumulados a la fecha. No cambian con el período que elijas
              más abajo.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <ResumenEjecutivoCard
              titulo="Activo"
              valor={`R$ ${formatearNumero(indicadores?.activos ?? 0)}`}
              emoji="💚"
              color={colores.verde}
            />

            <ResumenEjecutivoCard
              titulo="Pasivo"
              valor={`R$ ${formatearNumero(indicadores?.pasivos ?? 0)}`}
              emoji="💗"
              color="#b91c1c"
            />

            <ResumenEjecutivoCard
              titulo="Capital"
              valor={`R$ ${formatearNumero(indicadores?.patrimonio ?? 0)}`}
              emoji="💙"
              color={colores.azul}
            />

            <ResumenEjecutivoCard
              titulo="Saldo en caja"
              valor={`R$ ${formatearNumero(indicadores?.cajaDisponible ?? 0)}`}
              emoji="💵"
              color={colores.azul}
            />

            <ResumenEjecutivoCard
              titulo="Stock bajo"
              valor={`${indicadores?.stockBajo ?? 0} productos`}
              emoji="📦"
              color={colores.acento}
            />
          </div>
        </section>

        {/* =================================================
            SELECTOR GLOBAL
        ================================================== */}

        <section
          style={{
            background: colores.blanco,
            borderRadius: 18,
            padding: '15px 18px',
            marginBottom: 20,
            border: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.3,
                color: colores.verde,
                marginBottom: 4,
              }}
            >
              PERÍODO DE ANÁLISIS
            </div>

            <div
              style={{
                fontSize: 13,
                color: COLORES_BASE.gris,
              }}
            >
              El dashboard utiliza este período para sus objetivos e indicadores.
            </div>
          </div>

          <select
            value={periodoSeleccionado}
            onChange={(e) => setPeriodoSeleccionado(e.target.value)}
            style={{
              minWidth: 210,
              padding: '11px 14px',
              borderRadius: 12,
              border: `1px solid ${colores.acento}`,
              background: '#fbfcfd',
              color: colores.azul,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {periodos.map((periodo) => (
              <option key={periodo.valor} value={periodo.valor}>
                {periodo.etiqueta}
              </option>
            ))}

            <option value="TODOS">Todos los períodos</option>
          </select>
        </section>

        {/* =================================================
            RESUMEN EJECUTIVO
        ================================================== */}

        {configuracion?.mostrar_graficos && (
          <section
            style={{
              background: colores.blanco,
              borderRadius: 24,
              padding: 24,
              marginBottom: 20,
              border: '1px solid #e5e7eb',
              boxShadow:
                '0 10px 28px rgba(31,58,95,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 20,
              }}
            >
              <div>
                <div
                  style={{
                    marginBottom: 5,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.3,
                    color: colores.verde,
                  }}
                >
                  INFORMACIÓN EJECUTIVA
                </div>

                <h2
                  style={{
                    margin: 0,
                    color: colores.azul,
                    fontSize: 23,
                  }}
                >
                  Resumen Ejecutivo
                </h2>

                <p
                  style={{
                    margin: '5px 0 0',
                    fontSize: 12,
                    color: COLORES_BASE.gris,
                  }}
                >
                  Resultados del período seleccionado. La situación patrimonial
                  acumulada está más arriba.
                </p>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 999,
                  background: `${colores.azul}10`,
                  color: colores.azul,
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: 'capitalize',
                }}
              >
                {periodoTexto}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 12,
                marginBottom: 18,
              }}
            >
              <ResumenEjecutivoCard
                titulo="Ingreso operativo"
                valor={`R$ ${formatearNumero(indicadores?.ingresos ?? 0)}`}
                emoji="💵"
                color={colores.verde}
              />

              <ResumenEjecutivoCard
                titulo="Costo de mercadería vendida"
                valor={`R$ ${formatearNumero(indicadores?.cmv ?? 0)}`}
                emoji="🏷️"
                color="#b45309"
              />

              <ResumenEjecutivoCard
                titulo="Gastos"
                valor={`R$ ${formatearNumero(indicadores?.gastos ?? 0)}`}
                emoji="🧾"
                color="#c2410c"
              />

              <ResumenEjecutivoCard
                titulo="Lucro"
                valor={`R$ ${formatearNumero(indicadores?.lucro ?? 0)}`}
                emoji="💰"
                color={colores.azul}
              />

              <ResumenEjecutivoCard
                titulo="Rentabilidad"
                valor={`${formatearNumero(indicadores?.rentabilidad ?? 0)}%`}
                emoji="📈"
                color={colores.verde}
              />

              <ResumenEjecutivoCard
                titulo="Liquidez corriente"
                valor={`${formatearNumero(indicadores?.liquidez ?? 0)}`}
                emoji="💧"
                color="#ca8a04"
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(310px, 1fr))',
                gap: 16,
                marginBottom: 16,
              }}
            >
              <CategoryChart
                datos={indicadores?.ventasCategorias ?? []}
                color={colores.acento}
              />

              <StockChart
                datos={indicadores?.stockCategorias ?? []}
                color={colores.acento}
              />
            </div>

            <LucroChart datos={indicadores?.evolucionLucro ?? []} />
          </section>
        )}

        {/* =================================================
            OBJETIVOS
        ================================================== */}

        {configuracion?.mostrar_objetivos &&
          !esTodosLosPeriodos && (
            <section
              style={{
                background: colores.blanco,
                borderRadius: 24,
                padding: 24,
                marginBottom: 20,
                border: '1px solid #e5e7eb',
                boxShadow:
                  '0 10px 28px rgba(31,58,95,0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  marginBottom: 18,
                }}
              >
                <div>
                  <div
                    style={{
                      marginBottom: 5,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1.3,
                      color: colores.verde,
                    }}
                  >
                    GESTIÓN
                  </div>

                  <h2
                    style={{
                      margin: 0,
                      color: colores.azul,
                      fontSize: 22,
                    }}
                  >
                    Objetivos del mes
                  </h2>

                  <p
                    style={{
                      margin: '5px 0 0',
                      fontSize: 12,
                      color: COLORES_BASE.gris,
                      textTransform: 'capitalize',
                    }}
                  >
                    {periodoTexto}
                  </p>
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: `${colores.verde}14`,
                    color: colores.verde,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Objetivos acordados
                </div>
              </div>

              {CATEGORIAS_ORDEN.map(({ categoria, titulo, emoji }) => {
                const deLaCategoria = objetivos.filter((o) => o.categoria === categoria);

                if (categoria === 'MARKETING' && deLaCategoria.length === 0) {
                  return (
                    <div key={categoria} style={{ marginBottom: 22 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: colores.azul, marginBottom: 10 }}>
                        {emoji} {titulo}
                      </div>

                      <div
                        style={{
                          padding: 20,
                          border: '1px dashed #d6dee5',
                          borderRadius: 14,
                          textAlign: 'center',
                          color: COLORES_BASE.gris,
                          fontSize: 13,
                        }}
                      >
                        🔒 Próximamente — objetivos conectados a Instagram/WhatsApp.
                      </div>
                    </div>
                  );
                }

                if (deLaCategoria.length === 0) {
                  return null;
                }

                return (
                  <div key={categoria} style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: colores.azul, marginBottom: 10 }}>
                      {emoji} {titulo}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: 14,
                      }}
                    >
                      {deLaCategoria.map((objetivo) => (
                        <ObjetivoCard
                          key={objetivo.id}
                          objetivo={objetivo}
                          colorPrimario={colores.azul}
                          colorSecundario={colores.verde}
                          colorAcento={colores.acento}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {!objetivos.length && (
                <div
                  style={{
                    padding: 24,
                    border: '1px dashed #d6dee5',
                    borderRadius: 14,
                    textAlign: 'center',
                    color: COLORES_BASE.gris,
                    fontSize: 13,
                  }}
                >
                  No hay objetivos configurados todavía.
                </div>
              )}
            </section>
          )}

        {/* =================================================
            TODOS LOS PERIODOS
        ================================================== */}

        {esTodosLosPeriodos && (
          <section
            style={{
              background: `${colores.azul}08`,
              border: `1px solid ${colores.azul}22`,
              borderRadius: 18,
              padding: 18,
              marginBottom: 20,
              color: colores.azul,
              fontSize: 13,
            }}
          >
            <strong>📊 Vista histórica</strong>

            <div
              style={{
                marginTop: 5,
                color: COLORES_BASE.gris,
              }}
            >
              En esta vista se analizan todos los períodos. Los objetivos
              mensuales se muestran únicamente cuando seleccionás un período
              específico.
            </div>
          </section>
        )}

        {/* =================================================
            NOTA
            El saludo, Sabio y el nivel del emprendedor ya no viven acá:
            ahora están en el Lobby, que es la pantalla de entrada.
            Ver: src/app/page.tsx
        ================================================== */}

        {/* =================================================
            PIE — Marca Visão Financeira
        ================================================== */}

        <PieVisao colores={colores} />
      </div>
    </main>
  );
}

// Tooltip propio (no el "title" nativo del navegador): así se puede
// separar del cursor y agrandar el ícono, cosas que un title nativo
// no permite controlar.
function IconoAyuda({ texto, color }: { texto: string; color: string }) {
  const [mostrar, setMostrar] = useState(false);

  if (!texto) return null;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setMostrar(true)}
      onMouseLeave={() => setMostrar(false)}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: color,
          color: '#ffffff',
          fontSize: 14,
          fontWeight: 900,
          fontStyle: 'italic',
          cursor: 'help',
          flexShrink: 0,
        }}
      >
        i
      </span>

      {mostrar && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 14px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 240,
            background: '#1f2937',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.5,
            padding: '10px 12px',
            borderRadius: 10,
            boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
            zIndex: 20,
            textAlign: 'left',
          }}
        >
          {texto}

          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderBottom: '7px solid #1f2937',
            }}
          />
        </div>
      )}
    </span>
  );
}

function ObjetivoCard({
  objetivo,
  colorPrimario,
  colorSecundario,
  colorAcento,
}: {
  objetivo: ObjetivoCalculado;
  colorPrimario: string;
  colorSecundario: string;
  colorAcento: string;
}) {
  if (!objetivo.aplica) {
    return (
      <div
        style={{
          background: '#fbfcfd',
          border: '1px dashed #d6dee5',
          borderRadius: 16,
          padding: 16,
          color: COLORES_BASE.gris,
          fontSize: 12,
        }}
      >
        <strong style={{ color: colorPrimario, fontSize: 13 }}>{objetivo.nombre}</strong>
        <div style={{ marginTop: 6 }}>No aplica para "Todos los períodos" — elegí un mes.</div>
      </div>
    );
  }

  const cumplido = objetivo.cumplido;
  const enCamino =
    objetivo.porcentaje >= 50 &&
    objetivo.porcentaje < 100;

  const colorEstado = cumplido
    ? colorSecundario
    : enCamino
      ? '#d97706'
      : '#dc2626';

  const fondoEstado = cumplido
    ? `${colorSecundario}12`
    : enCamino
      ? '#fff7ed'
      : '#fef2f2';

  const formatearValor = (valor: number) =>
    objetivo.unidad === 'R$'
      ? `R$ ${valor.toFixed(2)}`
      : objetivo.unidad === 'veces'
        ? `${valor.toFixed(2)}x`
        : objetivo.unidad === '%'
          ? `${valor.toFixed(1)}%`
          : `${valor}`;

  const info = CATALOGO_INDICADORES[objetivo.indicador];
  const etiquetaMeta = info?.inverso ? 'Tope' : 'Meta';

  const resultadoTexto = formatearValor(objetivo.resultado);
  // Productos Estancados usa un umbral fijo de días, no un valor en
  // R$ — mostrar el tope como "90 días" es lo que tiene sentido acá,
  // aunque por dentro se calcule contra un monto.
  const objetivoTexto = objetivo.indicador === 'STOCK_ESTANCADO' ? '90 días' : formatearValor(objetivo.metaResuelta);

  return (
    <div
      style={{
        background: '#fbfcfd',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              color: colorPrimario,
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {objetivo.nombre}

            <IconoAyuda texto={CATALOGO_INDICADORES[objetivo.indicador]?.ayuda ?? ''} color={colorPrimario} />
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: COLORES_BASE.gris,
            }}
          >
            Ahora: {resultadoTexto}
          </div>
        </div>

        <span
          style={{
            padding: '5px 8px',
            borderRadius: 999,
            background: fondoEstado,
            color: colorEstado,
            fontSize: 10,
            fontWeight: 800,
            whiteSpace: 'nowrap',
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
          borderRadius: 999,
          background: '#e7edf1',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${objetivo.porcentaje}%`,
            height: '100%',
            borderRadius: 999,
            background: colorEstado,
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 9,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: colorEstado }}>{objetivo.porcentaje}%</span>

        <span style={{ fontSize: 13, fontWeight: 800, color: colorPrimario }}>
          {etiquetaMeta}: {objetivoTexto}
        </span>
      </div>
    </div>
  );
}

function ResumenEjecutivoCard({
  titulo,
  valor,
  emoji,
  color,
}: {
  titulo: string;
  valor: string;
  emoji: string;
  color: string;
}) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: 15,
        background: '#fbfcfd',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: COLORES_BASE.gris,
          marginBottom: 8,
        }}
      >
        {emoji} {titulo}
      </div>

      <strong
        style={{
          color,
          fontSize: 21,
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

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
        background: '#f8fafc',
        borderRadius: 14,
        padding: 14,
        border: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          color,
          marginBottom: 5,
        }}
      >
        {etiqueta.toUpperCase()}
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: COLORES_BASE.azul,
          lineHeight: 1.4,
        }}
      >
        {valor}
      </div>
    </div>
  );
}

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
        background: COLORES_BASE.blanco,
        borderRadius: 20,
        padding: 20,
        border: '1px solid #e5e7eb',
        minHeight: 112,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <span
        style={{
          color: COLORES_BASE.gris,
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

function formatearNumero(valor: number): string {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatearPeriodo(valor: string): string {
  const partes = valor.split('-');

  if (partes.length < 2) {
    return valor;
  }

  const year = Number(partes[0]);
  const month = Number(partes[1]);

  if (!year || !month) {
    return valor;
  }

  return new Date(year, month - 1, 1).toLocaleDateString(
    'es-AR',
    {
      month: 'long',
      year: 'numeric',
    }
  );
}
