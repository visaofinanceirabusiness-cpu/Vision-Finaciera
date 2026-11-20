'use client';

import { useState } from 'react';
import { formatearNumeroEntero } from '@/lib/moneda';
import { analisisSabio, composicionSalidas, topCuentas, variacionPct, type FilaCuenta } from '@/lib/informes/dre';

// Vista visual del Estado de Resultado (DRE): tarjetas con Sabio, resultado del período, evolución, composición de las salidas, top de
// cuentas y análisis de Sabio. Todo se alimenta de los números que calcula el informe; la demostración completa sigue debajo.

const COL = {
  azul: 'var(--color-primario, #1f3a5f)',
  verde: 'var(--color-secundario, #2e7d4f)',
  gris: '#6b7280',
};
export const PALETA_TORTA = ['#2563eb', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

export type TotalesDre = { ingresos: number; costos: number; gastos: number; resultadoBruto: number; resultado: number };

export type PropsDreVisual = {
  pt: boolean;
  esFamiliar: boolean;
  simbolo: string;
  etiquetaPeriodo: string;
  esTodos: boolean;
  periodos: { valor: string; etiqueta: string }[];
  periodo: string;
  onPeriodo: (valor: string) => void;
  totales: TotalesDre;
  anterior: TotalesDre | null;
  filasIngresos: FilaCuenta[];
  filasCostos: FilaCuenta[];
  filasGastos: FilaCuenta[];
  tendencia: { clave: string; etiqueta: string; valor: number }[];
};

export function DreVisual(p: PropsDreVisual) {
  const { pt, esFamiliar, simbolo } = p;
  const dinero = (n: number) => `${simbolo} ${formatearNumeroEntero(n)}`;
  const rentabilidad = p.totales.ingresos !== 0 ? (p.totales.resultado / p.totales.ingresos) * 100 : 0;
  const salidas = [...p.filasCostos, ...p.filasGastos];

  const tarjetas = esFamiliar
    ? [
        { clave: 'ingresos', titulo: pt ? 'Receitas' : 'Ingresos', sub: pt ? 'Entradas do período' : 'Entradas del período', valor: p.totales.ingresos, ant: p.anterior?.ingresos, sabio: 'sabio-resumen-ingresos', color: '#16a34a', fondo: '#ecfdf3', subeEsBueno: true },
        { clave: 'gastos', titulo: pt ? 'Despesas' : 'Gastos', sub: p.totales.ingresos ? `${((p.totales.gastos / p.totales.ingresos) * 100).toFixed(1).replace('.', ',')}% ${pt ? 'das receitas' : 'de los ingresos'}` : '', valor: p.totales.gastos, ant: p.anterior?.gastos, sabio: 'sabio-resumen-gastos', color: '#dc2626', fondo: '#fef2f2', subeEsBueno: false },
        { clave: 'resultado', titulo: pt ? 'Saldo do período' : 'Saldo del período', sub: `${pt ? 'Margem de' : 'Margen de'} ${rentabilidad.toFixed(1).replace('.', ',')}%`, valor: p.totales.resultado, ant: p.anterior?.resultado, sabio: p.totales.resultado >= 0 ? 'sabio-celebra' : 'sabio-idea', color: p.totales.resultado >= 0 ? '#1d4ed8' : '#dc2626', fondo: p.totales.resultado >= 0 ? '#eff6ff' : '#fef2f2', subeEsBueno: true },
      ]
    : [
        { clave: 'ingresos', titulo: pt ? 'Receitas' : 'Ingresos', sub: pt ? 'Entradas do período' : 'Entradas del período', valor: p.totales.ingresos, ant: p.anterior?.ingresos, sabio: 'sabio-resumen-ingresos', color: '#16a34a', fondo: '#ecfdf3', subeEsBueno: true },
        { clave: 'costos', titulo: pt ? 'Custos' : 'Costos', sub: p.totales.ingresos ? `${((p.totales.costos / p.totales.ingresos) * 100).toFixed(1).replace('.', ',')}% ${pt ? 'das receitas' : 'de los ingresos'}` : '', valor: p.totales.costos, ant: p.anterior?.costos, sabio: 'sabio-calculadora', color: '#dc2626', fondo: '#fef2f2', subeEsBueno: false },
        { clave: 'bruto', titulo: pt ? 'Resultado Bruto' : 'Resultado Bruto', sub: p.totales.ingresos ? `${pt ? 'Margem de' : 'Margen de'} ${((p.totales.resultadoBruto / p.totales.ingresos) * 100).toFixed(1).replace('.', ',')}%` : '', valor: p.totales.resultadoBruto, ant: p.anterior?.resultadoBruto, sabio: p.totales.resultadoBruto >= 0 ? 'sabio-celebra' : 'sabio-idea', color: '#1d4ed8', fondo: '#eff6ff', subeEsBueno: true },
        { clave: 'gastos', titulo: pt ? 'Despesas Operacionais' : 'Gastos Operacionales', sub: p.totales.ingresos ? `${((p.totales.gastos / p.totales.ingresos) * 100).toFixed(1).replace('.', ',')}% ${pt ? 'das receitas' : 'de los ingresos'}` : '', valor: p.totales.gastos, ant: p.anterior?.gastos, sabio: 'sabio-checklist', color: '#6d28d9', fondo: '#f5f3ff', subeEsBueno: false },
      ];

  const analisis = analisisSabio({
    pt,
    esFamiliar,
    ingresos: p.totales.ingresos,
    salidas: p.totales.costos + p.totales.gastos,
    resultado: p.totales.resultado,
    ingresosAnterior: p.anterior ? p.anterior.ingresos : null,
    mayoresSalidas: [...salidas].sort((a, b) => b.valor - a.valor).filter((f) => f.valor > 0).map((f) => f.nombre),
    dinero,
  });

  const titulo = esFamiliar ? (pt ? 'Demonstração de Resultado' : 'Estado de Resultado') : pt ? 'Demonstração de Resultado (DRE)' : 'Estado de Resultado (DRE)';

  return (
    <div>
      <EstiloImpresion />

      <div style={{ fontSize: 12.5, color: COL.gris, marginBottom: 6 }}>
        {pt ? 'Relatórios' : 'Informes'} › <strong style={{ color: COL.azul }}>{titulo}</strong>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 280px' }}>
          <h2 style={{ margin: 0, fontSize: 28, color: COL.azul }}>{titulo}</h2>
          <p style={{ margin: '4px 0 0', color: COL.gris, fontSize: 14 }}>
            {esFamiliar
              ? pt ? 'Veja como foram as finanças da sua família no período.' : 'Mirá cómo fueron las finanzas de tu familia en el período.'
              : pt ? 'Veja o desempenho do seu negócio no período, com receitas, custos, despesas e resultado.' : 'Mirá el desempeño de tu negocio en el período, con ingresos, costos, gastos y resultado.'}
          </p>
        </div>

        <div className="dre-no-imprimir" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '10px 14px' }}>
          <div>
            <div style={{ fontSize: 11, color: COL.gris, fontWeight: 700 }}>{pt ? 'Período' : 'Período'}</div>
            <select value={p.periodo} onChange={(e) => p.onPeriodo(e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, color: COL.azul, background: '#fff' }}>
              <option value="TODOS">{pt ? 'Todos os períodos' : 'Todos los períodos'}</option>
              {p.periodos.map((x) => (
                <option key={x.valor} value={x.valor}>{x.etiqueta}</option>
              ))}
            </select>
          </div>
          <BotonExportarPdf pt={pt} />
        </div>
      </div>

      <ZonaInforme titulo={pt ? 'Resumo do período' : 'Resumen del período'} subtitulo={pt ? 'Tudo o que importa em um só olhar' : 'Todo lo importante de un vistazo'} tono="verde">
      {/* Tarjetas con Sabio */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${esFamiliar ? 260 : 220}px, 1fr))`, gap: 12, marginBottom: 14 }}>
        {tarjetas.map((c) => {
          const v = p.esTodos || c.ant === undefined || c.ant === null ? null : variacionPct(c.valor, c.ant);
          const sube = v !== null && v >= 0;
          const bueno = v === null ? true : sube === c.subeEsBueno;
          return (
            <div key={c.clave} style={{ background: `linear-gradient(135deg, ${c.fondo}, #fff)`, border: `1px solid ${c.color}33`, borderRadius: 18, padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 8, minHeight: 130, overflow: 'hidden' }}>
              <img className="dre-sabio-tarjeta" src={`/sabio/${c.sabio}.webp`} alt="" style={{ height: 96, width: 'auto', flexShrink: 0, objectFit: 'contain' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: c.color, fontSize: 15 }}>{c.titulo}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: c.valor < 0 ? '#dc2626' : COL.azul, whiteSpace: 'nowrap' }}>{dinero(c.valor)}</div>
                {c.sub && <div style={{ fontSize: 12, color: COL.gris }}>{c.sub}</div>}
                {v !== null && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: bueno ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                    {sube ? '↗' : '↘'} {sube ? '+' : ''}{v.toFixed(1).replace('.', ',')}% <span style={{ color: COL.gris, fontWeight: 500 }}>{pt ? 'vs. mês anterior' : 'vs. mes anterior'}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resultado + evolución + composición */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div style={{ background: p.totales.resultado >= 0 ? '#ecfdf3' : '#fef2f2', borderRadius: 18, border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: COL.azul, color: '#fff', fontWeight: 800, padding: '9px 14px', fontSize: 14 }}>
            📊 {esFamiliar ? (pt ? 'Saldo do período' : 'Saldo del período') : pt ? 'Resultado Líquido do Período' : 'Resultado Neto del Período'} · {p.etiquetaPeriodo}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', flexWrap: 'wrap', flex: 1 }}>
            <img className="dre-sabio-tarjeta" src={`/sabio/${p.totales.resultado >= 0 ? 'sabio-celebra' : 'sabio-idea'}.webp`} alt="" style={{ height: 110, width: 'auto', objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 34, fontWeight: 900, color: p.totales.resultado >= 0 ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                {dinero(p.totales.resultado)} {p.totales.resultado >= 0 ? '↗' : '↘'}
              </div>
              <div style={{ fontSize: 13, color: COL.gris }}>
                {pt ? 'Rentabilidade' : 'Rentabilidad'} <strong style={{ color: p.totales.resultado >= 0 ? '#16a34a' : '#dc2626' }}>{rentabilidad.toFixed(1).replace('.', ',')}%</strong>
              </div>
            </div>
          </div>
        </div>

        <Tarjeta titulo={`📈 ${pt ? 'Evolução do Resultado' : 'Evolución del Resultado'}`} sub={pt ? '(últimos 6 meses)' : '(últimos 6 meses)'}>
          <GraficoBarras datos={p.tendencia.slice(-6)} resaltar={p.periodo} dinero={formatearNumeroEntero} pt={pt} />
        </Tarjeta>

        <Tarjeta titulo={`🍩 ${pt ? 'Composição das Saídas' : 'Composición de las Salidas'}`}>
          <Torta trozos={composicionSalidas(salidas, 3, pt ? 'Outros' : 'Otros')} total={dinero(p.totales.costos + p.totales.gastos)} pt={pt} />
        </Tarjeta>
      </div>

      {/* Top de cuentas + análisis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 18 }}>
        <TopCuentas titulo={`💰 ${pt ? 'Receitas por Conta' : 'Ingresos por Cuenta'}`} filas={p.filasIngresos} color="#22c55e" dinero={dinero} pt={pt} verTodas={pt ? 'Ver todas as receitas' : 'Ver todos los ingresos'} />
        <TopCuentas
          titulo={esFamiliar ? `🧾 ${pt ? 'Despesas por Conta' : 'Gastos por Cuenta'}` : `📦 ${pt ? 'Custos por Conta' : 'Costos por Cuenta'}`}
          filas={esFamiliar ? p.filasGastos : p.filasCostos}
          color="#ef4444"
          dinero={dinero}
          pt={pt}
          verTodas={esFamiliar ? (pt ? 'Ver todas as despesas' : 'Ver todos los gastos') : pt ? 'Ver todos os custos' : 'Ver todos los costos'}
        />
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 14, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: COL.azul, fontSize: 16, marginBottom: 8 }}>🎯 {pt ? 'Análise do Sabio' : 'Análisis del Sabio'}</div>
            <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: 14, padding: '10px 12px', fontSize: 13.5, color: '#1f2937', lineHeight: 1.5 }}>
              {analisis.map((t, i) => (
                <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>{t}</p>
              ))}
            </div>
          </div>
          <img className="dre-sabio-tarjeta" src="/sabio/sabio-analiza.webp" alt="" style={{ height: 120, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        </div>
      </div>
      </ZonaInforme>
    </div>
  );
}

export function Tarjeta({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 14 }}>
      <div style={{ fontWeight: 800, color: COL.azul, fontSize: 16, marginBottom: 8 }}>
        {titulo} {sub && <span style={{ fontWeight: 500, fontSize: 12, color: COL.gris }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function GraficoBarras({ datos, resaltar, dinero, pt }: { datos: { clave: string; etiqueta: string; valor: number }[]; resaltar: string; dinero: (n: number) => string; pt: boolean }) {
  if (datos.length === 0) return <div style={{ color: COL.gris, fontSize: 13 }}>{pt ? 'Ainda não há histórico.' : 'Todavía no hay historial.'}</div>;
  const maximo = Math.max(...datos.map((d) => Math.abs(d.valor)), 1);
  const ancho = 360, alto = 190, base = 92, tope = 54, paso = ancho / datos.length;
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 'auto', maxHeight: 220 }} role="img" aria-label={pt ? 'Evolução do resultado' : 'Evolución del resultado'}>
      <line x1="0" x2={ancho} y1={base} y2={base} stroke="#d1d5db" />
      {datos.map((d, i) => {
        const h = Math.max((Math.abs(d.valor) / maximo) * tope, d.valor === 0 ? 0 : 2);
        const x = i * paso + paso * 0.2;
        const positivo = d.valor >= 0;
        const y = positivo ? base - h : base;
        return (
          <g key={d.clave} opacity={resaltar === 'TODOS' || resaltar === d.clave ? 1 : 0.55}>
            <rect x={x} y={y} width={paso * 0.6} height={h} rx="3" fill={positivo ? '#22c55e' : '#ef4444'} />
            <text x={x + paso * 0.3} y={positivo ? y - 5 : y + h + 12} textAnchor="middle" fontSize="10" fontWeight="700" fill={positivo ? '#15803d' : '#b91c1c'}>{dinero(d.valor)}</text>
            <text x={x + paso * 0.3} y={alto - 8} textAnchor="middle" fontSize="10.5" fill="#6b7280">{d.etiqueta}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Torta({ trozos, total, pt, etiquetaTotal }: { trozos: { nombre: string; valor: number; pct: number }[]; total: string; pt: boolean; etiquetaTotal?: string }) {
  if (trozos.length === 0) return <div style={{ color: COL.gris, fontSize: 13 }}>{pt ? 'Sem saídas no período.' : 'Sin salidas en el período.'}</div>;
  const r = 52, c = 2 * Math.PI * r;
  let acumulado = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 140 140" style={{ width: 150, height: 150, flexShrink: 0 }} role="img" aria-label={pt ? 'Composição das saídas' : 'Composición de las salidas'}>
        <g transform="rotate(-90 70 70)">
          {trozos.map((t, i) => {
            const largo = (t.pct / 100) * c;
            const el = <circle key={t.nombre} cx="70" cy="70" r={r} fill="none" stroke={PALETA_TORTA[i % PALETA_TORTA.length]} strokeWidth="24" strokeDasharray={`${largo} ${c - largo}`} strokeDashoffset={-acumulado} />;
            acumulado += largo;
            return el;
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1f3a5f">{total}</text>
        <text x="70" y="80" textAnchor="middle" fontSize="8.5" fill="#6b7280">{etiquetaTotal ?? (pt ? 'Total de Saídas' : 'Total de Salidas')}</text>
      </svg>
      <div style={{ display: 'grid', gap: 6, fontSize: 13, minWidth: 0, flex: 1 }}>
        {trozos.map((t, i) => (
          <div key={t.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: PALETA_TORTA[i % PALETA_TORTA.length], flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span>
            <strong>{Math.round(t.pct)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopCuentas({ titulo, filas, color, dinero, pt, verTodas }: { titulo: string; filas: FilaCuenta[]; color: string; dinero: (n: number) => string; pt: boolean; verTodas: string }) {
  const [todas, setTodas] = useState(false);
  const { filas: top, total, hayMas } = topCuentas(filas, todas ? 200 : 5);
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 14 }}>
      <div style={{ fontWeight: 800, color: COL.azul, fontSize: 16, marginBottom: 8 }}>{titulo}</div>
      {top.length === 0 ? (
        <div style={{ color: COL.gris, fontSize: 13 }}>{pt ? 'Sem movimentos no período.' : 'Sin movimientos en el período.'}</div>
      ) : (
        <div style={{ display: 'grid', gap: 7 }}>
          {top.map((f) => (
            <div key={f.nombre} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 70px 44px', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{dinero(f.valor)}</span>
              <span style={{ height: 8, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.min(100, f.pct)}%`, background: color }} />
              </span>
              <span style={{ color: COL.gris, fontSize: 12, textAlign: 'right' }}>{f.pct.toFixed(1).replace('.', ',')}%</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 13 }}>
        {hayMas || todas ? (
          <button type="button" className="dre-no-imprimir" onClick={() => setTodas((v) => !v)} style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
            {todas ? (pt ? 'Ver menos' : 'Ver menos') : `${verTodas} ›`}
          </button>
        ) : (
          <span />
        )}
        <span>
          Total <strong style={{ background: color === '#22c55e' ? '#dcfce7' : '#fee2e2', color: color === '#22c55e' ? '#15803d' : '#b91c1c', borderRadius: 8, padding: '3px 10px', marginLeft: 6 }}>{dinero(total)}</strong>
        </span>
      </div>
    </div>
  );
}

// Al imprimir (Exportar PDF) solo queda el informe: se esconde el resto de la pantalla (menú, cabecera, botones).
export function EstiloImpresion() {
  return (
    <style>{`
      @media print {
        @page { size: A4; margin: 10mm; }
        body * { visibility: hidden !important; }
        #informe-imprimible, #informe-imprimible * { visibility: visible !important; }
        #informe-imprimible { position: absolute; left: 0; top: 0; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .dre-no-imprimir { display: none !important; }
      }
      @media (max-width: 560px) { .dre-sabio-tarjeta { display: none !important; } }
    `}</style>
  );
}

export function BotonExportarPdf({ pt }: { pt: boolean }) {
  return (
    <button
      type="button"
      className="dre-no-imprimir"
      onClick={() => window.print()}
      style={{ border: '1px solid #d1d5db', background: '#fff', color: COL.azul, borderRadius: 12, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
    >
      ⬇ {pt ? 'Exportar PDF' : 'Exportar PDF'}
    </button>
  );
}

// Zona con título y fondo propios que agrupa las tarjetas de una vista (simplificada / detallada).
export function ZonaInforme({ titulo, subtitulo, tono, children }: { titulo: string; subtitulo: string; tono: 'verde' | 'azul'; children: React.ReactNode }) {
  const c = tono === 'verde' ? { fondo: 'linear-gradient(180deg, #f0fdf4, #f8fafc)', borde: '#bbf7d0', titulo: '#15803d' } : { fondo: 'linear-gradient(180deg, #eff6ff, #f8fafc)', borde: '#bfdbfe', titulo: '#1d4ed8' };
  return (
    <section style={{ background: c.fondo, border: `1px solid ${c.borde}`, borderRadius: 22, padding: '14px 14px 4px', marginBottom: 18 }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 18, color: c.titulo }}>{titulo}</h3>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{subtitulo}</span>
      </div>
      {children}
    </section>
  );
}
