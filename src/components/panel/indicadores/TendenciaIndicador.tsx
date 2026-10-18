'use client';

import { useMemo, useState } from 'react';
import { etiquetaPeriodo } from '@/lib/evolucionFinanciera';
import { INDICADORES, cambioContraAnterior, serieDeIndicador, type FotoMes, type IndicadorId } from '@/lib/indicadoresFinancieros';
import { useAncho } from '../evolucion/compartido';

// TENDENCIA DE UN INDICADOR — gráfico completo al tocar su tile
// =====================================================
//
// Línea mes a mes del indicador, con rango propio, tooltip al pasar el cursor
// o tocar, y resumen (mes elegido, promedio, máximo y mínimo). Tocar un punto
// cambia el mes de toda la tarjeta. Los meses sin dato cortan la línea.

const AZUL = '#1f3a5f';
const VERDE = '#2e8b57';
const ROJO = '#dc2626';
const ALTO = 320;
const MARGEN = { izq: 78, der: 24, sup: 24, inf: 44 };

type Rango = '6' | '12' | '24' | 'TODO';

export function TendenciaIndicador({
  fotos,
  id,
  nombre,
  anualizar,
  claveActiva,
  onElegir,
  onCerrar,
  formatear,
  idioma,
}: {
  fotos: FotoMes[];
  id: IndicadorId;
  nombre: string;
  anualizar: boolean;
  claveActiva: string;
  onElegir: (clave: string) => void;
  onCerrar: () => void;
  formatear: (id: IndicadorId, valor: number) => string;
  idioma: string;
}) {
  const esPT = idioma === 'PT';
  const t = (es: string, pt: string) => (esPT ? pt : es);
  const locale = esPT ? 'pt-BR' : 'es-AR';
  const unidad = INDICADORES.find((i) => i.id === id)!.unidad;

  const [rango, setRango] = useState<Rango>('12');
  const [hover, setHover] = useState<number | null>(null);
  const [refGrafico, anchoGrafico] = useAncho();

  const completa = useMemo(() => serieDeIndicador(fotos, id, { anualizar }), [fotos, id, anualizar]);
  const serie = useMemo(() => (rango === 'TODO' ? completa : completa.slice(-Number(rango))), [completa, rango]);

  const conDato = serie.filter((p): p is { clave: string; valor: number } => p.valor !== null);
  const valores = conDato.map((p) => p.valor);

  const ANCHO = Math.max(anchoGrafico, serie.length * 40 + MARGEN.izq + MARGEN.der);
  const anchoUtil = ANCHO - MARGEN.izq - MARGEN.der;
  const altoUtil = ALTO - MARGEN.sup - MARGEN.inf;

  // Para liquidez, el 1,0× (activo corriente = deuda corriente) es una referencia que conviene tener a la vista.
  const referencia = unidad === 'veces' ? 1 : 0;
  const base = valores.length > 0 ? [...valores, referencia] : [referencia];
  const maxValor = Math.max(...base);
  const minValor = Math.min(...base);
  const rangoValores = maxValor - minValor || 1;

  const xDe = (i: number) => (serie.length === 1 ? MARGEN.izq + anchoUtil / 2 : MARGEN.izq + (i / (serie.length - 1)) * anchoUtil);
  const yDe = (v: number) => MARGEN.sup + altoUtil - ((v - minValor) / rangoValores) * altoUtil;

  let trazo = '';
  let abierto = false;
  serie.forEach((p, i) => {
    if (p.valor === null) {
      abierto = false;
      return;
    }
    trazo += `${abierto ? 'L' : 'M'} ${xDe(i)} ${yDe(p.valor)} `;
    abierto = true;
  });

  const varios = new Set(serie.map((p) => p.clave.slice(0, 4))).size > 1;
  const etiqueta = (clave: string, larga = false) => etiquetaPeriodo(clave, idioma, { larga, conAnio: varios });
  const paso = Math.max(1, Math.ceil(serie.length / 14));

  const indiceElegido = serie.findIndex((p) => p.clave === claveActiva);
  const indiceActivo = hover ?? (indiceElegido >= 0 ? indiceElegido : null);
  const puntoActivo = indiceActivo !== null ? serie[indiceActivo] : null;

  function indiceDesdeEvento(evento: React.PointerEvent<SVGSVGElement>): number {
    const caja = evento.currentTarget.getBoundingClientRect();
    const x = ((evento.clientX - caja.left) / caja.width) * ANCHO;
    const relativo = (x - MARGEN.izq) / anchoUtil;
    return Math.min(serie.length - 1, Math.max(0, Math.round(relativo * (serie.length - 1))));
  }

  const formatoEje = (v: number) => (unidad === 'veces' ? `${v.toLocaleString(locale, { maximumFractionDigits: 1 })}×` : `${v.toLocaleString(locale, { maximumFractionDigits: 0 })}%`);

  const promedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
  const maximo = conDato.length > 0 ? conDato.reduce((a, b) => (b.valor > a.valor ? b : a)) : null;
  const minimo = conDato.length > 0 ? conDato.reduce((a, b) => (b.valor < a.valor ? b : a)) : null;
  const actualEnSerie = indiceElegido >= 0 ? serie[indiceElegido] : null;

  const resumen: { titulo: string; valor: number | null; mes?: string }[] = [
    { titulo: t('Mes elegido', 'Mês escolhido'), valor: actualEnSerie?.valor ?? null, mes: actualEnSerie ? etiqueta(actualEnSerie.clave) : undefined },
    { titulo: t('Promedio del rango', 'Média do intervalo'), valor: promedio },
    { titulo: t('Máximo', 'Máximo'), valor: maximo?.valor ?? null, mes: maximo ? etiqueta(maximo.clave) : undefined },
    { titulo: t('Mínimo', 'Mínimo'), valor: minimo?.valor ?? null, mes: minimo ? etiqueta(minimo.clave) : undefined },
  ];

  const leftTooltip = indiceActivo !== null ? Math.min(86, Math.max(14, (xDe(indiceActivo) / ANCHO) * 100)) : 50;

  const cambioActivo = (() => {
    if (indiceActivo === null || !puntoActivo) return null;
    const previo = indiceActivo > 0 ? serie[indiceActivo - 1] : completa[completa.findIndex((p) => p.clave === puntoActivo.clave) - 1];
    return cambioContraAnterior(id, puntoActivo.valor, previo?.valor ?? null);
  })();

  return (
    <div style={{ background: '#fff', border: `2px solid ${AZUL}`, borderRadius: 14, padding: 16, margin: '12px 0 4px' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: AZUL }}>
          📈 {t('Tendencia', 'Tendência')} · {nombre}
        </div>

        <select
          value={rango}
          onChange={(e) => {
            setRango(e.target.value as Rango);
            setHover(null);
          }}
          aria-label={t('Rango', 'Intervalo')}
          style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: '6px 10px', fontSize: 13, fontWeight: 700, color: '#374151', background: '#fff', marginLeft: 'auto' }}
        >
          <option value="6">{t('Últimos 6 meses', 'Últimos 6 meses')}</option>
          <option value="12">{t('Últimos 12 meses', 'Últimos 12 meses')}</option>
          <option value="24">{t('Últimos 24 meses', 'Últimos 24 meses')}</option>
          <option value="TODO">{t('Todo el historial', 'Todo o histórico')}</option>
        </select>

        <button type="button" onClick={onCerrar} aria-label={t('Cerrar', 'Fechar')} style={{ border: '1px solid #cbd5e1', background: '#fff', color: AZUL, borderRadius: 8, width: 32, height: 32, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      {conDato.length === 0 ? (
        <p style={{ fontSize: 14, color: '#94a3b8', margin: '12px 0' }}>{t('No hay datos de este indicador en el rango elegido.', 'Não há dados deste indicador no intervalo escolhido.')}</p>
      ) : (
        <div ref={refGrafico} style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ position: 'relative', width: ANCHO }}>
            <svg
              viewBox={`0 0 ${ANCHO} ${ALTO}`}
              style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }}
              onPointerMove={(e) => setHover(indiceDesdeEvento(e))}
              onPointerLeave={() => setHover(null)}
              onPointerDown={(e) => {
                const i = indiceDesdeEvento(e);
                setHover(i);
                onElegir(serie[i].clave);
              }}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const y = MARGEN.sup + altoUtil - f * altoUtil;
                return (
                  <g key={f}>
                    <line x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={y} y2={y} stroke="#eef2f6" strokeWidth="1" />
                    <text x={MARGEN.izq - 10} y={y + 4} textAnchor="end" fontSize="14" fill="#94a3b8">
                      {formatoEje(minValor + f * rangoValores)}
                    </text>
                  </g>
                );
              })}

              {(unidad === 'veces' || minValor < 0) && (
                <>
                  <line x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={yDe(referencia)} y2={yDe(referencia)} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 5" />
                  <text x={ANCHO - MARGEN.der} y={yDe(referencia) - 6} textAnchor="end" fontSize="12" fill="#64748b">
                    {unidad === 'veces' ? t('1,0× = activo corriente igual a la deuda corriente', '1,0× = ativo circulante igual à dívida circulante') : '0'}
                  </text>
                </>
              )}

              {indiceActivo !== null && <line x1={xDe(indiceActivo)} x2={xDe(indiceActivo)} y1={MARGEN.sup} y2={ALTO - MARGEN.inf} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" />}

              <path d={trazo} fill="none" stroke={VERDE} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

              {serie.map((p, i) =>
                p.valor === null ? null : (
                  <circle key={p.clave} cx={xDe(i)} cy={yDe(p.valor)} r={i === indiceActivo ? 7 : 3.5} fill={p.valor < 0 ? ROJO : VERDE} stroke="#fff" strokeWidth={i === indiceActivo ? 2.5 : 1.5} />
                )
              )}

              {serie.map((p, i) =>
                i % paso === 0 || i === indiceActivo ? (
                  <text key={p.clave} x={xDe(i)} y={ALTO - 14} textAnchor="middle" fontSize="15" fontWeight={i === indiceActivo ? 800 : 600} fill={i === indiceActivo ? AZUL : '#6e7781'}>
                    {etiqueta(p.clave)}
                  </text>
                ) : null
              )}
            </svg>

            {hover !== null && puntoActivo && (
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  left: `${leftTooltip}%`,
                  transform: 'translateX(-50%)',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
                  padding: '8px 12px',
                  minWidth: 150,
                  pointerEvents: 'none',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 800, color: AZUL, marginBottom: 2 }}>{etiqueta(puntoActivo.clave, true)}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: puntoActivo.valor !== null && puntoActivo.valor < 0 ? ROJO : '#111827' }}>{puntoActivo.valor === null ? t('Sin datos', 'Sem dados') : formatear(id, puntoActivo.valor)}</div>
                {cambioActivo && cambioActivo.favorable !== null && (
                  <div style={{ fontSize: 12, color: cambioActivo.favorable ? '#15803d' : ROJO, fontWeight: 700 }}>
                    {cambioActivo.favorable ? '👍' : '👎'} {cambioActivo.delta > 0 ? '+' : '−'}
                    {Math.abs(cambioActivo.delta).toLocaleString(locale, { minimumFractionDigits: unidad === 'veces' ? 2 : 1, maximumFractionDigits: unidad === 'veces' ? 2 : 1 })}
                    {unidad === 'porcentaje' ? ' pp' : ''} {t('vs. mes anterior', 'vs. mês anterior')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
        {resumen.map((r) => (
          <div key={r.titulo} style={{ background: '#f8fafc', border: '1px solid #eef2f6', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6e7781' }}>
              {r.titulo}
              {r.mes ? ` · ${r.mes}` : ''}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: r.valor !== null && r.valor < 0 ? ROJO : AZUL }}>{r.valor === null ? '—' : formatear(id, r.valor)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
