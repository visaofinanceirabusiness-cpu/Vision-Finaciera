'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { compacto, escalaBonita, recortarRango, type RangoRapido } from '@/lib/informes/escala';

// Gráfico interactivo de los informes (mismo espíritu que el de Evolución): rango rápido, series que se prenden y apagan desde la leyenda,
// cursor con ficha de datos al pasar el mouse o el dedo, y clic en un mes para elegirlo como período del informe.

export type SerieGrafico = { clave: string; nombre: string; color: string; tipo: 'linea' | 'barra'; valores: number[]; area?: boolean };
export type PuntoGrafico = { clave: string; etiqueta: string; etiquetaLarga: string };

const GRIS = '#6b7280';

export function GraficoInteractivo({
  puntos,
  series,
  simbolo,
  seleccionado,
  onSeleccionar,
  pt,
  alto = 300,
  rangoInicial = '12M',
}: {
  puntos: PuntoGrafico[];
  series: SerieGrafico[];
  simbolo: string;
  seleccionado?: string;
  onSeleccionar?: (clave: string) => void;
  pt: boolean;
  alto?: number;
  rangoInicial?: RangoRapido;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [rango, setRango] = useState<RangoRapido>(rangoInicial);
  const [apagadas, setApagadas] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(300, el.clientWidth));
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const indices = useMemo(() => recortarRango(puntos.map((_, i) => i), rango), [puntos, rango]);
  const visibles = useMemo(() => series.filter((s) => !apagadas.has(s.clave)), [series, apagadas]);

  if (puntos.length === 0) return <div style={{ color: GRIS, fontSize: 13 }}>{pt ? 'Ainda não há histórico.' : 'Todavía no hay historial.'}</div>;

  const izq = 52, der = 12, arriba = 12, abajo = 28;
  const anchoUtil = ancho - izq - der;
  const altoUtil = alto - arriba - abajo;
  const hayBarras = visibles.some((s) => s.tipo === 'barra');
  const valores = visibles.flatMap((s) => indices.map((i) => s.valores[i] ?? 0));
  const escala = escalaBonita(Math.min(0, ...valores, hayBarras ? 0 : Infinity), Math.max(0, ...valores) || 1);
  const y = (v: number) => arriba + altoUtil - ((v - escala.min) / (escala.max - escala.min)) * altoUtil;
  const paso = anchoUtil / indices.length;
  const xCentro = (k: number) => izq + k * paso + paso / 2;
  const barras = visibles.filter((s) => s.tipo === 'barra');
  const anchoBarra = Math.min(26, (paso * 0.7) / Math.max(barras.length, 1));

  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = Math.floor(((e.clientX - r.left) * (ancho / r.width) - izq) / paso);
    setCursor(k >= 0 && k < indices.length ? k : null);
  };

  const kSel = seleccionado ? indices.findIndex((i) => puntos[i].clave === seleccionado) : -1;
  const kTip = cursor ?? null;
  const tipIzquierda = kTip !== null && xCentro(kTip) > ancho * 0.6;

  return (
    <div ref={caja} style={{ width: '100%' }}>
      <div className="dre-no-imprimir" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {series.map((s) => {
            const off = apagadas.has(s.clave);
            return (
              <button
                key={s.clave}
                type="button"
                onClick={() => setApagadas((prev) => { const n = new Set(prev); if (n.has(s.clave)) n.delete(s.clave); else n.add(s.clave); return n; })}
                aria-pressed={!off}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${off ? '#d1d5db' : s.color}`, background: off ? '#f9fafb' : `${s.color}14`, color: off ? '#9ca3af' : '#1f2937', borderRadius: 999, padding: '4px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                <span style={{ width: 10, height: 10, borderRadius: s.tipo === 'barra' ? 2 : 99, background: off ? '#d1d5db' : s.color }} />
                {s.nombre}
              </button>
            );
          })}
        </div>
        <div role="group" style={{ display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: 999, overflow: 'hidden' }}>
          {(['3M', '6M', '12M', 'TODO'] as RangoRapido[]).map((r) => (
            <button key={r} type="button" onClick={() => { setRango(r); setCursor(null); }} aria-pressed={rango === r} style={{ padding: '4px 12px', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: rango === r ? '#22a559' : 'transparent', color: rango === r ? '#fff' : '#1f3a5f' }}>
              {r === 'TODO' ? (pt ? 'Tudo' : 'Todo') : r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${ancho} ${alto}`}
          onPointerMove={alMover}
          onPointerDown={alMover}
          onPointerLeave={() => setCursor(null)}
          onClick={() => { if (cursor !== null && onSeleccionar) onSeleccionar(puntos[indices[cursor]].clave); }}
          style={{ display: 'block', touchAction: 'pan-y', cursor: onSeleccionar ? 'pointer' : 'default' }}
          role="img"
          aria-label={pt ? 'Gráfico de evolução' : 'Gráfico de evolución'}
        >
          {escala.marcas.map((m) => (
            <g key={m}>
              <line x1={izq} x2={ancho - der} y1={y(m)} y2={y(m)} stroke={m === 0 ? '#9ca3af' : '#eef0f2'} strokeDasharray={m === 0 ? '4 3' : undefined} />
              <text x={izq - 6} y={y(m) + 3.5} textAnchor="end" fontSize="10.5" fill={GRIS}>{compacto(m, '')}</text>
            </g>
          ))}

          {kSel >= 0 && <rect x={izq + kSel * paso} y={arriba} width={paso} height={altoUtil} fill="#22a55914" />}

          {indices.map((i, k) => (
            <text key={puntos[i].clave} x={xCentro(k)} y={alto - 9} textAnchor="middle" fontSize="10.5" fontWeight={k === kSel ? 800 : 500} fill={k === kSel ? '#15803d' : GRIS}>
              {indices.length > 14 && k % 2 === 1 ? '' : puntos[i].etiqueta}
            </text>
          ))}

          {barras.map((s, bi) =>
            indices.map((i, k) => {
              const v = s.valores[i] ?? 0;
              const x0 = xCentro(k) - (barras.length * anchoBarra) / 2 + bi * anchoBarra;
              return <rect key={`${s.clave}-${k}`} x={x0 + 1} y={Math.min(y(v), y(0))} width={Math.max(anchoBarra - 2, 1)} height={Math.max(Math.abs(y(v) - y(0)), v === 0 ? 0 : 1.5)} rx="2" fill={s.color} opacity={cursor === null || cursor === k ? 0.95 : 0.55} />;
            })
          )}

          {visibles.filter((s) => s.tipo === 'linea').map((s) => {
            const pts = indices.map((i, k) => `${xCentro(k)},${y(s.valores[i] ?? 0)}`);
            return (
              <g key={s.clave}>
                {s.area && <polygon points={`${xCentro(0)},${y(0)} ${pts.join(' ')} ${xCentro(indices.length - 1)},${y(0)}`} fill={s.color} opacity="0.1" />}
                <polyline points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />
                {indices.map((i, k) => (
                  <circle key={k} cx={xCentro(k)} cy={y(s.valores[i] ?? 0)} r={cursor === k || k === kSel ? 5.5 : 3} fill={cursor === k ? s.color : '#fff'} stroke={s.color} strokeWidth="2" />
                ))}
              </g>
            );
          })}

          {kTip !== null && <line x1={xCentro(kTip)} x2={xCentro(kTip)} y1={arriba} y2={arriba + altoUtil} stroke="#94a3b8" strokeDasharray="4 3" />}
        </svg>

        {kTip !== null && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: tipIzquierda ? undefined : `${(xCentro(kTip) / ancho) * 100}%`,
              right: tipIzquierda ? `${100 - (xCentro(kTip) / ancho) * 100}%` : undefined,
              transform: tipIzquierda ? 'translateX(-10px)' : 'translateX(10px)',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(15,23,42,0.14)',
              padding: '8px 12px',
              fontSize: 12.5,
              pointerEvents: 'none',
              minWidth: 150,
              zIndex: 2,
            }}
          >
            <div style={{ fontWeight: 800, color: '#1f3a5f', marginBottom: 4 }}>{puntos[indices[kTip]].etiquetaLarga.charAt(0).toUpperCase() + puntos[indices[kTip]].etiquetaLarga.slice(1)}</div>
            {visibles.map((s) => {
              const v = s.valores[indices[kTip]] ?? 0;
              return (
                <div key={s.clave} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#374151' }}>
                    <span style={{ width: 9, height: 9, borderRadius: s.tipo === 'barra' ? 2 : 99, background: s.color }} />
                    {s.nombre}
                  </span>
                  <strong style={{ color: v < 0 ? '#dc2626' : '#111827', whiteSpace: 'nowrap' }}>{compacto(v, simbolo)}</strong>
                </div>
              );
            })}
            {onSeleccionar && <div style={{ marginTop: 4, fontSize: 11, color: GRIS }}>{pt ? 'Clique para ver este mês' : 'Tocá para ver este mes'}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
