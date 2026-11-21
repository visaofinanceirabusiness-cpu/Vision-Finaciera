'use client';

import { formatearNumeroEntero } from '@/lib/moneda';
import { pesoDelMovimiento, variacionCaja, type PuntoFlujo } from '@/lib/informes/flujo';
import type { FilaCuenta } from '@/lib/informes/dre';
import { BotonExportarPdf, EstiloImpresion, Tarjeta, TopCuentas, ZonaInforme } from './DreVisual';
import { GraficoInteractivo } from './GraficoInteractivo';

// Vista visual del Flujo de Caja: cabecera con período, cuatro tarjetas (saldo inicial, entradas, salidas, saldo final), evolución
// mensual con el saldo acumulado, resumen del período y las listas de entradas y salidas con su participación.
// Todo viene de lo que ya calcula la pestaña; lo que es propio del perfil (ahorro de Familia, actividades de la empresa) entra como `extras`.

const COL = { azul: 'var(--color-primario, #1f3a5f)', gris: '#6b7280' };

export type FilaResumen = { etiqueta: string; valor: number; signo: '+' | '-' | '=' | ''; destacada?: boolean };

export type PropsFlujoVisual = {
  pt: boolean;
  esFamiliar: boolean;
  simbolo: string;
  periodos: { valor: string; etiqueta: string }[];
  periodo: string;
  onPeriodo: (v: string) => void;
  etiquetaPeriodo: string;
  cajaHoy: number;
  saldoInicial: number;
  entradas: number;
  salidas: number;
  saldoFinal: number;
  neto: number;
  serie: PuntoFlujo[];
  etiquetaMes: (clave: string) => string;
  etiquetaMesLarga: (clave: string) => string;
  filasEntradas: FilaCuenta[];
  filasSalidas: FilaCuenta[];
  filasResumen: FilaResumen[];
  extras?: React.ReactNode;
};

export function FlujoVisual(p: PropsFlujoVisual) {
  const { pt } = p;
  const dinero = (n: number) => `${p.simbolo} ${formatearNumeroEntero(n)}`;
  const variacion = variacionCaja(p.saldoInicial, p.saldoFinal);

  const tarjetas = [
    { clave: 'i', titulo: pt ? 'Saldo Inicial' : 'Saldo Inicial', valor: p.saldoInicial, sabio: 'sabio-alcancia', color: '#1d4ed8', fondo: '#eff6ff' },
    { clave: 'e', titulo: pt ? 'Entradas' : 'Entradas', valor: p.entradas, sabio: 'sabio-tendencia', color: '#16a34a', fondo: '#ecfdf3' },
    { clave: 's', titulo: pt ? 'Saídas' : 'Salidas', valor: p.salidas, sabio: 'sabio-alerta', color: '#dc2626', fondo: '#fef2f2' },
    { clave: 'f', titulo: pt ? 'Saldo Final' : 'Saldo Final', valor: p.saldoFinal, sabio: 'sabio-reserva', color: '#15803d', fondo: '#f0fdf4' },
  ];

  return (
    <div>
      <EstiloImpresion />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 280px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <img className="dre-sabio-tarjeta" src="/sabio/sabio-flujo.webp" alt="" style={{ height: 92, width: 'auto', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: COL.gris }}>{pt ? 'RELATÓRIO FINANCEIRO' : 'INFORME FINANCIERO'}</div>
            <h2 style={{ margin: 0, fontSize: 28, color: COL.azul }}>{pt ? 'Fluxo de Caixa' : 'Flujo de Caja'}</h2>
            <p style={{ margin: '4px 0 0', color: COL.gris, fontSize: 14 }}>
              {p.esFamiliar
                ? pt ? 'Veja de onde vem o dinheiro da sua família, para onde vai e quanto sobra.' : 'Mirá de dónde viene la plata de tu familia, a dónde va y cuánto queda.'
                : pt ? 'Movimentação de entradas e saídas de dinheiro do seu negócio.' : 'Movimiento de entradas y salidas de dinero de tu negocio.'}
            </p>
          </div>
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
          <div style={{ background: 'linear-gradient(90deg, #edf6f0, #f7faf8)', borderRadius: 12, padding: '6px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COL.gris }}>{pt ? 'CAIXA DISPONÍVEL HOJE' : 'CAJA DISPONIBLE HOY'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: COL.azul }}>{dinero(p.cajaHoy)}</div>
          </div>
          <BotonExportarPdf pt={pt} />
        </div>
      </div>

      <ZonaInforme titulo={pt ? 'Resumo do período' : 'Resumen del período'} subtitulo={p.etiquetaPeriodo} tono="azul">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
          {tarjetas.map((c) => (
            <div key={c.clave} style={{ background: `linear-gradient(135deg, ${c.fondo}, #fff)`, border: `1px solid ${c.color}33`, borderRadius: 18, padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 8, minHeight: 120, overflow: 'hidden' }}>
              <img className="dre-sabio-tarjeta" src={`/sabio/${c.sabio}.webp`} alt="" style={{ height: 88, width: 'auto', flexShrink: 0, objectFit: 'contain' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: c.color, fontSize: 15 }}>{c.titulo}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: c.valor < 0 ? '#dc2626' : COL.azul, whiteSpace: 'nowrap' }}>{dinero(c.valor)}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 12, marginBottom: 14 }}>
          <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
            <Tarjeta titulo={`📊 ${pt ? 'Evolução do Fluxo de Caixa' : 'Evolución del Flujo de Caja'}`} sub={pt ? '(clique em um mês para vê-lo)' : '(tocá un mes para verlo)'}>
              <GraficoInteractivo
                puntos={p.serie.map((x) => ({ clave: x.clave, etiqueta: p.etiquetaMes(x.clave), etiquetaLarga: p.etiquetaMesLarga(x.clave) }))}
                series={[
                  { clave: 'ent', nombre: pt ? 'Entradas' : 'Entradas', color: '#22c55e', tipo: 'barra', valores: p.serie.map((x) => x.entradas) },
                  { clave: 'sal', nombre: pt ? 'Saídas' : 'Salidas', color: '#ef4444', tipo: 'barra', valores: p.serie.map((x) => x.salidas) },
                  { clave: 'sdo', nombre: pt ? 'Saldo acumulado' : 'Saldo acumulado', color: '#2563eb', tipo: 'linea', area: true, valores: p.serie.map((x) => x.saldo) },
                ]}
                simbolo={p.simbolo}
                seleccionado={p.periodo}
                onSeleccionar={p.onPeriodo}
                pt={pt}
              />
            </Tarjeta>
          </div>

          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <Tarjeta titulo={`✅ ${pt ? 'Resumo do Período' : 'Resumen del Período'}`}>
              <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
                {p.filasResumen.map((f) => (
                  <div key={f.etiqueta} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: f.destacada ? '8px 10px' : 0, borderRadius: 10, background: f.destacada ? '#dcfce7' : 'transparent', fontWeight: f.destacada ? 800 : 500 }}>
                    <span>{f.signo ? `(${f.signo}) ` : ''}{f.etiqueta}</span>
                    <span style={{ color: f.signo === '+' ? '#15803d' : f.signo === '-' ? '#dc2626' : COL.azul, whiteSpace: 'nowrap' }}>{dinero(f.valor)}</span>
                  </div>
                ))}
              </div>
            </Tarjeta>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 18, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <img className="dre-sabio-tarjeta" src={`/sabio/${p.neto >= 0 ? 'sabio-barras-doradas' : 'sabio-meta'}.webp`} alt="" style={{ height: 64, width: 'auto', objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: 12, color: COL.gris }}>{pt ? 'Variação do caixa' : 'Variación de la caja'}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: variacion === null ? COL.gris : variacion >= 0 ? '#16a34a' : '#dc2626' }}>
                  {variacion === null ? '—' : `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1).replace('.', ',')}% ${variacion >= 0 ? '↗' : '↘'}`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: COL.gris }}>{pt ? 'Fluxo líquido' : 'Flujo neto'}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: p.neto >= 0 ? '#16a34a' : '#dc2626' }}>{dinero(p.neto)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <TopCuentas titulo={`⬇️ ${pt ? 'Entradas' : 'Entradas'} (${dinero(p.entradas)})`} filas={p.filasEntradas} color="#22c55e" dinero={dinero} pt={pt} verTodas={pt ? 'Ver todas as entradas' : 'Ver todas las entradas'} />
            <div style={{ marginTop: 6, fontSize: 12.5, color: '#15803d', fontWeight: 700 }}>{pesoDelMovimiento(p.entradas, p.salidas).toFixed(1).replace('.', ',')}% {pt ? 'do movimento' : 'del movimiento'}</div>
          </div>
          <div>
            <TopCuentas titulo={`⬆️ ${pt ? 'Saídas' : 'Salidas'} (${dinero(p.salidas)})`} filas={p.filasSalidas} color="#ef4444" dinero={dinero} pt={pt} verTodas={pt ? 'Ver todas as saídas' : 'Ver todas las salidas'} />
            <div style={{ marginTop: 6, fontSize: 12.5, color: '#b91c1c', fontWeight: 700 }}>{pesoDelMovimiento(p.salidas, p.entradas).toFixed(1).replace('.', ',')}% {pt ? 'do movimento' : 'del movimiento'}</div>
          </div>
        </div>

        {p.extras}
      </ZonaInforme>
    </div>
  );
}
