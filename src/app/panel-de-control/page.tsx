'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { obtenerProgresoGamificacion } from '@/lib/gamificacion';
import { SalesChart } from '@/components/panel/SalesChart';
import { CategoryChart } from '@/components/panel/CategoryChart';
import { StockChart } from '@/components/panel/StockChart';
import { PieVisao } from '@/components/panel/PieVisao';

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

type PeriodoDisponible = {
  valor: string;
  etiqueta: string;
};

const DATOS_DEMO = {
  activos: 983,
  pasivos: 0,
  capital: 180,
  ingresos: 2288,
  lucro: 933,
  rentabilidad: 41,
  liquidez: 655.52,

  ventasMensuales: [
    { mes: 'Abr', valor: 1890 },
    { mes: 'May', valor: 350 },
    { mes: 'Jun', valor: 1210 },
    { mes: 'Jul', valor: 720 },
    { mes: 'Ago', valor: 1300 },
  ],

  ventasCategorias: [
    { nombre: 'Accesorio', valor: 120 },
    { nombre: 'Perfume', valor: 110 },
    { nombre: 'Prod. belleza', valor: 1670 },
    { nombre: 'Ropa', valor: 340 },
  ],

  stockCategorias: [
    { nombre: 'Prod. belleza', valor: 78.5 },
    { nombre: 'Accesorio', valor: 18.2 },
    { nombre: 'Ropa', valor: 3.0 },
    { nombre: 'Perfume', valor: 0.3 },
  ],
};

export default function MiNegocioPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionDashboard | null>(null);
  const [gamificacion, setGamificacion] = useState<ProgresoGamificacion | null>(null);
  const [objetivos, setObjetivos] = useState<ObjetivoDashboard[]>([]);
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

      const { data, error: errorObjetivos } = await supabase
        .from('objetivos_empresa')
        .select(`
          id,
          periodo,
          indicador,
          objetivo,
          unidad,
          activo
        `)
        .eq('empresa_id', perfil.empresa_id)
        .eq('periodo', periodoSeleccionado)
        .eq('activo', true)
        .order('indicador', { ascending: true });

      if (errorObjetivos) {
        console.warn('No se pudieron cargar los objetivos:', errorObjetivos);
        setObjetivos([]);
        return;
      }

      const objetivosCalculados = ((data ?? []) as ObjetivoEmpresa[]).map((objetivo) => {
        const resultado = obtenerResultadoObjetivo(
          objetivo,
          gamificacion,
          periodoSeleccionado
        );

        const porcentaje =
          objetivo.objetivo > 0
            ? Math.min(
                100,
                Math.max(
                  0,
                  (resultado / Number(objetivo.objetivo)) * 100
                )
              )
            : 0;

        return {
          ...objetivo,
          resultado,
          porcentaje: Number(porcentaje.toFixed(2)),
        };
      });

      setObjetivos(objetivosCalculados);
    }

    cargarObjetivos();
  }, [perfil?.empresa_id, periodoSeleccionado, gamificacion]);

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
            TARJETAS SUPERIORES
        ================================================== */}

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
            color={colores.verde}
          />

          <ResumenCard
            titulo="Caja disponible"
            valor="R$ 0,00"
            color={colores.azul}
          />

          <ResumenCard
            titulo="Gastos del mes"
            valor="R$ 0,00"
            color="#c2410c"
          />

          <ResumenCard
            titulo="Stock bajo"
            valor="0 productos"
            color={colores.acento}
          />
        </div>

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
                  {esTodosLosPeriodos
                    ? 'Vista histórica'
                    : 'Datos de demostración · Próximamente conectados a la información contable real.'}
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
                titulo="Activos"
                valor={`R$ ${formatearNumero(
                  DATOS_DEMO.activos
                )}`}
                emoji="💚"
                color={colores.verde}
              />

              <ResumenEjecutivoCard
                titulo="Pasivos"
                valor={`R$ ${formatearNumero(
                  DATOS_DEMO.pasivos
                )}`}
                emoji="💗"
                color="#b91c1c"
              />

              <ResumenEjecutivoCard
                titulo="Capital"
                valor={`R$ ${formatearNumero(
                  DATOS_DEMO.capital
                )}`}
                emoji="💙"
                color={colores.azul}
              />

              <ResumenEjecutivoCard
                titulo="Ingreso operativo"
                valor={`R$ ${formatearNumero(
                  DATOS_DEMO.ingresos
                )}`}
                emoji="💵"
                color={colores.verde}
              />

              <ResumenEjecutivoCard
                titulo="Lucro"
                valor={`R$ ${formatearNumero(
                  DATOS_DEMO.lucro
                )}`}
                emoji="💰"
                color={colores.azul}
              />

              <ResumenEjecutivoCard
                titulo="Rentabilidad"
                valor={`${DATOS_DEMO.rentabilidad}%`}
                emoji="📈"
                color={colores.verde}
              />

              <ResumenEjecutivoCard
                titulo="Liquidez disponible"
                valor={`R$ ${formatearNumero(
                  DATOS_DEMO.liquidez
                )}`}
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
              }}
            >
              <SalesChart
                datos={DATOS_DEMO.ventasMensuales}
                color={colores.acento}
                colorSecundario={colores.azul}
              />

              <CategoryChart
                datos={DATOS_DEMO.ventasCategorias}
                color={colores.acento}
              />

              <StockChart
                datos={DATOS_DEMO.stockCategorias}
                color={colores.acento}
              />
            </div>
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

              {!objetivos.length ? (
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
                  No hay objetivos configurados para este período.
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
                  {objetivos.map((objetivo) => (
                    <ObjetivoCard
                      key={objetivo.id}
                      objetivo={objetivo}
                      colorPrimario={colores.azul}
                      colorSecundario={colores.verde}
                      colorAcento={colores.acento}
                    />
                  ))}
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

function obtenerResultadoObjetivo(
  objetivo: ObjetivoEmpresa,
  gamificacion: ProgresoGamificacion | null,
  periodo: string
): number {
  const indicador = objetivo.indicador.trim().toUpperCase();

  if (
    indicador === 'OPERACIONES REGISTRADAS' &&
    gamificacion &&
    periodo !== 'TODOS'
  ) {
    return gamificacion.operaciones;
  }

  return 0;
}

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
  const cumplido = objetivo.porcentaje >= 100;
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

  const resultadoTexto =
    objetivo.unidad === 'R$'
      ? `R$ ${objetivo.resultado.toFixed(2)}`
      : `${objetivo.resultado}`;

  const objetivoTexto =
    objetivo.unidad === 'R$'
      ? `R$ ${Number(objetivo.objetivo).toFixed(2)}`
      : `${Number(objetivo.objetivo)}`;

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
            }}
          >
            {formatearIndicador(objetivo.indicador)}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: COLORES_BASE.gris,
            }}
          >
            {resultadoTexto} / {objetivoTexto}
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
          marginTop: 7,
          fontSize: 10,
          color: COLORES_BASE.gris,
        }}
      >
        <span>{objetivo.porcentaje}%</span>
        <span>Meta: {objetivoTexto}</span>
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

function formatearIndicador(indicador: string): string {
  const mapa: Record<string, string> = {
    'VENTAS DEL MES': 'Ventas del mes',
    'COMPRAS DEL MES': 'Compras del mes',
    'OPERACIONES REGISTRADAS':
      'Operaciones registradas',
    'VALOR DEL INVENTARIO': 'Valor del inventario',
    PUBLICACIONES: 'Publicaciones',
    HISTORIAS: 'Historias',
    'NUEVOS SEGUIDORES': 'Nuevos seguidores',
    MENSAJES: 'Mensajes',
  };

  return (
    mapa[indicador.trim().toUpperCase()] ||
    indicador
  );
}
