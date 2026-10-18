'use client';

import type { PuntoAgrupado } from '@/lib/evolucionFinanciera';
import { AZUL, COLOR } from './compartido';

// DETALHES — cifras exactas del rango elegido
// =====================================================
//
// Tabla por período con total, una dona que muestra a dónde van los ingresos
// (costos, gastos y lo que queda como resultado) y barras del resultado de
// cada período. Usa el mismo rango y agrupado que Tendência.

const ANCHO = 560;
const ALTO = 190;

export function VistaDetalles({
  serie,
  totales,
  conCostos,
  simbolo,
  idioma,
  etiqueta,
}: {
  serie: PuntoAgrupado[];
  totales: Omit<PuntoAgrupado, 'clave'>;
  conCostos: boolean;
  simbolo: string;
  idioma: string;
  etiqueta: (clave: string, larga?: boolean) => string;
}) {
  const esPT = idioma === 'PT';
  const t = (es: string, pt: string) => (esPT ? pt : es);
  const locale = esPT ? 'pt-BR' : 'es-AR';
  const formato = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 0 });
  const formatoMoneda = (v: number) => `${simbolo} ${formato(v)}`;

  const columnas: { id: 'ingresos' | 'costos' | 'gastos' | 'resultado' | 'margenBruto'; titulo: string }[] = [
    { id: 'ingresos', titulo: t('Ingresos', 'Receitas') },
    ...(conCostos ? [{ id: 'costos' as const, titulo: t('Costos', 'Custos') }] : []),
    { id: 'gastos', titulo: t('Gastos', 'Despesas') },
    { id: 'resultado', titulo: t('Resultado', 'Resultado') },
    ...(conCostos ? [{ id: 'margenBruto' as const, titulo: t('Margen bruto', 'Margem bruta') }] : []),
  ];

  const celda = (valor: number, negrita = false): React.CSSProperties => ({
    padding: '9px 12px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontWeight: negrita ? 800 : 500,
    color: valor < 0 ? COLOR.gastos : '#111827',
  });

  // Dona: de cada peso que entra, cuánto se va en costos, en gastos y cuánto
  // queda. Si se gastó más de lo que entró no hay "lo que queda": se reparte
  // entre costos y gastos y el centro muestra los egresos.
  const entra = totales.ingresos;
  const quedaPositivo = entra > 0 && totales.resultado >= 0;

  const rebanadas = quedaPositivo
    ? [
        ...(conCostos ? [{ clave: 'costos', nombre: t('Costos', 'Custos'), valor: totales.costos, color: COLOR.costos }] : []),
        { clave: 'gastos', nombre: t('Gastos', 'Despesas'), valor: totales.gastos, color: COLOR.gastos },
        { clave: 'resultado', nombre: t('Resultado', 'Resultado'), valor: totales.resultado, color: COLOR.resultado },
      ]
    : [
        ...(conCostos ? [{ clave: 'costos', nombre: t('Costos', 'Custos'), valor: totales.costos, color: COLOR.costos }] : []),
        { clave: 'gastos', nombre: t('Gastos', 'Despesas'), valor: totales.gastos, color: COLOR.gastos },
      ];

  const baseDona = rebanadas.reduce((suma, r) => suma + Math.max(r.valor, 0), 0);
  const centro = quedaPositivo ? { etiqueta: t('Ingresos', 'Receitas'), valor: entra } : { etiqueta: t('Egresos', 'Saídas'), valor: totales.costos + totales.gastos };

  const radio = 62;
  const grosor = 26;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;

  // Barras del resultado por período.
  const valoresResultado = serie.map((p) => p.resultado);
  const maxR = Math.max(...valoresResultado, 1);
  const minR = Math.min(...valoresResultado, 0);
  const rangoR = maxR - minR || 1;
  const margen = { izq: 8, der: 8, sup: 14, inf: 30 };
  const altoUtil = ALTO - margen.sup - margen.inf;
  const anchoGrupo = (ANCHO - margen.izq - margen.der) / serie.length;
  const anchoBarra = Math.min(36, anchoGrupo * 0.7);
  const yR = (v: number) => margen.sup + altoUtil - ((v - minR) / rangoR) * altoUtil;
  const paso = Math.max(1, Math.ceil(serie.length / 10));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
      <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 480 }}>
          <thead>
            <tr style={{ background: '#eef4fb' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: AZUL, fontWeight: 800, position: 'sticky', left: 0, background: '#eef4fb' }}>{t('Período', 'Período')}</th>
              {columnas.map((c) => (
                <th key={c.id} style={{ padding: '10px 12px', textAlign: 'right', color: AZUL, fontWeight: 800, whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: COLOR[c.id], marginRight: 6 }} />
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {serie.map((p) => (
              <tr key={p.clave} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '9px 12px', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff' }}>{etiqueta(p.clave, true)}</td>
                {columnas.map((c) => (
                  <td key={c.id} style={celda(p[c.id], c.id === 'resultado')}>
                    {formato(p[c.id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #cbd5e1', background: '#f8fafc' }}>
              <td style={{ padding: '10px 12px', fontWeight: 900, color: AZUL, position: 'sticky', left: 0, background: '#f8fafc' }}>{t('Total', 'Total')}</td>
              {columnas.map((c) => (
                <td key={c.id} style={celda(totales[c.id], true)}>
                  {formatoMoneda(totales[c.id])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: AZUL }}>{quedaPositivo ? t('¿A dónde van los ingresos?', 'Para onde vão as receitas?') : t('¿A dónde van los egresos?', 'Para onde vão as saídas?')}</div>
        <div style={{ fontSize: 12.5, color: '#6e7781', marginBottom: 8 }}>{t('Del período elegido', 'Do período escolhido')}</div>

        {baseDona <= 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8' }}>{t('Sin movimientos en el período.', 'Sem movimentos no período.')}</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <svg viewBox="0 0 160 160" style={{ width: 170, height: 170, flexShrink: 0 }} role="img" aria-label={t('Composición', 'Composição')}>
              <circle cx="80" cy="80" r={radio} fill="none" stroke="#eef2f6" strokeWidth={grosor} />
              {rebanadas
                .filter((r) => r.valor > 0)
                .map((r) => {
                  const largo = (r.valor / baseDona) * circunferencia;
                  const desfase = -acumulado;
                  acumulado += largo;
                  return (
                    <circle
                      key={r.clave}
                      cx="80"
                      cy="80"
                      r={radio}
                      fill="none"
                      stroke={r.color}
                      strokeWidth={grosor}
                      strokeDasharray={`${largo} ${circunferencia - largo}`}
                      strokeDashoffset={desfase}
                      transform="rotate(-90 80 80)"
                    />
                  );
                })}
              <text x="80" y="74" textAnchor="middle" fontSize="11" fill="#6e7781" fontWeight="700">
                {centro.etiqueta}
              </text>
              <text x="80" y="92" textAnchor="middle" fontSize="15" fill={AZUL} fontWeight="900">
                {formatoMoneda(centro.valor)}
              </text>
            </svg>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 130 }}>
              {rebanadas.map((r) => (
                <div key={r.clave} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: r.color, display: 'inline-block' }} />
                  <span style={{ color: '#374151', fontWeight: 600 }}>{r.nombre}</span>
                  <b style={{ marginLeft: 'auto', color: '#111827' }}>{Math.round((Math.max(r.valor, 0) / baseDona) * 100)}%</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: AZUL }}>{t('Resultado por período', 'Resultado por período')}</div>
        <div style={{ fontSize: 12.5, color: '#6e7781', marginBottom: 4 }}>{t('Verde: ganancia · Rojo: pérdida', 'Verde: lucro · Vermelho: prejuízo')}</div>

        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <line x1={margen.izq} x2={ANCHO - margen.der} y1={yR(0)} y2={yR(0)} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray={minR < 0 ? '6 5' : undefined} />
          {serie.map((p, i) => {
            const x = margen.izq + i * anchoGrupo + (anchoGrupo - anchoBarra) / 2;
            const y = yR(p.resultado);
            return (
              <g key={p.clave}>
                <rect x={x} y={Math.min(y, yR(0))} width={anchoBarra} height={Math.max(Math.abs(y - yR(0)), p.resultado === 0 ? 0 : 2)} rx={3} fill={p.resultado < 0 ? COLOR.gastos : COLOR.ingresos}>
                  <title>{`${etiqueta(p.clave, true)}: ${formatoMoneda(p.resultado)}`}</title>
                </rect>
                {i % paso === 0 && (
                  <text x={x + anchoBarra / 2} y={ALTO - 10} textAnchor="middle" fontSize="12" fill="#6e7781">
                    {etiqueta(p.clave)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
