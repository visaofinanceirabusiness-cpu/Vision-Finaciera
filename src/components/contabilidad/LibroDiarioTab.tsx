'use client';

// PESTAÑA 3 · LIBRO DIARIO
//
// Centro de seguimiento contable: consultar movimientos, recordar lo de los últimos días y seguir cargando sin perder el hilo.
// Modelo visual: cabecera con «Nuevo lanzamiento» (abre el Mini-Juego de siempre), indicadores, tres tarjetas de los últimos días,
// buscador global y tabla. Solo cambia la presentación: los datos, los filtros, los estados y el motor contable son los de antes.

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatearNumeroEntero } from '@/lib/moneda';
import { crearTraductor, nombreOperacionDisplay } from '@/lib/i18n';
import { enlaceWhatsapp } from '@/lib/whatsapp';
import { enlaceChat, mensajeDeVenta, ventaPorId } from '@/lib/whatsappVentas';
import {
  diccionarioContabilidad,
  msgErrorOperaciones,
  msgErrorAutomaticos,
  msgErrorEmpresa,
  contadorAsientos,
} from '@/app/contabilidad/i18n';
import { SimboloContext, EsFamiliarContext, IdiomaContext, COLORES } from './compartido';
import { cuentaDebe, cuentaHaber } from './estilosCompartidos';
import { Estado } from './celdas';
import { IndicadoresLibroDiario } from './IndicadoresLibroDiario';
import {
  aplicarFiltroIndicador,
  calcularIndicadores,
  filtrarPorRango,
  rangoAnterior,
  rangoDelPeriodo,
  type FiltroIndicador,
  type PeriodoLibro,
} from '@/lib/indicadoresLibroDiario';
import { coincideBusqueda, coincideGrupoTipo, estiloDeOperacion, ultimosTresDias, type GrupoTipo, type ResumenDia } from '@/lib/libroDiario';
import { EVENTO_MINIJUEGO_CERRADO, abrirMiniJuego } from '@/lib/miniJuegoEvento';
import { fechaLocalHoy } from '@/lib/fecha';

type MovimientoDiario = {
  empresa_id: string;
  id_operacion: string;
  fecha: string;
  operacion: string;
  historico: string | null;
  cuenta_debito: string | null;
  cuenta_credito: string | null;
  importe: number;
  estado: string | null;
  tipo_registro: 'OPERACION' | 'AUTOMATICO';
  // Solo presentes en filas tipo_registro==='OPERACION' — se usan para reenviar el comprobante de una Venta ya validada
  // (ver BotonReenviarComprobante) y para el buscador. Los registros_automaticos (CMV, etc.) no los tienen.
  cliente_proveedor?: string | null;
  forma_pago?: string | null;
  categoria?: string | null;
};

type GrupoOperacion = {
  id_operacion: string;
  fecha: string;
  filas: MovimientoDiario[];
};

// Cada cuánto se vuelve a leer Supabase mientras la pantalla está a la vista, y cuántas operaciones se dibujan de una vez.
const REFRESCO_MS = 45_000;
const GRUPOS_POR_TANDA = 30;

export function LibroDiarioTab() {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const esFamiliar = useContext(EsFamiliarContext);
  const t = crearTraductor(diccionarioContabilidad, idioma);
  const router = useRouter();
  const esPT = idioma === 'PT';

  const [filas, setFilas] = useState<MovimientoDiario[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoLibro>('MES');
  const [filtroIndicador, setFiltroIndicador] = useState<FiltroIndicador | null>(null);
  const [grupoTipo, setGrupoTipo] = useState<GrupoTipo>('TODOS');
  const [limite, setLimite] = useState(GRUPOS_POR_TANDA);
  const [actualizadoEn, setActualizadoEn] = useState<Date | null>(null);
  const tablaRef = useRef<HTMLDivElement | null>(null);

  async function cargar(empresaId: string) {
    setError('');

    const [
      { data: operaciones, error: errorOperaciones },
      { data: automaticos, error: errorAutomaticos },
    ] = await Promise.all([
      supabase
        .from('registro_operaciones')
        .select(
          `
          empresa_id,
          id_operacion,
          fecha,
          operacion,
          historico,
          cuenta_debito,
          cuenta_credito,
          total,
          estado,
          cliente_proveedor,
          forma_pago,
          categoria
          `
        )
        .eq('empresa_id', empresaId),

      supabase
        .from('registros_automaticos')
        .select(
          `
          empresa_id,
          id_operacion,
          fecha,
          tipo_registro,
          historico,
          cuenta_debito,
          cuenta_credito,
          importe,
          estado
          `
        )
        .eq('empresa_id', empresaId),
    ]);

    if (errorOperaciones) {
      setError(msgErrorOperaciones(idioma, errorOperaciones.message));
      setFilas([]);
      return;
    }

    if (errorAutomaticos) {
      setError(msgErrorAutomaticos(idioma, errorAutomaticos.message));
      setFilas([]);
      return;
    }

    const filasOperacion: MovimientoDiario[] = (operaciones ?? []).map((fila) => ({
      empresa_id: fila.empresa_id,
      id_operacion: fila.id_operacion,
      fecha: fila.fecha,
      operacion: fila.operacion,
      historico: fila.historico,
      cuenta_debito: fila.cuenta_debito,
      cuenta_credito: fila.cuenta_credito,
      importe: Number(fila.total ?? 0),
      estado: fila.estado,
      tipo_registro: 'OPERACION',
      cliente_proveedor: fila.cliente_proveedor,
      forma_pago: fila.forma_pago,
      categoria: fila.categoria,
    }));

    const filasAutomaticas: MovimientoDiario[] = (automaticos ?? []).map((fila) => ({
      empresa_id: fila.empresa_id,
      id_operacion: fila.id_operacion,
      fecha: fila.fecha,
      operacion: fila.tipo_registro,
      historico: fila.historico,
      cuenta_debito: fila.cuenta_debito,
      cuenta_credito: fila.cuenta_credito,
      importe: Number(fila.importe ?? 0),
      estado: fila.estado,
      tipo_registro: 'AUTOMATICO',
    }));

    const combinadas = [...filasOperacion, ...filasAutomaticas];

    combinadas.sort((a, b) => {
      const numeroA = parseInt(String(a.id_operacion).replace('OP-', ''), 10) || 0;
      const numeroB = parseInt(String(b.id_operacion).replace('OP-', ''), 10) || 0;

      if (numeroA !== numeroB) {
        return numeroB - numeroA;
      }

      if (a.tipo_registro !== b.tipo_registro) {
        return a.tipo_registro === 'OPERACION' ? -1 : 1;
      }

      return 0;
    });

    setFilas(combinadas);
  }

  useEffect(() => {
    async function iniciar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfil?.empresa_id) {
        setError(msgErrorEmpresa(idioma));
        setCargando(false);
        return;
      }

      setEmpresaId(perfil.empresa_id);

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nombre')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      setNombreEmpresa(empresaData?.nombre ?? '');

      await cargar(perfil.empresa_id);
      setCargando(false);
    }

    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const hoy = fechaLocalHoy();
  const rango = useMemo(() => rangoDelPeriodo(periodo, hoy), [periodo, hoy]);
  const filasDelPeriodo = useMemo(() => filtrarPorRango(filas, rango), [filas, rango]);
  const indicadores = useMemo(
    () => calcularIndicadores(filasDelPeriodo, rango ? filtrarPorRango(filas, rangoAnterior(rango)) : null, rango, hoy),
    [filasDelPeriodo, filas, rango, hoy]
  );
  const tresDias = useMemo(() => ultimosTresDias(filas, hoy), [filas, hoy]);

  // Con algo escrito en el buscador se mira TODO el historial (no solo el período elegido) y todos los campos de cada asiento.
  const hayBusqueda = busqueda.trim().length > 0;

  const visibles = useMemo(() => {
    const base = aplicarFiltroIndicador(hayBusqueda ? filas : filasDelPeriodo, filtroIndicador);
    return base.filter((fila) => coincideGrupoTipo(fila.operacion, grupoTipo) && (!hayBusqueda || coincideBusqueda(fila, busqueda, idioma, esFamiliar)));
  }, [filas, filasDelPeriodo, filtroIndicador, grupoTipo, hayBusqueda, busqueda, idioma, esFamiliar]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, GrupoOperacion>();

    for (const fila of visibles) {
      const existente = mapa.get(fila.id_operacion);

      if (existente) {
        existente.filas.push(fila);
      } else {
        mapa.set(fila.id_operacion, {
          id_operacion: fila.id_operacion,
          fecha: fila.fecha,
          filas: [fila],
        });
      }
    }

    return Array.from(mapa.values());
  }, [visibles]);

  const totalAsientos = visibles.length;
  const totalImportes = visibles.reduce((suma, fila) => suma + Number(fila.importe ?? 0), 0);
  const totalOperaciones = grupos.length;

  // Lectura silenciosa (sin pantalla de carga): al volver a la pestaña, cada ciertos segundos y al cerrar el Mini-Juego.
  const refrescar = useCallback(async () => {
    if (!empresaId) return;
    await cargar(empresaId);
    setActualizadoEn(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    const alVolver = () => {
      if (document.visibilityState === 'visible') void refrescar();
    };
    const id = window.setInterval(alVolver, REFRESCO_MS);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener(EVENTO_MINIJUEGO_CERRADO, refrescar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener(EVENTO_MINIJUEGO_CERRADO, refrescar);
    };
  }, [empresaId, refrescar]);

  // Cualquier cambio de filtro vuelve a la primera tanda.
  useEffect(() => setLimite(GRUPOS_POR_TANDA), [periodo, filtroIndicador, grupoTipo, busqueda]);

  function verDetalleDelDia(fecha: string) {
    setBusqueda('');
    setGrupoTipo('TODOS');
    setPeriodo('TODO');
    setFiltroIndicador({ tipo: 'dia', valor: fecha });
    window.setTimeout(() => tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  const chipsTipo: Array<{ id: GrupoTipo; texto: string }> = [
    { id: 'TODOS', texto: esPT ? 'Todos' : 'Todos' },
    { id: 'INGRESOS', texto: esPT ? '↑ Receitas' : '↑ Ingresos' },
    { id: 'EGRESOS', texto: esPT ? '↓ Despesas' : '↓ Egresos' },
    { id: 'TRANSFERENCIAS', texto: esPT ? '⇄ Transferências' : '⇄ Transferencias' },
  ];

  return (
    <div>
      <style>{`
        .ld-ultimos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .ld-dia:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(31,58,95,0.14); }
        .ld-fila:hover { background: #f4faf6; }
        @media (max-width: 900px) { .ld-ultimos { grid-template-columns: 1fr; } }
        @media (prefers-reduced-motion: reduce) { .ld-dia { transition: none !important; } }
      `}</style>

      {/* Cabecera: título, «Nuevo lanzamiento» (abre el Mini-Juego existente) y estado de la actualización. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <span aria-hidden style={{ width: 56, height: 56, borderRadius: 18, background: `linear-gradient(135deg, ${COLORES.azul}, ${COLORES.verde})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0, boxShadow: '0 8px 18px rgba(31,58,95,0.22)' }}>📖</span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 26, color: COLORES.azul, lineHeight: 1.1 }}>{esPT ? 'Livro Diário' : 'Libro Diario'}</h2>
            <div style={{ fontSize: 15, color: COLORES.gris, marginTop: 2 }}>{esPT ? 'Registro cronológico de todas as operações' : 'Registro cronológico de todas las operaciones'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void refrescar()} title={esPT ? 'Atualizar agora' : 'Actualizar ahora'} style={{ border: '1px solid #d6dee5', background: '#fff', color: COLORES.gris, borderRadius: 12, padding: '10px 12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            🔄 {actualizadoEn ? actualizadoEn.toLocaleTimeString(esPT ? 'pt-BR' : 'es-AR', { hour: '2-digit', minute: '2-digit' }) : esPT ? 'Atualizar' : 'Actualizar'}
          </button>
          <button
            type="button"
            onClick={abrirMiniJuego}
            title={esPT ? 'Abrir o Mini-Jogo para lançar uma operação' : 'Abrir el Mini-Juego para cargar una operación'}
            style={{ border: 'none', background: `linear-gradient(135deg, ${COLORES.verde}, ${COLORES.azul})`, color: '#fff', borderRadius: 14, padding: '12px 20px', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 18px rgba(46,139,87,0.3)' }}
          >
            <span aria-hidden style={{ fontSize: 20 }}>＋</span> 🎮 {esPT ? 'Novo lançamento' : 'Nuevo lanzamiento'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 15 }}>{error}</div>
      )}

      {!cargando && !error && (
        <IndicadoresLibroDiario
          indicadores={indicadores}
          periodo={periodo}
          onPeriodo={(nuevo) => {
            setPeriodo(nuevo);
            setFiltroIndicador(null);
          }}
          filtro={filtroIndicador}
          onFiltro={setFiltroIndicador}
          idioma={idioma ?? 'ES'}
          esFamiliar={esFamiliar}
          simbolo={simbolo}
          intermedio={<UltimosTresDias dias={tresDias} idioma={idioma} esFamiliar={esFamiliar} simbolo={simbolo} activo={filtroIndicador?.tipo === 'dia' ? filtroIndicador.valor : null} onDetalle={verDetalleDelDia} />}
        />
      )}

      {/* Tabla: buscador global + tipos + resumen. */}
      <div ref={tablaRef} style={{ scrollMarginTop: 90 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '14px 16px', marginBottom: 14, boxShadow: '0 4px 14px rgba(31,58,95,0.06)' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 0 }}>
              <span aria-hidden style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  // Un filtro de las tarjetas (p. ej. «Ver detalle» de un día) que quedó activo y fuera de pantalla hacía que
                  // la búsqueda no encontrara nada: al buscar se quita, y la búsqueda mira todo el historial.
                  if (e.target.value.trim() && filtroIndicador) setFiltroIndicador(null);
                }}
                placeholder={esPT ? 'Buscar em todos os campos (ID, data, conta, valor…)' : 'Buscar en todos los campos (ID, fecha, cuenta, importe…)'}
                title={esPT ? 'Busca por ID, data, operação, histórico, contas, valor, categoria, forma de pagamento e status' : 'Busca por ID, fecha, operación, histórico, cuentas, importe, categoría, forma de pago y estado'}
                aria-label={t('buscarLibroDiario')}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 40px', borderRadius: 14, border: '2px solid #d6dee5', fontSize: 15, color: COLORES.azul, background: '#f8fafc' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {chipsTipo.map((c) => (
                <button key={c.id} type="button" onClick={() => setGrupoTipo(c.id)} aria-pressed={grupoTipo === c.id} style={{ border: `2px solid ${grupoTipo === c.id ? COLORES.azul : '#d6dee5'}`, background: grupoTipo === c.id ? COLORES.azul : '#fff', color: grupoTipo === c.id ? '#fff' : COLORES.azul, borderRadius: 999, padding: '8px 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                  {c.texto}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <Resumen titulo={t('resumenOperaciones')} valor={String(totalOperaciones)} />
            <Resumen titulo={t('resumenAsientos')} valor={String(totalAsientos)} />
            <Resumen titulo={t('resumenImportes')} valor={`${simbolo} ${formatearNumeroEntero(totalImportes)}`} />
            {filtroIndicador && !hayBusqueda && (
              <button type="button" onClick={() => setFiltroIndicador(null)} title={esPT ? 'Remover filtro' : 'Quitar filtro'} style={{ border: 'none', background: '#fef3c7', color: '#78350f', borderRadius: 999, padding: '7px 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                🔎 {esPT ? 'Filtro' : 'Filtro'}: {etiquetaFiltro(filtroIndicador, idioma, esFamiliar)} ✕
              </button>
            )}
            {hayBusqueda && <span style={{ fontSize: 14, color: '#92400e', background: '#fef3c7', borderRadius: 999, padding: '6px 12px', fontWeight: 700 }}>🔎 {esPT ? 'Buscando em todo o histórico' : 'Buscando en todo el historial'}</span>}
          </div>
        </div>

        {cargando ? (
          <p style={{ fontSize: 16 }}>{t('cargandoLibroDiario')}</p>
        ) : !grupos.length ? (
          <div style={{ background: '#f8fafc', border: '2px dashed #d6dee5', borderRadius: 16, padding: 28, textAlign: 'center', color: COLORES.gris, fontSize: 16 }}>{t('sinMovimientosContables')}</div>
        ) : (
          <div>
            {grupos.slice(0, limite).map((grupo) => (
              <GrupoOperacionCard key={grupo.id_operacion} grupo={grupo} empresaId={empresaId} nombreEmpresa={nombreEmpresa} />
            ))}
            {grupos.length > limite && (
              <div style={{ textAlign: 'center', margin: '8px 0 20px' }}>
                <button type="button" onClick={() => setLimite((l) => l + GRUPOS_POR_TANDA)} style={{ border: `2px solid ${COLORES.verde}`, background: '#fff', color: COLORES.verde, borderRadius: 14, padding: '11px 24px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                  {esPT ? `Mostrar mais (${grupos.length - limite} restantes)` : `Mostrar más (${grupos.length - limite} restantes)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Texto corto del filtro activo (el mismo que muestra la cabecera de indicadores).
function etiquetaFiltro(filtro: FiltroIndicador, idioma: string | null, esFamiliar: boolean): string {
  const pt = idioma === 'PT';
  if (filtro.tipo === 'operacion') return nombreOperacionDisplay(idioma, filtro.valor, esFamiliar);
  if (filtro.tipo === 'dia') return new Date(`${filtro.valor}T12:00:00`).toLocaleDateString(pt ? 'pt-BR' : 'es-AR');
  if (filtro.valor === 'PENDIENTE') return pt ? 'Pendentes' : 'Pendientes';
  if (filtro.valor === 'VALIDADO') return 'Validados';
  if (filtro.valor === 'AUTOMATICO') return 'Automáticos';
  if (filtro.valor === 'OPERACION') return pt ? 'Manuais' : 'Manuales';
  return filtro.valor;
}

// Tres tarjetas con lo último que se cargó: hoy, ayer y hace dos días. Tocar «Ver detalle» filtra la tabla por ese día.
function UltimosTresDias({ dias, idioma, esFamiliar, simbolo, activo, onDetalle }: { dias: ResumenDia[]; idioma: string | null; esFamiliar: boolean; simbolo: string; activo: string | null; onDetalle: (fecha: string) => void }) {
  const esPT = idioma === 'PT';
  const nombres = { HOY: esPT ? 'Hoje' : 'Hoy', AYER: esPT ? 'Ontem' : 'Ayer', HACE_2: esPT ? 'Há 2 dias' : 'Hace 2 días' };
  const fondos = ['linear-gradient(160deg, #eef6ff, #ffffff)', 'linear-gradient(160deg, #f1f7ff, #ffffff)', 'linear-gradient(160deg, #edf8f1, #ffffff)'];
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 20, color: COLORES.azul }}>📅 {esPT ? 'Últimos 3 dias' : 'Últimos 3 días'}</h3>
        <span style={{ fontSize: 14, color: COLORES.gris }}>{esPT ? 'Resumo das operações recentes' : 'Resumen de las operaciones recientes'}</span>
      </div>
      <div className="ld-ultimos">
        {dias.map((d, i) => {
          const fecha = new Date(`${d.fecha}T12:00:00`).toLocaleDateString(esPT ? 'pt-BR' : 'es-AR', { day: '2-digit', month: 'short' });
          return (
            <article key={d.etiqueta} className="ld-dia" style={{ background: fondos[i], border: `2px solid ${activo === d.fecha ? COLORES.verde : '#dbe7f1'}`, borderRadius: 20, padding: '14px 16px', transition: 'transform .15s, box-shadow .15s', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: COLORES.azul }}>{nombres[d.etiqueta]} <span style={{ fontWeight: 600, color: COLORES.gris, fontSize: 15 }}>· {fecha}</span></div>
                <span style={{ background: d.operaciones > 0 ? '#dcfce7' : '#f1f5f9', color: d.operaciones > 0 ? '#166534' : COLORES.gris, borderRadius: 999, padding: '4px 11px', fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {d.operaciones} {d.operaciones === 1 ? (esPT ? 'operação' : 'operación') : esPT ? 'operações' : 'operaciones'}
                </span>
              </div>

              <div style={{ flex: 1 }}>
                {d.movimientos.length === 0 ? (
                  <div style={{ fontSize: 15, color: COLORES.gris, padding: '10px 0' }}>{esPT ? 'Sem operações neste dia.' : 'Sin operaciones este día.'}</div>
                ) : (
                  d.movimientos.map((m) => {
                    const estilo = estiloDeOperacion(m.operacion);
                    return (
                      <div key={m.id_operacion + m.operacion} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid #e8eef4', fontSize: 15 }}>
                        <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, background: estilo.fondo, color: estilo.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>{estilo.flecha}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 800, color: COLORES.azul, lineHeight: 1.2 }}>{nombreOperacionDisplay(idioma, m.operacion, esFamiliar)}</div>
                          <div style={{ fontSize: 13.5, color: COLORES.gris, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.historico || '—'}</div>
                        </div>
                        <strong style={{ whiteSpace: 'nowrap', color: estilo.color }}>{simbolo} {formatearNumeroEntero(m.importe)}</strong>
                      </div>
                    );
                  })
                )}
                {d.restantes > 0 && <div style={{ fontSize: 13.5, color: COLORES.gris, paddingTop: 4 }}>+ {d.restantes} {esPT ? 'mais' : 'más'}</div>}
              </div>

              <button type="button" onClick={() => onDetalle(d.fecha)} disabled={d.operaciones === 0 && d.restantes === 0} style={{ marginTop: 10, border: 'none', background: 'none', color: d.operaciones === 0 ? '#9ca3af' : COLORES.verde, fontWeight: 800, fontSize: 15, cursor: d.operaciones === 0 ? 'default' : 'pointer', textAlign: 'left', padding: 0 }}>
                {esPT ? 'Ver detalhe' : 'Ver detalle'} →
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GrupoOperacionCard({
  grupo,
  empresaId,
  nombreEmpresa,
}: {
  grupo: GrupoOperacion;
  empresaId: string | null;
  nombreEmpresa: string;
}) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const esFamiliar = useContext(EsFamiliarContext);
  const t = crearTraductor(diccionarioContabilidad, idioma);
  const esPT = idioma === 'PT';
  const importeGrupo = grupo.filas.reduce((suma, fila) => suma + Number(fila.importe ?? 0), 0);
  // Pago dividido: una operación con más de una fila de tipo OPERACION (una por forma de pago / categoría).
  const filasOperacion = grupo.filas.filter((f) => f.tipo_registro === 'OPERACION');
  const esDividida = filasOperacion.length > 1;
  const totalOperacion = filasOperacion.reduce((suma, fila) => suma + Number(fila.importe ?? 0), 0);
  const mediosOperacion = filasOperacion.map((f) => f.forma_pago).filter(Boolean).join(' + ');
  const cabecera: React.CSSProperties = { padding: '12px 10px', color: '#475569', fontSize: 13, textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 800, letterSpacing: 0.3 };
  const celda: React.CSSProperties = { padding: '11px 10px', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <section style={{ marginBottom: 14, border: '1px solid #dfe7ee', borderRadius: 20, overflow: 'hidden', background: '#ffffff', boxShadow: '0 4px 14px rgba(31,58,95,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 18px', background: 'linear-gradient(90deg, #eef5fa, #f7fbf8)', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: COLORES.azul }}>{grupo.id_operacion}</span>
          <span style={{ fontSize: 14, color: COLORES.gris }}>📅 {new Date(`${grupo.fecha}T12:00:00`).toLocaleDateString(esPT ? 'pt-BR' : 'es-AR')}</span>
          <span style={{ padding: '5px 11px', borderRadius: 999, background: '#eaf7ee', color: '#247347', fontSize: 13, fontWeight: 700 }}>{contadorAsientos(idioma, grupo.filas.length)}</span>
          {esDividida && (
            <span style={{ padding: '5px 11px', borderRadius: 999, background: '#eef2ff', color: '#3730a3', fontSize: 13, fontWeight: 700 }}>
              ➗ {esPT ? `Pagamento dividido em ${filasOperacion.length}` : `Pago dividido en ${filasOperacion.length}`}
            </span>
          )}
        </div>
        {empresaId && filasOperacion.length > 0 && ['VENTA', 'COBRO'].includes(filasOperacion[0].operacion) && (filasOperacion[0].estado || '').toUpperCase() === 'VALIDADO' && filasOperacion[0].cliente_proveedor && (
          <BotonWhatsappVenta empresaId={empresaId} nombreEmpresa={nombreEmpresa} idioma={idioma} simbolo={simbolo} idOperacion={grupo.id_operacion} cliente={filasOperacion[0].cliente_proveedor} />
        )}
        <div style={{ fontSize: 15, color: COLORES.gris }}>
          {t('importeRegistrado')} <strong style={{ color: COLORES.azul, fontSize: 17 }}>{simbolo} {formatearNumeroEntero(importeGrupo)}</strong>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 1150, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          {/* Mismo ancho de columnas en todas las operaciones, para que se lea como una sola tabla. */}
          <colgroup>
            {[126, 128, 170, 100, 110, 110, 110, 110, 186].map((ancho, i) => (
              <col key={i} style={{ width: ancho }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <th style={cabecera}>{t('tipoHeader')}</th>
              <th style={cabecera}>{t('operacion')}</th>
              <th style={cabecera}>{t('historico')}</th>
              <th style={cabecera}>{esPT ? 'Categoria' : 'Categoría'}</th>
              <th style={cabecera}>{esPT ? 'Forma de pagamento' : 'Forma de pago'}</th>
              <th style={cabecera}>{t('debeHeader')}</th>
              <th style={cabecera}>{t('haberHeader')}</th>
              <th style={{ ...cabecera, textAlign: 'right' }}>{t('importeHeader')}</th>
              <th style={cabecera}>{t('estadoHeader')}</th>
            </tr>
          </thead>

          <tbody>
            {grupo.filas.map((fila, indice) => {
              const estilo = estiloDeOperacion(fila.operacion);
              return (
                <tr key={`${fila.id_operacion}-${fila.tipo_registro}-${indice}`} className="ld-fila" style={{ borderTop: '1px solid #edf1f4' }}>
                  <td style={celda}>
                    <TipoRegistro tipo={fila.tipo_registro} idioma={idioma} />
                  </td>

                  <td style={celda}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span aria-hidden style={{ width: 24, height: 24, borderRadius: 8, background: estilo.fondo, color: estilo.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{estilo.flecha}</span>
                      <strong style={{ color: COLORES.azul }}>{nombreOperacionDisplay(idioma, fila.operacion, esFamiliar)}</strong>
                    </span>
                  </td>

                  <td style={{ ...celda, whiteSpace: 'normal' }}>{fila.historico || '—'}</td>
                  <td style={celda}>{fila.categoria || '—'}</td>
                  <td style={celda}>{fila.forma_pago || '—'}</td>

                  <td style={celda}>
                    <span style={cuentaDebe}>{fila.cuenta_debito || '—'}</span>
                  </td>

                  <td style={celda}>
                    <span style={cuentaHaber}>{fila.cuenta_credito || '—'}</span>
                  </td>

                  <td style={{ ...celda, textAlign: 'right' }}>
                    <strong style={{ color: estilo.color, fontSize: 16 }}>{simbolo} {formatearNumeroEntero(Number(fila.importe ?? 0))}</strong>
                  </td>

                  <td style={celda}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Estado estado={fila.estado} idioma={idioma} />

                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// WhatsApp de una venta o cobro ya validado, bien a la vista en la cabecera de la operación: manda el comprobante completo (cantidad, producto,
// precio por unidad, total y forma de pago) o abre el chat con el cliente. Mismo mecanismo que /whatsapp (ver lib/whatsappVentas.ts).
function BotonWhatsappVenta({
  empresaId,
  nombreEmpresa,
  idioma,
  simbolo,
  idOperacion,
  cliente,
}: {
  empresaId: string;
  nombreEmpresa: string;
  idioma: string | null;
  simbolo: string;
  idOperacion: string;
  cliente: string;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const esPT = idioma === 'PT';

  async function enviar(conMensaje: boolean) {
    setCargando(true);
    setError('');
    try {
      const venta = await ventaPorId(empresaId, idOperacion);
      if (!venta?.telefono) {
        setError(esPT ? 'Esse cliente não tem telefone cadastrado.' : 'Ese cliente no tiene teléfono cargado.');
        return;
      }
      const enlace = conMensaje ? enlaceWhatsapp(venta.telefono, mensajeDeVenta(venta, nombreEmpresa, idioma, simbolo)) : enlaceChat(venta.telefono);
      window.open(enlace, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  const estiloBoton: React.CSSProperties = { border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 800, cursor: cargando ? 'default' : 'pointer', opacity: cargando ? 0.7 : 1 };

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={cargando} onClick={() => enviar(true)} title={cliente} style={{ ...estiloBoton, background: '#25D366', color: '#fff' }}>
          📲 {esPT ? 'Enviar comprovante' : 'Enviar comprobante'}
        </button>
        <button type="button" disabled={cargando} onClick={() => enviar(false)} style={{ ...estiloBoton, background: '#e7f9ef', color: '#166534', border: '1px solid #25D366' }}>
          💬 {esPT ? 'Conversar' : 'Chatear'}
        </button>
      </span>
      {error && <span style={{ fontSize: 12, color: '#dc2626' }}>{error}</span>}
    </span>
  );
}


function TipoRegistro({ tipo, idioma }: { tipo: 'OPERACION' | 'AUTOMATICO'; idioma: string | null }) {
  const automatico = tipo === 'AUTOMATICO';
  const t = crearTraductor(diccionarioContabilidad, idioma);

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 11px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        background: automatico ? '#ede9fe' : '#eaf7ee',
        color: automatico ? '#6d28d9' : '#247347',
      }}
    >
      {automatico ? t('automatico') : t('operacionEtiqueta')}
    </span>
  );
}



function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 12, padding: '8px 14px', minWidth: 110 }}>
      <div style={{ fontSize: 12.5, color: COLORES.gris, marginBottom: 2 }}>{titulo}</div>
      <strong style={{ color: COLORES.azul, fontSize: 17 }}>{valor}</strong>
    </div>
  );
}
