'use client';

// VISÃO FINANCEIRA 3D — LA EMPRESA POR DENTRO
//
// La estructura contable (Ativo / Passivo / Patrimônio Líquido → rubros → cuentas) como un edificio 3D
// que se recorre: girar, acercarse, seleccionar un área y entrar. Los datos son los de Informes → Balance
// (ver lib/visao3d.ts); la escena (three.js) se carga aparte, sin sumar peso al resto de la aplicación.
// Siempre hay una vista de lista equivalente (accesible y para equipos sin WebGL).

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { VolverLobby } from '@/components/nav/VolverLobby';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { PanelNodo } from '@/components/visao3d/PanelNodo';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { nombreCuentaDisplay } from '@/lib/i18n';
import { empresaTieneOnboardingCompleto } from '@/lib/onboarding';
import { cargarDatosVisao3D } from '@/lib/visao3dDatos';
import { empresaTieneVisao3D } from '@/lib/visao3dEmpresas';
import { construirEdificio, mesesDisponibles, movimientosDeCuenta, type AsientoVisao, type CuentaPlan, type EtiquetasGrupo, type NodoEdificio } from '@/lib/visao3d';
import { caminoResuelto, COLOR_GRUPO, disenarVolumenes, hijosVisibles, resolverNodo } from '@/lib/visao3dLayout';

const Escena = dynamic(() => import('@/components/visao3d/Escena'), {
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

  const [mes, setMes] = useState('TODOS');
  const [mostrarCeros, setMostrarCeros] = useState(false);
  const [focoId, setFocoId] = useState('empresa');
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [vista, setVista] = useState<'3d' | 'lista'>('3d');
  const [webgl, setWebgl] = useState(true);
  const [movimientoReducido, setMovimientoReducido] = useState(false);

  const esPT = idioma === 'PT';
  const simbolo = simboloMoneda(moneda);

  useEffect(() => {
    const ok = hayWebGL();
    setWebgl(ok);
    if (!ok) setVista('lista');
    setMovimientoReducido(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
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

      // Piloto: por ahora solo las empresas habilitadas (ver lib/visao3dEmpresas.ts).
      if (!empresaTieneVisao3D(perfil.empresa_id)) {
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

      const { data: empresa } = await supabase.from('empresas').select('moneda, idioma').eq('id', perfil.empresa_id).maybeSingle();
      setMoneda(empresa?.moneda ?? null);
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

  const foco = resolverNodo(edificio.raiz, focoId, mostrarCeros, etiquetaOtras) ?? edificio.raiz;
  const seleccionado = seleccionadoId ? resolverNodo(edificio.raiz, seleccionadoId, mostrarCeros, etiquetaOtras) : null;
  const nodoPanel = seleccionado ?? foco;

  const { volumenes } = useMemo(() => disenarVolumenes(foco, mostrarCeros, etiquetaOtras), [foco, mostrarCeros, etiquetaOtras]);
  const { visibles: hijosPanel, ocultosEnCero } = hijosVisibles(nodoPanel, mostrarCeros, etiquetaOtras);
  const camino = caminoResuelto(edificio.raiz, nodoPanel.id, mostrarCeros, etiquetaOtras);

  const movimientos = useMemo(
    () => (nodoPanel.esHoja && nodoPanel.cuentaNombre ? movimientosDeCuenta(nodoPanel.cuentaNombre, asientos, mesCierre) : []),
    [nodoPanel, asientos, mesCierre]
  );

  function entrar(nodo: NodoEdificio) {
    if (nodo.hijos.length === 0) {
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

  const puedeVolver = foco.id !== 'empresa' || Boolean(seleccionadoId);
  const cuadra = Math.abs(edificio.diferencia) < 0.5;

  const barra: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' };
  const boton = (activo: boolean): React.CSSProperties => ({
    border: `1px solid ${activo ? '#fff' : 'rgba(255,255,255,0.35)'}`,
    background: activo ? 'rgba(255,255,255,0.18)' : 'transparent',
    color: '#fff',
    borderRadius: 999,
    padding: '6px 14px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  });

  return (
    <main style={{ minHeight: '100vh', background: 'var(--fondo-app, linear-gradient(160deg, #0b1424 0%, #14284a 60%, #12382f 100%))', padding: '20px 16px 32px' }}>
      <style>{`
        .visao3d-cuerpo { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 14px; }
        .visao3d-lienzo { height: calc(100vh - 230px); min-height: 480px; }
        @media (max-width: 860px) {
          .visao3d-cuerpo { grid-template-columns: minmax(0, 1fr); }
          .visao3d-lienzo { height: 56vh; min-height: 340px; }
        }
      `}</style>

      <div style={{ maxWidth: 1250, margin: '0 auto', color: '#fff' }}>
        <VolverLobby>{esPT ? 'Voltar' : 'Volver'}</VolverLobby>

        <div style={{ ...barra, justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.3, color: '#7dd3fc' }}>VISÃO 3D</div>
            <h1 style={{ margin: 0, fontSize: 26 }}>🏢 {esPT ? 'A empresa por dentro' : 'La empresa por dentro'}</h1>
          </div>
          <AccesosHerramientas />
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        {cargando ? (
          <p>{esPT ? 'Carregando...' : 'Cargando...'}</p>
        ) : cuentas.length === 0 ? (
          <p>{esPT ? 'Ainda não há plano de contas para mostrar.' : 'Todavía no hay plan de cuentas para mostrar.'}</p>
        ) : (
          <>
            <div style={{ ...barra, marginBottom: 10 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>
                {esPT ? 'Saldos ao fechamento de' : 'Saldos al cierre de'}{' '}
                <select
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  style={{ marginLeft: 6, borderRadius: 8, padding: '5px 8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="TODOS">{esPT ? 'Hoje (tudo registrado)' : 'Hoy (todo lo registrado)'}</option>
                  {meses.map((m) => (
                    <option key={m} value={m}>
                      {formatoMes(m, esPT)}
                    </option>
                  ))}
                </select>
              </label>

              <button type="button" onClick={() => setMostrarCeros((v) => !v)} aria-pressed={mostrarCeros} style={boton(mostrarCeros)}>
                {mostrarCeros ? (esPT ? 'Ocultar contas em zero' : 'Ocultar cuentas en cero') : esPT ? 'Mostrar contas em zero' : 'Mostrar cuentas en cero'}
              </button>

              {webgl && (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <button type="button" onClick={() => setVista('3d')} aria-pressed={vista === '3d'} style={boton(vista === '3d')}>
                    🏢 3D
                  </button>
                  <button type="button" onClick={() => setVista('lista')} aria-pressed={vista === 'lista'} style={boton(vista === 'lista')}>
                    ☰ {esPT ? 'Lista' : 'Lista'}
                  </button>
                </span>
              )}

              <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: cuadra ? 'rgba(34,180,85,0.25)' : 'rgba(239,68,68,0.3)' }}>
                {cuadra
                  ? esPT
                    ? '✅ Ativo = Passivo + Patrimônio'
                    : '✅ Activo = Pasivo + Patrimonio'
                  : `⚠️ ${esPT ? 'Diferença' : 'Diferencia'}: ${simbolo} ${formatearNumeroEntero(edificio.diferencia)}`}
              </span>
            </div>

            <nav aria-label={esPT ? 'Caminho' : 'Ruta'} style={{ ...barra, gap: 4, fontSize: 13, marginBottom: 10 }}>
              {camino.map((n, i) => (
                <span key={n.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <span style={{ opacity: 0.6 }}>→</span>}
                  <button
                    type="button"
                    onClick={() => (n.id === 'empresa' ? irAEmpresa() : irACamino(n))}
                    style={{ border: 'none', background: 'transparent', color: i === camino.length - 1 ? '#fff' : n.nivel > 0 ? COLOR_GRUPO[n.grupo] : '#7dd3fc', fontWeight: 800, cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}
                  >
                    {n.nombre}
                  </button>
                </span>
              ))}
            </nav>

            <div className="visao3d-cuerpo">
              {vista === '3d' && webgl ? (
                <div className="visao3d-lienzo" style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', position: 'relative' }}>
                  <Escena
                    volumenes={volumenes}
                    focoId={foco.id}
                    seleccionadoId={seleccionadoId}
                    onSeleccionar={seleccionar}
                    onEntrar={entrar}
                    formatear={(v) => `${v < 0 ? '−' : ''}${simbolo} ${formatearNumeroEntero(Math.abs(v))}`}
                    movimientoReducido={movimientoReducido}
                  />
                  <div style={{ position: 'absolute', left: 10, bottom: 8, fontSize: 11, color: '#94a3b8', pointerEvents: 'none' }}>
                    {esPT ? 'Arraste para girar · pinça/roda para zoom · toque duas vezes para entrar' : 'Arrastrá para girar · pellizco/rueda para zoom · tocá dos veces para entrar'}
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(11,20,36,0.7)', borderRadius: 18, padding: 14, border: '1px solid rgba(255,255,255,0.12)' }}>
                  {!webgl && <p style={{ fontSize: 12.5, color: '#fcd34d' }}>{esPT ? 'Este dispositivo não suporta 3D: use a lista.' : 'Este dispositivo no soporta 3D: usá la lista.'}</p>}
                  {volumenes.flatMap((v) => (foco.nivel === 0 ? [v.nodo] : v.pisos.map((p) => p.nodo))).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => (foco.nivel === 0 || seleccionadoId === n.id ? entrar(n) : seleccionar(n))}
                      style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', border: 'none', borderLeft: `4px solid ${COLOR_GRUPO[n.grupo]}`, background: seleccionadoId === n.id ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)', color: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 6, cursor: 'pointer', fontSize: 14 }}
                    >
                      <span>{n.hijos.length > 0 ? '▸ ' : ''}{n.nombre}</span>
                      <b>{`${n.saldo < 0 ? '−' : ''}${simbolo} ${formatearNumeroEntero(Math.abs(n.saldo))}`}</b>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ maxHeight: 'calc(100vh - 230px)', minHeight: 0 }}>
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
                />
              </div>
            </div>

            <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 12 }}>
              {esPT
                ? 'Saldos calculados com os lançamentos validados (os mesmos do Balanço). O tamanho dos andares acompanha o valor, mas não é uma escala exata.'
                : 'Saldos calculados con los asientos validados (los mismos del Balance). El tamaño de los pisos acompaña al valor, pero no es una escala exacta.'}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
