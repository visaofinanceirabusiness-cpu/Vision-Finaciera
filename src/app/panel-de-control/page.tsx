'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { obtenerProgresoGamificacion } from '@/lib/gamificacion';
import { LucroChart } from '@/components/panel/LucroChart';
import { CategoryChart } from '@/components/panel/CategoryChart';
import { DistribucionPieChart } from '@/components/panel/DistribucionPieChart';
import { EvolucionFamiliarChart } from '@/components/panel/EvolucionFamiliarChart';
import { StockChart } from '@/components/panel/StockChart';
import { PieVisao } from '@/components/panel/PieVisao';
import { obtenerIndicadores, type IndicadoresPanel } from '@/lib/contabilidad';
import { obtenerDefiniciones, calcularObjetivos, CATALOGO_INDICADORES, ayudaIndicador, type ObjetivoCalculado, type CategoriaObjetivo } from '@/lib/objetivos';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { crearTraductor } from '@/lib/i18n';
import { empresaTieneOnboardingCompleto } from '@/lib/onboarding';
import { SabioWidget } from '@/components/panel/SabioWidget';
import {
  diccionarioPanelControl,
  type ClavePanelControl,
  msgEcuacionNoCierra,
  msgSaludEndeudamiento,
  msgFondoRespaldoProgreso,
  msgNivelBanner,
  msgFaltanParaSubirNivel,
  msgBienvenidaTutorialPanel,
  msgCerrarTutorialPanel,
} from './i18n';

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
  moneda: string | null;
  idioma: string;
};

function categoriasOrden(t: (clave: ClavePanelControl) => string): { categoria: CategoriaObjetivo; titulo: string; emoji: string }[] {
  return [
    { categoria: 'ACTIVIDAD', titulo: t('categoriaPrimerosPasos'), emoji: '🚀' },
    { categoria: 'METAS', titulo: t('categoriaMetasFamiliares'), emoji: '✈️' },
    { categoria: 'CONTABLE', titulo: t('categoriaContables'), emoji: '📒' },
    { categoria: 'MERCADERIA', titulo: t('categoriaMercaderia'), emoji: '📦' },
    { categoria: 'FINANCIERO', titulo: t('categoriaFinancieros'), emoji: '💹' },
    { categoria: 'MARKETING', titulo: t('categoriaMarketing'), emoji: '📣' },
  ];
}

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

type PeriodoDisponible = {
  valor: string;
  etiqueta: string;
};

export default function MiNegocioPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [esFamiliar, setEsFamiliar] = useState(false);
  const [configuracion, setConfiguracion] = useState<ConfiguracionDashboard | null>(null);
  const [gamificacion, setGamificacion] = useState<ProgresoGamificacion | null>(null);
  const [objetivos, setObjetivos] = useState<ObjetivoCalculado[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresPanel | null>(null);
  const [periodos, setPeriodos] = useState<PeriodoDisponible[]>([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarBienvenidaTutorial, setMostrarBienvenidaTutorial] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setMostrarBienvenidaTutorial(new URLSearchParams(window.location.search).get('tutorial') === '1');
  }, []);

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

      if (!(await empresaTieneOnboardingCompleto(perfilData.empresa_id))) {
        router.push('/bienvenida');
        return;
      }

      setPerfil(perfilData);

      const { data: empresaData, error: errorEmpresa } = await supabase
        .from('empresas')
        .select('nombre, rubro, logo_url, moneda, idioma, perfil_empresa_id, perfiles_empresa(codigo)')
        .eq('id', perfilData.empresa_id)
        .maybeSingle();

      if (errorEmpresa) {
        setError(`No se pudo cargar la empresa: ${errorEmpresa.message}`);
        setCargando(false);
        return;
      }

      setEmpresa(empresaData);

      const perfilCodigo = (empresaData as unknown as { perfiles_empresa?: { codigo: string } | null } | null)
        ?.perfiles_empresa?.codigo;

      setEsFamiliar(perfilCodigo === 'FAMILIAR');

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
          etiqueta: formatearPeriodo(valor, empresaData?.idioma),
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

  const idioma = empresa?.idioma ?? 'ES';
  const t = crearTraductor(diccionarioPanelControl, idioma);

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
        {t('cargando')}
      </div>
    );
  }

  const colores = {
    azul: configuracion?.color_primario ?? COLORES_BASE.azul,
    verde: configuracion?.color_secundario ?? COLORES_BASE.verde,
    acento: configuracion?.color_acento ?? COLORES_BASE.gris,
    blanco: COLORES_BASE.blanco,
  };

  const simbolo = simboloMoneda(empresa?.moneda);

  const esTodosLosPeriodos = periodoSeleccionado === 'TODOS';

  const periodoTexto = esTodosLosPeriodos
    ? t('todosLosPeriodos')
    : formatearPeriodo(periodoSeleccionado, idioma);

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
            ENCABEZADO — mismo estilo que el resto de las
            herramientas (Contabilidad, Mercadería, Informes...).
        ================================================== */}

        <header style={encabezadoEstandar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/?vista=empresa" style={volverEstandar}>
              {t('volver')}
            </Link>

            <AccesosHerramientas />
          </div>

          <div style={eyebrowEstandar}>{t('eyebrowGestionFinanciera')}</div>

          <h1 style={{ margin: 0, fontSize: 32 }}>{t('titulo')}</h1>

          <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
            {t('subtituloConEmpresa')} {empresa?.nombre ?? t('tuNegocioDefault')}.
          </p>
        </header>

        {/* =================================================
            BIENVENIDA AL TERMINAR EL TUTORIAL GUIADO
            Llega con ?tutorial=1 desde la Central de Lançamentos, al
            completar las 3 operaciones. No bloquea nada — es solo una
            orientación breve, se cierra y no vuelve a aparecer.
        ================================================== */}

        {mostrarBienvenidaTutorial && (
          <div
            style={{
              background: `linear-gradient(125deg, ${colores.azul} 0%, ${colores.azul} 58%, ${colores.verde} 100%)`,
              borderRadius: 24,
              padding: '24px 28px',
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
              boxShadow: '0 18px 40px rgba(20,42,71,0.16)',
            }}
          >
            <button
              type="button"
              onClick={() => setMostrarBienvenidaTutorial(false)}
              style={{
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 999,
                color: colores.blanco,
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              {msgCerrarTutorialPanel(idioma)}
            </button>

            <SabioWidget
              colores={{ azul: colores.azul, verde: colores.verde, blanco: colores.blanco }}
              idioma={idioma}
              frase={msgBienvenidaTutorialPanel(idioma)}
              onClickFrase={() => setMostrarBienvenidaTutorial(false)}
            />
          </div>
        )}

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
            {msgEcuacionNoCierra(
              idioma,
              simbolo,
              formatearNumero(Math.abs(indicadores.descuadre)),
              formatearNumero(indicadores.activos)
            )}
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
              {t('eyebrowSituacionActual')}
            </div>

            <h2 style={{ margin: 0, color: colores.azul, fontSize: 23 }}>
              {esFamiliar ? t('tuFamiliaHoy') : t('tuNegocioHoy')}
            </h2>

            <p
              style={{
                margin: '5px 0 0',
                fontSize: 12,
                color: COLORES_BASE.gris,
              }}
            >
              {t('ayudaSituacionActual')}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {esFamiliar ? (
              <>
                <ResumenEjecutivoCard
                  titulo={t('dineroDisponible')}
                  valor={`${simbolo} ${formatearNumero(indicadores?.cajaDisponible ?? 0)}`}
                  emoji="💵"
                  color={colores.verde}
                />

                <ResumenEjecutivoCard
                  titulo={t('deudaTotal')}
                  valor={`${simbolo} ${formatearNumero(indicadores?.pasivos ?? 0)}`}
                  emoji="💗"
                  color="#b91c1c"
                />

                <ResumenEjecutivoCard
                  titulo={t('patrimonioNeto')}
                  valor={`${simbolo} ${formatearNumero(indicadores?.patrimonio ?? 0)}`}
                  emoji="💙"
                  color={colores.azul}
                />
              </>
            ) : (
              <>
                <ResumenEjecutivoCard
                  titulo={t('activo')}
                  valor={`${simbolo} ${formatearNumero(indicadores?.activos ?? 0)}`}
                  emoji="💚"
                  color={colores.verde}
                />

                <ResumenEjecutivoCard
                  titulo={t('pasivo')}
                  valor={`${simbolo} ${formatearNumero(indicadores?.pasivos ?? 0)}`}
                  emoji="💗"
                  color="#b91c1c"
                />

                <ResumenEjecutivoCard
                  titulo={t('capital')}
                  valor={`${simbolo} ${formatearNumero(indicadores?.patrimonio ?? 0)}`}
                  emoji="💙"
                  color={colores.azul}
                />

                <ResumenEjecutivoCard
                  titulo={t('saldoEnCaja')}
                  valor={`${simbolo} ${formatearNumero(indicadores?.cajaDisponible ?? 0)}`}
                  emoji="💵"
                  color={colores.azul}
                />

                <ResumenEjecutivoCard
                  titulo={t('stockBajo')}
                  valor={`${indicadores?.stockBajo ?? 0} ${t('productos')}`}
                  emoji="📦"
                  color={colores.acento}
                />
              </>
            )}
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
              {t('eyebrowPeriodo')}
            </div>

            <div
              style={{
                fontSize: 13,
                color: COLORES_BASE.gris,
              }}
            >
              {t('ayudaPeriodo')}
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

            <option value="TODOS">{t('todosLosPeriodos')}</option>
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
                  {t('eyebrowInformacionEjecutiva')}
                </div>

                <h2
                  style={{
                    margin: 0,
                    color: colores.azul,
                    fontSize: 23,
                  }}
                >
                  {t('resumenEjecutivo')}
                </h2>

                <p
                  style={{
                    margin: '5px 0 0',
                    fontSize: 12,
                    color: COLORES_BASE.gris,
                  }}
                >
                  {t('ayudaResumenEjecutivo')}
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
              {esFamiliar ? (
                <>
                  <ResumenEjecutivoCard
                    titulo={t('ingresosDelPeriodo')}
                    valor={`${simbolo} ${formatearNumero(indicadores?.ingresos ?? 0)}`}
                    emoji="💵"
                    color={colores.verde}
                  />

                  <ResumenEjecutivoCard
                    titulo={t('gastosDelPeriodo')}
                    valor={`${simbolo} ${formatearNumero(indicadores?.gastos ?? 0)}`}
                    emoji="🧾"
                    color="#c2410c"
                  />

                  <ResumenEjecutivoCard
                    titulo={t('ahorroDelPeriodo')}
                    valor={`${simbolo} ${formatearNumero(indicadores?.lucro ?? 0)}`}
                    emoji="🐷"
                    color={colores.azul}
                  />

                  <ResumenEjecutivoCard
                    titulo={t('tasaDeAhorro')}
                    valor={`${formatearNumero(indicadores?.rentabilidad ?? 0)}%`}
                    emoji="📈"
                    color={colores.verde}
                  />
                </>
              ) : (
                <>
                  <ResumenEjecutivoCard
                    titulo={t('ingresoOperativo')}
                    valor={`${simbolo} ${formatearNumero(indicadores?.ingresos ?? 0)}`}
                    emoji="💵"
                    color={colores.verde}
                  />

                  <ResumenEjecutivoCard
                    titulo={t('cmv')}
                    valor={`${simbolo} ${formatearNumero(indicadores?.cmv ?? 0)}`}
                    emoji="🏷️"
                    color="#b45309"
                  />

                  <ResumenEjecutivoCard
                    titulo={t('gastos')}
                    valor={`${simbolo} ${formatearNumero(indicadores?.gastos ?? 0)}`}
                    emoji="🧾"
                    color="#c2410c"
                  />

                  <ResumenEjecutivoCard
                    titulo={t('lucro')}
                    valor={`${simbolo} ${formatearNumero(indicadores?.lucro ?? 0)}`}
                    emoji="💰"
                    color={colores.azul}
                  />

                  <ResumenEjecutivoCard
                    titulo={t('rentabilidad')}
                    valor={`${formatearNumero(indicadores?.rentabilidad ?? 0)}%`}
                    emoji="📈"
                    color={colores.verde}
                  />

                  <ResumenEjecutivoCard
                    titulo={t('liquidezCorriente')}
                    valor={`${formatearNumero(indicadores?.liquidez ?? 0)}`}
                    emoji="💧"
                    color="#ca8a04"
                  />
                </>
              )}
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
              {esFamiliar ? (
                <>
                  <DistribucionPieChart
                    datos={indicadores?.gastosCategorias ?? []}
                    simbolo={simbolo}
                    idioma={idioma}
                    titulo={t('tituloDistribucionGastos')}
                    subtitulo={t('subtituloDistribucionGastos')}
                    mensajeVacio={t('vacioDistribucionGastos')}
                  />

                  <DistribucionPieChart
                    datos={indicadores?.ingresosSocios ?? []}
                    simbolo={simbolo}
                    idioma={idioma}
                    titulo={t('tituloDistribucionIngresos')}
                    subtitulo={t('subtituloDistribucionIngresos')}
                    mensajeVacio={t('vacioDistribucionIngresos')}
                  />
                </>
              ) : (
                <>
                  <CategoryChart
                    datos={indicadores?.ventasCategorias ?? []}
                    color={colores.acento}
                    simbolo={simbolo}
                    idioma={idioma}
                  />

                  <StockChart
                    datos={indicadores?.stockCategorias ?? []}
                    color={colores.acento}
                    idioma={idioma}
                  />
                </>
              )}
            </div>

            {esFamiliar ? (
              <EvolucionFamiliarChart datos={indicadores?.evolucionLucro ?? []} simbolo={simbolo} idioma={idioma} />
            ) : (
              <LucroChart datos={indicadores?.evolucionLucro ?? []} simbolo={simbolo} idioma={idioma} />
            )}
          </section>
        )}

        {/* =================================================
            ENDEUDAMIENTO Y FONDO DE RESPALDO (perfil Familia)
        ================================================== */}

        {esFamiliar && configuracion?.mostrar_graficos && (
          <section
            style={{
              background: colores.blanco,
              borderRadius: 24,
              padding: 24,
              marginBottom: 20,
              border: '1px solid #e5e7eb',
              boxShadow: '0 10px 28px rgba(31,58,95,0.06)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 20,
            }}
          >
            <SeccionEndeudamiento
              deuda={indicadores?.pasivos ?? 0}
              patrimonio={indicadores?.patrimonio ?? 0}
              simbolo={simbolo}
              colores={colores}
              idioma={idioma}
            />

            <SeccionFondoRespaldo
              cajaDisponible={indicadores?.cajaDisponible ?? 0}
              meta={objetivos.find((o) => o.indicador === 'FONDO_EMERGENCIA')}
              simbolo={simbolo}
              colores={colores}
              idioma={idioma}
            />
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
                    {t('eyebrowGestion')}
                  </div>

                  <h2
                    style={{
                      margin: 0,
                      color: colores.azul,
                      fontSize: 22,
                    }}
                  >
                    {esFamiliar ? t('objetivosFamiliares') : t('objetivosDelMes')}
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
                  {t('objetivosAcordados')}
                </div>
              </div>

              {esFamiliar && gamificacion && (
                <ProgresoNivelBanner gamificacion={gamificacion} colores={colores} idioma={idioma} />
              )}

              {categoriasOrden(t).map(({ categoria, titulo, emoji }) => {
                const deLaCategoria = objetivos.filter((o) => o.categoria === categoria);

                // En Familia, los objetivos Contables y Financieros
                // (Ventas +10%, Rentabilidad, Fondo de Emergencia...)
                // no tienen sentido todavía en nivel 1 — recién
                // aparecen desde nivel 2, cuando ya hay historial de
                // meses para comparar. "Primeros pasos" es lo único
                // que corresponde mientras el usuario recién arranca.
                if (esFamiliar && (categoria === 'CONTABLE' || categoria === 'FINANCIERO') && (gamificacion?.nivel ?? 1) < 2) {
                  return null;
                }

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
                        {t('proximamenteMarketing')}
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
                          idioma={idioma}
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
                  {t('sinObjetivos')}
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
            <strong>{t('vistaHistoricaTitulo')}</strong>

            <div
              style={{
                marginTop: 5,
                color: COLORES_BASE.gris,
              }}
            >
              {t('vistaHistoricaTexto')}
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

        <PieVisao colores={colores} idioma={idioma} />
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
  idioma,
}: {
  objetivo: ObjetivoCalculado;
  colorPrimario: string;
  colorSecundario: string;
  colorAcento: string;
  idioma: string;
}) {
  const t = crearTraductor(diccionarioPanelControl, idioma);

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
        <div style={{ marginTop: 6 }}>{t('noAplicaTodosPeriodos')}</div>
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
    objetivo.unidad === '%'
      ? `${valor.toFixed(1)}%`
      : objetivo.unidad === 'veces'
        ? `${valor.toFixed(2)}x`
        : objetivo.unidad === 'unidades'
          ? `${formatearNumeroEntero(valor)}`
          : `${objetivo.unidad} ${formatearNumeroEntero(valor)}`;

  const info = CATALOGO_INDICADORES[objetivo.indicador];
  const etiquetaMeta = info?.inverso ? t('tope') : t('meta');

  const resultadoTexto = formatearValor(objetivo.resultado);
  // Productos Estancados usa un umbral fijo de días, no un valor en
  // R$ — mostrar el tope como "90 días" es lo que tiene sentido acá,
  // aunque por dentro se calcule contra un monto.
  const objetivoTexto = objetivo.indicador === 'STOCK_ESTANCADO' ? t('noventaDias') : formatearValor(objetivo.metaResuelta);

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

            <IconoAyuda texto={ayudaIndicador(objetivo.indicador, idioma)} color={colorPrimario} />
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: COLORES_BASE.gris,
            }}
          >
            {t('ahora')}: {resultadoTexto}
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
            ? t('cumplido')
            : enCamino
              ? t('enCamino')
              : t('pendiente')}
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

function SeccionEndeudamiento({
  deuda,
  patrimonio,
  simbolo,
  colores,
  idioma,
}: {
  deuda: number;
  patrimonio: number;
  simbolo: string;
  colores: { azul: string; verde: string; acento: string; blanco: string };
  idioma: string;
}) {
  const t = crearTraductor(diccionarioPanelControl, idioma);
  const total = deuda + Math.max(patrimonio, 0);
  const proporcionDeuda = total > 0 ? (deuda / total) * 100 : 0;

  const salud =
    proporcionDeuda < 30
      ? { texto: t('endeudamientoSano'), color: colores.verde }
      : proporcionDeuda < 60
        ? { texto: t('endeudamientoModerado'), color: '#d97706' }
        : { texto: t('endeudamientoAlto'), color: '#dc2626' };

  return (
    <div>
      <div style={{ marginBottom: 5, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde }}>
        {t('eyebrowEquilibrio')}
      </div>

      <h3 style={{ margin: '0 0 4px', color: colores.azul, fontSize: 18 }}>{t('endeudamiento')}</h3>

      <p style={{ margin: '0 0 14px', fontSize: 12, color: COLORES_BASE.gris }}>
        {t('ayudaEndeudamiento')}
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <InfoCard etiqueta={t('deudaTotal')} valor={`${simbolo} ${formatearNumero(deuda)}`} color="#b91c1c" />
        <InfoCard etiqueta={t('patrimonioNeto')} valor={`${simbolo} ${formatearNumero(patrimonio)}`} color={colores.azul} />
      </div>

      <div style={{ height: 9, borderRadius: 999, background: '#e7edf1', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, proporcionDeuda)}%`, height: '100%', borderRadius: 999, background: salud.color }} />
      </div>

      <div style={{ marginTop: 9, fontSize: 12, fontWeight: 700, color: salud.color }}>
        {salud.texto} — {msgSaludEndeudamiento(idioma, formatearNumero(proporcionDeuda))}
      </div>
    </div>
  );
}

function SeccionFondoRespaldo({
  cajaDisponible,
  meta,
  simbolo,
  colores,
  idioma,
}: {
  cajaDisponible: number;
  meta: ObjetivoCalculado | undefined;
  simbolo: string;
  colores: { azul: string; verde: string; acento: string; blanco: string };
  idioma: string;
}) {
  const t = crearTraductor(diccionarioPanelControl, idioma);
  const objetivoMonto = meta?.objetivo ?? 0;
  const porcentaje = objetivoMonto > 0 ? Math.min(100, (cajaDisponible / objetivoMonto) * 100) : 0;
  const cumplido = objetivoMonto > 0 && cajaDisponible >= objetivoMonto;

  return (
    <div>
      <div style={{ marginBottom: 5, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde }}>
        {t('eyebrowColchon')}
      </div>

      <h3 style={{ margin: '0 0 4px', color: colores.azul, fontSize: 18 }}>{t('fondoDeRespaldo')}</h3>

      <p style={{ margin: '0 0 14px', fontSize: 12, color: COLORES_BASE.gris }}>
        {t('ayudaFondoRespaldo')}
      </p>

      {objetivoMonto > 0 ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <strong style={{ color: colores.azul }}>{simbolo} {formatearNumero(cajaDisponible)}</strong>
            <span style={{ color: COLORES_BASE.gris }}>{t('meta')}: {simbolo} {formatearNumero(objetivoMonto)}</span>
          </div>

          <div style={{ height: 9, borderRadius: 999, background: '#e7edf1', overflow: 'hidden' }}>
            <div
              style={{
                width: `${porcentaje}%`,
                height: '100%',
                borderRadius: 999,
                background: cumplido ? colores.verde : '#d97706',
              }}
            />
          </div>

          <div style={{ marginTop: 9, fontSize: 12, fontWeight: 700, color: cumplido ? colores.verde : '#d97706' }}>
            {cumplido ? t('fondoCompleto') : msgFondoRespaldoProgreso(idioma, formatearNumero(porcentaje))}
          </div>
        </>
      ) : (
        <div style={{ padding: 16, border: '1px dashed #d6dee5', borderRadius: 14, fontSize: 12, color: COLORES_BASE.gris }}>
          {t('sinMetaFondoRespaldo')}
        </div>
      )}
    </div>
  );
}

function ProgresoNivelBanner({
  gamificacion,
  colores,
  idioma,
}: {
  gamificacion: ProgresoGamificacion;
  colores: { azul: string; verde: string; acento: string; blanco: string };
  idioma: string;
}) {
  const t = crearTraductor(diccionarioPanelControl, idioma);

  return (
    <div
      style={{
        background: `${colores.azul}08`,
        border: `1px solid ${colores.azul}22`,
        borderRadius: 16,
        padding: 18,
        marginBottom: 22,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: colores.azul }}>
          {msgNivelBanner(idioma, gamificacion.emoji, gamificacion.nivel, gamificacion.nombre)}
        </div>

        <span style={{ fontSize: 12, fontWeight: 700, color: colores.verde }}>
          {gamificacion.operaciones} {t('operacionesRegistradas')}
        </span>
      </div>

      <div style={{ height: 9, borderRadius: 999, background: '#e7edf1', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, gamificacion.progreso)}%`, height: '100%', borderRadius: 999, background: colores.verde }} />
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: COLORES_BASE.gris }}>
        {gamificacion.faltan > 0
          ? msgFaltanParaSubirNivel(idioma, gamificacion.faltan)
          : t('nivelMaximo')}
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
  return Math.round(valor).toLocaleString('es-AR', {
    maximumFractionDigits: 0,
  });
}

// Mismo encabezado que usan Contabilidad, Mercadería, Informes,
// Recursos Humanos y Configurações — para que las 6 herramientas se
// sientan como una sola app, no pantallas sueltas con estilos propios.
const encabezadoEstandar: React.CSSProperties = {
  background: 'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
  borderRadius: 24,
  padding: '28px 34px',
  color: COLORES_BASE.blanco,
  marginBottom: 24,
  boxShadow: '0 18px 40px rgba(20,42,71,0.16)',
};

const volverEstandar: React.CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: 18,
};

const eyebrowEstandar: React.CSSProperties = {
  color: '#86efac',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.4,
  marginBottom: 8,
};

function formatearPeriodo(valor: string, idioma?: string): string {
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
    idioma === 'PT' ? 'pt-BR' : 'es-AR',
    {
      month: 'long',
      year: 'numeric',
    }
  );
}
