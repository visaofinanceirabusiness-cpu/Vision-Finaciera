'use client';

// GRÁFICO DE EVOLUCIÓN DE CUENTAS (Panel Maestro → Sabio Soporte). Cualquier cuenta del plan, separadas por tipo y con varias activas a la vez,
// cada una con su color. Las cuentas PADRE (Activo, Mercaderías…) se dibujan como un área con línea gruesa y las INDIVIDUALES (Caja, Banco…)
// como línea fina con puntos: así se ve el peso de cada hija dentro de su padre (y el tooltip da el porcentaje). Se puede pasar a pantalla
// completa. Datos: lib/sabioSoporte/evolucion.ts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { GRUPOS, indicesDeCierre, type Evolucion, type Granularidad, type SerieCuenta } from '@/lib/sabioSoporte/evolucion';

const PALETA = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#be123c', '#a16207', '#9333ea', '#0369a1', '#15803d', '#c2410c', '#6d28d9', '#0f766e', '#b91c1c'];
const AZUL = '#1f3a5f';
const GRIS = '#6e7781';

const PRESETS: Array<{ nombre: string; claves: string[] }> = [
  { nombre: 'Ecuación contable', claves: ['1.0.0.0.0', '2.0.0.0.0', 'RES:PN_TOTAL'] },
  { nombre: 'Disponible vs deuda', claves: ['RES:DISPONIBLE', '2.0.0.0.0'] },
  { nombre: 'Resultado', claves: ['4.0.0.0.0', '5.0.0.0.0', 'RES:RESULTADO'] },
  { nombre: 'Stock', claves: ['RES:MERCADERIAS', '1.1.1.0.2'] },
];

function compacto(n: number, simbolo: string): string {
  const a = Math.abs(n);
  const t = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}M` : a >= 10_000 ? `${(a / 1000).toFixed(0)}k` : a >= 1000 ? `${(a / 1000).toFixed(1)}k` : a.toFixed(0);
  return `${n < 0 ? '−' : ''}${simbolo} ${t}`;
}

function escalaBonita(min: number, max: number): { min: number; max: number; marcas: number[] } {
  if (max === min) max = min + 1;
  const paso0 = (max - min) / 5;
  const p = Math.pow(10, Math.floor(Math.log10(paso0)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= paso0) ?? 10 * p;
  const lo = Math.floor(min / paso) * paso;
  const hi = Math.ceil(max / paso) * paso;
  const marcas: number[] = [];
  for (let v = lo; v <= hi + paso / 2; v += paso) marcas.push(Math.round(v * 100) / 100);
  return { min: lo, max: hi, marcas };
}

export function GraficoEvolucion({ evolucion, simbolo, alto: altoLienzo = '68vh' }: { evolucion: Evolucion; simbolo: string; alto?: string }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(900);
  const [alto, setAlto] = useState(520);
  const [completa, setCompleta] = useState(false);
  const [sel, setSel] = useState<string[]>(['1.0.0.0.0', '2.0.0.0.0', 'RES:PN_TOTAL']);
  const [gran, setGran] = useState<Granularidad>('MES');
  const [relativo, setRelativo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState(0);
  const [hasta, setHasta] = useState(-1);
  const [cerrados, setCerrados] = useState<Record<string, boolean>>({ INGRESO: true, COSTO: true, GASTO: true });
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    const el = lienzo.current;
    if (!el) return;
    const medir = () => {
      setAncho(Math.max(320, el.clientWidth));
      setAlto(Math.max(300, el.clientHeight));
    };
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, [completa]);

  useEffect(() => {
    const alCambiar = () => setCompleta(document.fullscreenElement === contenedor.current);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const todas = evolucion.series;
  const colorDe = useMemo(() => new Map(todas.map((s, i) => [s.clave, PALETA[i % PALETA.length]])), [todas]);
  const raizDelGrupo = useMemo(() => new Map(todas.filter((s) => s.nivel === 0 && s.grupo !== 'RESUMEN').map((s) => [s.grupo, s])), [todas]);

  const cierres = useMemo(() => indicesDeCierre(evolucion.fechas, gran), [evolucion.fechas, gran]);
  const iDesde = Math.min(Math.max(0, desde), Math.max(0, cierres.length - 1));
  const iHasta = hasta < 0 ? cierres.length - 1 : Math.min(hasta, cierres.length - 1);
  const puntos = cierres.slice(iDesde, Math.max(iDesde, iHasta) + 1);

  const activas = sel.map((k) => evolucion.porClave.get(k)).filter((s): s is SerieCuenta => Boolean(s));
  const valoresDe = (s: SerieCuenta) => {
    const v = puntos.map((i) => s.valores[i]);
    if (!relativo) return v;
    const m = Math.max(...v.map(Math.abs), 1);
    return v.map((x) => (x / m) * 100);
  };

  const todosLosValores = activas.flatMap(valoresDe);
  const escala = escalaBonita(Math.min(0, ...(todosLosValores.length ? todosLosValores : [0])), Math.max(0, ...(todosLosValores.length ? todosLosValores : [1])));
  const m = { izq: 70, der: 24, arr: 16, aba: 40 };
  const w = ancho - m.izq - m.der;
  const h = alto - m.arr - m.aba;
  const x = (i: number) => m.izq + (puntos.length <= 1 ? w / 2 : (i / (puntos.length - 1)) * w);
  const y = (v: number) => m.arr + h - ((v - escala.min) / (escala.max - escala.min)) * h;

  const etiquetaFecha = (i: number) => {
    const f = evolucion.fechas[puntos[i]];
    return gran === 'MES' ? f.slice(0, 7) : f.slice(5);
  };
  const paso = Math.max(1, Math.ceil(puntos.length / Math.max(2, Math.floor(w / 70))));

  function alMover(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - m.izq;
    setCursor(puntos.length <= 1 ? 0 : Math.min(puntos.length - 1, Math.max(0, Math.round((px / w) * (puntos.length - 1)))));
  }

  const alternar = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const q = busqueda.trim().toLowerCase();

  async function pantallaCompleta() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await contenedor.current?.requestFullscreen?.();
  }

  if (evolucion.fechas.length === 0) return <p style={{ color: GRIS }}>Todavía no hay operaciones para graficar.</p>;

  const boton = (activo: boolean): React.CSSProperties => ({ border: `1.5px solid ${activo ? AZUL : '#d1d5db'}`, background: activo ? AZUL : '#fff', color: activo ? '#fff' : AZUL, borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' });
  const selector: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 8, padding: '5px 8px', fontSize: 12.5 };

  const tooltip = cursor !== null ? activas.map((s) => ({ s, v: s.valores[puntos[cursor]] })).sort((a, b) => b.v - a.v) : [];

  return (
    <div ref={contenedor} style={{ background: '#fff', display: 'flex', flexDirection: 'column', height: completa ? '100vh' : 'auto', width: completa ? '100vw' : 'auto', padding: completa ? 18 : 0, boxSizing: 'border-box', overflow: completa ? 'hidden' : undefined }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, flex: '0 0 auto' }}>
        {(['MES', 'SEMANA', 'DIA'] as Granularidad[]).map((g) => (
          <button key={g} type="button" onClick={() => { setGran(g); setDesde(0); setHasta(-1); }} style={boton(gran === g)}>{g === 'MES' ? 'Mensual' : g === 'SEMANA' ? 'Semanal' : 'Diario'}</button>
        ))}
        <button type="button" onClick={() => setRelativo((r) => !r)} style={boton(relativo)} title="Cada cuenta en su propia escala (0–100 % de su máximo): sirve para comparar la forma de cuentas de tamaños muy distintos">{relativo ? '✓ ' : ''}Comparar formas</button>
        <label style={{ fontSize: 12.5, color: GRIS }}>Desde <select value={iDesde} onChange={(e) => setDesde(Number(e.target.value))} style={selector}>{cierres.map((c, i) => <option key={c} value={i}>{gran === 'MES' ? evolucion.fechas[c].slice(0, 7) : evolucion.fechas[c]}</option>)}</select></label>
        <label style={{ fontSize: 12.5, color: GRIS }}>Hasta <select value={Math.max(iDesde, iHasta)} onChange={(e) => setHasta(Number(e.target.value))} style={selector}>{cierres.map((c, i) => <option key={c} value={i}>{gran === 'MES' ? evolucion.fechas[c].slice(0, 7) : evolucion.fechas[c]}</option>)}</select></label>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={pantallaCompleta} style={boton(completa)}>{completa ? '⤡ Salir de pantalla completa' : '⤢ Pantalla completa'}</button>
      </div>

      <div style={{ display: 'flex', gap: 14, flex: completa ? '1 1 0' : undefined, minHeight: 0, flexWrap: completa ? 'nowrap' : 'wrap', alignItems: 'stretch' }}>
        <aside style={{ width: completa ? 320 : 290, maxWidth: '100%', maxHeight: completa ? undefined : 620, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 14, padding: 10, flex: '0 0 auto' }}>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cuenta…" style={{ ...selector, width: '100%', boxSizing: 'border-box', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {PRESETS.map((p) => <button key={p.nombre} type="button" onClick={() => setSel(p.claves.filter((k) => evolucion.porClave.has(k)))} style={{ ...boton(false), padding: '3px 9px', fontSize: 11.5 }}>{p.nombre}</button>)}
            <button type="button" onClick={() => setSel([])} style={{ ...boton(false), padding: '3px 9px', fontSize: 11.5, color: '#b91c1c', borderColor: '#fecaca' }}>Quitar todas</button>
          </div>
          {GRUPOS.map(({ grupo, nombre }) => {
            const cuentas = todas.filter((s) => s.grupo === grupo && (!q || s.nombre.toLowerCase().includes(q) || s.codigo.includes(q)));
            if (cuentas.length === 0) return null;
            const cerrado = cerrados[grupo] && !q;
            return (
              <div key={grupo} style={{ marginBottom: 6 }}>
                <button type="button" onClick={() => setCerrados((c) => ({ ...c, [grupo]: !c[grupo] }))} style={{ border: 'none', background: '#f1f5f9', width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 8, fontWeight: 800, fontSize: 12.5, color: AZUL, cursor: 'pointer' }}>
                  {cerrado ? '▸' : '▾'} {nombre} <span style={{ color: GRIS, fontWeight: 600 }}>({cuentas.filter((c) => sel.includes(c.clave)).length}/{cuentas.length})</span>
                </button>
                {!cerrado && cuentas.map((s) => (
                  <label key={s.clave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', paddingLeft: 6 + s.nivel * 10, fontSize: 12.5, cursor: 'pointer', fontWeight: s.esPadre ? 800 : 500 }}>
                    <input type="checkbox" checked={sel.includes(s.clave)} onChange={() => alternar(s.clave)} />
                    {s.esPadre ? <span aria-hidden style={{ width: 14, height: 10, background: `${colorDe.get(s.clave)}44`, borderTop: `3px solid ${colorDe.get(s.clave)}`, flexShrink: 0 }} /> : <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: colorDe.get(s.clave), flexShrink: 0 }} />}
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.nombre}>{s.nombre}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </aside>

        <div ref={lienzo} style={{ flex: '1 1 520px', minWidth: 0, height: completa ? undefined : altoLienzo, minHeight: completa ? 0 : 360, position: 'relative', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <svg width={ancho} height={alto} onMouseMove={alMover} onMouseLeave={() => setCursor(null)} style={{ display: 'block' }}>
            {escala.marcas.map((v) => (
              <g key={v}>
                <line x1={m.izq} x2={ancho - m.der} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#94a3b8' : '#eef2f6'} strokeWidth={v === 0 ? 1.5 : 1} />
                <text x={m.izq - 8} y={y(v) + 4} textAnchor="end" fontSize={completa ? 13 : 11} fill={GRIS}>{relativo ? `${v}%` : compacto(v, simbolo)}</text>
              </g>
            ))}
            {puntos.map((_, i) => (i % paso === 0 ? <text key={i} x={x(i)} y={alto - 14} textAnchor="middle" fontSize={completa ? 13 : 11} fill={GRIS}>{etiquetaFecha(i)}</text> : null))}

            {/* Padres primero (áreas al fondo) y después las individuales por encima. */}
            {[...activas].sort((a, b) => Number(b.esPadre) - Number(a.esPadre)).map((s) => {
              const v = valoresDe(s);
              const color = colorDe.get(s.clave)!;
              const ruta = v.map((val, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ');
              return (
                <g key={s.clave}>
                  {s.esPadre && v.length > 1 && <path d={`${ruta} L${x(v.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`} fill={color} opacity={0.14} />}
                  <path d={ruta} fill="none" stroke={color} strokeWidth={s.esPadre ? 3.6 : 1.8} strokeLinejoin="round" strokeLinecap="round" />
                  {!s.esPadre && puntos.length <= 70 && v.map((val, i) => <circle key={i} cx={x(i)} cy={y(val)} r={2.6} fill="#fff" stroke={color} strokeWidth={1.6} />)}
                </g>
              );
            })}

            {cursor !== null && (
              <g>
                <line x1={x(cursor)} x2={x(cursor)} y1={m.arr} y2={m.arr + h} stroke="#64748b" strokeDasharray="4 3" />
                {activas.map((s) => <circle key={s.clave} cx={x(cursor)} cy={y(valoresDe(s)[cursor])} r={4.5} fill={colorDe.get(s.clave)} stroke="#fff" strokeWidth={1.5} />)}
              </g>
            )}
          </svg>

          {cursor !== null && activas.length > 0 && (
            <div style={{ position: 'absolute', top: 10, left: x(cursor) > ancho / 2 ? undefined : x(cursor) + 14, right: x(cursor) > ancho / 2 ? ancho - x(cursor) + 14 : undefined, background: 'rgba(255,255,255,0.97)', border: '1px solid #cbd5e1', borderRadius: 10, padding: '8px 10px', fontSize: completa ? 14.5 : 12.5, boxShadow: '0 6px 18px rgba(15,23,42,0.18)', pointerEvents: 'none', maxHeight: '90%', overflow: 'hidden', minWidth: 230 }}>
              <div style={{ fontWeight: 800, color: AZUL, marginBottom: 4 }}>{evolucion.fechas[puntos[cursor]]}</div>
              {tooltip.map(({ s, v }) => {
                const raiz = raizDelGrupo.get(s.grupo);
                const peso = !s.esPadre && raiz && raiz.valores[puntos[cursor]] > 0 && s.grupo !== 'RESUMEN' ? (v / raiz.valores[puntos[cursor]]) * 100 : null;
                return (
                  <div key={s.clave} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '1px 0' }}>
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: s.esPadre ? 2 : '50%', background: colorDe.get(s.clave), flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: s.esPadre ? 800 : 500 }}>{s.nombre}</span>
                    <b>{compacto(v, simbolo)}</b>
                    {peso !== null && <span style={{ color: GRIS, minWidth: 54, textAlign: 'right' }}>{peso.toFixed(0)} % del {GRUPOS.find((g) => g.grupo === s.grupo)?.nombre.toLowerCase()}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {activas.length === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GRIS, fontSize: 15 }}>Elegí una o más cuentas de la lista.</div>}
        </div>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: GRIS, flex: '0 0 auto' }}>Áreas con línea gruesa = cuentas padre (su total); líneas finas con puntos = cuentas individuales. Pasá el mouse por el gráfico para ver cada valor y su peso dentro del grupo.</p>
    </div>
  );
}
