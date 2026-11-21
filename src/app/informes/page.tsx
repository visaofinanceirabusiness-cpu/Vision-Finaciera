'use client';

// INFORMES
//
// Cinco informes contables, todos alimentados por el mismo Diario que
// arma Libro Diario (registro_operaciones + registros_automaticos),
// pero filtrados a estado = 'VALIDADO' únicamente — así un asiento
// pendiente de revisión no contamina ningún informe.
//
//   - Mayor: el detalle cronológico de una cuenta elegida, con saldo
//     corriendo.
//   - Sumas y Saldos: todas las cuentas, con su movimiento del período
//     y su saldo final. El total Debe debe cerrar igual al total Haber.
//   - Flujo de Caja, Estado de Resultado y Balance Patrimonial:
//     próximos pasos.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BLOQUES_FLUJO, armarFlujo, crearClasificador, diferenciaConSaldoDeseado, movimientosDeCaja, promedioSalidasMensuales, saldoAlCierreDePeriodo, saldoInicialDePeriodo, type BloqueFlujo } from '@/lib/flujoCaja';
import { useEspectador } from '@/components/demo/ProveedorEspectador';
import { useEstadoDemo } from '@/lib/demoEstado';
import { EVENTO_PANTALLA_BLOQUEADA, pestanaInformeHabilitada } from '@/lib/modoEspectador';
import { guardarSaldoDeseado, obtenerSaldoDeseado, periodoAnterior } from '@/lib/flujoCajaMeta';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { VolverLobby } from '@/components/nav/VolverLobby';
import { supabase } from '@/lib/supabase';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { cargarNaturalezaPorOperacion } from '@/lib/naturalezaResultadoDatos';
import { resultadoPorNaturaleza, resumenNaturaleza, type Naturaleza } from '@/lib/naturalezaResultado';
import { DreVisual } from '@/components/informes/DreVisual';
import { BalanceVisual } from '@/components/informes/BalanceVisual';
import { MayorVisual } from '@/components/informes/MayorVisual';
import { InterpretacionVisual, type EstadoVista } from '@/components/informes/InterpretacionVisual';
import { armarConversacion, huellaDeDatos } from '@/lib/informes/conversacion';
import { guardarVersion, listarVersiones, ultimaVersion, versionPorId, type VersionConContenido, type VersionGuardada } from '@/lib/informes/interpretacionHistorial';
import { reunirDatos } from '@/lib/informes/interpretacionDatos';
import { useCaja } from '@/components/caja/useCaja';
import { SumasVisual } from '@/components/informes/SumasVisual';
import { FlujoVisual, type FilaResumen } from '@/components/informes/FlujoVisual';
import { serieFlujo } from '@/lib/informes/flujo';
import { totalesBalance } from '@/lib/informes/balance';
import { SabioWidget } from '@/components/panel/SabioWidget';
import { SabioFlotante } from '@/components/panel/SabioFlotante';
import { crearTraductor, nombreOperacionDisplay, nombreCuentaDisplay } from '@/lib/i18n';
import { empresaTieneOnboardingCompleto } from '@/lib/onboarding';
import { idsCuentasPorCobrar } from '@/lib/cuentasPorCobrar';
import {
  diccionarioInformes,
  formatearPeriodo,
  formatearPeriodoCorto,
  msgDebeHaberNoCierran,
  msgResultadoLabel,
  msgFlujoNetoLabel,
  msgEcuacionCierra,
  msgEcuacionNoCierra,
  frasesSabioInformes,
} from './i18n';

// Contexto para no tener que pasar el símbolo de moneda como prop a
// cada uno de los informes y sus sub-componentes — cada uno lo toma
// con useContext(SimboloContext) donde lo necesite.
const SimboloContext = createContext('R$');

const IdiomaContext = createContext<string | null>(null);

// Colores personalizables por empresa (CONFIGURAÇÕES → Apariencia):
// var(--x, <default>) resuelve a la variable si TemaGlobal la seteó,
// y si no, usa el mismo valor de siempre — ver lib/apariencia.ts.
const COLORES = {
  azul: 'var(--color-primario, #1f3a5f)',
  verde: 'var(--color-secundario, #2e8b57)',
  gris: 'var(--color-acento, #6e7781)',
  blanco: '#ffffff',
};

type Pestana = 'mayor' | 'flujo' | 'resultado' | 'sumas' | 'balance' | 'interpretacion';

type CuentaPlan = {
  id: string;
  codigo: string;
  nombre: string;
  cuenta_padre_id: string | null;
  tipo_saldo: string | null;
  naturaleza: string | null;
  saldo_inicial: number | null;
};

type Asiento = {
  id_operacion: string | null;
  fecha: string;
  descripcion: string;
  debito: string | null;
  credito: string | null;
  importe: number;
  operacion: string | null;
};

export default function InformesPage() {
  const router = useRouter();

  const [pestana, setPestana] = useState<Pestana>('balance');
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<string | null>(null);
  const [esFamiliar, setEsFamiliar] = useState(false);
  const [cuentas, setCuentas] = useState<CuentaPlan[]>([]);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  // Asientos de cierre del ejercicio (31/12): solo los usan las pestañas acumuladas (Balance, Mayor, Sumas y Saldos). El Estado de Resultado
  // y el Flujo de Caja no los reciben: si no, cada año cerrado mostraría ingresos y gastos en cero.
  const [cierres, setCierres] = useState<Asiento[]>([]);
  const [ejerciciosCerrados, setEjerciciosCerrados] = useState<Array<{ ejercicio: number; esPrueba: boolean }>>([]);
  const asientosConCierre = useMemo(() => [...asientos, ...cierres], [asientos, cierres]);
  const [nombresMedioFinanciero, setNombresMedioFinanciero] = useState<Set<string>>(new Set());
  const [nombresPorCobrar, setNombresPorCobrar] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // Deep links desde el Panel de Control: /informes?pestana=flujo o ?pestana=mayor&cuenta=<nombre>
  const [cuentaInicial, setCuentaInicial] = useState('');
  const [periodoInicial, setPeriodoInicial] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deseada = params.get('pestana');
    if (deseada === 'mayor' || deseada === 'flujo' || deseada === 'resultado') setPestana(deseada);
    setCuentaInicial(params.get('cuenta') ?? '');
    setPeriodoInicial(params.get('periodo') ?? '');
  }, []);

  const t = crearTraductor(diccionarioInformes, idioma);

  // En la demo, cada informe lo libera quien presenta: los demás se ven con candado.
  const espectador = useEspectador();
  const demo = useEstadoDemo();
  const { estaEnCaja } = useCaja();
  const bloqueada = (id: Pestana) => Boolean(espectador) && !pestanaInformeHabilitada(id, demo.habilitadas);
  const irA = (id: Pestana) => {
    if (bloqueada(id)) {
      window.dispatchEvent(new Event(EVENTO_PANTALLA_BLOQUEADA));
      return;
    }
    setPestana(id);
  };

  // Cuando se libera un informe y el que estaba abierto sigue bloqueado, se pasa al habilitado.
  useEffect(() => {
    if (!espectador || !demo.cargado || !bloqueada(pestana)) return;
    const habilitada = (['balance', 'resultado', 'flujo', 'mayor', 'sumas', 'interpretacion'] as Pestana[]).find((id) => !bloqueada(id));
    if (habilitada) setPestana(habilitada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espectador, demo.cargado, demo.habilitadas, pestana]);

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('empresa_id, tipo_usuario, nombre')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfil?.empresa_id) {
        setError(t('errorEmpresa'));
        setCargando(false);
        return;
      }

      // El perfil Asistente (Bloque E1 del Día 1 de seguridad) es de
      // solo carga de datos — no ve Informes. Esto es una capa de
      // frontend, no de base de datos: el bloqueo real por RLS es
      // parte de la pasada de mínimo privilegio (E3) que sigue.
      if (perfil.tipo_usuario === 'ASISTENTE') {
        router.push('/');
        return;
      }

      if (!(await empresaTieneOnboardingCompleto(perfil.empresa_id))) {
        router.push('/bienvenida');
        return;
      }

      setEmpresaId(perfil.empresa_id);

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nombre, moneda, idioma, perfiles_empresa(codigo)')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      const relacionPerfil = empresaData?.perfiles_empresa as { codigo: string }[] | { codigo: string } | null | undefined;
      setEsFamiliar((Array.isArray(relacionPerfil) ? relacionPerfil[0]?.codigo : relacionPerfil?.codigo) === 'FAMILIAR');
      setNombreEmpresa(empresaData?.nombre ?? '');
      setNombreUsuario(String(perfil.nombre ?? '').trim().split(/\s+/)[0] ?? '');
      setMoneda(empresaData?.moneda ?? null);
      setIdioma(empresaData?.idioma ?? null);

      const [
        { data: cuentasData, error: errorCuentas },
        { data: operacionesData, error: errorOperaciones },
        { data: automaticosData, error: errorAutomaticos },
        { data: formaPagoCuentasData, error: errorFormaPagoCuentas },
        { data: cierresData },
      ] = await Promise.all([
        supabase
          .from('plan_cuentas')
          .select('id, codigo, nombre, cuenta_padre_id, tipo_saldo, naturaleza, saldo_inicial')
          .eq('empresa_id', perfil.empresa_id),

        supabase
          .from('registro_operaciones')
          .select('id_operacion, fecha, operacion, historico, cuenta_debito, cuenta_credito, total')
          .eq('empresa_id', perfil.empresa_id)
          .eq('estado', 'VALIDADO'),

        supabase
          .from('registros_automaticos')
          .select('id_operacion, fecha, tipo_registro, historico, cuenta_debito, cuenta_credito, importe')
          .eq('empresa_id', perfil.empresa_id)
          .eq('estado', 'VALIDADO'),

        // Qué cuentas son "medios financieros" reales (plata que se
        // puede gastar) — no se puede adivinar por el código del Plan
        // de Cuentas (ver comentario en cuentasDeCaja más abajo): la
        // única fuente confiable es forma_pago_cuentas, la misma tabla
        // que ya usa motor.ts para resolver el rol MEDIO_FINANCIERO.
        supabase
          .from('forma_pago_cuentas')
          .select('cuenta_id')
          .eq('empresa_id', perfil.empresa_id)
          .eq('activo', true),

        supabase.from('asientos_cierre').select('id_cierre, ejercicio, fecha, historico, cuenta_debito, cuenta_credito, importe, es_prueba').eq('empresa_id', perfil.empresa_id),
      ]);

      if (errorCuentas) console.warn('No se pudo cargar el plan de cuentas:', errorCuentas);
      if (errorOperaciones) console.warn('No se pudieron cargar las operaciones:', errorOperaciones);
      if (errorAutomaticos) console.warn('No se pudieron cargar los registros automáticos:', errorAutomaticos);
      if (errorFormaPagoCuentas) console.warn('No se pudieron cargar las cuentas de medios de pago:', errorFormaPagoCuentas);

      setCuentas((cuentasData ?? []) as CuentaPlan[]);

      const idsCuentaMedioFinanciero = new Set((formaPagoCuentasData ?? []).map((f) => f.cuenta_id));

      // Las cuentas a cobrar ("Departamento a cobrar") también se crean como forma de
      // pago, pero NO son plata disponible: sin esto, un alquiler devengado y todavía
      // sin cobrar aparecía como "Entrada de caja" y sumaba a la caja de hoy.
      const porCobrar = await idsCuentasPorCobrar(perfil.empresa_id).catch((e) => {
        console.warn('No se pudieron identificar las cuentas por cobrar:', e);
        return new Set<string>();
      });

      setNombresPorCobrar(new Set((cuentasData ?? []).filter((c) => porCobrar.has(c.id)).map((c) => c.nombre)));

      // Solo cuentas de ACTIVO: una forma de pago puede estar vinculada
      // a un PASIVO (ej. "Tarjeta" → "Tarjeta de Crédito a Pagar"), que
      // no es plata disponible — usarla ahí no mueve caja, cambia deuda.
      setNombresMedioFinanciero(
        new Set(
          (cuentasData ?? [])
            .filter((c) => idsCuentaMedioFinanciero.has(c.id) && c.tipo_saldo === 'ACTIVO' && !porCobrar.has(c.id))
            .map((c) => c.nombre)
        )
      );

      const idiomaEmpresa = empresaData?.idioma ?? null;

      const asientosOperaciones: Asiento[] = (operacionesData ?? []).map((fila) => ({
        id_operacion: fila.id_operacion,
        fecha: String(fila.fecha ?? ''),
        descripcion: [fila.operacion ? nombreOperacionDisplay(idiomaEmpresa, fila.operacion) : null, fila.historico]
          .filter(Boolean)
          .join(' · '),
        debito: fila.cuenta_debito,
        credito: fila.cuenta_credito,
        importe: Number(fila.total ?? 0),
        operacion: fila.operacion,
      }));

      const asientosAutomaticos: Asiento[] = (automaticosData ?? []).map((fila) => ({
        id_operacion: fila.id_operacion,
        fecha: String(fila.fecha ?? ''),
        descripcion: [fila.tipo_registro, fila.historico].filter(Boolean).join(' · '),
        debito: fila.cuenta_debito,
        credito: fila.cuenta_credito,
        importe: Number(fila.importe ?? 0),
        operacion: null,
      }));

      setAsientos([...asientosOperaciones, ...asientosAutomaticos]);
      setEjerciciosCerrados(
        [...new Map((cierresData ?? []).map((f) => [f.ejercicio as number, { ejercicio: f.ejercicio as number, esPrueba: Boolean(f.es_prueba) }])).values()].sort((a, b) => b.ejercicio - a.ejercicio)
      );
      setCierres(
        (cierresData ?? []).map((fila) => ({
          id_operacion: fila.id_cierre,
          fecha: String(fila.fecha ?? ''),
          descripcion: fila.historico ?? '',
          debito: fila.cuenta_debito,
          credito: fila.cuenta_credito,
          importe: Number(fila.importe ?? 0),
          operacion: null,
        }))
      );
      setCargando(false);
    }

    cargar();
  }, [router]);

  // Cuentas hoja: las que no son encabezado de ninguna otra. Son las
  // únicas que se suman — las cuentas título (ATIVO, PASSIVO...) son
  // solo agrupadores visuales.
  const hojas = useMemo(() => {
    const idsConHijas = new Set(
      cuentas.map((cuenta) => cuenta.cuenta_padre_id).filter(Boolean) as string[]
    );

    return cuentas
      .filter((cuenta) => !idsConHijas.has(cuenta.id))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [cuentas]);

  return (
    <IdiomaContext.Provider value={idioma}>
    <SimboloContext.Provider value={simboloMoneda(moneda)}>
    <div style={fondo}>
      <div style={{ maxWidth: 1250, margin: '0 auto' }}>
        <header style={encabezado}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <VolverLobby>{t('volver')}</VolverLobby>

              <div style={eyebrow}>{t('eyebrow')}</div>

              <h1 style={{ margin: 0, fontSize: 32 }}>{t('titulo')}</h1>

              <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
                {t('subtitulo')}
              </p>
            </div>

            {/* SABIO — permanente, con tips propios de Informes. Vive en
                el mismo panel del encabezado, entre el título y los
                accesos rápidos. */}
            <SabioWidget
              colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
              idioma={idioma}
              frases={frasesSabioInformes(idioma)}
            />

            <AccesosHerramientas />
          </div>
        </header>

        <SabioFlotante
          colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
          idioma={idioma}
          frases={frasesSabioInformes(idioma)}
        />

        <main style={panel}>
          <div
            style={{
              display: 'flex',
              gap: 10,
              borderBottom: '1px solid #e5e7eb',
              marginBottom: 22,
              flexWrap: 'wrap',
            }}
          >
            <button type="button" onClick={() => irA('mayor')} style={tabStyle(pestana === 'mayor')}>
              {bloqueada('mayor') ? '🔒 ' : ''}{t('tabMayor')}
            </button>

            <button type="button" onClick={() => irA('flujo')} style={tabStyle(pestana === 'flujo')}>
              {bloqueada('flujo') ? '🔒 ' : ''}{t('tabFlujo')}
            </button>

            <button
              type="button"
              onClick={() => irA('resultado')}
              style={tabStyle(pestana === 'resultado')}
            >
              {bloqueada('resultado') ? '🔒 ' : ''}{t('tabResultado')}
            </button>

            <button type="button" onClick={() => irA('sumas')} style={tabStyle(pestana === 'sumas')}>
              {bloqueada('sumas') ? '🔒 ' : ''}{t('tabSumas')}
            </button>

            <button
              type="button"
              onClick={() => irA('balance')}
              style={tabStyle(pestana === 'balance')}
            >
              {bloqueada('balance') ? '🔒 ' : ''}{t('tabBalance')}
            </button>

            {!estaEnCaja('interpretacion') && (
              <button type="button" onClick={() => irA('interpretacion')} style={tabStyle(pestana === 'interpretacion')}>
                {bloqueada('interpretacion') ? '🔒 ' : ''}{t('tabInterpretacion')}
              </button>
            )}
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          {ejerciciosCerrados.length > 0 && (pestana === 'balance' || pestana === 'mayor' || pestana === 'sumas') && (
            <div style={{ border: '1px solid #ddd6fe', background: '#faf5ff', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#4c1d95' }}>
              🔒{' '}
              {idioma === 'PT'
                ? `Exercício${ejerciciosCerrados.length > 1 ? 's' : ''} ${ejerciciosCerrados.map((e) => e.ejercicio).join(', ')} fechado${ejerciciosCerrados.length > 1 ? 's' : ''} em 31/12: o resultado de cada ano já está em Resultados Acumulados e as contas de resultado ficam em zero nesta aba. O Demonstrativo de Resultado continua mostrando os valores reais de cada ano.`
                : `Ejercicio${ejerciciosCerrados.length > 1 ? 's' : ''} ${ejerciciosCerrados.map((e) => e.ejercicio).join(', ')} cerrado${ejerciciosCerrados.length > 1 ? 's' : ''} el 31/12: el resultado de cada año ya está en Resultados Acumulados y las cuentas de resultado quedan en cero en esta pestaña. El Estado de Resultado sigue mostrando las cifras reales de cada año.`}
              {ejerciciosCerrados.some((e) => e.esPrueba) && (
                <strong style={{ marginLeft: 8, background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '2px 10px' }}>
                  {idioma === 'PT' ? 'TESTE — empresa demo' : 'PRUEBA — empresa demo'}
                </strong>
              )}
            </div>
          )}

          {bloqueada(pestana) ? (
            <div style={{ ...cargandoStyle, fontSize: 16 }}>
              {idioma === 'PT' ? '🔒 Este relatório será liberado em breve.' : '🔒 Este informe se habilitará en breve.'}
            </div>
          ) : cargando ? (
            <div style={cargandoStyle}>{t('cargandoInformes')}</div>
          ) : (
            <>
              {pestana === 'mayor' && <MayorTab cuentas={cuentas} asientos={asientosConCierre} cuentaInicial={cuentaInicial} />}
              {pestana === 'sumas' && <SumasYSaldosTab cuentas={cuentas} hojas={hojas} asientos={asientosConCierre} />}
              {pestana === 'flujo' && (
                <FlujoDeCajaTab hojas={hojas} asientos={asientos} nombresMedioFinanciero={nombresMedioFinanciero} nombresPorCobrar={nombresPorCobrar} periodoInicial={periodoInicial} empresaId={empresaId} esFamiliar={esFamiliar} />
              )}
              {pestana === 'resultado' && <EstadoDeResultadoTab hojas={hojas} asientos={asientos} empresaId={empresaId} periodoInicial={periodoInicial} esFamiliar={esFamiliar} />}
              {pestana === 'balance' && <BalancePatrimonialTab cuentas={cuentas} hojas={hojas} asientos={asientosConCierre} />}
              {pestana === 'interpretacion' && !estaEnCaja('interpretacion') && (
                <InterpretacionTab empresaId={empresaId} nombreEmpresa={nombreEmpresa} nombreUsuario={nombreUsuario} cuentas={cuentas} hojas={hojas} asientos={asientos} asientosBalance={asientosConCierre} nombresMedioFinanciero={nombresMedioFinanciero} nombresPorCobrar={nombresPorCobrar} esFamiliar={esFamiliar} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
    </SimboloContext.Provider>
    </IdiomaContext.Provider>
  );
}

/* ==========================================================
   UTILIDAD COMPARTIDA — saldo de una cuenta según su naturaleza
========================================================== */

function calcularMovimiento(cuenta: CuentaPlan, asientos: Asiento[], incluirInicial = true) {
  let debe = 0;
  let haber = 0;

  for (const asiento of asientos) {
    if (asiento.debito === cuenta.nombre) debe += asiento.importe;
    if (asiento.credito === cuenta.nombre) haber += asiento.importe;
  }

  const inicial = incluirInicial ? Number(cuenta.saldo_inicial ?? 0) : 0;

  const saldoFinal =
    cuenta.naturaleza === 'ACREEDORA' ? inicial + haber - debe : inicial + debe - haber;

  return { inicial, debe, haber, saldoFinal };
}

// Agrupa las fechas de los asientos en períodos "AAAA-MM", más la
// opción "TODOS" para ver el histórico completo.
function mesEnCurso(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

// El mes en curso siempre está en la lista (aunque todavía no tenga
// movimientos): es el período con el que abren Flujo de Caja y Estado de
// Resultado, y un <select> con un valor que no existe se ve en blanco.
function obtenerPeriodos(asientos: Asiento[], idioma: string | null, extra?: string) {
  const claves = new Set(asientos.map((a) => a.fecha.slice(0, 7)).filter(Boolean));
  claves.add(mesEnCurso());
  if (extra && /^\d{4}-\d{2}$/.test(extra)) claves.add(extra);

  return Array.from(claves)
    .sort((a, b) => b.localeCompare(a))
    .map((clave) => ({ valor: clave, etiqueta: formatearPeriodo(clave, idioma) }));
}

/* ==========================================================
   PESTAÑA · SUMAS Y SALDOS
========================================================== */

function SumasYSaldosTab({ cuentas, hojas, asientos }: { cuentas: CuentaPlan[]; hojas: CuentaPlan[]; asientos: Asiento[] }) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const periodos = useMemo(() => obtenerPeriodos(asientos, idioma), [asientos, idioma]);

  return (
    <div id="informe-imprimible">
      <SumasVisual cuentas={cuentas} hojas={hojas} asientos={asientos} periodos={periodos} periodoInicial={mesEnCurso()} simbolo={simbolo} idioma={idioma} />
    </div>
  );
}

/* ==========================================================
   PESTAÑA · MAYOR
========================================================== */

function MayorTab({ cuentas, asientos, cuentaInicial }: { cuentas: CuentaPlan[]; asientos: Asiento[]; cuentaInicial: string }) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const periodos = useMemo(() => obtenerPeriodos(asientos, idioma), [asientos, idioma]);

  return (
    <div id="informe-imprimible">
      <MayorVisual cuentas={cuentas} asientos={asientos} periodos={periodos} cuentaInicial={cuentaInicial} simbolo={simbolo} idioma={idioma} />
    </div>
  );
}

/* ==========================================================
   PESTAÑA · ESTADO DE RESULTADO
========================================================== */

function EstadoDeResultadoTab({ hojas, asientos, empresaId, periodoInicial, esFamiliar }: { hojas: CuentaPlan[]; asientos: Asiento[]; empresaId: string | null; periodoInicial: string; esFamiliar: boolean }) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioInformes, idioma);
  const periodos = useMemo(() => obtenerPeriodos(asientos, idioma, periodoInicial), [asientos, idioma, periodoInicial]);
  const [periodo, setPeriodo] = useState(/^\d{4}-\d{2}$/.test(periodoInicial) ? periodoInicial : mesEnCurso());
  // "Por cuenta" (como siempre) o "Por naturaleza": fijos / recurrentes variables / del mes.
  const [vista, setVista] = useState<'CUENTA' | 'NATURALEZA'>('CUENTA');
  // La «vista simplificada» ahora es el tablero de tarjetas de arriba; la detallada siempre muestra cada cuenta.
  const soloTotal = false;

  const esTodos = periodo === 'TODOS';

  const asientosDelPeriodo = useMemo(
    () => (esTodos ? asientos : asientos.filter((a) => a.fecha.slice(0, 7) === periodo)),
    [asientos, periodo, esTodos]
  );

  // Con "Todos los períodos" el saldo inicial representa el arrastre
  // histórico y suma al resultado. Con un mes puntual, se mira solo
  // lo que pasó ese mes.
  const filasPorTipo = (tipo: string) =>
    hojas
      .map((cuenta) => ({ cuenta, ...calcularMovimiento(cuenta, asientosDelPeriodo, esTodos) }))
      .filter((fila) => fila.cuenta.tipo_saldo === tipo && Math.round(fila.saldoFinal) !== 0)
      .sort((a, b) => b.saldoFinal - a.saldoFinal);

  const ingresos = filasPorTipo('INGRESO');
  const costos = filasPorTipo('COSTO');
  const gastos = filasPorTipo('GASTO');

  const totalIngresos = ingresos.reduce((s, f) => s + f.saldoFinal, 0);
  const totalCostos = costos.reduce((s, f) => s + f.saldoFinal, 0);
  const totalGastos = gastos.reduce((s, f) => s + f.saldoFinal, 0);
  const resultado = totalIngresos - totalCostos - totalGastos;
  const rentabilidad = totalIngresos !== 0 ? (resultado / totalIngresos) * 100 : 0;

  // Empresas: el estado se arma en tres escalones (bruto → operacional → neto).
  // Los gastos financieros (6.4) e impuestos (6.5) quedan debajo del operacional.
  const esNoOperativo = (fila: { cuenta: CuentaPlan }) => ['6.4.', '6.5.'].some((prefijo) => (fila.cuenta.codigo ?? '').startsWith(prefijo));
  const gastosOperativos = gastos.filter((f) => !esNoOperativo(f));
  const gastosNoOperativos = gastos.filter(esNoOperativo);
  const totalGastosOperativos = gastosOperativos.reduce((s, f) => s + f.saldoFinal, 0);
  const totalGastosNoOperativos = gastosNoOperativos.reduce((s, f) => s + f.saldoFinal, 0);
  const resultadoBruto = totalIngresos - totalCostos;
  const resultadoOperacional = resultadoBruto - totalGastosOperativos;
  const porcentajeSobreIngresos = (valor: number) => (totalIngresos !== 0 ? (valor / totalIngresos) * 100 : 0);
  const esPT = idioma === 'PT';

  // La tendencia mira siempre todo el histórico, sin importar el
  // período elegido arriba — es el panorama general de la empresa,
  // no un dato que dependa del filtro.
  const tendencia = useMemo(
    () => calcularTendenciaResultado(hojas, asientos, idioma),
    [hojas, asientos, idioma]
  );

  // Mes anterior (solo con un mes puntual): para mostrar cuánto subió o bajó cada tarjeta.
  const totalesAnterior = useMemo(() => {
    if (esTodos) return null;
    const delMes = asientos.filter((a) => a.fecha.slice(0, 7) === periodoAnterior(periodo));
    if (delMes.length === 0) return null;
    const suma = (tipo: string) => hojas.filter((c) => c.tipo_saldo === tipo).reduce((acc, c) => acc + calcularMovimiento(c, delMes, false).saldoFinal, 0);
    const ing = suma('INGRESO');
    const cos = suma('COSTO');
    const gas = suma('GASTO');
    return { ingresos: ing, costos: cos, gastos: gas, resultadoBruto: ing - cos, resultado: ing - cos - gas };
  }, [asientos, hojas, periodo, esTodos]);

  // Vista «por naturaleza»: de dónde viene cada ingreso y gasto (fijo, recurrente variable o del mes).
  const [vistaDre, setVistaDre] = useState<'CUENTA' | 'NATURALEZA'>('CUENTA');
  const [mapaNaturaleza, setMapaNaturaleza] = useState<Map<string, Naturaleza> | null | 'error'>(null);
  useEffect(() => {
    if (vistaDre !== 'NATURALEZA' || !empresaId || mapaNaturaleza) return;
    let vigente = true;
    cargarNaturalezaPorOperacion(empresaId)
      .then((m) => { if (vigente) setMapaNaturaleza(m); })
      .catch(() => { if (vigente) setMapaNaturaleza('error'); });
    return () => { vigente = false; };
  }, [vistaDre, empresaId, mapaNaturaleza]);
  const naturaleza = useMemo(() => {
    if (vistaDre !== 'NATURALEZA') return null;
    if (mapaNaturaleza === null) return 'cargando' as const;
    if (mapaNaturaleza === 'error') return null;
    const r = resultadoPorNaturaleza(hojas, asientosDelPeriodo, mapaNaturaleza, esTodos);
    const suma = (tipo: 'INGRESO' | 'COSTO' | 'GASTO') => ({ FIJO: r[tipo].FIJO.total, RECURRENTE_VARIABLE: r[tipo].RECURRENTE_VARIABLE.total, DEL_MES: r[tipo].DEL_MES.total });
    return { ingresos: suma('INGRESO'), costos: suma('COSTO'), gastos: suma('GASTO'), resumen: resumenNaturaleza(r) };
  }, [vistaDre, mapaNaturaleza, hojas, asientosDelPeriodo, esTodos]);

  const aFilas = (filas: { cuenta: CuentaPlan; saldoFinal: number }[]) => filas.map((f) => ({ nombre: nombreCuentaDisplay(idioma, f.cuenta.nombre), valor: f.saldoFinal }));

  return (
    <div id="informe-imprimible">
      <DreVisual
        pt={esPT}
        esFamiliar={esFamiliar}
        simbolo={simbolo}
        etiquetaPeriodo={esTodos ? t('todosLosPeriodos') : formatearPeriodo(periodo, idioma)}
        esTodos={esTodos}
        periodos={periodos}
        periodo={periodo}
        onPeriodo={setPeriodo}
        totales={{ ingresos: totalIngresos, costos: totalCostos, gastos: totalGastos, resultadoBruto, resultado }}
        anterior={totalesAnterior}
        filasIngresos={aFilas(ingresos)}
        filasCostos={aFilas(costos)}
        filasGastos={aFilas(gastos)}
        tendencia={tendencia}
        vista={vistaDre}
        onVista={empresaId ? setVistaDre : undefined}
        naturaleza={naturaleza}
      />

    </div>
  );
}

// Resultado (Ingresos - Costos - Gastos) de cada mes, calculado solo
// con el movimiento de ese mes (no acumulado, no incluye saldo inicial).
function calcularTendenciaResultado(hojas: CuentaPlan[], asientos: Asiento[], idioma: string | null) {
  const claves = Array.from(new Set(asientos.map((a) => a.fecha.slice(0, 7)).filter(Boolean))).sort();

  return claves.map((clave) => {
    const delMes = asientos.filter((a) => a.fecha.slice(0, 7) === clave);

    const sumaTipo = (tipo: string) =>
      hojas
        .filter((c) => c.tipo_saldo === tipo)
        .reduce((s, c) => s + calcularMovimiento(c, delMes, false).saldoFinal, 0);

    const ingresos = sumaTipo('INGRESO');
    const salidas = sumaTipo('COSTO') + sumaTipo('GASTO');
    const valor = ingresos - salidas;

    return { clave, etiqueta: formatearPeriodoCorto(clave, idioma), etiquetaLarga: formatearPeriodo(clave, idioma), valor, ingresos, salidas };
  });
}

const CLAVE_VISTA_INFORME = 'informes:vista';

// Simplificada / detallada: se recuerda en el dispositivo y vale para Flujo de Caja y Estado de Resultado.
function useVistaInforme(): ['SIMPLE' | 'DETALLE', (v: 'SIMPLE' | 'DETALLE') => void] {
  const [vista, setVistaEstado] = useState<'SIMPLE' | 'DETALLE'>('DETALLE');

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_VISTA_INFORME) === 'SIMPLE') setVistaEstado('SIMPLE');
    } catch {
      // sin almacenamiento, queda la vista detallada
    }
  }, []);

  function setVista(v: 'SIMPLE' | 'DETALLE') {
    setVistaEstado(v);
    try {
      window.localStorage.setItem(CLAVE_VISTA_INFORME, v);
    } catch {
      // la elección vale igual para esta sesión
    }
  }

  return [vista, setVista];
}

function ToggleVistaInforme({ vista, onChange, esPT }: { vista: 'SIMPLE' | 'DETALLE'; onChange: (v: 'SIMPLE' | 'DETALLE') => void; esPT: boolean }) {
  const opciones: ['SIMPLE' | 'DETALLE', string][] = [
    ['SIMPLE', esPT ? 'Simplificada' : 'Simplificada'],
    ['DETALLE', esPT ? 'Detalhada' : 'Detallada'],
  ];

  return (
    <div role="group" aria-label={esPT ? 'Tipo de visão' : 'Tipo de vista'} style={{ display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: 999, overflow: 'hidden' }}>
      {opciones.map(([valor, etiqueta]) => (
        <button
          key={valor}
          type="button"
          onClick={() => onChange(valor)}
          aria-pressed={vista === valor}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: vista === valor ? COLORES.verde : 'transparent',
            color: vista === valor ? '#fff' : COLORES.azul,
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

// Saldo deseado del mes: manual, editable mes a mes, informativo (no genera asientos).
function SaldoDeseado({ empresaId, periodo, saldoFinal, esPT, esFamiliar, sugerido }: { empresaId: string; periodo: string; saldoFinal: number; esPT: boolean; esFamiliar: boolean; sugerido: number }) {
  const simbolo = useContext(SimboloContext);
  const [guardado, setGuardado] = useState(0);
  const [texto, setTexto] = useState('0');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    setError('');

    obtenerSaldoDeseado(empresaId, periodo)
      .then((valor) => {
        if (cancelado) return;
        setGuardado(valor);
        setTexto(String(valor));
      })
      .catch(() => {
        if (!cancelado) setError(esPT ? 'Não foi possível carregar o saldo desejado.' : 'No se pudo cargar el saldo deseado.');
      });

    return () => {
      cancelado = true;
    };
  }, [empresaId, periodo, esPT]);

  async function guardar(valor: number) {
    if (!Number.isFinite(valor) || valor < 0) {
      setError(esPT ? 'Coloque um valor igual ou maior que zero.' : 'Poné un valor igual o mayor a cero.');
      return;
    }

    setError('');
    if (valor === guardado) return;

    try {
      await guardarSaldoDeseado(empresaId, periodo, valor);
      setGuardado(valor);
    } catch {
      setError(esPT ? 'Não foi possível salvar.' : 'No se pudo guardar.');
    }
  }

  async function usarDelMesAnterior() {
    try {
      const anterior = await obtenerSaldoDeseado(empresaId, periodoAnterior(periodo));
      setTexto(String(anterior));
      await guardar(anterior);
    } catch {
      setError(esPT ? 'Não foi possível carregar o mês anterior.' : 'No se pudo cargar el mes anterior.');
    }
  }

  // La diferencia sale de lo escrito, así informa aunque todavía no se haya podido guardar.
  const valorEscrito = Number(texto.replace(',', '.'));
  const diferencia = Number.isFinite(valorEscrito) && valorEscrito > 0 ? diferenciaConSaldoDeseado(saldoFinal, valorEscrito) : null;

  return (
    <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13.5, fontWeight: 800, color: COLORES.azul }} htmlFor="saldo-deseado">
          {esFamiliar ? (esPT ? 'Colchão do mês' : 'Colchón del mes') : esPT ? 'Saldo desejado' : 'Saldo deseado'}
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: COLORES.gris, fontWeight: 700 }}>{simbolo}</span>
          <input
            id="saldo-deseado"
            type="text"
            inputMode="decimal"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => guardar(Number(texto.replace(',', '.')))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            style={{ ...campoInput, width: 150, textAlign: 'right' }}
          />
        </div>
      </div>

      {guardado === 0 && (
        <button
          type="button"
          onClick={usarDelMesAnterior}
          style={{ marginTop: 8, border: 'none', background: 'transparent', color: COLORES.azul, textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5, padding: 0 }}
        >
          {esPT ? 'Usar o do mês anterior' : 'Usar el del mes anterior'}
        </button>
      )}

      {esFamiliar && sugerido > 0 && (
        <button
          type="button"
          onClick={() => {
            setTexto(String(sugerido));
            guardar(sugerido);
          }}
          style={{ marginTop: 8, marginLeft: guardado === 0 ? 14 : 0, border: 'none', background: 'transparent', color: COLORES.azul, textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5, padding: 0 }}
        >
          {esPT ? `Sugerir: 1 mês de gastos (${simbolo} ${formatearNumeroEntero(sugerido)})` : `Sugerir: 1 mes de gastos (${simbolo} ${formatearNumeroEntero(sugerido)})`}
        </button>
      )}

      {diferencia && (
        <div
          style={{
            marginTop: 10,
            fontWeight: 800,
            fontSize: 15,
            color: diferencia.tipo === 'FALTA' ? '#dc2626' : COLORES.verde,
          }}
        >
          {diferencia.tipo === 'FALTA'
            ? `${esFamiliar ? (esPT ? 'Falta para o seu colchão' : 'Te falta para tu colchón') : esPT ? 'Falta para chegar' : 'Falta para llegar'}: ${simbolo} ${formatearNumeroEntero(diferencia.monto)}`
            : diferencia.tipo === 'SOBRA'
              ? `${esFamiliar ? (esPT ? 'Você pode destinar à poupança ou investimento' : 'Podés destinar a ahorro o inversión') : esPT ? 'Disponível para aplicar' : 'Disponible para aplicar'}: ${simbolo} ${formatearNumeroEntero(diferencia.monto)}`
              : esPT
                ? esFamiliar ? 'Seu colchão está exatamente coberto.' : 'Você está exatamente no saldo desejado.'
                : esFamiliar ? 'Tu colchón está justo cubierto.' : 'Estás justo en el saldo deseado.'}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11.5, color: COLORES.gris }}>
        {esPT ? 'Informativo: não gera lançamentos. Cada mês tem o seu.' : 'Informativo: no genera asientos. Cada mes tiene el suyo.'}
      </div>

      {error && <div style={{ marginTop: 6, fontSize: 12.5, color: '#dc2626' }}>{error}</div>}
    </div>
  );
}

/* ==========================================================
   PESTAÑA · FLUJO DE CAJA
========================================================== */

function FlujoDeCajaTab({
  hojas,
  asientos,
  nombresMedioFinanciero,
  nombresPorCobrar,
  periodoInicial,
  empresaId,
  esFamiliar,
}: {
  hojas: CuentaPlan[];
  asientos: Asiento[];
  nombresMedioFinanciero: Set<string>;
  nombresPorCobrar: Set<string>;
  periodoInicial: string;
  empresaId: string | null;
  esFamiliar: boolean;
}) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const esPT = idioma === 'PT';
  const t = crearTraductor(diccionarioInformes, idioma);
  // "Cuenta de caja" = cualquier cuenta que sea de verdad un medio
  // financiero (está vinculada a una forma de pago activa), no una
  // adivinanza por el código del Plan de Cuentas — bancos agregados a
  // mano (ej. "Banco Bradesco") pueden quedar con un código fuera de
  // "1.1.1." según cómo se hayan creado, y con el prefijo viejo el
  // sistema no los reconocía como caja: una transferencia hacia/desde
  // esas cuentas se contaba como entrada Y salida real de plata en vez
  // de excluirse como movimiento interno.
  const cuentasCaja = useMemo(
    () => hojas.filter((c) => nombresMedioFinanciero.has(c.nombre)),
    [hojas, nombresMedioFinanciero]
  );

  const nombresCaja = useMemo(() => new Set(cuentasCaja.map((c) => c.nombre)), [cuentasCaja]);

  const periodos = useMemo(() => obtenerPeriodos(asientos, idioma, periodoInicial), [asientos, idioma, periodoInicial]);
  const [periodo, setPeriodo] = useState(/^\d{4}-\d{2}$/.test(periodoInicial) ? periodoInicial : mesEnCurso());
  const esTodos = periodo === 'TODOS';

  // El saldo de caja actual es siempre acumulado a la fecha — no
  // depende del período elegido, igual que "Caja disponible" en el
  // Panel de Control.
  const saldoCajaActual = useMemo(
    () => cuentasCaja.reduce((s, c) => s + calcularMovimiento(c, asientos, true).saldoFinal, 0),
    [cuentasCaja, asientos]
  );

  const asientosDelPeriodo = useMemo(
    () => (esTodos ? asientos : asientos.filter((a) => a.fecha.slice(0, 7) === periodo)),
    [asientos, periodo, esTodos]
  );

  // Cobrar una cuenta a cobrar ("Casita a cobrar") es plata que entra por el ingreso
  // con el que se devengó ("Alquiler Argentina"): las entradas se agrupan por ese
  // ingreso y no por el nombre de la cuenta a cobrar. Solo cuando todos los
  // devengos de esa cuenta fueron al mismo ingreso; si no, se deja la cuenta.
  const ingresoDeCuentaPorCobrar = useMemo(() => {
    const nombresIngreso = new Set(hojas.filter((c) => c.tipo_saldo === 'INGRESO').map((c) => c.nombre));
    const ingresosPorCuenta = new Map<string, Set<string>>();

    for (const a of asientos) {
      if (a.debito && a.credito && nombresPorCobrar.has(a.debito) && nombresIngreso.has(a.credito)) {
        ingresosPorCuenta.set(a.debito, (ingresosPorCuenta.get(a.debito) ?? new Set<string>()).add(a.credito));
      }
    }

    const mapa = new Map<string, string>();
    for (const [cuenta, ingresos] of ingresosPorCuenta) {
      if (ingresos.size === 1) mapa.set(cuenta, Array.from(ingresos)[0]);
    }
    return mapa;
  }, [hojas, asientos, nombresPorCobrar]);

  const clasificar = useMemo(() => crearClasificador(hojas, asientos, nombresCaja, esFamiliar), [hojas, asientos, nombresCaja, esFamiliar]);

  const flujo = useMemo(
    () =>
      armarFlujo(
        movimientosDeCaja(asientosDelPeriodo, nombresCaja),
        clasificar,
        (contraparte) => (contraparte && ingresoDeCuentaPorCobrar.get(contraparte)) || contraparte
      ),
    [asientosDelPeriodo, nombresCaja, clasificar, ingresoDeCuentaPorCobrar]
  );

  const nombreFila = (nombre: string) => (nombre === '__OTRO__' ? t('otro') : nombre);
  const filas = (lista: { nombre: string; valor: number }[]) => lista.map((f) => ({ nombre: nombreFila(f.nombre), valor: f.valor }));

  const saldoInicial = useMemo(() => saldoInicialDePeriodo(cuentasCaja, asientos, periodo), [cuentasCaja, asientos, periodo]);
  const flujoNeto = flujo.neto;
  const saldoFinal = saldoInicial + flujoNeto;

  // Familia: Entradas y Salidas simples; lo que va a bienes, ahorro e inversión queda aparte.
  const familia = useMemo(() => {
    const juntar = (lado: 'entradas' | 'salidas') => {
      const mapa = new Map<string, number>();
      for (const b of BLOQUES_FLUJO) {
        if (b === 'INVERSION' || b === 'BIENES') continue;
        for (const f of flujo.bloques[b][lado]) mapa.set(f.nombre, (mapa.get(f.nombre) ?? 0) + f.valor);
      }
      return Array.from(mapa.entries())
        .map(([nombre, valor]) => ({ nombre, valor }))
        .sort((a, b) => b.valor - a.valor);
    };
    const entradas = juntar('entradas');
    const salidas = juntar('salidas');
    return {
      entradas,
      salidas,
      totalEntradas: entradas.reduce((s, f) => s + f.valor, 0),
      totalSalidas: salidas.reduce((s, f) => s + f.valor, 0),
    };
  }, [flujo]);

  // Familia: cuánto hay guardado en Ahorros e Inversiones (1.2) y cuánto se ahorró del ingreso.
  const cuentasAhorro = useMemo(() => (esFamiliar ? hojas.filter((c) => (c.codigo ?? '').startsWith('1.2.')) : []), [esFamiliar, hojas]);
  const ahorroInicial = useMemo(() => saldoInicialDePeriodo(cuentasAhorro, asientos, periodo), [cuentasAhorro, asientos, periodo]);
  const ahorroFinal = useMemo(() => saldoAlCierreDePeriodo(cuentasAhorro, asientos, periodo), [cuentasAhorro, asientos, periodo]);
  const ingresosDelPeriodo = flujo.bloques.COMERCIAL.totalEntradas;
  const ahorradoNeto = flujo.bloques.INVERSION.totalSalidas - flujo.bloques.INVERSION.totalEntradas;
  const tasaAhorro = ingresosDelPeriodo > 0 ? (ahorradoNeto / ingresosDelPeriodo) * 100 : null;

  const colchonSugerido = useMemo(
    () => (esFamiliar ? promedioSalidasMensuales(movimientosDeCaja(asientos, nombresCaja), clasificar, periodo) : 0),
    [esFamiliar, asientos, nombresCaja, clasificar, periodo]
  );

  const tituloBloque: Record<BloqueFlujo, { emoji: string; actividades: string; flujo: string }> = {
    COMERCIAL: {
      emoji: '🛒',
      actividades: esPT ? 'Atividades comerciais' : 'Actividades comerciales',
      flujo: esPT ? 'Fluxo comercial' : 'Flujo comercial',
    },
    OPERATIVO: {
      emoji: '⚙️',
      actividades: esPT ? 'Atividades operacionais' : 'Actividades operativas',
      flujo: esPT ? 'Fluxo operacional' : 'Flujo operativo',
    },
    INVERSION: {
      emoji: '🏦',
      actividades: esPT ? 'Atividades de investimento' : 'Actividades de inversión',
      flujo: esPT ? 'Fluxo de investimento' : 'Flujo de inversión',
    },
    FINANCIERO: {
      emoji: '💳',
      actividades: esPT ? 'Atividades financeiras' : 'Actividades financieras',
      flujo: esPT ? 'Fluxo financeiro' : 'Flujo financiero',
    },
    BIENES: {
      emoji: '🏠',
      actividades: esPT ? 'Bens e propriedades' : 'Bienes y propiedades',
      flujo: esPT ? 'Fluxo de bens' : 'Flujo de bienes',
    },
    OTROS: {
      emoji: '📌',
      actividades: esPT ? 'Outros' : 'Otros',
      flujo: esPT ? 'Outros fluxos' : 'Otros flujos',
    },
  };

  // Entradas y salidas de todos los bloques en una sola lista (Familia ya trae las suyas, sin ahorro ni bienes).
  const juntarTodo = (lado: 'entradas' | 'salidas') => {
    const mapa = new Map<string, number>();
    for (const b of BLOQUES_FLUJO) for (const f of flujo.bloques[b][lado]) mapa.set(f.nombre, (mapa.get(f.nombre) ?? 0) + f.valor);
    return Array.from(mapa.entries()).map(([nombre, valor]) => ({ nombre, valor }));
  };
  const totalEntradas = esFamiliar ? familia.totalEntradas : flujo.totalEntradas;
  const totalSalidas = esFamiliar ? familia.totalSalidas : flujo.totalSalidas;
  const serie = useMemo(
    () => serieFlujo(movimientosDeCaja(asientos, nombresCaja), (clave) => saldoAlCierreDePeriodo(cuentasCaja, asientos, clave)),
    [asientos, nombresCaja, cuentasCaja]
  );
  const dinero = (n: number) => `${simbolo} ${formatearNumeroEntero(n)}`;
  const netoBienes = flujo.bloques.BIENES.neto;

  const filasResumen: FilaResumen[] = [
    { etiqueta: esPT ? 'Saldo inicial' : 'Saldo inicial', valor: saldoInicial, signo: '' },
    { etiqueta: esPT ? 'Total de entradas' : 'Total de entradas', valor: totalEntradas, signo: '+' },
    { etiqueta: esPT ? 'Total de saídas' : 'Total de salidas', valor: totalSalidas, signo: '-' },
    ...(esFamiliar ? [
      { etiqueta: esPT ? 'Aportes líquidos a poupança e investimento' : 'Aportes netos a ahorro e inversión', valor: ahorradoNeto, signo: '-' as const },
      ...(netoBienes !== 0 ? [{ etiqueta: esPT ? 'Compras menos vendas de bens' : 'Compras menos ventas de bienes', valor: -netoBienes, signo: '-' as const }] : []),
    ] : []),
    { etiqueta: esPT ? 'Saldo final' : 'Saldo final', valor: saldoFinal, signo: '', destacada: true },
  ];

  const fila = (etiqueta: string, valor: number, destacada = false) => (
    <div key={etiqueta} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, fontWeight: destacada ? 800 : 500, padding: destacada ? '8px 10px' : 0, borderRadius: 10, background: destacada ? '#dbeafe' : 'transparent' }}>
      <span>{etiqueta}</span>
      <span style={{ whiteSpace: 'nowrap', color: valor < 0 ? '#dc2626' : COLORES.azul }}>{dinero(valor)}</span>
    </div>
  );

  const extras = (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', marginBottom: 14 }}>
      {esFamiliar ? (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <img className="dre-sabio-tarjeta" src="/sabio/sabio-alcancia.webp" alt="" style={{ height: 96, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 800, color: COLORES.azul, fontSize: 16 }}>🏦 {esPT ? 'Poupança e investimento' : 'Ahorro e inversión'}</div>
            {fila(esPT ? 'Você aplicou' : 'Aportaste', flujo.bloques.INVERSION.totalSalidas)}
            {fila(esPT ? 'Você resgatou' : 'Rescataste', flujo.bloques.INVERSION.totalEntradas)}
            {fila(esPT ? '= Você poupou neste período' : '= Ahorraste en el período', ahorradoNeto, true)}
            {tasaAhorro !== null && <div style={{ fontSize: 12.5, color: COLORES.azul, fontWeight: 700 }}>{esPT ? 'Taxa de poupança' : 'Tasa de ahorro'}: {tasaAhorro.toFixed(1)}% {esPT ? 'da sua renda' : 'de tus ingresos'}</div>}
            {fila(esPT ? 'Poupança — início do período' : 'Ahorros — inicio del período', ahorroInicial)}
            {fila(esPT ? 'Poupança — fim do período' : 'Ahorros — cierre del período', ahorroFinal)}
            {fila(esPT ? 'Dinheiro líquido total (disponível + poupança)' : 'Plata líquida total (disponible + ahorros)', saldoFinal + ahorroFinal, true)}
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 14 }}>
          <div style={{ fontWeight: 800, color: COLORES.azul, fontSize: 16, marginBottom: 8 }}>⚙️ {esPT ? 'Fluxo por atividade' : 'Flujo por actividad'}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {BLOQUES_FLUJO.filter((b) => (b !== 'OTROS' && b !== 'BIENES') || flujo.bloques[b].entradas.length > 0 || flujo.bloques[b].salidas.length > 0).map((b) => fila(`${tituloBloque[b].emoji} ${tituloBloque[b].flujo}`, flujo.bloques[b].neto))}
          </div>
        </div>
      )}
      {empresaId && !esTodos && (
        <div style={{ minWidth: 0 }}>
          <SaldoDeseado empresaId={empresaId} periodo={periodo} saldoFinal={saldoFinal} esPT={esPT} esFamiliar={esFamiliar} sugerido={colchonSugerido} />
        </div>
      )}
    </div>
  );

  return (
    <div id="informe-imprimible">
      <FlujoVisual
        pt={esPT}
        esFamiliar={esFamiliar}
        simbolo={simbolo}
        periodos={periodos}
        periodo={periodo}
        onPeriodo={setPeriodo}
        etiquetaPeriodo={esTodos ? t('todosLosPeriodos') : formatearPeriodo(periodo, idioma)}
        cajaHoy={saldoCajaActual}
        saldoInicial={saldoInicial}
        entradas={totalEntradas}
        salidas={totalSalidas}
        saldoFinal={saldoFinal}
        neto={flujoNeto}
        serie={serie}
        etiquetaMes={(clave) => formatearPeriodoCorto(clave, idioma)}
        etiquetaMesLarga={(clave) => formatearPeriodo(clave, idioma)}
        filasEntradas={filas(esFamiliar ? familia.entradas : juntarTodo('entradas'))}
        filasSalidas={filas(esFamiliar ? familia.salidas : juntarTodo('salidas'))}
        filasResumen={filasResumen}
        extras={extras}
      />
    </div>
  );
}

/* ==========================================================
   PESTAÑA · INTERPRETACIÓN
========================================================== */

function InterpretacionTab({
  empresaId,
  nombreEmpresa,
  nombreUsuario,
  cuentas,
  hojas,
  asientos,
  asientosBalance,
  nombresMedioFinanciero,
  nombresPorCobrar,
  esFamiliar,
}: {
  empresaId: string | null;
  nombreEmpresa: string;
  nombreUsuario: string;
  cuentas: CuentaPlan[];
  hojas: CuentaPlan[];
  asientos: Asiento[];
  asientosBalance: Asiento[];
  nombresMedioFinanciero: Set<string>;
  nombresPorCobrar: Set<string>;
  esFamiliar: boolean;
}) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const pt = idioma === 'PT';
  const periodos = useMemo(() => obtenerPeriodos(asientos, idioma), [asientos, idioma]);
  const [periodo, setPeriodo] = useState(mesEnCurso());
  const etiquetaPeriodo = formatearPeriodo(periodo, idioma);

  // La conversación en vivo: el mismo cálculo de cada informe, puesto en palabras. Es lo que se guarda al generar.
  const datos = useMemo(
    () =>
      reunirDatos({
        pt,
        esFamiliar,
        periodo,
        etiquetaPeriodo,
        dinero: (n) => `${simbolo} ${formatearNumeroEntero(n)}`,
        cuentas,
        hojas,
        asientos,
        asientosBalance,
        nombresMedioFinanciero,
        nombresPorCobrar,
        nombreDeCuenta: (n) => nombreCuentaDisplay(idioma, n),
        etiquetaMes: (clave) => formatearPeriodo(clave, idioma),
      }),
    [pt, esFamiliar, periodo, etiquetaPeriodo, simbolo, cuentas, hojas, asientos, asientosBalance, nombresMedioFinanciero, nombresPorCobrar, idioma]
  );
  const vivo = useMemo(() => armarConversacion(datos, { nombre: nombreUsuario || (pt ? 'tudo bem' : 'Sabio'), empresa: nombreEmpresa }), [datos, nombreUsuario, nombreEmpresa, pt]);
  const huella = useMemo(() => huellaDeDatos(datos), [datos]);

  const [historial, setHistorial] = useState<VersionGuardada[]>([]);
  const [guardada, setGuardada] = useState<VersionConContenido | null>(null);
  const [verVersion, setVerVersion] = useState<VersionConContenido | null>(null);
  const [generando, setGenerando] = useState(false);
  const [sePuedeGuardar, setSePuedeGuardar] = useState(true);

  const refrescarHistorial = useCallback(async () => {
    if (empresaId) setHistorial(await listarVersiones(empresaId));
  }, [empresaId]);

  // Al elegir un mes: si ya hay una interpretación guardada se muestra esa; si no, se ve la conversación en vivo al instante y queda en el
  // historial recién cuando se toca «Generar».
  useEffect(() => {
    if (!empresaId) return;
    let vigente = true;
    setVerVersion(null);
    void (async () => {
      const ultima = await ultimaVersion(empresaId, periodo);
      if (!vigente) return;
      setGuardada(ultima);
      await refrescarHistorial();
    })();
    return () => { vigente = false; };
  }, [empresaId, periodo, refrescarHistorial]);

  const generar = async () => {
    if (!empresaId || generando) return;
    setGenerando(true);
    setVerVersion(null);
    const ok = await guardarVersion(empresaId, periodo, vivo, huella, 'MANUAL');
    setSePuedeGuardar(ok);
    if (ok) {
      setGuardada(await ultimaVersion(empresaId, periodo));
      await refrescarHistorial();
    }
    setGenerando(false);
  };

  const abrirVersion = async (id: string) => {
    const v = await versionPorId(id);
    if (v) {
      if (v.periodo !== periodo) setPeriodo(v.periodo);
      setVerVersion(v);
    }
  };

  // Qué se muestra: una versión del historial, la guardada del mes, o la conversación en vivo.
  const mostrada = verVersion ? verVersion.contenido : guardada ? guardada.contenido : vivo;
  const estado: EstadoVista = verVersion
    ? { tipo: 'historial', version: verVersion.version, generadoEn: verVersion.generado_en, periodoEtiqueta: formatearPeriodo(verVersion.periodo, idioma) }
    : guardada
      ? { tipo: 'guardada', version: guardada.version, generadoEn: guardada.generado_en, hayCambios: guardada.huella !== huella }
      : { tipo: 'vivo' };

  return (
    <div id="informe-imprimible">
      <InterpretacionVisual
        conversacion={mostrada}
        estado={estado}
        empresa={nombreEmpresa}
        periodos={periodos}
        periodo={periodo}
        onPeriodo={setPeriodo}
        onGenerar={generar}
        generando={generando}
        guardado={sePuedeGuardar}
        historial={historial}
        etiquetaDe={(clave) => formatearPeriodo(clave, idioma)}
        onVerVersion={abrirVersion}
        onVolver={() => setVerVersion(null)}
        pt={pt}
        etiquetaPeriodo={etiquetaPeriodo}
      />
    </div>
  );
}

/* ==========================================================
   PESTAÑA · BALANCE PATRIMONIAL
========================================================== */

function BalancePatrimonialTab({
  cuentas,
  hojas,
  asientos: asientosTodos,
}: {
  cuentas: CuentaPlan[];
  hojas: CuentaPlan[];
  asientos: Asiento[];
}) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioInformes, idioma);
  const [mostrarCeros, setMostrarCeros] = useState(false);
  const [nivel, setNivel] = useVistaInforme();
  const esPT = idioma === 'PT';
  // El balance es una foto a una fecha: se acumula todo hasta el cierre del mes elegido.
  const periodos = useMemo(() => obtenerPeriodos(asientosTodos, idioma), [asientosTodos, idioma]);
  const [periodo, setPeriodo] = useState(mesEnCurso());
  const asientos = useMemo(() => asientosTodos.filter((a) => a.fecha.slice(0, 7) <= periodo), [asientosTodos, periodo]);

  // Evolución patrimonial: el balance al cierre de cada mes con movimiento (hasta el último), por la misma regla que el balance.
  const serieBalance = useMemo(() => {
    const meses = Array.from(new Set(asientosTodos.map((a) => a.fecha.slice(0, 7)).filter(Boolean))).sort();
    return meses.map((clave) => ({ clave, etiqueta: formatearPeriodoCorto(clave, idioma), etiquetaLarga: formatearPeriodo(clave, idioma), ...totalesBalance(hojas, asientosTodos.filter((a) => a.fecha.slice(0, 7) <= clave)) }));
  }, [asientosTodos, hojas, idioma]);

  // Agrupa cada cuenta hoja bajo el nombre de su cuenta padre directa
  // (ej. "Caja"/"PIX" bajo "ATIVO CIRCULANTE"), para mostrar el balance
  // con la misma estructura que tiene el Plan de Cuentas.
  function nombreGrupo(cuenta: CuentaPlan): string {
    if (!cuenta.cuenta_padre_id) return cuenta.nombre;
    const padre = cuentas.find((c) => c.id === cuenta.cuenta_padre_id);
    return padre ? padre.nombre : cuenta.nombre;
  }

  function bloque(tipo: string) {
    // Casi todas las cuentas de un tipo comparten naturaleza (ej. todo
    // PATRIMONIO es ACREEDORA), pero puede haber alguna "contra"
    // adrede con la naturaleza opuesta (ej. Retiro Personal es
    // PATRIMONIO pero DEUDORA, porque resta patrimonio en vez de
    // sumarlo). calcularMovimiento() ya da el saldo en la dirección
    // PROPIA de cada cuenta — acá se lleva a la dirección del GRUPO
    // (negando las que van al revés) para que tanto cada fila como el
    // total reflejen correctamente si suman o restan del bloque.
    const naturalezaDelBloque = tipo === 'PASIVO' || tipo === 'PATRIMONIO' ? 'ACREEDORA' : 'DEUDORA';

    const filas = hojas
      .map((cuenta) => {
        const movimiento = calcularMovimiento(cuenta, asientos, true);
        const signo = cuenta.naturaleza === naturalezaDelBloque ? 1 : -1;

        return {
          cuenta,
          grupo: nombreGrupo(cuenta),
          ...movimiento,
          saldoFinal: movimiento.saldoFinal * signo,
        };
      })
      .filter((fila) => fila.cuenta.tipo_saldo === tipo);

    // El total siempre suma TODAS las cuentas del tipo (los ceros no
    // aportan nada), pero las filas que se muestran sí respetan el
    // interruptor de "mostrar cuentas en cero".
    const total = filas.reduce((s, f) => s + f.saldoFinal, 0);

    // Comparar contra el valor redondeado (no el exacto): un saldo de
    // centavos como R$ 0,30 se muestra como "R$ 0" (formatearNumeroEntero
    // redondea), así que si se ocultan los ceros tiene que desaparecer
    // también — si no, queda una fila que dice "0" a la vista pero el
    // interruptor no la contó como cero.
    const filasVisibles = mostrarCeros ? filas : filas.filter((f) => Math.round(f.saldoFinal) !== 0);

    const grupos = new Map<string, typeof filas>();

    for (const fila of filasVisibles) {
      const lista = grupos.get(fila.grupo) ?? [];
      lista.push(fila);
      grupos.set(fila.grupo, lista);
    }

    return { grupos, total };
  }

  const activo = bloque('ACTIVO');
  const pasivo = bloque('PASIVO');
  const patrimonio = bloque('PATRIMONIO');

  // Ganancia o pérdida del ejercicio, todavía no cerrada contra
  // "Lucros Acumulados" — se muestra como una línea más del Patrimonio,
  // para que Activo = Pasivo + Patrimonio siga cerrando.
  const resultadoDelEjercicio =
    hojas.filter((c) => c.tipo_saldo === 'INGRESO').reduce((s, c) => s + calcularMovimiento(c, asientos, true).saldoFinal, 0) -
    hojas.filter((c) => c.tipo_saldo === 'COSTO').reduce((s, c) => s + calcularMovimiento(c, asientos, true).saldoFinal, 0) -
    hojas.filter((c) => c.tipo_saldo === 'GASTO').reduce((s, c) => s + calcularMovimiento(c, asientos, true).saldoFinal, 0);

  const totalPatrimonioConResultado = patrimonio.total + resultadoDelEjercicio;
  const totalPasivoYPatrimonio = pasivo.total + totalPatrimonioConResultado;
  const diferencia = activo.total - totalPasivoYPatrimonio;

  const soloGrupos = nivel === 'SIMPLE';
  const cierra = Math.abs(diferencia) < 0.01;
  const totalGrupo = (grupos: Map<string, { saldoFinal: number }[]>) => Array.from(grupos.entries()).map(([nombre, filas]) => ({ nombre: nombreCuentaDisplay(idioma, nombre), valor: filas.reduce((acc, f) => acc + f.saldoFinal, 0) }));

  return (
    <div id="informe-imprimible">
      <BalanceVisual
        pt={esPT}
        simbolo={simbolo}
        periodos={periodos}
        periodo={periodo}
        onPeriodo={setPeriodo}
        selectorVista={<ToggleVistaInforme vista={nivel} onChange={setNivel} esPT={esPT} />}
        totales={{ activo: activo.total, pasivo: pasivo.total, patrimonio: totalPatrimonioConResultado, resultado: resultadoDelEjercicio }}
        serie={serieBalance}
        gruposActivo={totalGrupo(activo.grupos)}
        activoNode={<BloqueBalance titulo={t('activoTitulo')} emoji="💚" grupos={activo.grupos} total={activo.total} color={COLORES.verde} soloGrupos={soloGrupos} />}
        pasivoNode={
          <div>
            <BloqueBalance titulo={t('pasivoTitulo')} emoji="💗" grupos={pasivo.grupos} total={pasivo.total} color="#b91c1c" soloGrupos={soloGrupos} />

            <div style={{ height: 14 }} />

            <BloqueBalance
              titulo={t('patrimonioTitulo')}
              emoji="💙"
              grupos={patrimonio.grupos}
              total={patrimonio.total}
              color={COLORES.azul}
              filaExtra={{ nombre: t('resultadoEjercicioNoCerrado'), valor: resultadoDelEjercicio }}
              soloGrupos={soloGrupos}
            />
          </div>
        }
        pie={
          <>
            <div style={{ marginBottom: 12 }} className="dre-no-imprimir">
              <BotonToggle activo={mostrarCeros} onClick={() => setMostrarCeros((actual) => !actual)} etiquetaActivo={t('ocultarCerosEnCero')} etiquetaInactivo={t('mostrarCerosEnCero')} />
            </div>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                background: cierra ? '#eaf7ee' : '#fef2f2',
                color: cierra ? '#247347' : '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <img className="dre-sabio-tarjeta" src={`/sabio/${cierra ? 'sabio-escudo' : 'sabio-alerta'}.webp`} alt="" style={{ height: 52, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              <span>
              {cierra
                ? msgEcuacionCierra(idioma, `${simbolo} ${formatearNumeroEntero(activo.total)}`, `${simbolo} ${formatearNumeroEntero(totalPasivoYPatrimonio)}`)
                : msgEcuacionNoCierra(idioma, `${simbolo} ${formatearNumeroEntero(diferencia)}`, `${simbolo} ${formatearNumeroEntero(activo.total)}`, `${simbolo} ${formatearNumeroEntero(totalPasivoYPatrimonio)}`)}
              {cierra && <span style={{ marginLeft: 10 }}>✓ {esPT ? 'Balanço em equilíbrio!' : '¡Balance en equilibrio!'}</span>}
              </span>
            </div>
          </>
        }
      />
    </div>
  );
}

function BloqueBalance({
  titulo,
  emoji,
  grupos,
  total,
  color,
  filaExtra,
  soloGrupos = false,
}: {
  titulo: string;
  emoji: string;
  grupos: Map<string, { cuenta: CuentaPlan; saldoFinal: number }[]>;
  total: number;
  color: string;
  filaExtra?: { nombre: string; valor: number };
  // Vista simplificada: solo cada grupo con su subtotal, sin las cuentas.
  soloGrupos?: boolean;
}) {
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());
  const alternar = (grupo: string) => setCerrados((previo) => { const n = new Set(previo); if (n.has(grupo)) n.delete(grupo); else n.add(grupo); return n; });
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioInformes, idioma);
  const entradas = Array.from(grupos.entries());

  // En vertical (columna angosta) el nombre de la cuenta + el monto
  // pueden ser más anchos que la pantalla — antes se cortaban porque
  // el contenedor tenía overflow:hidden y las filas no tenían scroll
  // propio. Ahora cada zona con filas se desplaza horizontalmente
  // (overflowX:auto) y los montos no se comprimen (whiteSpace:nowrap
  // + flexShrink:0), así nunca se pierde un dato, solo hay que
  // deslizar el dedo para verlo completo.
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
      <div
        style={{
          padding: '12px 16px',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <strong style={{ color: COLORES.azul, fontSize: 14, whiteSpace: 'nowrap' }}>
          {emoji} {titulo}
        </strong>

        <strong style={{ color, fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>{simbolo} {formatearNumeroEntero((total + (filaExtra?.valor ?? 0)))}</strong>
      </div>

      <div style={{ padding: '4px 0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {entradas.map(([grupo, filas]) => (
          <div key={grupo} style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={() => alternar(grupo)}
              aria-expanded={!soloGrupos && !cerrados.has(grupo)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 16, width: '100%', border: 'none', background: 'none', padding: 0, marginBottom: 4, cursor: 'pointer', fontSize: 13, fontWeight: 800, color: COLORES.azul, textAlign: 'left' }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>{soloGrupos || cerrados.has(grupo) ? '▸' : '▾'} {nombreCuentaDisplay(idioma, grupo)}</span>
              <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{simbolo} {formatearNumeroEntero(filas.reduce((acc, f) => acc + f.saldoFinal, 0))}</span>
            </button>

            {!soloGrupos && !cerrados.has(grupo) && filas.map((fila) => (
              <div
                key={fila.cuenta.id}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', gap: 16 }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>{nombreCuentaDisplay(idioma, fila.cuenta.nombre)}</span>
                <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{simbolo} {formatearNumeroEntero(fila.saldoFinal)}</span>
              </div>
            ))}
          </div>
        ))}

        {filaExtra && (
          <div
            style={{
              margin: '8px 12px 4px',
              padding: '9px 12px',
              borderRadius: 10,
              background: filaExtra.valor >= 0 ? '#eaf7ee' : '#fef2f2',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 800,
              gap: 16,
              color: filaExtra.valor >= 0 ? '#247347' : '#dc2626',
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>{filaExtra.nombre}</span>
            <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{simbolo} {formatearNumeroEntero(filaExtra.valor)}</span>
          </div>
        )}

        {!entradas.length && !filaExtra && (
          <div style={{ padding: 16, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>
            {t('sinCuentasMovimiento')}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================
   COMPONENTES COMPARTIDOS
========================================================== */

function tabStyle(activa: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    padding: '12px 18px',
    color: activa ? COLORES.verde : COLORES.gris,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    borderBottom: activa ? `3px solid ${COLORES.verde}` : '3px solid transparent',
    marginBottom: -1,
  };
}

function BotonToggle({
  activo,
  onClick,
  etiquetaActivo,
  etiquetaInactivo,
}: {
  activo: boolean;
  onClick: () => void;
  etiquetaActivo: string;
  etiquetaInactivo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        border: `1px solid ${activo ? COLORES.azul : '#d1d5db'}`,
        background: activo ? `${COLORES.azul}12` : COLORES.blanco,
        color: activo ? COLORES.azul : COLORES.gris,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {activo ? `👁️ ${etiquetaActivo}` : `🙈 ${etiquetaInactivo}`}
    </button>
  );
}

/* ==========================================================
   ESTILOS
========================================================== */

const fondo: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--fondo-app, radial-gradient(circle at top left, #e7f1ed 0%, transparent 34%), #f4f7f8)',
  padding: '28px 24px 48px',
};

const encabezado: React.CSSProperties = {
  background: 'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
  borderRadius: 24,
  padding: '28px 34px',
  color: COLORES.blanco,
  marginBottom: 24,
  boxShadow: '0 18px 40px rgba(20,42,71,0.16)',
};

const volver: React.CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: 18,
};

const eyebrow: React.CSSProperties = {
  color: '#86efac',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.4,
  marginBottom: 8,
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 26,
  boxShadow: '0 14px 36px rgba(31,58,95,0.10)',
  overflow: 'hidden',
};

const campoInput: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid #d6dee5',
  background: '#fbfcfd',
  color: '#1f2937',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

const pieFila: React.CSSProperties = {
  background: '#f1f5f9',
  borderTop: '2px solid #d6dee5',
};

const errorStyle: React.CSSProperties = {
  background: '#fef2f2',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 12,
  padding: '11px 14px',
  marginBottom: 18,
  fontSize: 13,
};

const cargandoStyle: React.CSSProperties = {
  padding: 30,
  textAlign: 'center',
  color: COLORES.gris,
};
