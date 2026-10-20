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

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BLOQUES_FLUJO, armarFlujo, crearClasificador, diferenciaConSaldoDeseado, movimientosDeCaja, promedioSalidasMensuales, saldoAlCierreDePeriodo, saldoInicialDePeriodo, type BloqueFlujo } from '@/lib/flujoCaja';
import { guardarSaldoDeseado, obtenerSaldoDeseado, periodoAnterior } from '@/lib/flujoCajaMeta';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { VolverLobby } from '@/components/nav/VolverLobby';
import { supabase } from '@/lib/supabase';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { ResultadoPorNaturaleza } from '@/components/informes/ResultadoPorNaturaleza';
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

type Pestana = 'mayor' | 'flujo' | 'resultado' | 'sumas' | 'balance';

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

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('empresa_id, tipo_usuario')
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
        .select('moneda, idioma, perfiles_empresa(codigo)')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      const relacionPerfil = empresaData?.perfiles_empresa as { codigo: string }[] | { codigo: string } | null | undefined;
      setEsFamiliar((Array.isArray(relacionPerfil) ? relacionPerfil[0]?.codigo : relacionPerfil?.codigo) === 'FAMILIAR');
      setMoneda(empresaData?.moneda ?? null);
      setIdioma(empresaData?.idioma ?? null);

      const [
        { data: cuentasData, error: errorCuentas },
        { data: operacionesData, error: errorOperaciones },
        { data: automaticosData, error: errorAutomaticos },
        { data: formaPagoCuentasData, error: errorFormaPagoCuentas },
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
            <button type="button" onClick={() => setPestana('mayor')} style={tabStyle(pestana === 'mayor')}>
              {t('tabMayor')}
            </button>

            <button type="button" onClick={() => setPestana('flujo')} style={tabStyle(pestana === 'flujo')}>
              {t('tabFlujo')}
            </button>

            <button
              type="button"
              onClick={() => setPestana('resultado')}
              style={tabStyle(pestana === 'resultado')}
            >
              {t('tabResultado')}
            </button>

            <button type="button" onClick={() => setPestana('sumas')} style={tabStyle(pestana === 'sumas')}>
              {t('tabSumas')}
            </button>

            <button
              type="button"
              onClick={() => setPestana('balance')}
              style={tabStyle(pestana === 'balance')}
            >
              {t('tabBalance')}
            </button>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          {cargando ? (
            <div style={cargandoStyle}>{t('cargandoInformes')}</div>
          ) : (
            <>
              {pestana === 'mayor' && <MayorTab hojas={hojas} asientos={asientos} cuentaInicial={cuentaInicial} />}
              {pestana === 'sumas' && <SumasYSaldosTab hojas={hojas} asientos={asientos} />}
              {pestana === 'flujo' && (
                <FlujoDeCajaTab hojas={hojas} asientos={asientos} nombresMedioFinanciero={nombresMedioFinanciero} nombresPorCobrar={nombresPorCobrar} periodoInicial={periodoInicial} empresaId={empresaId} esFamiliar={esFamiliar} />
              )}
              {pestana === 'resultado' && <EstadoDeResultadoTab hojas={hojas} asientos={asientos} empresaId={empresaId} periodoInicial={periodoInicial} esFamiliar={esFamiliar} />}
              {pestana === 'balance' && <BalancePatrimonialTab cuentas={cuentas} hojas={hojas} asientos={asientos} />}
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

function SumasYSaldosTab({ hojas, asientos }: { hojas: CuentaPlan[]; asientos: Asiento[] }) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioInformes, idioma);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarCeros, setMostrarCeros] = useState(false);

  const filas = useMemo(
    () =>
      hojas.map((cuenta) => ({
        cuenta,
        ...calcularMovimiento(cuenta, asientos),
      })),
    [hojas, asientos]
  );

  const visibles = filas.filter((fila) => {
    const coincideBusqueda = `${fila.cuenta.codigo} ${fila.cuenta.nombre}`
      .toLowerCase()
      .includes(busqueda.toLowerCase());

    // Redondeado, no exacto: un saldo de centavos se muestra como "0"
    // en pantalla (formatearNumeroEntero redondea), así que si son
    // todos cero al redondear tiene que contar como "sin movimiento".
    const tieneMovimiento =
      Math.round(fila.inicial) !== 0 ||
      Math.round(fila.debe) !== 0 ||
      Math.round(fila.haber) !== 0 ||
      Math.round(fila.saldoFinal) !== 0;

    return coincideBusqueda && (mostrarCeros || tieneMovimiento);
  });

  const totalInicial = visibles.reduce((s, f) => s + f.inicial, 0);
  const totalDebe = visibles.reduce((s, f) => s + f.debe, 0);
  const totalHaber = visibles.reduce((s, f) => s + f.haber, 0);
  const totalFinal = visibles.reduce((s, f) => s + f.saldoFinal, 0);
  const diferenciaDebeHaber = totalDebe - totalHaber;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={t('buscarCuenta')}
          style={{ ...campoInput, maxWidth: 420, marginBottom: 0 }}
        />

        <BotonToggle
          activo={mostrarCeros}
          onClick={() => setMostrarCeros((actual) => !actual)}
          etiquetaActivo={t('ocultarCerosEnCero')}
          etiquetaInactivo={t('mostrarCerosEnCero')}
        />
      </div>

      <div style={tablaContenedor}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={cabeceraFila}>
              <Th>{t('codigoHeader')}</Th>
              <Th>{t('cuentaHeader')}</Th>
              <Th align="right">{t('saldoInicialHeader')}</Th>
              <Th align="right">{t('debeHeader')}</Th>
              <Th align="right">{t('haberHeader')}</Th>
              <Th align="right">{t('saldoFinalHeader')}</Th>
            </tr>
          </thead>

          <tbody>
            {visibles.map((fila) => (
              <tr key={fila.cuenta.id} style={filaStyle}>
                <Td>{fila.cuenta.codigo}</Td>
                <Td>{nombreCuentaDisplay(idioma, fila.cuenta.nombre)}</Td>
                <Td align="right">{simbolo} {formatearNumeroEntero(fila.inicial)}</Td>
                <Td align="right">{fila.debe ? `${simbolo} ${formatearNumeroEntero(fila.debe)}` : '—'}</Td>
                <Td align="right">{fila.haber ? `${simbolo} ${formatearNumeroEntero(fila.haber)}` : '—'}</Td>
                <Td align="right">
                  <strong style={{ color: COLORES.azul }}>{simbolo} {formatearNumeroEntero(fila.saldoFinal)}</strong>
                </Td>
              </tr>
            ))}

            {!visibles.length && (
              <tr>
                <td colSpan={6} style={vacioStyle}>
                  {t('sinCuentas')}
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr style={pieFila}>
              <Td>
                <strong>{t('total')}</strong>
              </Td>
              <Td>—</Td>
              <Td align="right">
                <strong>{simbolo} {formatearNumeroEntero(totalInicial)}</strong>
              </Td>
              <Td align="right">
                <strong>{simbolo} {formatearNumeroEntero(totalDebe)}</strong>
              </Td>
              <Td align="right">
                <strong>{simbolo} {formatearNumeroEntero(totalHaber)}</strong>
              </Td>
              <Td align="right">
                <strong>{simbolo} {formatearNumeroEntero(totalFinal)}</strong>
              </Td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '12px 16px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          background: Math.abs(diferenciaDebeHaber) < 0.01 ? '#eaf7ee' : '#fef2f2',
          color: Math.abs(diferenciaDebeHaber) < 0.01 ? '#247347' : '#dc2626',
        }}
      >
        {Math.abs(diferenciaDebeHaber) < 0.01
          ? t('debeHaberCierran')
          : msgDebeHaberNoCierran(idioma, `${simbolo} ${formatearNumeroEntero(diferenciaDebeHaber)}`)}
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA · MAYOR
========================================================== */

// Orden natural del plan de cuentas (Activo → Pasivo → Patrimonio →
// Ingreso → Costo → Gasto) — mismo criterio que ya se usa en
// Contabilidad para agrupar Categoría/Forma de Pago.
const ORDEN_TIPO_SALDO = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO'];

function tituloTipoSaldo(
  tipoSaldo: string | null | undefined,
  t: (clave: 'activoTitulo' | 'pasivoTitulo' | 'patrimonioTitulo' | 'ingresosTitulo' | 'costosTitulo' | 'gastosTitulo') => string,
  idioma: string | null
): string {
  switch (tipoSaldo) {
    case 'ACTIVO':
      return t('activoTitulo');
    case 'PASIVO':
      return t('pasivoTitulo');
    case 'PATRIMONIO':
      return t('patrimonioTitulo');
    case 'INGRESO':
      return t('ingresosTitulo');
    case 'COSTO':
      return t('costosTitulo');
    case 'GASTO':
      return t('gastosTitulo');
    default:
      return idioma === 'PT' ? 'Outras' : 'Otras';
  }
}

function MayorTab({ hojas, asientos, cuentaInicial }: { hojas: CuentaPlan[]; asientos: Asiento[]; cuentaInicial: string }) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioInformes, idioma);
  const [cuentaId, setCuentaId] = useState('');
  const [mostrarCeros, setMostrarCeros] = useState(false);

  // Las cuentas se identifican por nombre en los asientos, así que el
  // enlace del Panel de Control también viaja por nombre.
  useEffect(() => {
    if (!cuentaInicial) return;
    const encontrada = hojas.find((c) => c.nombre === cuentaInicial);
    if (encontrada) setCuentaId(encontrada.id);
  }, [cuentaInicial, hojas]);

  const cuenta = hojas.find((c) => c.id === cuentaId) ?? null;

  // Antes de buscar la cuenta, sacamos del desplegable las que nunca
  // tuvieron saldo — ensucian la lista y casi nunca son las que se
  // necesita mirar.
  const opciones = useMemo(() => {
    const lista = mostrarCeros
      ? hojas
      : hojas.filter((c) => Math.round(calcularMovimiento(c, asientos, true).saldoFinal) !== 0);

    return lista.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [hojas, asientos, mostrarCeros]);

  // Separadas por naturaleza (Activo/Pasivo/.../Gasto) en vez de una
  // sola lista plana — con decenas de cuentas, encontrar la que se
  // busca a ojo era cada vez más difícil.
  const gruposPorTipoSaldo = useMemo(() => {
    const grupos = new Map<string, CuentaPlan[]>();

    for (const opcion of opciones) {
      const clave = opcion.tipo_saldo && ORDEN_TIPO_SALDO.includes(opcion.tipo_saldo) ? opcion.tipo_saldo : 'otras';
      const lista = grupos.get(clave) ?? [];
      lista.push(opcion);
      grupos.set(clave, lista);
    }

    return [...ORDEN_TIPO_SALDO, 'otras']
      .filter((clave) => grupos.has(clave))
      .map((clave) => ({
        titulo: tituloTipoSaldo(clave === 'otras' ? null : clave, t, idioma),
        cuentas: grupos.get(clave) ?? [],
      }));
  }, [opciones, t, idioma]);

  const movimientos = useMemo(() => {
    if (!cuenta) return [];

    return asientos
      .filter((a) => a.debito === cuenta.nombre || a.credito === cuenta.nombre)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.id_operacion ?? '').localeCompare(b.id_operacion ?? ''));
  }, [cuenta, asientos]);

  const filasConSaldo = useMemo(() => {
    if (!cuenta) return [];

    let saldo = Number(cuenta.saldo_inicial ?? 0);
    const esAcreedora = cuenta.naturaleza === 'ACREEDORA';

    return movimientos.map((mov) => {
      const esDebe = mov.debito === cuenta.nombre;
      const monto = esDebe ? mov.importe : -mov.importe;

      saldo += esAcreedora ? -monto : monto;

      return { ...mov, esDebe, saldo };
    });
  }, [movimientos, cuenta]);

  const saldoActual = cuenta
    ? filasConSaldo.length
      ? filasConSaldo[filasConSaldo.length - 1].saldo
      : Number(cuenta.saldo_inicial ?? 0)
    : 0;

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 420, flex: 1, minWidth: 260 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: COLORES.azul, display: 'block', marginBottom: 6 }}>
            {t('cuentaLabel')}
          </label>

          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={campoInput}>
            <option value="">{t('seleccionarCuenta')}</option>

            {gruposPorTipoSaldo.map((grupo) => (
              <optgroup key={grupo.titulo} label={grupo.titulo}>
                {grupo.cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nombreCuentaDisplay(idioma, c.nombre)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <BotonToggle
          activo={mostrarCeros}
          onClick={() => setMostrarCeros((actual) => !actual)}
          etiquetaActivo={t('ocultarCerosEnCero')}
          etiquetaInactivo={t('mostrarCerosEnCero')}
        />

        {cuenta && (
          <div
            style={{
              padding: '11px 18px',
              borderRadius: 12,
              background: 'linear-gradient(90deg, #edf6f0, #f7faf8)',
              minWidth: 200,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
              {t('saldoActualLabel')}
            </div>

            <div style={{ fontSize: 22, fontWeight: 800, color: COLORES.azul }}>
              {simbolo} {formatearNumeroEntero(saldoActual)}
            </div>
          </div>
        )}
      </div>

      {!cuenta ? (
        <div style={vacioOperacion}>{t('elegirCuentaMovimiento')}</div>
      ) : (
        <div style={tablaContenedor}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={cabeceraFila}>
                <Th>{t('fechaHeader')}</Th>
                <Th>{t('operacionHeader')}</Th>
                <Th>{t('descripcionHeader')}</Th>
                <Th align="right">{t('debeHeader')}</Th>
                <Th align="right">{t('haberHeader')}</Th>
                <Th align="right">{t('saldoHeader')}</Th>
              </tr>
            </thead>

            <tbody>
              <tr style={filaStyle}>
                <Td>—</Td>
                <Td>—</Td>
                <Td>
                  <em>{t('saldoInicialItalic')}</em>
                </Td>
                <Td align="right">—</Td>
                <Td align="right">—</Td>
                <Td align="right">
                  <strong>{simbolo} {formatearNumeroEntero(Number(cuenta.saldo_inicial ?? 0))}</strong>
                </Td>
              </tr>

              {filasConSaldo.map((fila, indice) => (
                <tr key={`${fila.id_operacion}-${indice}`} style={filaStyle}>
                  <Td>{new Date(`${fila.fecha}T12:00:00`).toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR')}</Td>
                  <Td>{fila.id_operacion || '—'}</Td>
                  <Td>{fila.descripcion || '—'}</Td>
                  <Td align="right">{fila.esDebe ? `${simbolo} ${formatearNumeroEntero(fila.importe)}` : '—'}</Td>
                  <Td align="right">{!fila.esDebe ? `${simbolo} ${formatearNumeroEntero(fila.importe)}` : '—'}</Td>
                  <Td align="right">
                    <strong>{simbolo} {formatearNumeroEntero(fila.saldo)}</strong>
                  </Td>
                </tr>
              ))}

              {!filasConSaldo.length && (
                <tr>
                  <td colSpan={6} style={vacioStyle}>
                    {t('sinMovimientosValidados')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
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
  // Simplificada (solo totales) o detallada (con cada cuenta): compartida con Flujo de Caja.
  const [nivel, setNivel] = useVistaInforme();
  const soloTotal = nivel === 'SIMPLE';

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

  return (
    <div>
      <div style={{ marginBottom: 18, maxWidth: 280 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: COLORES.azul, display: 'block', marginBottom: 6 }}>
          {t('periodoLabel')}
        </label>

        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={campoInput}>
          <option value="TODOS">{t('todosLosPeriodos')}</option>

          {periodos.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 18 }}>
        <ToggleVistaInforme vista={nivel} onChange={setNivel} esPT={idioma === 'PT'} />
      </div>

      {empresaId && !soloTotal && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {(
            [
              ['CUENTA', idioma === 'PT' ? 'Por conta' : 'Por cuenta'],
              ['NATURALEZA', idioma === 'PT' ? 'Por natureza (fixos / recorrentes / do mês)' : 'Por naturaleza (fijos / recurrentes / del mes)'],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setVista(valor)}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: `1px solid ${vista === valor ? COLORES.verde : '#d1d5db'}`,
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
      )}

      {vista === 'NATURALEZA' && empresaId && !soloTotal ? (
        <ResultadoPorNaturaleza
          empresaId={empresaId}
          idioma={idioma}
          simbolo={simbolo}
          cuentas={hojas}
          asientos={asientosDelPeriodo}
          incluirSaldoInicial={esTodos}
          etiquetaPeriodo={esTodos ? t('todosLosPeriodos') : formatearPeriodo(periodo, idioma)}
        />
      ) : (
        <>
      <SeccionResultado soloTotal={soloTotal} titulo={t('ingresosTitulo')} emoji="💵" filas={ingresos} total={totalIngresos} color={COLORES.verde} />

      {esFamiliar ? (
        <SeccionResultado soloTotal={soloTotal} titulo={t('gastosTitulo')} emoji="🧾" filas={gastos} total={totalGastos} color="#c2410c" resta />
      ) : (
        <>
          {/* Empresas: las tres líneas de resultado salen siempre, en cero si no hay nada que restar. */}
          <SeccionResultado soloTotal={soloTotal} titulo={t('costosTitulo')} emoji="📦" filas={costos} total={totalCostos} color="#c2410c" resta />
          <SubtotalResultado titulo={esPT ? 'Resultado bruto' : 'Resultado bruto'} valor={resultadoBruto} porcentaje={porcentajeSobreIngresos(resultadoBruto)} />

          <SeccionResultado
            soloTotal={soloTotal}
            titulo={esPT ? 'Despesas operacionais' : 'Gastos operacionales'}
            emoji="🧾"
            filas={gastosOperativos}
            total={totalGastosOperativos}
            color="#c2410c"
            resta
          />
          <SubtotalResultado titulo={esPT ? 'Resultado operacional' : 'Resultado operacional'} valor={resultadoOperacional} porcentaje={porcentajeSobreIngresos(resultadoOperacional)} />

          <SeccionResultado
            soloTotal={soloTotal}
            titulo={esPT ? 'Despesas financeiras e impostos' : 'Gastos financieros e impuestos'}
            emoji="🏦"
            filas={gastosNoOperativos}
            total={totalGastosNoOperativos}
            color="#c2410c"
            resta
          />
        </>
      )}

      <div
        style={{
          marginTop: 18,
          padding: '18px 20px',
          borderRadius: 16,
          background: resultado >= 0 ? 'linear-gradient(90deg, #edf6f0, #f7faf8)' : '#fef2f2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
            {esFamiliar
              ? msgResultadoLabel(idioma, esTodos, formatearPeriodo(periodo, idioma))
              : `${esPT ? 'RESULTADO LÍQUIDO' : 'RESULTADO NETO'} — ${esTodos ? (esPT ? 'histórico' : 'histórico') : formatearPeriodo(periodo, idioma)}`}
          </div>

          <div style={{ fontSize: 24, fontWeight: 800, color: resultado >= 0 ? COLORES.verde : '#dc2626' }}>
            {simbolo} {formatearNumeroEntero(resultado)}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 13, color: COLORES.gris }}>
          {t('rentabilidadLabel')}
          <div style={{ fontSize: 18, fontWeight: 800, color: COLORES.azul }}>
            {rentabilidad.toFixed(1)}%
          </div>
        </div>
      </div>
        </>
      )}

      <SeccionTendencia titulo={t('tendenciaResultadoTitulo')} datos={tendencia} idioma={idioma} />
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

    const valor = sumaTipo('INGRESO') - sumaTipo('COSTO') - sumaTipo('GASTO');

    return { clave, etiqueta: formatearPeriodoCorto(clave, idioma), valor };
  });
}

// Bloque "panorama general": título + gráfico de tendencia, siempre
// con todo el histórico, sin importar el período elegido arriba.
function SeccionTendencia({
  titulo,
  datos,
  idioma,
}: {
  titulo: string;
  datos: { clave: string; etiqueta: string; valor: number }[];
  idioma: string | null;
}) {
  const t = crearTraductor(diccionarioInformes, idioma);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: COLORES.verde }}>
        {t('panoramaGeneral')}
      </div>

      <h3 style={{ margin: '0 0 4px', color: COLORES.azul, fontSize: 17 }}>{titulo}</h3>

      <p style={{ margin: '0 0 14px', fontSize: 12, color: COLORES.gris }}>
        {t('tendenciaSubtitulo')}
      </p>

      <GraficoTendenciaResultado datos={datos} idioma={idioma} />
    </div>
  );
}

function GraficoTendenciaResultado({
  datos,
  idioma,
}: {
  datos: { clave: string; etiqueta: string; valor: number }[];
  idioma: string | null;
}) {
  const t = crearTraductor(diccionarioInformes, idioma);

  if (!datos.length) {
    return <div style={vacioOperacion}>{t('sinHistorialTendencia')}</div>;
  }

  const alto = 160;
  const anchoBarra = 46;
  const gap = 14;
  const ancho = datos.length * (anchoBarra + gap) + gap;

  const maxAbs = Math.max(...datos.map((d) => Math.abs(d.valor)), 1);
  const mitad = alto / 2;
  const escala = (mitad - 16) / maxAbs;

  return (
    <div style={{ ...tablaContenedor, padding: '18px 12px', overflowX: 'auto' }}>
      <svg width={ancho} height={alto + 26} style={{ display: 'block' }}>
        <line x1={0} y1={mitad} x2={ancho} y2={mitad} stroke="#e5e7eb" strokeWidth={1} />

        {datos.map((dato, indice) => {
          const x = gap + indice * (anchoBarra + gap);
          const alturaBarra = Math.abs(dato.valor) * escala;
          const y = dato.valor >= 0 ? mitad - alturaBarra : mitad;
          const color = dato.valor >= 0 ? COLORES.verde : '#dc2626';

          return (
            <g key={dato.clave}>
              <rect x={x} y={y} width={anchoBarra} height={Math.max(alturaBarra, 2)} rx={4} fill={color} />

              <text
                x={x + anchoBarra / 2}
                y={dato.valor >= 0 ? y - 6 : y + alturaBarra + 14}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill={color}
              >
                {dato.valor.toFixed(0)}
              </text>

              <text
                x={x + anchoBarra / 2}
                y={alto + 18}
                textAnchor="middle"
                fontSize={11}
                fill={COLORES.gris}
              >
                {dato.etiqueta}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
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

// Línea de saldo del flujo de caja (inicial, final, subtotal de cada actividad).
function LineaSaldo({ titulo, valor, destacada = false }: { titulo: string; valor: number; destacada?: boolean }) {
  const simbolo = useContext(SimboloContext);

  return (
    <div
      style={{
        marginBottom: 12,
        padding: destacada ? '12px 16px' : '10px 14px',
        borderRadius: 12,
        background: destacada ? (valor >= 0 ? '#edf6f0' : '#fef2f2') : '#f8fafc',
        border: `1px solid ${destacada ? (valor >= 0 ? '#cfe5d6' : '#fecaca') : '#e5e7eb'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <strong style={{ color: COLORES.azul, fontSize: 13.5 }}>{titulo}</strong>
      <strong style={{ fontSize: 15, color: valor >= 0 ? COLORES.azul : '#dc2626', whiteSpace: 'nowrap' }}>
        {simbolo} {formatearNumeroEntero(valor)}
      </strong>
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

function SubtotalResultado({ titulo, valor, porcentaje }: { titulo: string; valor: number; porcentaje: number }) {
  const simbolo = useContext(SimboloContext);

  return (
    <div
      style={{
        marginBottom: 16,
        padding: '12px 16px',
        borderRadius: 12,
        background: valor >= 0 ? '#edf6f0' : '#fef2f2',
        border: `1px solid ${valor >= 0 ? '#cfe5d6' : '#fecaca'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <strong style={{ color: COLORES.azul, fontSize: 14 }}>= {titulo}</strong>
      <span style={{ fontWeight: 800, fontSize: 16, color: valor >= 0 ? COLORES.verde : '#dc2626', whiteSpace: 'nowrap' }}>
        {simbolo} {formatearNumeroEntero(valor)}
        <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: COLORES.gris }}>{porcentaje.toFixed(1)}%</span>
      </span>
    </div>
  );
}

function SeccionResultado({
  titulo,
  emoji,
  filas,
  total,
  color,
  resta = false,
  soloTotal = false,
}: {
  titulo: string;
  emoji: string;
  filas: { cuenta: CuentaPlan; saldoFinal: number }[];
  total: number;
  color: string;
  resta?: boolean;
  // Vista simplificada: solo el encabezado con el total, sin el detalle por cuenta.
  soloTotal?: boolean;
}) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioInformes, idioma);
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: '#f8fafc',
          borderRadius: soloTotal ? 10 : '10px 10px 0 0',
          border: '1px solid #e5e7eb',
          borderBottom: soloTotal ? '1px solid #e5e7eb' : 'none',
          gap: 12,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <strong style={{ color: COLORES.azul, fontSize: 13, whiteSpace: 'nowrap' }}>
          {emoji} {titulo}
        </strong>

        <strong style={{ color, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {resta ? '− ' : ''}{simbolo} {formatearNumeroEntero(total)}
        </strong>
      </div>

      {!soloTotal && (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        {!filas.length ? (
          <div style={{ padding: 16, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>
            {t('sinMovimientoPeriodo')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {filas.map((fila, indice) => (
              <div
                key={fila.cuenta.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  fontSize: 13,
                  gap: 16,
                  borderTop: indice === 0 ? 'none' : '1px solid #f1f5f9',
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>{nombreCuentaDisplay(idioma, fila.cuenta.nombre)}</span>
                <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{simbolo} {formatearNumeroEntero(fila.saldoFinal)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
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
  const [vista, setVista] = useVistaInforme();
  const soloTotal = vista === 'SIMPLE';
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

  // Igual que en Estado de Resultado: la tendencia mira todo el
  // histórico, sin importar el período elegido arriba.
  const tendenciaCaja = useMemo(
    () => calcularTendenciaCaja(nombresCaja, asientos, idioma),
    [nombresCaja, asientos, idioma]
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

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 280, flex: 1, minWidth: 220 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: COLORES.azul, display: 'block', marginBottom: 6 }}>
            {t('periodoLabel')}
          </label>

          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={campoInput}>
            <option value="TODOS">{t('todosLosPeriodos')}</option>

            {periodos.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            padding: '11px 18px',
            borderRadius: 12,
            background: 'linear-gradient(90deg, #edf6f0, #f7faf8)',
            minWidth: 200,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
            {t('cajaDisponibleHoy')}
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: COLORES.azul }}>
            {simbolo} {formatearNumeroEntero(saldoCajaActual)}
          </div>
        </div>

        <ToggleVistaInforme vista={vista} onChange={setVista} esPT={esPT} />
      </div>

      <LineaSaldo titulo={esFamiliar ? (esPT ? 'Com quanto você começou (dinheiro disponível)' : 'Con cuánto arrancaste (plata disponible)') : esPT ? 'Saldo inicial (fechamento do mês anterior)' : 'Saldo inicial (cierre del mes anterior)'} valor={saldoInicial} />

      {esFamiliar ? (
        <>
          <SeccionMontos titulo={t('entradasDeCaja')} emoji="⬇️" filas={filas(familia.entradas)} total={familia.totalEntradas} color={COLORES.verde} soloTotal={soloTotal} />
          <SeccionMontos titulo={t('salidasDeCaja')} emoji="⬆️" filas={filas(familia.salidas)} total={familia.totalSalidas} color="#c2410c" resta soloTotal={soloTotal} />

          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: COLORES.gris, marginBottom: 10 }}>{t('subtituloAhorroInversion')}</p>
            <SeccionMontos titulo={esPT ? 'Você aplicou em poupança e investimentos' : 'Aportaste a ahorro e inversión'} emoji="🏦" filas={filas(flujo.bloques.INVERSION.salidas)} total={flujo.bloques.INVERSION.totalSalidas} color={COLORES.azul} resta soloTotal={soloTotal} />
            <SeccionMontos titulo={esPT ? 'Você resgatou de poupança e investimentos' : 'Rescataste de ahorro e inversión'} emoji="🏦" filas={filas(flujo.bloques.INVERSION.entradas)} total={flujo.bloques.INVERSION.totalEntradas} color={COLORES.azul} soloTotal={soloTotal} />
            <LineaSaldo
              titulo={esPT ? '= Você poupou neste período' : '= Ahorraste en el período'}
              valor={ahorradoNeto}
              destacada
            />
            {tasaAhorro !== null && (
              <p style={{ fontSize: 13, color: COLORES.azul, fontWeight: 700, margin: '0 2px 12px' }}>
                {esPT ? 'Taxa de poupança' : 'Tasa de ahorro'}: {tasaAhorro.toFixed(1)}% {esPT ? 'da sua renda' : 'de tus ingresos'}
              </p>
            )}
          </div>

          {(flujo.bloques.BIENES.entradas.length > 0 || flujo.bloques.BIENES.salidas.length > 0) && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 12, color: COLORES.gris, marginBottom: 10 }}>
                {esPT ? 'Compras e vendas de bens e propriedades: não contam como poupança.' : 'Compras y ventas de bienes y propiedades: no cuentan como ahorro.'}
              </p>
              <SeccionMontos titulo={esPT ? 'Compras de bens' : 'Compras de bienes'} emoji="🏠" filas={filas(flujo.bloques.BIENES.salidas)} total={flujo.bloques.BIENES.totalSalidas} color="#c2410c" resta soloTotal={soloTotal} />
              <SeccionMontos titulo={esPT ? 'Vendas de bens' : 'Ventas de bienes'} emoji="🏠" filas={filas(flujo.bloques.BIENES.entradas)} total={flujo.bloques.BIENES.totalEntradas} color={COLORES.verde} soloTotal={soloTotal} />
            </div>
          )}
        </>
      ) : (
        BLOQUES_FLUJO.filter((b) => (b !== 'OTROS' && b !== 'BIENES') || flujo.bloques[b].entradas.length > 0 || flujo.bloques[b].salidas.length > 0).map((b) => {
          const bloque = flujo.bloques[b];

          return (
            <div key={b} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: COLORES.azul, letterSpacing: 0.4, textTransform: 'uppercase', margin: '4px 2px 8px' }}>
                {tituloBloque[b].emoji} {tituloBloque[b].actividades}
              </div>

              {!soloTotal && (
                <>
                  <SeccionMontos titulo={esPT ? 'Entradas' : 'Entradas'} emoji="⬇️" filas={filas(bloque.entradas)} total={bloque.totalEntradas} color={COLORES.verde} />
                  <SeccionMontos titulo={esPT ? 'Saídas' : 'Salidas'} emoji="⬆️" filas={filas(bloque.salidas)} total={bloque.totalSalidas} color="#c2410c" resta />
                </>
              )}

              <LineaSaldo titulo={`= ${tituloBloque[b].flujo}`} valor={bloque.neto} destacada />
            </div>
          );
        })
      )}

      <div
        style={{
          marginTop: 18,
          padding: '18px 20px',
          borderRadius: 16,
          background: flujoNeto >= 0 ? 'linear-gradient(90deg, #edf6f0, #f7faf8)' : '#fef2f2',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
          {msgFlujoNetoLabel(idioma, esTodos, formatearPeriodo(periodo, idioma))}
        </div>

        <div style={{ fontSize: 24, fontWeight: 800, color: flujoNeto >= 0 ? COLORES.verde : '#dc2626' }}>
          {simbolo} {formatearNumeroEntero(flujoNeto)}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <LineaSaldo titulo={esFamiliar ? (esPT ? 'Com quanto você fecha (dinheiro disponível)' : 'Con cuánto cerrás (plata disponible)') : esPT ? 'Saldo final (saldo inicial + fluxo líquido)' : 'Saldo final (saldo inicial + flujo neto)'} valor={saldoFinal} destacada />
      </div>

      {esFamiliar && (
        <div style={{ marginTop: 12 }}>
          <LineaSaldo titulo={esPT ? 'Poupança e investimentos — início do período' : 'Ahorros e inversiones — inicio del período'} valor={ahorroInicial} />
          <LineaSaldo titulo={esPT ? 'Poupança e investimentos — fim do período' : 'Ahorros e inversiones — cierre del período'} valor={ahorroFinal} />
          <LineaSaldo titulo={esPT ? 'Dinheiro líquido total (disponível + poupança)' : 'Plata líquida total (disponible + ahorros)'} valor={saldoFinal + ahorroFinal} destacada />
        </div>
      )}

      {empresaId && !esTodos && (
        <SaldoDeseado empresaId={empresaId} periodo={periodo} saldoFinal={saldoFinal} esPT={esPT} esFamiliar={esFamiliar} sugerido={colchonSugerido} />
      )}

      <SeccionTendencia titulo={t('tendenciaCajaTitulo')} datos={tendenciaCaja} idioma={idioma} />
    </div>
  );
}

// Flujo neto de caja (entradas - salidas) de cada mes: la misma definición del
// informe, así la tendencia coincide con el flujo neto de cada período.
function calcularTendenciaCaja(nombresCaja: Set<string>, asientos: Asiento[], idioma: string | null) {
  const claves = Array.from(new Set(asientos.map((a) => a.fecha.slice(0, 7)).filter(Boolean))).sort();
  const porMes = new Map<string, number>();

  for (const m of movimientosDeCaja(asientos, nombresCaja)) {
    const clave = m.fecha.slice(0, 7);
    porMes.set(clave, (porMes.get(clave) ?? 0) + (m.entrada ? m.importe : -m.importe));
  }

  return claves.map((clave) => ({ clave, etiqueta: formatearPeriodoCorto(clave, idioma), valor: porMes.get(clave) ?? 0 }));
}

// Agrupa una lista de asientos por el nombre de la cuenta "contraparte"
// (la otra punta del asiento), sumando importes iguales.
function agruparPorContraparte(
  lista: Asiento[],
  contraparte: (a: Asiento) => string | null,
  idioma: string | null
) {
  const mapa = new Map<string, number>();

  for (const asiento of lista) {
    const clave = contraparte(asiento) || '__OTRO__';
    mapa.set(clave, (mapa.get(clave) ?? 0) + asiento.importe);
  }

  const t = crearTraductor(diccionarioInformes, idioma);

  return Array.from(mapa.entries())
    .map(([nombre, valor]) => ({ nombre: nombre === '__OTRO__' ? t('otro') : nombre, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function SeccionMontos({
  titulo,
  emoji,
  filas,
  total,
  color,
  resta = false,
  soloTotal = false,
}: {
  titulo: string;
  emoji: string;
  filas: { nombre: string; valor: number }[];
  total: number;
  color: string;
  resta?: boolean;
  // Vista simplificada: solo el encabezado con el total, sin el detalle por cuenta.
  soloTotal?: boolean;
}) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioInformes, idioma);
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: '#f8fafc',
          borderRadius: soloTotal ? 10 : '10px 10px 0 0',
          border: '1px solid #e5e7eb',
          borderBottom: soloTotal ? '1px solid #e5e7eb' : 'none',
          gap: 12,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <strong style={{ color: COLORES.azul, fontSize: 13, whiteSpace: 'nowrap' }}>
          {emoji} {titulo}
        </strong>

        <strong style={{ color, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {resta ? '− ' : ''}{simbolo} {formatearNumeroEntero(total)}
        </strong>
      </div>

      {!soloTotal && (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        {!filas.length ? (
          <div style={{ padding: 16, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>
            {t('sinMovimientoPeriodo')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {filas.map((fila, indice) => (
              <div
                key={fila.nombre}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  fontSize: 13,
                  gap: 16,
                  borderTop: indice === 0 ? 'none' : '1px solid #f1f5f9',
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>{nombreCuentaDisplay(idioma, fila.nombre)}</span>
                <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{simbolo} {formatearNumeroEntero(fila.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

/* ==========================================================
   PESTAÑA · BALANCE PATRIMONIAL
========================================================== */

function BalancePatrimonialTab({
  cuentas,
  hojas,
  asientos,
}: {
  cuentas: CuentaPlan[];
  hojas: CuentaPlan[];
  asientos: Asiento[];
}) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioInformes, idioma);
  const [mostrarCeros, setMostrarCeros] = useState(false);

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

  return (
    <div>
      <div
        style={{
          marginBottom: 18,
          padding: '18px 20px',
          borderRadius: 16,
          background: resultadoDelEjercicio >= 0 ? 'linear-gradient(90deg, #edf6f0, #f7faf8)' : '#fef2f2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
            {t('resultadoEjercicioSinCerrar')}
          </div>

          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: resultadoDelEjercicio >= 0 ? COLORES.verde : '#dc2626',
            }}
          >
            {simbolo} {formatearNumeroEntero(resultadoDelEjercicio)}
          </div>
        </div>

        <p style={{ margin: 0, maxWidth: 280, fontSize: 12, color: COLORES.gris }}>
          {t('resultadoEjercicioDescripcion')}
        </p>
      </div>

      <div style={{ marginBottom: 18 }}>
        <BotonToggle
          activo={mostrarCeros}
          onClick={() => setMostrarCeros((actual) => !actual)}
          etiquetaActivo={t('ocultarCerosEnCero')}
          etiquetaInactivo={t('mostrarCerosEnCero')}
        />
      </div>

      <div
        style={{
          display: 'grid',
          // min(340px, 100%) en vez de 340px a secas: si el ancho
          // disponible es menor a 340px (celular en vertical), la
          // columna se achica a ese 100% en vez de forzar que toda la
          // grilla se salga de la pantalla sin ninguna forma de
          // deslizarla -- eso era lo que dejaba "clavado" el bloque
          // aunque las filas de adentro ya tuvieran su propio scroll.
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
          gap: 18,
        }}
      >
        <BloqueBalance titulo={t('activoTitulo')} emoji="💚" grupos={activo.grupos} total={activo.total} color={COLORES.verde} />

        <div>
          <BloqueBalance titulo={t('pasivoTitulo')} emoji="💗" grupos={pasivo.grupos} total={pasivo.total} color="#b91c1c" />

          <div style={{ height: 14 }} />

          <BloqueBalance
            titulo={t('patrimonioTitulo')}
            emoji="💙"
            grupos={patrimonio.grupos}
            total={patrimonio.total}
            color={COLORES.azul}
            filaExtra={{ nombre: t('resultadoEjercicioNoCerrado'), valor: resultadoDelEjercicio }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: '12px 16px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          background: Math.abs(diferencia) < 0.01 ? '#eaf7ee' : '#fef2f2',
          color: Math.abs(diferencia) < 0.01 ? '#247347' : '#dc2626',
        }}
      >
        {Math.abs(diferencia) < 0.01
          ? msgEcuacionCierra(
              idioma,
              `${simbolo} ${formatearNumeroEntero(activo.total)}`,
              `${simbolo} ${formatearNumeroEntero(totalPasivoYPatrimonio)}`
            )
          : msgEcuacionNoCierra(
              idioma,
              `${simbolo} ${formatearNumeroEntero(diferencia)}`,
              `${simbolo} ${formatearNumeroEntero(activo.total)}`,
              `${simbolo} ${formatearNumeroEntero(totalPasivoYPatrimonio)}`
            )}
      </div>
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
}: {
  titulo: string;
  emoji: string;
  grupos: Map<string, { cuenta: CuentaPlan; saldoFinal: number }[]>;
  total: number;
  color: string;
  filaExtra?: { nombre: string; valor: number };
}) {
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
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: COLORES.gris, marginBottom: 4, whiteSpace: 'nowrap' }}>
              {nombreCuentaDisplay(idioma, grupo).toUpperCase()}
            </div>

            {filas.map((fila) => (
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

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      style={{
        padding: '10px 10px',
        color: '#374151',
        fontSize: 12,
        textAlign: align,
        whiteSpace: 'nowrap',
        fontWeight: 800,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '10px 10px', fontSize: 13, textAlign: align, whiteSpace: 'nowrap' }}>{children}</td>
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

const tablaContenedor: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
};

const cabeceraFila: React.CSSProperties = {
  background: '#f8fafc',
  textAlign: 'left',
};

const pieFila: React.CSSProperties = {
  background: '#f1f5f9',
  borderTop: '2px solid #d6dee5',
};

const filaStyle: React.CSSProperties = {
  borderTop: '1px solid #e5e7eb',
};

const vacioStyle: React.CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: COLORES.gris,
};

const vacioOperacion: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: COLORES.gris,
  border: '1px dashed #d6dee5',
  borderRadius: 14,
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
