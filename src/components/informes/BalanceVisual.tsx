'use client';

import { formatearNumeroEntero } from '@/lib/moneda';
import { composicionSalidas, type FilaCuenta } from '@/lib/informes/dre';
import { analisisBalance } from '@/lib/informes/balance';
import { BotonExportarPdf, EstiloImpresion, Tarjeta, Torta } from './DreVisual';
import { GraficoInteractivo } from './GraficoInteractivo';

// Vista visual del Balance Patrimonial: cabecera con período, tarjetas con Sabio, composición del patrimonio y análisis de Sabio.
// Las listas de cuentas (Activo / Pasivo / Patrimonio) las arma la pestaña y entran como `activoNode` y `pasivoNode`.

const COL = { azul: 'var(--color-primario, #1f3a5f)', gris: '#6b7280' };

export type PropsBalanceVisual = {
  pt: boolean;
  simbolo: string;
  periodos: { valor: string; etiqueta: string }[];
  periodo: string;
  onPeriodo: (valor: string) => void;
  selectorVista: React.ReactNode;
  totales: { activo: number; pasivo: number; patrimonio: number; resultado: number };
  gruposActivo: FilaCuenta[];
  serie: { clave: string; etiqueta: string; etiquetaLarga: string; activo: number; pasivo: number; patrimonio: number }[];
  activoNode: React.ReactNode;
  pasivoNode: React.ReactNode;
  pie: React.ReactNode;
};

export function BalanceVisual(p: PropsBalanceVisual) {
  const { pt } = p;
  const dinero = (n: number) => `${p.simbolo} ${formatearNumeroEntero(n)}`;
  const t = p.totales;

  const tarjetas = [
    { clave: 'a', titulo: pt ? 'Ativo' : 'Activo', sub: pt ? 'Bens e direitos do negócio' : 'Bienes y derechos del negocio', valor: t.activo, sabio: 'sabio-proteccion', color: '#16a34a', fondo: '#ecfdf3' },
    { clave: 'p', titulo: pt ? 'Passivo' : 'Pasivo', sub: pt ? 'Obrigações e dívidas' : 'Obligaciones y deudas', valor: t.pasivo, sabio: 'sabio-banco', color: '#dc2626', fondo: '#fef2f2' },
    { clave: 'pl', titulo: pt ? 'Patrimônio Líquido' : 'Patrimonio Neto', sub: pt ? 'Capital próprio do negócio' : 'Capital propio del negocio', valor: t.patrimonio, sabio: 'sabio-balanza', color: '#1d4ed8', fondo: '#eff6ff' },
    { clave: 'r', titulo: pt ? 'Resultado do Exercício' : 'Resultado del Ejercicio', sub: pt ? (t.resultado >= 0 ? 'Lucro do período (não encerrado)' : 'Prejuízo do período (não encerrado)') : t.resultado >= 0 ? 'Ganancia del período (no cerrado)' : 'Pérdida del período (no cerrado)', valor: t.resultado, sabio: t.resultado >= 0 ? 'sabio-crecimiento' : 'sabio-idea', color: t.resultado >= 0 ? '#15803d' : '#dc2626', fondo: t.resultado >= 0 ? '#f0fdf4' : '#fef2f2' },
  ];

  const analisis = analisisBalance({ pt, activo: t.activo, pasivo: t.pasivo, patrimonio: t.patrimonio, resultado: t.resultado, dinero });

  return (
    <div>
      <EstiloImpresion />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 280px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 44 }} aria-hidden>🏛️</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 28, color: COL.azul }}>{pt ? 'Balanço Patrimonial' : 'Balance Patrimonial'}</h2>
            <p style={{ margin: '4px 0 0', color: COL.gris, fontSize: 14 }}>
              {pt ? 'Mostra a situação patrimonial em uma data, com os bens, direitos, obrigações e o patrimônio líquido.' : 'Muestra la situación patrimonial a una fecha, con los bienes, derechos, obligaciones y el patrimonio neto.'}
            </p>
          </div>
        </div>

        <div className="dre-no-imprimir" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '10px 14px' }}>
          <div>
            <div style={{ fontSize: 11, color: COL.gris, fontWeight: 700 }}>{pt ? 'Posição ao fim de' : 'Situación al cierre de'}</div>
            <select value={p.periodo} onChange={(e) => p.onPeriodo(e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, color: COL.azul, background: '#fff' }}>
              {p.periodos.map((x) => (
                <option key={x.valor} value={x.valor}>{x.etiqueta}</option>
              ))}
            </select>
          </div>
          {p.selectorVista}
          <BotonExportarPdf pt={pt} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
        {tarjetas.map((c) => (
          <div key={c.clave} style={{ background: `linear-gradient(135deg, ${c.fondo}, #fff)`, border: `1px solid ${c.color}33`, borderRadius: 18, padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 8, minHeight: 130, overflow: 'hidden' }}>
            <img className="dre-sabio-tarjeta" src={`/sabio/${c.sabio}.webp`} alt="" style={{ height: 96, width: 'auto', flexShrink: 0, objectFit: 'contain' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: c.color, fontSize: 15 }}>{c.titulo}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.valor < 0 ? '#dc2626' : COL.azul, whiteSpace: 'nowrap' }}>{dinero(c.valor)}</div>
              <div style={{ fontSize: 12, color: COL.gris }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 14, alignItems: 'start' }}>
        {p.activoNode}
        {p.pasivoNode}
        <div style={{ display: 'grid', gap: 14 }}>
          <Tarjeta titulo={`🍩 ${pt ? 'Composição do Patrimônio' : 'Composición del Patrimonio'}`}>
            <Torta trozos={composicionSalidas(p.gruposActivo, 4, pt ? 'Outros' : 'Otros')} total={dinero(t.activo)} pt={pt} etiquetaTotal={pt ? 'Total do Ativo' : 'Total del Activo'} />
          </Tarjeta>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 14, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: COL.azul, fontSize: 16, marginBottom: 8 }}>🎯 {pt ? 'Análise do Sabio' : 'Análisis del Sabio'}</div>
              <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: 14, padding: '10px 12px', fontSize: 13.5, color: '#1f2937', lineHeight: 1.5 }}>
                {analisis.map((txt, i) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>{txt}</p>
                ))}
              </div>
            </div>
            <img className="dre-sabio-tarjeta" src="/sabio/sabio-idea.webp" alt="" style={{ height: 110, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Tarjeta titulo={`📈 ${pt ? 'Evolução Patrimonial' : 'Evolución Patrimonial'}`} sub={pt ? '(clique em um mês para ver o balanço dessa data)' : '(tocá un mes para ver el balance a esa fecha)'}>
          <GraficoInteractivo
            puntos={p.serie.map((x) => ({ clave: x.clave, etiqueta: x.etiqueta, etiquetaLarga: x.etiquetaLarga }))}
            series={[
              { clave: 'act', nombre: pt ? 'Ativo' : 'Activo', color: '#16a34a', tipo: 'linea', area: true, valores: p.serie.map((x) => x.activo) },
              { clave: 'pas', nombre: pt ? 'Passivo' : 'Pasivo', color: '#dc2626', tipo: 'linea', valores: p.serie.map((x) => x.pasivo) },
              { clave: 'pat', nombre: pt ? 'Patrimônio Líquido' : 'Patrimonio Neto', color: '#2563eb', tipo: 'linea', valores: p.serie.map((x) => x.patrimonio) },
            ]}
            simbolo={p.simbolo}
            seleccionado={p.periodo}
            onSeleccionar={p.onPeriodo}
            pt={pt}
          />
        </Tarjeta>
      </div>

      <div style={{ marginTop: 16 }}>{p.pie}</div>
    </div>
  );
}
