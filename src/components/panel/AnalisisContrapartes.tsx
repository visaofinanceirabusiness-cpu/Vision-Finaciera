'use client';

// ANÁLISIS DE CLIENTES / PROVEEDORES — pestaña "Análisis" de Recursos
// Humanos. Solo lectura: arma indicadores, ranking, evolución y
// frecuencia a partir de registro_operaciones (ver
// lib/analisisContrapartes.ts). En Familia son fuentes de ingreso y
// destinos de pago.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fechaLocalHoy, formatearPeriodo } from '@/lib/fecha';
import {
  analizarContrapartes,
  normalizarNombre,
  type EtiquetaFrecuencia,
  type OperacionTercero,
  type TipoContraparte,
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
      .select('fecha, operacion, total, cliente_proveedor, estado')
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
}: {
  empresaId: string;
  esFamiliar: boolean;
  idioma: string | null;
  simbolo: string;
  clientes: Persona[];
  proveedores: Persona[];
  colores: Colores;
}) {
  const esPT = idioma === 'PT';
  const locale = esPT ? 'pt-BR' : 'es-AR';
  const hoy = fechaLocalHoy();
  const mesActual = hoy.slice(0, 7);

  const [operaciones, setOperaciones] = useState<OperacionTercero[] | null>(null);
  const [error, setError] = useState(false);
  const [tipo, setTipo] = useState<TipoContraparte>('clientes');
  const [periodo, setPeriodo] = useState(mesActual);
  const [verTodasFrecuencia, setVerTodasFrecuencia] = useState(false);

  useEffect(() => {
    let vigente = true;
    cargarOperaciones(empresaId)
      .then((datos) => vigente && setOperaciones(datos))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, [empresaId]);

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
    () => analizarContrapartes({ operaciones: operaciones ?? [], tipo, esFamiliar, periodo, hoy, fechasAlta }),
    [operaciones, tipo, esFamiliar, periodo, hoy, fechasAlta]
  );

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
                    {i + 1}. {fila.nombre}
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
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1f2937' }}>{fila.nombre}</td>
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
