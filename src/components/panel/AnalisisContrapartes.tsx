'use client';

// ANÁLISIS DE CLIENTES / PROVEEDORES — pestaña "Análisis" de Recursos
// Humanos. Solo lectura: arma indicadores, ranking, evolución y
// frecuencia a partir de registro_operaciones (ver
// lib/analisisContrapartes.ts). En Familia son fuentes de ingreso y
// destinos de pago.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { obtenerIndicadores, type IndicadoresPanel } from '@/lib/contabilidad';
import { fechaLocalHoy, formatearPeriodo } from '@/lib/fecha';
import {
  analizarContrapartes,
  fichaDeContraparte,
  grafiasPorRevisar,
  operacionesSinContraparte,
  saldosPorContraparte,
  normalizarNombre,
  type EtiquetaFrecuencia,
  type OperacionTercero,
  type TipoContraparte,
  type TiposDeCuenta,
} from '@/lib/analisisContrapartes';
import { DistribucionPieChart } from './DistribucionPieChart';

type Persona = { nombre: string; fecha_alta: string | null };

type Colores = { azul: string; verde: string; gris: string; blanco: string };

const TAMANO_PAGINA = 1000;

async function cargarOperaciones(empresaId: string): Promise<OperacionTercero[]> {
  const todas: OperacionTercero[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from('registro_operaciones')
      .select('id, fecha, operacion, total, cliente_proveedor, estado, categoria, historico, id_operacion, cuenta_debito, cuenta_credito')
      .eq('empresa_id', empresaId)
      .in('operacion', ['VENTA', 'COMPRA', 'COBRO', 'PAGO'])
      .order('fecha', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) throw error;
    todas.push(...((data ?? []) as OperacionTercero[]));
    if (!data || data.length < TAMANO_PAGINA) break;
  }
  return todas;
}

export function AnalisisContrapartes({
  empresaId,
  esFamiliar,
  idioma,
  simbolo,
  clientes,
  proveedores,
  colores,
  fichaPedida,
  onFichaAbierta,
  onDarDeAlta,
}: {
  empresaId: string;
  esFamiliar: boolean;
  idioma: string | null;
  simbolo: string;
  clientes: Persona[];
  proveedores: Persona[];
  colores: Colores;
  // Viene de Clientes / Proveedores (botón "Ver análisis"): abre esa ficha.
  fichaPedida?: { tipo: TipoContraparte; nombre: string } | null;
  onFichaAbierta?: () => void;
  // Abre el formulario de alta de RRHH ya con el nombre cargado.
  onDarDeAlta: (tipo: TipoContraparte, nombre: string, fechaAlta: string) => void;
}) {
  const esPT = idioma === 'PT';
  const locale = esPT ? 'pt-BR' : 'es-AR';
  const hoy = fechaLocalHoy();
  const mesActual = hoy.slice(0, 7);

  const [operaciones, setOperaciones] = useState<OperacionTercero[] | null>(null);
  const [tiposCuenta, setTiposCuenta] = useState<TiposDeCuenta | undefined>(undefined);
  const [planCuentas, setPlanCuentas] = useState<Array<{ nombre: string; saldo_inicial: number | null; naturaleza: string | null }>>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresPanel | null>(null);
  const [error, setError] = useState(false);
  const [tipo, setTipo] = useState<TipoContraparte>('clientes');
  const [periodo, setPeriodo] = useState(mesActual);
  const [verTodasFrecuencia, setVerTodasFrecuencia] = useState(false);
  const [fichaAbierta, setFichaAbierta] = useState<string | null>(null);
  const [unificando, setUnificando] = useState<string | null>(null);
  const [errorUnificar, setErrorUnificar] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [verTodasSinNombre, setVerTodasSinNombre] = useState(false);
  const [nombresEscritos, setNombresEscritos] = useState<Record<string, string>>({});
  const [asignando, setAsignando] = useState<string | null>(null);

  useEffect(() => {
    if (!fichaPedida) return;
    setTipo(fichaPedida.tipo);
    setPeriodo('TODOS');
    setFichaAbierta(normalizarNombre(fichaPedida.nombre));
    onFichaAbierta?.();
  }, [fichaPedida, onFichaAbierta]);

  useEffect(() => {
    let vigente = true;
    supabase
      .from('plan_cuentas')
      .select('nombre, tipo_saldo, saldo_inicial, naturaleza')
      .eq('empresa_id', empresaId)
      .then(({ data }) => {
        if (!vigente || !data) return;
        setTiposCuenta(new Map(data.map((c) => [c.nombre as string, (c.tipo_saldo ?? '') as string])));
        setPlanCuentas(data.map((c) => ({ nombre: c.nombre as string, saldo_inicial: c.saldo_inicial as number | null, naturaleza: c.naturaleza as string | null })));
      });
    obtenerIndicadores(empresaId, 'TODOS')
      .then((datos) => vigente && setIndicadores(datos))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [empresaId]);

  useEffect(() => {
    let vigente = true;
    cargarOperaciones(empresaId)
      .then((datos) => vigente && setOperaciones(datos))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, [empresaId, recarga]);

  const periodos = useMemo(() => {
    const claves = new Set<string>([mesActual]);
    for (const o of operaciones ?? []) claves.add(o.fecha.slice(0, 7));
    return [...claves].sort((a, b) => b.localeCompare(a));
  }, [operaciones, mesActual]);

  const fechasAlta = useMemo(() => {
    const mapa = new Map<string, string | null>();
    for (const p of tipo === 'clientes' ? clientes : proveedores) mapa.set(normalizarNombre(p.nombre), p.fecha_alta);
    return mapa;
  }, [tipo, clientes, proveedores]);

  const analisis = useMemo(
    () => analizarContrapartes({ operaciones: operaciones ?? [], tipo, esFamiliar, periodo, hoy, fechasAlta, tiposCuenta }),
    [operaciones, tipo, esFamiliar, periodo, hoy, fechasAlta, tiposCuenta]
  );

  const altas = useMemo(() => (tipo === 'clientes' ? clientes : proveedores).map((p) => p.nombre), [tipo, clientes, proveedores]);

  const porRevisar = useMemo(
    () => grafiasPorRevisar({ operaciones: operaciones ?? [], tipo, esFamiliar, altas }),
    [operaciones, tipo, esFamiliar, altas]
  );

  const cuentasPendientes = useMemo(() => {
    if (!indicadores) return [];
    if (tipo === 'clientes') return indicadores.composicionActivoGrupos.find((g) => g.id === 'POR_COBRAR')?.cuentas ?? [];
    return indicadores.composicionPasivoGrupos
      .filter((g) => g.id === 'CUENTAS_PAGAR' || g.id === 'OTROS')
      .flatMap((g) => g.cuentas)
      .sort((a, b) => b.valor - a.valor);
  }, [indicadores, tipo]);
  const totalPendientePanel = cuentasPendientes.reduce((suma, c) => suma + c.valor, 0);

  const saldos = useMemo(() => {
    if (esFamiliar || cuentasPendientes.length === 0) return null;
    const nombresCuentas = new Set(cuentasPendientes.map((c) => c.nombre));
    return saldosPorContraparte({
      operaciones: operaciones ?? [],
      cuentas: planCuentas.filter((c) => nombresCuentas.has(c.nombre)).map((c) => ({ nombre: c.nombre, saldoInicial: Number(c.saldo_inicial ?? 0), naturaleza: c.naturaleza })),
      lado: tipo === 'clientes' ? 'COBRAR' : 'PAGAR',
    });
  }, [esFamiliar, cuentasPendientes, operaciones, planCuentas, tipo]);

  const sinNombre = useMemo(
    () => operacionesSinContraparte({ operaciones: operaciones ?? [], tipo, esFamiliar }),
    [operaciones, tipo, esFamiliar]
  );
  const sugeridas = useMemo(() => sinNombre.filter((o) => o.sugerencia), [sinNombre]);

  async function asignarNombre(ids: string[], nombre: string, clave: string) {
    const limpio = nombre.trim();
    if (!limpio || ids.length === 0) return;

    setAsignando(clave);
    setErrorUnificar('');
    const { error: errorUpdate } = await supabase
      .from('registro_operaciones')
      .update({ cliente_proveedor: limpio })
      .eq('empresa_id', empresaId)
      .in('id', ids);
    setAsignando(null);

    if (errorUpdate) {
      setErrorUnificar(esPT ? 'Não foi possível atribuir. Tente novamente.' : 'No se pudo asignar. Probá de nuevo.');
      return;
    }
    setRecarga((n) => n + 1);
  }

  async function asignarSugeridas() {
    const pregunta = esPT
      ? `Vai atribuir o nome sugerido a ${sugeridas.length} operações (o nome vem do histórico de cada uma). Continuar?`
      : `Vas a asignar el nombre sugerido a ${sugeridas.length} operaciones (el nombre sale del histórico de cada una). ¿Continuar?`;
    if (!window.confirm(pregunta)) return;

    const porNombre = new Map<string, string[]>();
    for (const o of sugeridas) porNombre.set(o.sugerencia!, [...(porNombre.get(o.sugerencia!) ?? []), o.id]);

    setAsignando('SUGERIDAS');
    setErrorUnificar('');
    for (const [nombre, ids] of porNombre) {
      const { error: errorUpdate } = await supabase
        .from('registro_operaciones')
        .update({ cliente_proveedor: nombre })
        .eq('empresa_id', empresaId)
        .in('id', ids);
      if (errorUpdate) {
        setAsignando(null);
        setErrorUnificar(esPT ? 'Não foi possível atribuir todas. Tente novamente.' : 'No se pudieron asignar todas. Probá de nuevo.');
        setRecarga((n) => n + 1);
        return;
      }
    }
    setAsignando(null);
    setRecarga((n) => n + 1);
  }

  const ficha = useMemo(
    () =>
      fichaAbierta
        ? fichaDeContraparte({ operaciones: operaciones ?? [], tipo, esFamiliar, clave: fichaAbierta, periodo, hoy, tiposCuenta })
        : null,
    [fichaAbierta, operaciones, tipo, esFamiliar, periodo, hoy, tiposCuenta]
  );

  async function unificar(grafia: string, destino: string) {
    const pregunta = esPT
      ? `Vai trocar "${grafia}" por "${destino}" em todas as operações que usam esse nome. Continuar?`
      : `Vas a reemplazar "${grafia}" por "${destino}" en todas las operaciones que usan ese nombre. ¿Continuar?`;
    if (!window.confirm(pregunta)) return;

    setUnificando(grafia);
    setErrorUnificar('');
    const { error: errorUpdate } = await supabase
      .from('registro_operaciones')
      .update({ cliente_proveedor: destino })
      .eq('empresa_id', empresaId)
      .eq('cliente_proveedor', grafia);
    setUnificando(null);

    if (errorUpdate) {
      setErrorUnificar(esPT ? 'Não foi possível unificar. Tente novamente.' : 'No se pudo unificar. Probá de nuevo.');
      return;
    }
    setRecarga((n) => n + 1);
  }

  const nombres = useMemo(() => {
    if (esFamiliar) {
      return tipo === 'clientes'
        ? { plural: esPT ? 'Fontes de renda' : 'Fuentes de ingreso', emoji: '💰', total: esPT ? 'Total recebido' : 'Total recibido', unidad: esPT ? 'fontes' : 'fuentes' }
        : { plural: esPT ? 'Destinos de pagamento' : 'Destinos de pago', emoji: '🏪', total: esPT ? 'Total pago' : 'Total pagado', unidad: esPT ? 'destinos' : 'destinos' };
    }
    return tipo === 'clientes'
      ? { plural: 'Clientes', emoji: '👥', total: esPT ? 'Total vendido' : 'Total vendido', unidad: 'clientes' }
      : { plural: esPT ? 'Fornecedores' : 'Proveedores', emoji: '🏢', total: esPT ? 'Total comprado' : 'Total comprado', unidad: esPT ? 'fornecedores' : 'proveedores' };
  }, [esFamiliar, tipo, esPT]);

  const formatear = (valor: number) =>
    `${simbolo} ${valor.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatearFecha = (fecha: string) => new Date(`${fecha}T00:00:00`).toLocaleDateString(locale);

  if (error) {
    return <div style={avisoStyle}>{esPT ? 'Não foi possível carregar as operações.' : 'No se pudieron cargar las operaciones.'}</div>;
  }

  if (!operaciones) {
    return <div style={avisoStyle}>{esPT ? 'Carregando análise...' : 'Cargando análisis...'}</div>;
  }

  const unico = analisis.liquidacionesSinAsignar.operaciones === 1;
  const top = analisis.ranking.slice(0, 10);
  const maxTop = Math.max(...top.map((r) => r.valor), 1);

  const cinco = analisis.ranking.slice(0, 5);
  const resto = analisis.ranking.slice(5).reduce((suma, r) => suma + r.valor, 0);
  const datosPareto = [
    ...cinco.map((r) => ({ nombre: r.nombre, valor: r.valor })),
    ...(resto > 0 ? [{ nombre: esPT ? 'Outros' : 'Otros', valor: resto }] : []),
  ];

  const maxMes = Math.max(...analisis.evolucion.map((m) => m.valor), 1);
  const filasFrecuencia = verTodasFrecuencia ? analisis.frecuencia : analisis.frecuencia.slice(0, 12);

  const tarjetas: Array<{ etiqueta: string; valor: string; color: string; ayuda?: string }> = [
    { etiqueta: nombres.total, valor: formatear(analisis.total), color: colores.verde },
    { etiqueta: esPT ? 'Operações' : 'Operaciones', valor: String(analisis.operaciones), color: colores.azul },
    { etiqueta: esPT ? 'Ticket médio' : 'Ticket promedio', valor: formatear(analisis.ticketPromedio), color: colores.azul },
    { etiqueta: esPT ? `${nombres.plural} ativos` : `${nombres.plural} activos`, valor: String(analisis.activos), color: colores.azul },
    { etiqueta: esPT ? 'Novos no período' : 'Nuevos en el período', valor: String(analisis.nuevos), color: '#7c3aed' },
    {
      etiqueta: esPT ? 'Concentração top 3' : 'Concentración top 3',
      valor: `${analisis.concentracionTop3.toFixed(0)}%`,
      color: analisis.concentracionTop3 >= 70 ? '#dc2626' : analisis.concentracionTop3 >= 50 ? '#d97706' : colores.verde,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['clientes', 'proveedores'] as const).map((valor) => {
            const activo = tipo === valor;
            const etiqueta = esFamiliar
              ? valor === 'clientes' ? (esPT ? '💰 Fontes de renda' : '💰 Fuentes de ingreso') : (esPT ? '🏪 Destinos de pagamento' : '🏪 Destinos de pago')
              : valor === 'clientes' ? '👥 Clientes' : esPT ? '🏢 Fornecedores' : '🏢 Proveedores';
            return (
              <button
                key={valor}
                type="button"
                onClick={() => setTipo(valor)}
                style={{
                  border: `1px solid ${activo ? colores.azul : '#d1d5db'}`,
                  background: activo ? colores.azul : '#ffffff',
                  color: activo ? '#ffffff' : '#1f2937',
                  borderRadius: 999,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {etiqueta}
              </button>
            );
          })}
        </div>

        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: 12, border: `1px solid ${colores.verde}`, background: '#fbfcfd', color: colores.azul, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          {periodos.map((clave) => (
            <option key={clave} value={clave}>
              {formatearPeriodo(clave, esPT)}
            </option>
          ))}
          <option value="TODOS">{esPT ? 'Todos os períodos' : 'Todos los períodos'}</option>
        </select>
      </div>

      {/* INDICADORES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        {tarjetas.map((t) => (
          <div key={t.etiqueta} style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: '14px 16px', background: '#fbfcfd' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: COLORES_GRIS, textTransform: 'uppercase' }}>{t.etiqueta}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: t.color, marginTop: 4 }}>{t.valor}</div>
          </div>
        ))}
      </div>

      {(analisis.sinContraparte.operaciones > 0 || analisis.liquidacionesSinAsignar.operaciones > 0) && (
        <div style={{ ...avisoStyle, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', textAlign: 'left', marginBottom: 18, lineHeight: 1.6 }}>
          {analisis.sinContraparte.operaciones > 0 && (
            <div>
              ⚠️{' '}
              {esPT
                ? `${analisis.sinContraparte.operaciones} operações (${formatear(analisis.sinContraparte.importe)}) sem ${esFamiliar ? 'nome' : tipo === 'clientes' ? 'cliente' : 'fornecedor'} atribuído: entram no total, mas não no ranking.`
                : `${analisis.sinContraparte.operaciones} operaciones (${formatear(analisis.sinContraparte.importe)}) sin ${esFamiliar ? 'nombre' : tipo === 'clientes' ? 'cliente' : 'proveedor'} asignado: suman al total, pero no al ranking.`}
            </div>
          )}
          {analisis.liquidacionesSinAsignar.operaciones > 0 && (
            <div>
              ⚠️{' '}
              {esPT
                ? `Falta atribuir ${analisis.liquidacionesSinAsignar.operaciones} ${unico ? (tipo === 'clientes' ? 'recebimento' : 'pagamento') : tipo === 'clientes' ? 'recebimentos' : 'pagamentos'} (${formatear(analisis.liquidacionesSinAsignar.importe)}) a ${tipo === 'clientes' ? 'um cliente' : 'um fornecedor'}. Sem isso ainda não calculamos saldos por ${tipo === 'clientes' ? 'cliente' : 'fornecedor'}.`
                : `Falta asignar ${analisis.liquidacionesSinAsignar.operaciones} ${unico ? (tipo === 'clientes' ? 'cobro' : 'pago') : tipo === 'clientes' ? 'cobros' : 'pagos'} (${formatear(analisis.liquidacionesSinAsignar.importe)}) a ${tipo === 'clientes' ? 'un cliente' : 'un proveedor'}. Sin eso todavía no calculamos saldos por ${tipo === 'clientes' ? 'cliente' : 'proveedor'}.`}
            </div>
          )}
        </div>
      )}

      {/* RANKING + REPARTO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 18 }}>
        <div style={tarjetaStyle}>
          <h3 style={tituloStyle(colores.azul)}>
            🏆 {esPT ? `Top ${nombres.plural.toLowerCase()}` : `Top ${nombres.plural.toLowerCase()}`}
          </h3>
          <p style={subtituloStyle}>{esPT ? 'Maiores valores no período' : 'Mayores valores del período'}</p>

          {top.length === 0 ? (
            <div style={vacioStyle}>{esPT ? 'Sem dados neste período.' : 'Sin datos en este período.'}</div>
          ) : (
            top.map((fila, i) => (
              <div key={fila.nombre} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: '#1f2937', overflowWrap: 'anywhere' }}>
                    {i + 1}.{' '}
                    <button type="button" onClick={() => setFichaAbierta(normalizarNombre(fila.nombre))} style={botonNombre(colores.azul)}>
                      {fila.nombre}
                    </button>
                  </span>
                  <span style={{ whiteSpace: 'nowrap', color: colores.azul, fontWeight: 800 }}>
                    {formatear(fila.valor)} <span style={{ color: COLORES_GRIS, fontWeight: 600 }}>· {fila.porcentaje.toFixed(0)}%</span>
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#e7edf1', marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(fila.valor / maxTop) * 100}%`, height: '100%', borderRadius: 999, background: tipo === 'clientes' ? colores.verde : '#c2410c' }} />
                </div>
                <div style={{ fontSize: 11, color: COLORES_GRIS, marginTop: 2 }}>
                  {fila.operaciones} {esPT ? (fila.operaciones === 1 ? 'operação' : 'operações') : fila.operaciones === 1 ? 'operación' : 'operaciones'}
                </div>
              </div>
            ))
          )}
        </div>

        <DistribucionPieChart
          datos={datosPareto}
          simbolo={simbolo}
          idioma={esPT ? 'PT' : 'ES'}
          titulo={`🥧 ${esPT ? 'Distribuição' : 'Distribución'}`}
          subtitulo={esPT ? 'Peso de cada um sobre o total atribuído' : 'Peso de cada uno sobre el total atribuido'}
          mensajeVacio={esPT ? 'Sem dados neste período.' : 'Sin datos en este período.'}
        />
      </div>

      {/* EVOLUCIÓN */}
      <div style={{ ...tarjetaStyle, marginBottom: 18 }}>
        <h3 style={tituloStyle(colores.azul)}>📈 {esPT ? 'Evolução mensal' : 'Evolución mensual'}</h3>
        <p style={subtituloStyle}>
          {esPT ? 'Valor total dos últimos 12 meses' : 'Valor total de los últimos 12 meses'}
        </p>
        <svg viewBox="0 0 600 190" style={{ width: '100%', height: 190, display: 'block' }}>
          {analisis.evolucion.map((mes, i) => {
            const ancho = 600 / analisis.evolucion.length;
            const alto = (mes.valor / maxMes) * 130;
            const resaltado = mes.clave === (periodo === 'TODOS' ? mesActual : periodo);
            return (
              <g key={mes.clave}>
                <title>{`${formatearPeriodo(mes.clave, esPT)}: ${formatear(mes.valor)} · ${mes.operaciones}`}</title>
                <rect
                  x={i * ancho + 6}
                  y={150 - alto}
                  width={ancho - 12}
                  height={Math.max(alto, mes.valor > 0 ? 2 : 0)}
                  rx={5}
                  fill={resaltado ? colores.azul : colores.verde}
                  opacity={resaltado ? 1 : 0.65}
                />
                <text x={i * ancho + ancho / 2} y={150 - alto - 5} textAnchor="middle" fontSize="9.5" fill="#475569">
                  {mes.valor > 0 ? Math.round(mes.valor).toLocaleString(locale) : ''}
                </text>
                <text x={i * ancho + ancho / 2} y={168} textAnchor="middle" fontSize="10" fill="#6e7781">
                  {new Date(`${mes.clave}-01T00:00:00`).toLocaleDateString(locale, { month: 'short' }).replace('.', '')}
                </text>
                <text x={i * ancho + ancho / 2} y={181} textAnchor="middle" fontSize="9" fill="#9ca3af">
                  {mes.operaciones > 0 ? `${mes.operaciones} op.` : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* SALDOS PENDIENTES */}
      {cuentasPendientes.length > 0 && (
        <div style={{ ...tarjetaStyle, marginBottom: 18 }}>
          <h3 style={tituloStyle(colores.azul)}>
            {tipo === 'clientes' ? '🧾' : '💳'}{' '}
            {tipo === 'clientes' ? (esPT ? 'A receber (saldos)' : 'Por cobrar (saldos)') : esPT ? 'A pagar (saldos)' : 'Por pagar (saldos)'}
          </h3>
          <p style={subtituloStyle}>
            {esFamiliar
              ? esPT
                ? 'Em Família cada fonte tem a sua própria conta: este é o saldo de cada uma, hoje. Toque para ver os movimentos.'
                : 'En Familia cada fuente tiene su propia cuenta: este es el saldo de cada una, hoy. Tocá una para ver sus movimientos.'
              : esPT
                ? `Saldo de cada ${tipo === 'clientes' ? 'cliente' : 'fornecedor'}, a partir do que movimentou nas contas ${tipo === 'clientes' ? 'a receber' : 'a pagar'}.`
                : `Saldo de cada ${tipo === 'clientes' ? 'cliente' : 'proveedor'}, a partir de lo que movió en las cuentas ${tipo === 'clientes' ? 'por cobrar' : 'por pagar'}.`}
          </p>

          {esFamiliar || !saldos ? (
            <>
              {cuentasPendientes.map((c) => (
                <Link
                  key={c.nombre}
                  href={`/informes?pestana=mayor&cuenta=${encodeURIComponent(c.nombre)}`}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: '1px solid #eef2f6', textDecoration: 'none', fontSize: 14 }}
                >
                  <span style={{ fontWeight: 700, color: '#1f2937' }}>{c.nombre}</span>
                  <span style={{ fontWeight: 800, color: tipo === 'clientes' ? '#15803d' : '#c2410c', whiteSpace: 'nowrap' }}>
                    {formatear(c.valor)} <span style={{ color: colores.azul }}>›</span>
                  </span>
                </Link>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '2px solid #e5e7eb', fontWeight: 900, color: colores.azul }}>
                <span>Total</span>
                <span>{formatear(totalPendientePanel)}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#15803d' }}>
                ✓ {esPT ? `Coincide com "${tipo === 'clientes' ? 'A receber' : 'A pagar'}" do Painel de Controle.` : `Coincide con "${tipo === 'clientes' ? 'Por cobrar' : 'Cuentas a pagar'}" del Panel de Control.`}
              </div>
            </>
          ) : (
            <>
              {saldos.filas.map((f) => (
                <div key={f.nombre} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: '1px solid #eef2f6', fontSize: 14 }}>
                  <button type="button" onClick={() => setFichaAbierta(normalizarNombre(f.nombre))} style={botonNombre(colores.azul)}>
                    {f.nombre}
                  </button>
                  <span style={{ fontWeight: 800, whiteSpace: 'nowrap', color: f.saldo < 0 ? '#b45309' : tipo === 'clientes' ? '#15803d' : '#c2410c' }}>
                    {formatear(f.saldo)}
                    {f.saldo < 0 && <span style={{ fontWeight: 600, fontSize: 11 }}> {esPT ? '(a favor)' : '(a favor)'}</span>}
                  </span>
                </div>
              ))}
              {saldos.sinAsignar.operaciones > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: '1px solid #eef2f6', fontSize: 14, color: '#92400e' }}>
                  <span>⚠️ {esPT ? 'Sem nome atribuído' : 'Sin nombre asignado'} ({saldos.sinAsignar.operaciones})</span>
                  <span style={{ fontWeight: 800 }}>{formatear(saldos.sinAsignar.saldo)}</span>
                </div>
              )}
              {Math.abs(saldos.saldoInicial) >= 0.5 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: '1px solid #eef2f6', fontSize: 14, color: COLORES_GRIS }}>
                  <span>{esPT ? 'Saldo inicial (sem detalhe)' : 'Saldo inicial (sin detalle)'}</span>
                  <span style={{ fontWeight: 800 }}>{formatear(saldos.saldoInicial)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '2px solid #e5e7eb', fontWeight: 900, color: colores.azul }}>
                <span>Total</span>
                <span>{formatear(saldos.total)}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: Math.abs(saldos.total - totalPendientePanel) < 0.5 ? '#15803d' : '#b91c1c' }}>
                {Math.abs(saldos.total - totalPendientePanel) < 0.5
                  ? `✓ ${esPT ? 'Coincide com o saldo em livros' : 'Coincide con el saldo en libros'} (${formatear(totalPendientePanel)}).`
                  : `⚠️ ${esPT ? 'Diferença com os livros' : 'Diferencia con los libros'}: ${formatear(saldos.total - totalPendientePanel)} (${esPT ? 'livros' : 'libros'} ${formatear(totalPendientePanel)}).`}
              </div>
            </>
          )}
        </div>
      )}

      {/* FRECUENCIA */}
      <div style={tarjetaStyle}>
        <h3 style={tituloStyle(colores.azul)}>🔁 {esPT ? 'Frequência' : 'Frecuencia'}</h3>
        <p style={subtituloStyle}>
          {esPT
            ? 'Com todo o histórico: quão seguido aparece cada um e quando foi a última vez'
            : 'Con todo el historial: qué tan seguido aparece cada uno y cuándo fue la última vez'}
        </p>

        {analisis.frecuencia.length === 0 ? (
          <div style={vacioStyle}>{esPT ? 'Ainda não há operações com nome atribuído.' : 'Todavía no hay operaciones con nombre asignado.'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: COLORES_GRIS, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={thStyle}>{esPT ? 'Nome' : 'Nombre'}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{esPT ? 'Oper.' : 'Oper.'}</th>
                  <th style={thStyle}>{esPT ? 'Última' : 'Última'}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{esPT ? 'Dias desde' : 'Días desde'}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{esPT ? 'Intervalo médio' : 'Intervalo prom.'}</th>
                  <th style={thStyle}>{esPT ? 'Situação' : 'Estado'}</th>
                </tr>
              </thead>
              <tbody>
                {filasFrecuencia.map((fila) => (
                  <tr key={fila.nombre} style={{ borderTop: '1px solid #eef2f6' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                      <button type="button" onClick={() => setFichaAbierta(normalizarNombre(fila.nombre))} style={botonNombre(colores.azul)}>
                        {fila.nombre}
                      </button>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fila.operaciones}</td>
                    <td style={tdStyle}>{formatearFecha(fila.ultima)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fila.diasDesdeUltima}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {fila.intervaloPromedioDias === null ? '—' : `${fila.intervaloPromedioDias} ${esPT ? 'dias' : 'días'}`}
                    </td>
                    <td style={tdStyle}>
                      <InsigniaFrecuencia etiqueta={fila.etiqueta} esPT={esPT} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {analisis.frecuencia.length > 12 && (
          <button
            type="button"
            onClick={() => setVerTodasFrecuencia((v) => !v)}
            style={{ marginTop: 10, background: 'transparent', border: 'none', color: colores.azul, fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}
          >
            {verTodasFrecuencia
              ? esPT ? 'Ver menos ▴' : 'Ver menos ▴'
              : esPT ? `Ver todos (${analisis.frecuencia.length}) ▾` : `Ver todos (${analisis.frecuencia.length}) ▾`}
          </button>
        )}
      </div>

      {/* CALIDAD DE DATOS */}
      {(porRevisar.length > 0 || sinNombre.length > 0) && (
        <div style={{ ...tarjetaStyle, marginTop: 18 }}>
          <h3 style={tituloStyle(colores.azul)}>🧹 {esPT ? 'Qualidade dos dados' : 'Calidad de datos'}</h3>
          {errorUnificar && <div style={{ ...avisoStyle, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: 12 }}>{errorUnificar}</div>}

          {porRevisar.length > 0 && (
            <>
          <p style={subtituloStyle}>
            {esPT
              ? `Nomes usados nas operações que não coincidem exatamente com ${esFamiliar ? 'um cadastro' : tipo === 'clientes' ? 'um cliente cadastrado' : 'um fornecedor cadastrado'}. Unificar deixa o ranking e a frequência mais certos.`
              : `Nombres usados en las operaciones que no coinciden exactamente con ${esFamiliar ? 'un alta' : tipo === 'clientes' ? 'un cliente dado de alta' : 'un proveedor dado de alta'}. Unificar deja el ranking y la frecuencia más precisos.`}
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: COLORES_GRIS, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={thStyle}>{esPT ? 'Como está escrito' : 'Como está escrito'}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{esPT ? 'Oper.' : 'Oper.'}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{esPT ? 'Valor' : 'Valor'}</th>
                  <th style={thStyle}>{esPT ? 'O que fazer' : 'Qué hacer'}</th>
                </tr>
              </thead>
              <tbody>
                {porRevisar.slice(0, 15).map((fila) => (
                  <tr key={fila.grafia} style={{ borderTop: '1px solid #eef2f6' }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1f2937' }}>&ldquo;{fila.grafia}&rdquo;</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fila.operaciones}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatear(fila.importe)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {fila.sugerencia && (
                          <button
                            type="button"
                            disabled={unificando === fila.grafia}
                            onClick={() => unificar(fila.grafia, fila.sugerencia!)}
                            style={botonAccion(colores.azul, true)}
                          >
                            {unificando === fila.grafia
                              ? esPT ? 'Unificando...' : 'Unificando...'
                              : `${fila.confianza === 'MISMA' ? '🔗' : '❓'} ${esPT ? 'Unificar com' : 'Unificar con'} ${fila.sugerencia}`}
                          </button>
                        )}
                        {!fila.sugerencia && (
                          <button type="button" onClick={() => onDarDeAlta(tipo, fila.grafia.trim(), fila.primeraFecha)} style={botonAccion(colores.verde, false)}>
                            ➕ {esPT ? 'Cadastrar' : 'Dar de alta'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {porRevisar.length > 15 && (
            <div style={{ marginTop: 8, fontSize: 12, color: COLORES_GRIS }}>
              {esPT ? `E mais ${porRevisar.length - 15}. Unifique estes e volte a abrir.` : `Y ${porRevisar.length - 15} más. Unificá estos y volvé a abrir.`}
            </div>
          )}
            </>
          )}

          {sinNombre.length > 0 && (
            <div style={{ marginTop: porRevisar.length > 0 ? 22 : 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: colores.azul }}>
                🏷️ {esPT ? 'Operações sem nome atribuído' : 'Operaciones sin nombre asignado'} ({sinNombre.length})
              </div>
              <p style={subtituloStyle}>
                {esPT
                  ? 'Escolha a quem pertence cada uma. Só muda o nome; valores e contas ficam iguais. As sugeridas vêm do histórico de cada devengo.'
                  : 'Elegí a quién corresponde cada una. Solo cambia el nombre; los importes y las cuentas quedan igual. Las sugeridas salen del histórico de cada devengo.'}
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                {sugeridas.length > 0 && (
                  <button type="button" disabled={asignando === 'SUGERIDAS'} onClick={asignarSugeridas} style={botonAccion(colores.verde, true)}>
                    {asignando === 'SUGERIDAS'
                      ? esPT ? 'Atribuindo...' : 'Asignando...'
                      : esPT ? `✅ Atribuir as ${sugeridas.length} sugeridas` : `✅ Asignar las ${sugeridas.length} sugeridas`}
                  </button>
                )}
                {sinNombre.length > sugeridas.length && (
                  <button type="button" onClick={() => setVerTodasSinNombre((v) => !v)} style={botonAccion(colores.azul, false)}>
                    {verTodasSinNombre
                      ? esPT ? 'Ver só as sugeridas ▴' : 'Ver solo las sugeridas ▴'
                      : esPT ? `Ver todas (${sinNombre.length}) ▾` : `Ver todas (${sinNombre.length}) ▾`}
                  </button>
                )}
              </div>

              <datalist id="nombres-altas">
                {altas.map((nombre) => (
                  <option key={nombre} value={nombre} />
                ))}
              </datalist>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: COLORES_GRIS, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <th style={thStyle}>{esPT ? 'Data' : 'Fecha'}</th>
                      <th style={thStyle}>{esPT ? 'Operação' : 'Operación'}</th>
                      <th style={thStyle}>{esPT ? 'Detalhe' : 'Detalle'}</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>{esPT ? 'Valor' : 'Valor'}</th>
                      <th style={thStyle}>{esPT ? 'Nome' : 'Nombre'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(verTodasSinNombre || sugeridas.length === 0 ? sinNombre : sugeridas).slice(0, 25).map((o) => {
                      const escrito = nombresEscritos[o.id] ?? o.sugerencia ?? '';
                      return (
                        <tr key={o.id} style={{ borderTop: '1px solid #eef2f6' }}>
                          <td style={tdStyle}>{formatearFecha(o.fecha)}</td>
                          <td style={{ ...tdStyle, fontWeight: 800, fontSize: 11, color: colores.azul }}>{o.operacion}</td>
                          <td style={{ ...tdStyle, color: '#475569' }}>{o.historico || o.categoria || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: colores.azul }}>{formatear(o.total)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <input
                                list="nombres-altas"
                                value={escrito}
                                onChange={(e) => setNombresEscritos((actual) => ({ ...actual, [o.id]: e.target.value }))}
                                placeholder={esPT ? 'Nome...' : 'Nombre...'}
                                style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 13, minWidth: 140, flex: 1 }}
                              />
                              <button
                                type="button"
                                disabled={!escrito.trim() || asignando === o.id}
                                onClick={() => asignarNombre([o.id], escrito, o.id)}
                                style={{ ...botonAccion(colores.verde, true), opacity: !escrito.trim() ? 0.5 : 1 }}
                              >
                                {asignando === o.id ? '...' : esPT ? 'Atribuir' : 'Asignar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(verTodasSinNombre || sugeridas.length === 0 ? sinNombre.length : sugeridas.length) > 25 && (
                <div style={{ marginTop: 8, fontSize: 12, color: COLORES_GRIS }}>
                  {esPT ? 'Mostrando as 25 mais recentes; ao atribuir, aparecem as seguintes.' : 'Mostrando las 25 más recientes; al asignar, aparecen las siguientes.'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FICHA */}
      {ficha && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setFichaAbierta(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: 24, padding: 22, width: '100%', maxWidth: 760, margin: '24px 0', boxShadow: '0 24px 60px rgba(15,23,42,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde }}>
                  {nombres.emoji} {nombres.plural.toUpperCase()}
                </div>
                <h3 style={{ margin: '4px 0 0', color: colores.azul, fontSize: 22, overflowWrap: 'anywhere' }}>{ficha.nombre}</h3>
              </div>
              <button type="button" onClick={() => setFichaAbierta(null)} aria-label={esPT ? 'Fechar' : 'Cerrar'} style={{ border: 'none', background: '#f1f5f9', borderRadius: 999, width: 36, height: 36, fontSize: 18, cursor: 'pointer', color: colores.azul }}>
                ✕
              </button>
            </div>

            {ficha.operaciones === 0 ? (
              <div style={{ ...vacioStyle, marginTop: 16 }}>{esPT ? 'Sem operações registradas com este nome.' : 'Sin operaciones registradas con este nombre.'}</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, margin: '16px 0' }}>
                  {[
                    { etiqueta: esPT ? 'Total histórico' : 'Total histórico', valor: formatear(ficha.totalHistorico), color: colores.verde },
                    { etiqueta: periodo === 'TODOS' ? (esPT ? 'No período' : 'En el período') : formatearPeriodo(periodo, esPT), valor: formatear(ficha.totalPeriodo), color: colores.azul },
                    { etiqueta: esPT ? 'Operações' : 'Operaciones', valor: String(ficha.operaciones), color: colores.azul },
                    { etiqueta: esPT ? 'Ticket médio' : 'Ticket promedio', valor: formatear(ficha.ticketPromedio), color: colores.azul },
                    { etiqueta: esPT ? 'Primeira' : 'Primera', valor: ficha.primera ? formatearFecha(ficha.primera) : '—', color: '#475569' },
                    { etiqueta: esPT ? 'Última' : 'Última', valor: ficha.ultima ? `${formatearFecha(ficha.ultima)}${ficha.diasDesdeUltima !== null ? ` · ${ficha.diasDesdeUltima} ${esPT ? 'd' : 'd'}` : ''}` : '—', color: '#475569' },
                  ].map((c) => (
                    <div key={c.etiqueta} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: '10px 12px', background: '#fbfcfd' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: COLORES_GRIS, textTransform: 'uppercase' }}>{c.etiqueta}</div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: c.color, marginTop: 3 }}>{c.valor}</div>
                    </div>
                  ))}
                </div>

                <GraficoMeses
                  meses={ficha.evolucion}
                  resaltado={periodo === 'TODOS' ? mesActual : periodo}
                  locale={locale}
                  esPT={esPT}
                  color={colores.verde}
                  resaltadoColor={colores.azul}
                />

                <div style={{ fontSize: 13, fontWeight: 800, color: colores.azul, margin: '14px 0 6px' }}>
                  {esPT ? 'Operações' : 'Operaciones'}
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #eef2f6', borderRadius: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                      {ficha.movimientos.map((m, i) => (
                        <tr key={`${m.fecha}-${i}`} style={{ borderTop: i === 0 ? 'none' : '1px solid #eef2f6' }}>
                          <td style={tdStyle}>{formatearFecha(m.fecha)}</td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 800, color: m.esBase ? colores.azul : COLORES_GRIS, fontSize: 11 }}>{m.operacion}</span>
                          </td>
                          <td style={{ ...tdStyle, color: '#475569' }}>{m.categoria || m.historico || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: colores.azul }}>{formatear(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const COLORES_GRIS = '#6e7781';

function InsigniaFrecuencia({ etiqueta, esPT }: { etiqueta: EtiquetaFrecuencia; esPT: boolean }) {
  const estilos: Record<EtiquetaFrecuencia, { texto: string; textoPT: string; color: string; fondo: string }> = {
    RECURRENTE: { texto: 'Recurrente', textoPT: 'Recorrente', color: '#15803d', fondo: '#f0fdf4' },
    OCASIONAL: { texto: 'Ocasional', textoPT: 'Ocasional', color: '#1d4ed8', fondo: '#eff6ff' },
    DORMIDO: { texto: 'Dormido', textoPT: 'Dormindo', color: '#b45309', fondo: '#fffbeb' },
  };
  const e = estilos[etiqueta];
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: e.fondo, color: e.color, fontSize: 12, fontWeight: 800 }}>
      {esPT ? e.textoPT : e.texto}
    </span>
  );
}

const tarjetaStyle: React.CSSProperties = {
  background: '#fbfcfd',
  border: '1px solid #e5e7eb',
  borderRadius: 24,
  padding: 20,
};

const tituloStyle = (color: string): React.CSSProperties => ({ margin: 0, color, fontSize: 18 });

const subtituloStyle: React.CSSProperties = { margin: '4px 0 14px', fontSize: 12, color: COLORES_GRIS };

const vacioStyle: React.CSSProperties = {
  padding: 20,
  border: '1px dashed #d6dee5',
  borderRadius: 14,
  textAlign: 'center',
  color: COLORES_GRIS,
  fontSize: 13,
};

const avisoStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 14,
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
  textAlign: 'center',
  color: COLORES_GRIS,
  fontSize: 13,
};

const thStyle: React.CSSProperties = { padding: '8px 10px', fontWeight: 800 };
const tdStyle: React.CSSProperties = { padding: '9px 10px' };

const botonNombre = (color: string): React.CSSProperties => ({
  border: 'none',
  background: 'transparent',
  padding: 0,
  font: 'inherit',
  fontWeight: 800,
  color,
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  textAlign: 'left',
});

const botonAccion = (color: string, relleno: boolean): React.CSSProperties => ({
  border: `1px solid ${color}`,
  background: relleno ? `${color}12` : '#ffffff',
  color,
  borderRadius: 999,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
});

function GraficoMeses({
  meses,
  resaltado,
  locale,
  esPT,
  color,
  resaltadoColor,
}: {
  meses: Array<{ clave: string; valor: number; operaciones: number }>;
  resaltado: string;
  locale: string;
  esPT: boolean;
  color: string;
  resaltadoColor: string;
}) {
  const max = Math.max(...meses.map((m) => m.valor), 1);
  const ancho = 600 / meses.length;
  return (
    <svg viewBox="0 0 600 130" style={{ width: '100%', height: 130, display: 'block' }}>
      {meses.map((mes, i) => {
        const alto = (mes.valor / max) * 82;
        const activo = mes.clave === resaltado;
        return (
          <g key={mes.clave}>
            <title>{`${formatearPeriodo(mes.clave, esPT)}: ${Math.round(mes.valor).toLocaleString(locale)} · ${mes.operaciones}`}</title>
            <rect x={i * ancho + 6} y={96 - alto} width={ancho - 12} height={Math.max(alto, mes.valor > 0 ? 2 : 0)} rx={5} fill={activo ? resaltadoColor : color} opacity={activo ? 1 : 0.65} />
            <text x={i * ancho + ancho / 2} y={96 - alto - 4} textAnchor="middle" fontSize="9.5" fill="#475569">
              {mes.valor > 0 ? Math.round(mes.valor).toLocaleString(locale) : ''}
            </text>
            <text x={i * ancho + ancho / 2} y={113} textAnchor="middle" fontSize="10" fill="#6e7781">
              {new Date(`${mes.clave}-01T00:00:00`).toLocaleDateString(locale, { month: 'short' }).replace('.', '')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
