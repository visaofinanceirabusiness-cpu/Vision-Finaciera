'use client';

// VISÃO FINANCEIRA 3D — LA EMPRESA POR DENTRO
//
// La estructura contable (Ativo / Passivo / Patrimônio Líquido → rubros → cuentas) como un edificio 3D
// que se recorre: girar, acercarse, seleccionar un área y entrar. Los datos son los de Informes → Balance
// (ver lib/visao3d.ts); la escena (three.js) se carga aparte, sin sumar peso al resto de la aplicación.
// Siempre hay una vista de lista equivalente (accesible y para equipos sin WebGL).

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PanelNodo } from '@/components/visao3d/PanelNodo';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { nombreCuentaDisplay } from '@/lib/i18n';
import { empresaTieneOnboardingCompleto } from '@/lib/onboarding';
import { cargarDatosVisao3D } from '@/lib/visao3dDatos';
import { empresaTieneVisao3D, escenaDePerfil } from '@/lib/visao3dEmpresas';
import { cargarAperturaVisao3D } from '@/lib/visao3dApertura';
import { construirEdificio, mesesDisponibles, movimientosDeCuenta, type AsientoVisao, type CuentaPlan, type EtiquetasGrupo, type NodoEdificio } from '@/lib/visao3d';
import { caminoResuelto, COLOR_GRUPO, disenarVolumenes, hijosVisibles, resolverNodo } from '@/lib/visao3dLayout';
import { construirObjetosCasa } from '@/lib/visao3dCasa';
import { guardarPreferencia, leerCalidad, leerPreferencia, type Calidad, type Preferencia } from '@/lib/visao3dCalidad';

const Escena = dynamic(() => import('@/components/visao3d/edificio/Escena'), {
  ssr: false,
  loading: () => <div style={{ color: '#cbd5e1', display: 'grid', placeItems: 'center', height: '100%' }}>⏳ 3D…</div>,
});

const EscenaCasa = dynamic(() => import('@/components/visao3d/casa/EscenaCasa'), {
  ssr: false,
  loading: () => <div style={{ color: '#cbd5e1', display: 'grid', placeItems: 'center', height: '100%' }}>⏳ 3D…</div>,
});

const COLORES = { azul: 'var(--color-primario, #1f3a5f)', verde: 'var(--color-secundario, #2e8b57)' };

function hayWebGL(): boolean {
  try {
    const lienzo = document.createElement('canvas');
    return Boolean(lienzo.getContext('webgl2') || lienzo.getContext('webgl'));
  } catch {
    return false;
  }
}

function formatoMes(clave: string, esPT: boolean): string {
  const [anio, mes] = clave.split('-').map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString(esPT ? 'pt-BR' : 'es-AR', { month: 'long', year: 'numeric' });
}

export default function Visao3DPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [cuentas, setCuentas] = useState<CuentaPlan[]>([]);
  const [asientos, setAsientos] = useState<AsientoVisao[]>([]);
  const [idioma, setIdioma] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<string | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState('');

  const [mes, setMes] = useState('TODOS');
  // Las cuentas en cero se ven (en gris): el objeto está, pero no hay saldo.
  const [mostrarCeros, setMostrarCeros] = useState(true);
  const [focoId, setFocoId] = useState('empresa');
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [vista, setVista] = useState<'3d' | 'lista'>('3d');
  // Perfil Familia: la empresa se ve como una casa amueblada (cada amenidad es una cuenta); también se puede ver el edificio.
  const [esFamiliar, setEsFamiliar] = useState(false); // = el perfil usa la casa (todos, con su tema)
  const [perfilCodigo, setPerfilCodigo] = useState<string | null>(null);
  const [modo, setModo] = useState<'casa' | 'edificio'>('edificio');
  const [webgl, setWebgl] = useState(true);
  // Pantalla inmersiva: el edificio ocupa todo; los controles viven en un menú y el panel es una hoja plegable.
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Calidad gráfica de la casa: automática según el equipo, o la que se elija en el menú (se recuerda).
  const [preferenciaCalidad, setPreferenciaCalidad] = useState<Preferencia>('auto');
  const [calidadAutomatica, setCalidadAutomatica] = useState<Calidad>('medio');
  useEffect(() => {
    setPreferenciaCalidad(leerPreferencia());
    setCalidadAutomatica(leerCalidad().automatica);
  }, []);
  function elegirCalidad(p: Preferencia) {
    guardarPreferencia(p);
    setPreferenciaCalidad(p);
  }
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [pista, setPista] = useState(true);
  // Pantalla de entrada: el toque que la cierra es el gesto que el navegador exige para pasar a pantalla completa.
  const [entrado, setEntrado] = useState(false);
  const [movimientoReducido, setMovimientoReducido] = useState(false);

  const esPT = idioma === 'PT';
  const simbolo = simboloMoneda(moneda);

  useEffect(() => {
    const ok = hayWebGL();
    setWebgl(ok);
    if (!ok) setVista('lista');
    setMovimientoReducido(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }, []);

  // Sin scroll de página mientras se está adentro, y la pista de gestos se va sola.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const pistaTimer = window.setTimeout(() => setPista(false), 7000);
    return () => {
      document.body.style.overflow = anterior;
      window.clearTimeout(pistaTimer);
      if (document.fullscreenElement) void document.exitFullscreen?.();
    };
  }, []);

  useEffect(() => {
    async function iniciar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil, error: errorPerfil } = await supabase.from('perfiles').select('empresa_id, tipo_usuario').eq('id', userData.user.id).maybeSingle();
      if (errorPerfil || !perfil?.empresa_id) {
        setError('No se encontró la empresa del usuario.');
        setCargando(false);
        return;
      }

      const { data: empresa } = await supabase.from('empresas').select('moneda, idioma, nombre, perfiles_empresa(codigo)').eq('id', perfil.empresa_id).maybeSingle();
      const relacionPerfil = empresa?.perfiles_empresa as { codigo: string }[] | { codigo: string } | null | undefined;
      const perfilCodigo = (Array.isArray(relacionPerfil) ? relacionPerfil[0]?.codigo : relacionPerfil?.codigo) ?? null;
      const familiar = escenaDePerfil(perfilCodigo) === 'casa';
      // Apertura progresiva por perfil / piloto por empresa (ver lib/visao3dEmpresas.ts).
      if (!empresaTieneVisao3D(perfil.empresa_id, perfilCodigo, await cargarAperturaVisao3D())) {
        router.push('/');
        return;
      }

      // Igual que Informes: el asistente es de solo carga y no ve la información financiera.
      if (perfil.tipo_usuario === 'ASISTENTE') {
        router.push('/');
        return;
      }

      if (!(await empresaTieneOnboardingCompleto(perfil.empresa_id))) {
        router.push('/bienvenida');
        return;
      }

      setEsFamiliar(familiar);
      setPerfilCodigo(perfilCodigo);
      if (familiar) setModo('casa');
      setMoneda(empresa?.moneda ?? null);
      setNombreEmpresa(empresa?.nombre ?? '');
      setIdioma(empresa?.idioma ?? null);

      try {
        const datos = await cargarDatosVisao3D(perfil.empresa_id, empresa?.idioma ?? null);
        setCuentas(datos.cuentas);
        setAsientos(datos.asientos);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos.');
      } finally {
        setCargando(false);
      }
    }

    void iniciar();
  }, [router]);

  const etiquetas: EtiquetasGrupo = useMemo(
    () => ({
      empresa: esPT ? 'Empresa' : 'Empresa',
      ACTIVO: esPT ? 'Ativo' : 'Activo',
      PASIVO: esPT ? 'Passivo' : 'Pasivo',
      PATRIMONIO: esPT ? 'Patrimônio Líquido' : 'Patrimonio Neto',
      resultado: esPT ? 'Resultado do exercício (sem fechar)' : 'Resultado del ejercicio (sin cerrar)',
    }),
    [esPT]
  );
  const etiquetaOtras = esPT ? 'Outras contas' : 'Otras cuentas';

  const meses = useMemo(() => mesesDisponibles(asientos), [asientos]);
  const mesCierre = mes === 'TODOS' ? null : mes;
  const edificio = useMemo(() => construirEdificio(cuentas, asientos, mesCierre, etiquetas, (n) => nombreCuentaDisplay(idioma, n)), [cuentas, asientos, mesCierre, etiquetas, idioma]);

  const enCasa = esFamiliar && modo === 'casa';
  const objetosCasa = useMemo(() => (esFamiliar ? construirObjetosCasa(edificio.raiz) : null), [esFamiliar, edificio.raiz]);
  const buscarNodo = (id: string): NodoEdificio | null => resolverNodo(edificio.raiz, id, mostrarCeros, etiquetaOtras);

  const foco = enCasa ? edificio.raiz : resolverNodo(edificio.raiz, focoId, mostrarCeros, etiquetaOtras) ?? edificio.raiz;
  const seleccionado = seleccionadoId ? buscarNodo(seleccionadoId) : null;
  const nodoPanel = seleccionado ?? foco;

  const { volumenes } = useMemo(() => disenarVolumenes(foco, mostrarCeros, etiquetaOtras, edificio.raiz.saldo), [foco, mostrarCeros, etiquetaOtras, edificio.raiz.saldo]);
  const { visibles: hijosPanel, ocultosEnCero } = hijosVisibles(nodoPanel, mostrarCeros, etiquetaOtras);
  // En la casa la ruta es Empresa → amenidad → cuenta.
  const camino = enCasa
    ? [edificio.raiz, ...(seleccionado ? [seleccionado] : [])]
    : caminoResuelto(edificio.raiz, nodoPanel.id, mostrarCeros, etiquetaOtras);

  const movimientos = useMemo(
    () => (nodoPanel.esHoja && nodoPanel.cuentaNombre ? movimientosDeCuenta(nodoPanel.cuentaNombre, asientos, mesCierre) : []),
    [nodoPanel, asientos, mesCierre]
  );

  function entrar(nodo: NodoEdificio) {
    if (enCasa || nodo.hijos.length === 0) {
      setSeleccionadoId(nodo.id);
      return;
    }
    setFocoId(nodo.id);
    setSeleccionadoId(null);
  }

  function seleccionar(nodo: NodoEdificio) {
    setSeleccionadoId(nodo.id);
  }

  // Primero se suelta la selección; después se sube un nivel (hasta la empresa completa).
  function volver() {
    if (seleccionadoId) {
      setSeleccionadoId(null);
      return;
    }
    const caminoFoco = caminoResuelto(edificio.raiz, foco.id, mostrarCeros, etiquetaOtras);
    setFocoId((caminoFoco.length >= 2 ? caminoFoco[caminoFoco.length - 2] : edificio.raiz).id);
  }

  function irAEmpresa() {
    setFocoId('empresa');
    setSeleccionadoId(null);
  }

  function irACamino(nodo: NodoEdificio) {
    if (enCasa) {
      setSeleccionadoId(nodo.id);
      return;
    }
    if (nodo.hijos.length > 0) {
      setFocoId(nodo.id);
      setSeleccionadoId(null);
    } else {
      const indice = camino.findIndex((n) => n.id === nodo.id);
      const padre = indice > 0 ? camino[indice - 1] : edificio.raiz;
      setFocoId(padre.id);
      setSeleccionadoId(nodo.id);
    }
  }

  const puedeVolver = enCasa ? Boolean(seleccionadoId) : foco.id !== 'empresa' || Boolean(seleccionadoId);
  const cuadra = Math.abs(edificio.diferencia) < 0.5;
  const dinero = (n: number) => `${n < 0 ? '−' : ''}${simbolo} ${formatearNumeroEntero(Math.abs(n))}`;
  const colorNodo = COLOR_GRUPO[nodoPanel.grupo];

  function pantallaCompletaDelNavegador() {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.()?.catch(() => undefined);
  }

  // Entrar: pasa a pantalla completa del navegador (donde se puede; en iPhone no existe y queda la vista inmersiva).
  function entrarALaEmpresa() {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.()?.catch(() => undefined);
    setEntrado(true);
  }

  const vidrio: React.CSSProperties = { background: 'rgba(11,20,36,0.82)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)' };
  const redondo: React.CSSProperties = { ...vidrio, width: 38, height: 38, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 17, cursor: 'pointer', textDecoration: 'none', flexShrink: 0 };
  const interruptor = (activo: boolean): React.CSSProperties => ({
    border: `1px solid ${activo ? '#fff' : 'rgba(255,255,255,0.35)'}`,
    background: activo ? 'rgba(255,255,255,0.2)' : 'transparent',
    color: '#fff',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
  });

  return (
    <main style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#0b1424', color: '#fff', overflow: 'hidden' }}>
      <style>{`
        .visao3d-panel { position: absolute; left: 8px; right: 8px; bottom: 8px; }
        @media (min-width: 861px) { .visao3d-panel { left: auto; right: 14px; bottom: 14px; width: 380px; } }
        .visao3d-migas::-webkit-scrollbar { display: none; }
      `}</style>

      {!entrado && (
        <button
          type="button"
          onClick={entrarALaEmpresa}
          style={{ position: 'absolute', inset: 0, zIndex: 20, border: 'none', cursor: 'pointer', color: '#fff', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 50% 40%, #1b2c55 0%, #0b1424 70%)' }}
        >
          <span style={{ display: 'grid', gap: 10, justifyItems: 'center', padding: 24, textAlign: 'center' }}>
            <span style={{ fontSize: 64 }}>🏢</span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: '#7dd3fc' }}>VISÃO 3D</span>
            <span style={{ fontSize: 26, fontWeight: 900 }}>{nombreEmpresa || (esPT ? 'A empresa por dentro' : 'La empresa por dentro')}</span>
            <span style={{ marginTop: 10, background: '#2f7df6', borderRadius: 999, padding: '12px 26px', fontWeight: 800, fontSize: 16 }}>{esPT ? 'Entrar na empresa' : 'Entrar a la empresa'} →</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{esPT ? 'Abre em tela cheia' : 'Se abre en pantalla completa'}</span>
          </span>
        </button>
      )}

      {/* Escena a pantalla completa (o la lista equivalente). */}
      {cargando ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#cbd5e1' }}>{esPT ? 'Carregando...' : 'Cargando...'}</div>
      ) : error || cuentas.length === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: '#fca5a5' }}>
          {error || (esPT ? 'Ainda não há plano de contas para mostrar.' : 'Todavía no hay plan de cuentas para mostrar.')}
        </div>
      ) : vista === '3d' && webgl && enCasa && objetosCasa ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          <EscenaCasa
            key={preferenciaCalidad}
            objetos={objetosCasa}
            totales={{
              ACTIVO: { nombre: edificio.raiz.hijos[0].nombre, saldo: edificio.raiz.hijos[0].saldo },
              PASIVO: { nombre: edificio.raiz.hijos[1].nombre, saldo: edificio.raiz.hijos[1].saldo },
              PATRIMONIO: { nombre: edificio.raiz.hijos[2].nombre, saldo: edificio.raiz.hijos[2].saldo },
            }}
            seleccionadoId={seleccionadoId}
            onSeleccionar={seleccionar}
            formatear={dinero}
            movimientoReducido={movimientoReducido}
            periodoClave={mes}
            esPT={esPT}
            perfilCodigo={perfilCodigo}
            nombreEmpresa={nombreEmpresa}
          />
        </div>
      ) : vista === '3d' && webgl ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Escena
            volumenes={volumenes}
            focoId={foco.id}
            periodoClave={mes}
            seleccionadoId={seleccionadoId}
            onSeleccionar={seleccionar}
            onEntrar={entrar}
            formatear={dinero}
            movimientoReducido={movimientoReducido}
            nombreEmpresa={nombreEmpresa}
          />
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '130px 14px 150px' }}>
          {!webgl && <p style={{ fontSize: 12.5, color: '#fcd34d' }}>{esPT ? 'Este dispositivo não suporta 3D: use a lista.' : 'Este dispositivo no soporta 3D: usá la lista.'}</p>}
          {volumenes.flatMap((v) => (foco.nivel === 0 ? [v.nodo] : v.pisos.map((p) => p.nodo))).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => (foco.nivel === 0 || seleccionadoId === n.id ? entrar(n) : seleccionar(n))}
              style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', border: 'none', borderLeft: `4px solid ${COLOR_GRUPO[n.grupo]}`, background: seleccionadoId === n.id ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)', color: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 6, cursor: 'pointer', fontSize: 14 }}
            >
              <span>{n.hijos.length > 0 ? '▸ ' : ''}{n.nombre}</span>
              <b>{dinero(n.saldo)}</b>
            </button>
          ))}
        </div>
      )}

      {/* Barra superior mínima: salir, ruta y menú. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 12px 0', display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
        <Link href="/" aria-label={esPT ? 'Voltar ao início' : 'Volver al inicio'} style={{ ...redondo, pointerEvents: 'auto' }}>
          🏠
        </Link>
        <nav
          aria-label={esPT ? 'Caminho' : 'Ruta'}
          className="visao3d-migas"
          style={{ ...vidrio, pointerEvents: 'auto', flex: 1, minWidth: 0, borderRadius: 999, padding: '0 10px', height: 38, display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none' }}
        >
          {camino.map((n, i) => (
            <span key={n.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {i > 0 && <span style={{ opacity: 0.6 }}>→</span>}
              <button
                type="button"
                onClick={() => (n.id === 'empresa' ? irAEmpresa() : irACamino(n))}
                style={{ border: 'none', background: 'transparent', color: i === camino.length - 1 ? '#fff' : n.nivel > 0 ? COLOR_GRUPO[n.grupo] : '#7dd3fc', fontWeight: 800, cursor: 'pointer', fontSize: 12.5, padding: '2px 4px' }}
              >
                {n.nombre}
              </button>
            </span>
          ))}
        </nav>
        <button type="button" aria-label={esPT ? 'Opções' : 'Opciones'} aria-expanded={menuAbierto} onClick={() => setMenuAbierto((v) => !v)} style={{ ...redondo, pointerEvents: 'auto' }}>
          ⚙️
        </button>
      </div>

      {/* Ecuación contable compacta: Ativo = Passivo + Patrimônio (tocar uno entra al grupo). */}
      {!cargando && cuentas.length > 0 && (
        <div role="group" aria-label={esPT ? 'Ativo = Passivo + Patrimônio Líquido' : 'Activo = Pasivo + Patrimonio Neto'} style={{ position: 'absolute', top: 56, left: 12, right: 12, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', pointerEvents: 'none' }}>
          {edificio.raiz.hijos.map((grupo, i) => (
            <span key={grupo.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <b style={{ fontSize: 15, opacity: 0.8, color: '#fff' }}>{i === 1 ? '=' : '+'}</b>}
              <button
                type="button"
                onClick={() => {
                  if (enCasa) return;
                  setFocoId(grupo.id);
                  setSeleccionadoId(null);
                }}
                style={{ ...vidrio, pointerEvents: 'auto', border: `1.5px solid ${COLOR_GRUPO[grupo.grupo]}`, borderRadius: 12, padding: '4px 10px', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8, color: COLOR_GRUPO[grupo.grupo] }}>{grupo.nombre.toUpperCase()}</div>
                <div style={{ fontSize: 13.5, fontWeight: 900 }}>{dinero(grupo.saldo)}</div>
              </button>
            </span>
          ))}
          <span style={{ ...vidrio, pointerEvents: 'none', fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, background: cuadra ? 'rgba(21,128,61,0.85)' : 'rgba(185,28,28,0.9)' }}>
            {cuadra ? '✅' : `⚠️ ${dinero(edificio.diferencia)}`}
          </span>
        </div>
      )}

      {/* Menú de opciones (período, cuentas en cero, vistas, pantalla completa del navegador). */}
      {menuAbierto && (
        <div role="dialog" aria-label={esPT ? 'Opções' : 'Opciones'} style={{ ...vidrio, position: 'absolute', top: 54, right: 12, zIndex: 5, borderRadius: 16, padding: 14, display: 'grid', gap: 10, width: 'min(320px, calc(100vw - 24px))' }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, display: 'grid', gap: 4 }}>
            {esPT ? 'Saldos ao fechamento de' : 'Saldos al cierre de'}
            <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ borderRadius: 8, padding: '7px 8px', border: '1px solid #cbd5e1', color: '#0f172a' }}>
              <option value="TODOS">{esPT ? 'Hoje (tudo registrado)' : 'Hoy (todo lo registrado)'}</option>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {formatoMes(m, esPT)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setMostrarCeros((v) => !v)} aria-pressed={mostrarCeros} style={interruptor(mostrarCeros)}>
            {mostrarCeros ? '✔ ' : ''}
            {esPT ? 'Mostrar contas em zero' : 'Mostrar cuentas en cero'}
          </button>
          {esFamiliar && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => { setModo('casa'); setSeleccionadoId(null); }} aria-pressed={modo === 'casa'} style={interruptor(modo === 'casa')}>
                🏠 {esPT ? 'Casa' : 'Casa'}
              </button>
              <button type="button" onClick={() => { setModo('edificio'); setSeleccionadoId(null); }} aria-pressed={modo === 'edificio'} style={interruptor(modo === 'edificio')}>
                🏢 {esPT ? 'Prédio' : 'Edificio'}
              </button>
            </div>
          )}
          {esFamiliar && modo === 'casa' && webgl && (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{esPT ? 'Qualidade gráfica' : 'Calidad gráfica'}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['auto', 'bajo', 'medio', 'alto'] as const).map((q) => (
                  <button key={q} type="button" onClick={() => elegirCalidad(q)} aria-pressed={preferenciaCalidad === q} style={interruptor(preferenciaCalidad === q)}>
                    {q === 'auto' ? `⚙️ Auto (${calidadAutomatica})` : q === 'bajo' ? (esPT ? 'Baixa' : 'Baja') : q === 'medio' ? (esPT ? 'Média' : 'Media') : esPT ? 'Alta' : 'Alta'}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                {esPT ? 'Alta: modelos 3D e sombras (só computador). Baixa: tudo leve.' : 'Alta: modelos 3D y sombras (solo computadora). Baja: todo liviano.'}
              </span>
            </div>
          )}
          {webgl && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setVista('3d')} aria-pressed={vista === '3d'} style={interruptor(vista === '3d')}>
                🏢 3D
              </button>
              <button type="button" onClick={() => setVista('lista')} aria-pressed={vista === 'lista'} style={interruptor(vista === 'lista')}>
                ☰ {esPT ? 'Lista' : 'Lista'}
              </button>
            </div>
          )}
          <button type="button" onClick={pantallaCompletaDelNavegador} style={interruptor(false)}>
            ⛶ {esPT ? 'Alternar tela cheia' : 'Alternar pantalla completa'}
          </button>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
            {esPT
              ? 'Saldos com os lançamentos validados (os mesmos do Balanço). O tamanho dos andares acompanha o valor, mas não é uma escala exata.'
              : 'Saldos con los asientos validados (los mismos del Balance). El tamaño de los pisos acompaña al valor, pero no es una escala exacta.'}
          </p>
        </div>
      )}

      {pista && vista === '3d' && !cargando && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', fontSize: 11.5, color: '#94a3b8', pointerEvents: 'none', padding: '0 16px' }}>
          {esPT ? 'Arraste para girar · pinça para zoom · toque duas vezes para entrar' : 'Arrastrá para girar · pellizco para zoom · tocá dos veces para entrar'}
        </div>
      )}

      {/* Hoja inferior: lo esencial siempre; el detalle (cifras, cuentas, movimientos) se despliega. */}
      {!cargando && cuentas.length > 0 && !error && (
        <div className="visao3d-panel" style={{ zIndex: 4 }}>
          <div style={{ ...vidrio, background: 'rgba(11,20,36,0.92)', border: `1px solid ${colorNodo}66`, borderRadius: 18, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => setPanelAbierto((v) => !v)} aria-expanded={panelAbierto} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', padding: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {panelAbierto ? '▾' : '▴'} {nodoPanel.nombre}
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: nodoPanel.saldo < 0 ? '#fca5a5' : '#fff' }}>{dinero(nodoPanel.saldo)}</div>
              </button>
              {!enCasa && nodoPanel.hijos.length > 0 && (
                <button type="button" onClick={() => entrar(nodoPanel)} style={{ border: 'none', background: colorNodo, color: '#fff', borderRadius: 999, padding: '8px 14px', fontWeight: 800, cursor: 'pointer' }}>
                  {esPT ? 'Entrar' : 'Entrar'} →
                </button>
              )}
              {puedeVolver && (
                <button type="button" onClick={volver} style={{ border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', borderRadius: 999, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}>
                  ← {esPT ? 'Voltar' : 'Volver'}
                </button>
              )}
            </div>
            {panelAbierto && (
              <div style={{ marginTop: 10, maxHeight: '48vh', overflowY: 'auto' }}>
                <PanelNodo
                  nodo={nodoPanel}
                  hijos={hijosPanel}
                  ocultosEnCero={ocultosEnCero}
                  movimientos={movimientos}
                  esPT={esPT}
                  simbolo={simbolo}
                  puedeVolver={puedeVolver}
                  hayPeriodoAnterior={mesCierre !== null}
                  onEntrar={entrar}
                  onSeleccionar={seleccionar}
                  onVolver={volver}
                  onEmpresa={irAEmpresa}
                  incrustado
                />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
