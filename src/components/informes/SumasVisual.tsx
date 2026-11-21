'use client';

import { useMemo, useState } from 'react';
import { formatearNumeroEntero } from '@/lib/moneda';
import { nombreCuentaDisplay } from '@/lib/i18n';
import { arbolMayor, sinCeros, type AsientoArbol, type CuentaArbol, type NodoMayor } from '@/lib/informes/mayorArbol';
import { totalesBalance } from '@/lib/informes/balance';
import { aCsv, variacion } from '@/lib/informes/sumas';
import { EstiloImpresion } from './DreVisual';

// Sumas y Saldos (Balancete): saldos contables por cuenta y grupo con la movimiento del período, comparados contra otro período.
// Dos lecturas: «Movimiento» (saldo inicial, debe, haber, saldo final) y «Saldos» (solo cómo cambió cada saldo).

const COL = { azul: 'var(--color-primario, #1f3a5f)', gris: '#6b7280' };
const RESULTADO = ['INGRESO', 'COSTO', 'GASTO'];

export type CuentaSumas = CuentaArbol;
export type AsientoSumas = AsientoArbol;

function anterior(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function SumasVisual({
  cuentas,
  hojas,
  asientos,
  periodos,
  periodoInicial,
  simbolo,
  idioma,
}: {
  cuentas: CuentaSumas[];
  hojas: CuentaSumas[];
  asientos: AsientoSumas[];
  periodos: { valor: string; etiqueta: string }[];
  periodoInicial: string;
  simbolo: string;
  idioma: string | null;
}) {
  const pt = idioma === 'PT';
  const dinero = (n: number) => `${simbolo} ${formatearNumeroEntero(n)}`;
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [comparar, setComparar] = useState('AUTO');
  const [modo, setModo] = useState<'MOV' | 'SALDOS'>('MOV');
  const [vista, setVista] = useState<'GRUPO' | 'CUENTA'>('GRUPO');
  const [mostrarCeros, setMostrarCeros] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const esTodos = periodo === 'TODOS';
  const claveComparacion = esTodos || comparar === 'NINGUNO' ? null : comparar === 'AUTO' ? anterior(periodo) : comparar;

  const A = useMemo(() => arbolMayor(cuentas, asientos, periodo, true), [cuentas, asientos, periodo]);
  const B = useMemo(() => (claveComparacion ? arbolMayor(cuentas, asientos, claveComparacion, true) : null), [cuentas, asientos, claveComparacion]);

  const saldoB = useMemo(() => {
    const m = new Map<string, number>();
    const rec = (nodos: NodoMayor[]) => nodos.forEach((n) => { m.set(n.cuenta.id, n.saldoFinal); rec(n.hijos); });
    if (B) rec(B.raices);
    return m;
  }, [B]);
  const resultadoDe = (raices: NodoMayor[]) =>
    raices.reduce((s, r) => s + (r.cuenta.tipo_saldo === 'INGRESO' ? r.saldoFinal : RESULTADO.includes(r.cuenta.tipo_saldo ?? '') ? -r.saldoFinal : 0), 0);

  // Tarjetas: balance al cierre del período (y del de comparación) + resultado del período.
  const kpis = useMemo(() => {
    const hasta = (clave: string) => (clave === 'TODOS' ? asientos : asientos.filter((a) => a.fecha.slice(0, 7) <= clave));
    const a = totalesBalance(hojas, hasta(periodo));
    const b = claveComparacion ? totalesBalance(hojas, hasta(claveComparacion)) : null;
    const resA = resultadoDe(A.raices);
    const resB = B ? resultadoDe(B.raices) : null;
    return [
      { clave: 'a', titulo: pt ? 'Ativo' : 'Activo', valor: a.activo, v: b ? variacion(a.activo, b.activo) : null, sabio: 'sabio-hoodie-lupa', subeEsBueno: true },
      { clave: 'p', titulo: pt ? 'Passivo' : 'Pasivo', valor: a.pasivo, v: b ? variacion(a.pasivo, b.pasivo) : null, sabio: 'sabio-hoodie-libro', subeEsBueno: false },
      { clave: 'pl', titulo: pt ? 'Patrimônio Líquido' : 'Patrimonio Neto', valor: a.patrimonio, v: b ? variacion(a.patrimonio, b.patrimonio) : null, sabio: 'sabio-hoodie-graduado', subeEsBueno: true },
      { clave: 'r', titulo: pt ? 'Resultado' : 'Resultado', valor: resA, v: resB !== null ? variacion(resA, resB) : null, sabio: resA >= 0 ? 'sabio-hoodie-medalla' : 'sabio-hoodie-alcancia', subeEsBueno: true },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hojas, asientos, periodo, claveComparacion, A, B, pt]);

  const arbol = useMemo(() => (mostrarCeros ? A.raices : sinCeros(A.raices)), [A, mostrarCeros]);
  const analitico = vista === 'CUENTA';

  const colorRaiz = (tipo: string | null) => (tipo === 'ACTIVO' ? '#e3f6e8' : tipo === 'INGRESO' ? '#e7f5ec' : tipo === 'COSTO' || tipo === 'GASTO' ? '#fdecec' : '#e0ecfb');
  const todosLosIds = (nodos: NodoMayor[]): string[] => nodos.flatMap((n) => (n.esHoja ? [] : [n.cuenta.id, ...todosLosIds(n.hijos)]));
  const alternar = (id: string) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const flecha = (v: ReturnType<typeof variacion> | null, subeEsBueno: boolean) => {
    if (!v) return <span style={{ color: COL.gris }}>—</span>;
    if (Math.abs(v.monto) < 0.5) return <span style={{ color: COL.gris }}>—</span>;
    const sube = v.monto > 0;
    const bueno = sube === subeEsBueno;
    return <span style={{ color: bueno ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{sube ? '▲' : '▼'} {sube ? '+' : '−'}{formatearNumeroEntero(Math.abs(v.monto))}</span>;
  };

  const filas: React.ReactNode[] = [];
  const dibujar = (n: NodoMayor, tipoRaiz: string | null) => {
    if (n.esHoja && !analitico) return;
    const abierto = abiertos.has(n.cuenta.id);
    const esRaiz = n.nivel === 1;
    const esSalida = tipoRaiz === 'COSTO' || tipoRaiz === 'GASTO';
    const v = B ? variacion(n.saldoFinal, saldoB.get(n.cuenta.id) ?? 0) : null;
    const subeEsBueno = !(tipoRaiz === 'PASIVO' || esSalida);
    const num: React.CSSProperties = { padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: n.esHoja ? 500 : 700 };
    filas.push(
      <tr key={n.cuenta.id} onClick={() => !n.esHoja && alternar(n.cuenta.id)} style={{ background: esRaiz ? colorRaiz(tipoRaiz) : n.esHoja ? '#fff' : '#f8fafc', cursor: n.esHoja ? 'default' : 'pointer', borderTop: '1px solid #eef0f2' }}>
        <td style={{ padding: '9px 10px', paddingLeft: 10 + (n.nivel - 1) * 18, whiteSpace: 'nowrap', fontWeight: n.esHoja ? 500 : 800, color: COL.azul }}>
          <span style={{ display: 'inline-block', width: 18, color: COL.gris }}>{n.esHoja ? '' : abierto ? '⌄' : '›'}</span>
          {!n.esHoja && <span style={{ marginRight: 6 }}>📁</span>}
          {n.cuenta.codigo}
        </td>
        <td style={{ padding: '9px 10px', fontWeight: n.esHoja ? 500 : 800, color: n.esHoja ? '#1f2937' : COL.azul }}>{nombreCuentaDisplay(idioma, n.cuenta.nombre)}</td>
        <td style={num}>{dinero(n.saldoInicial)}</td>
        {modo === 'MOV' && <td style={num}>{dinero(n.debe)}</td>}
        {modo === 'MOV' && <td style={num}>{dinero(n.haber)}</td>}
        <td style={{ ...num, fontWeight: 800 }}>
          <span style={{ color: n.saldoFinal < 0 || esSalida ? '#b91c1c' : COL.azul, background: esRaiz ? (n.saldoFinal < 0 || esSalida ? '#fee2e2' : '#bbf7d0') : 'transparent', borderRadius: 999, padding: esRaiz ? '3px 12px' : 0 }}>{dinero(n.saldoFinal)}</span>
        </td>
        <td style={num}>{flecha(v, subeEsBueno)}</td>
        <td style={{ ...num, color: COL.gris }}>{v && v.pct !== null ? `${v.pct >= 0 ? '+' : ''}${v.pct.toFixed(1).replace('.', ',')}%` : '—'}</td>
      </tr>
    );
    if (!n.esHoja && abierto) n.hijos.forEach((h) => dibujar(h, tipoRaiz));
  };
  arbol.forEach((r) => dibujar(r, r.cuenta.tipo_saldo));

  // Total de las cuentas de resultado del período.
  const raicesResultado = A.raices.filter((r) => RESULTADO.includes(r.cuenta.tipo_saldo ?? ''));
  const totalDebeRes = raicesResultado.reduce((s, r) => s + r.debe, 0);
  const totalHaberRes = raicesResultado.reduce((s, r) => s + r.haber, 0);
  const resultado = resultadoDe(A.raices);
  const varResultado = B ? variacion(resultado, resultadoDe(B.raices)) : null;
  const cuadra = Math.abs(A.totalDebe - A.totalHaber) < 0.01;

  const exportar = () => {
    const filasCsv: (string | number)[][] = [[pt ? 'Código' : 'Código', pt ? 'Conta' : 'Cuenta', pt ? 'Saldo Inicial' : 'Saldo Inicial', pt ? 'Débito' : 'Debe', pt ? 'Crédito' : 'Haber', pt ? 'Saldo Final' : 'Saldo Final', pt ? 'Variação' : 'Variación', '%']];
    const rec = (n: NodoMayor) => {
      if (n.esHoja && !analitico) return;
      const v = B ? variacion(n.saldoFinal, saldoB.get(n.cuenta.id) ?? 0) : null;
      filasCsv.push([n.cuenta.codigo, `${'  '.repeat(n.nivel - 1)}${n.cuenta.nombre}`, n.saldoInicial, n.debe, n.haber, n.saldoFinal, v ? v.monto : '', v && v.pct !== null ? Math.round(v.pct * 10) / 10 : '']);
      n.hijos.forEach(rec);
    };
    arbol.forEach(rec);
    filasCsv.push([]);
    filasCsv.push(['', pt ? 'Total (Contas de Resultado)' : 'Total (Cuentas de Resultado)', 0, Math.round(totalDebeRes * 100) / 100, Math.round(totalHaberRes * 100) / 100, resultado, varResultado ? varResultado.monto : '', '']);
    const blob = new Blob([aCsv(filasCsv)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pt ? 'balancete' : 'sumas-y-saldos'}-${periodo === 'TODOS' ? 'historico' : periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const campo: React.CSSProperties = { padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, color: COL.azul, background: '#fff', minWidth: 150 };
  const etiqueta: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: COL.gris, marginBottom: 3 };
  const th: React.CSSProperties = { padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' };

  return (
    <div>
      <EstiloImpresion />

      {/* Cabecera oscura con Sabio y las cuatro tarjetas */}
      <div style={{ background: 'linear-gradient(135deg, #12304f, #0f5a63)', borderRadius: 22, padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 260px' }}>
          <img className="dre-sabio-tarjeta" src="/sabio/sabio-hoodie-tablet.webp" alt="" style={{ height: 92, width: 'auto', objectFit: 'contain' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 30 }}>{pt ? 'Balancete' : 'Sumas y Saldos'}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: '#cfe3f5', lineHeight: 1.4 }}>{pt ? 'Saldos contábeis por conta e grupo, com a movimentação do período.' : 'Saldos contables por cuenta y grupo, con el movimiento del período.'}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, flex: '3 1 560px' }}>
          {kpis.map((k) => {
            const bueno = k.v ? (k.v.monto > 0) === k.subeEsBueno : true;
            return (
              <div key={k.clave} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 16, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <img className="dre-sabio-tarjeta" src={`/sabio/${k.sabio}.webp`} alt="" style={{ height: 52, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5 }}>{k.titulo}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, whiteSpace: 'nowrap' }}>{dinero(k.valor)}</div>
                  {k.v && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: Math.abs(k.v.monto) < 0.5 ? '#cbd5e1' : bueno ? '#86efac' : '#fca5a5' }}>
                      {Math.abs(k.v.monto) < 0.5 ? '—' : k.v.monto > 0 ? '▲' : '▼'} {k.v.pct === null ? '' : `${k.v.pct >= 0 ? '+' : ''}${k.v.pct.toFixed(1).replace('.', ',')}%`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="dre-no-imprimir" style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 18, padding: '12px 16px', marginBottom: 14 }}>
        <div>
          <div style={etiqueta}>{pt ? 'Período' : 'Período'}</div>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={campo}>
            <option value="TODOS">{pt ? 'Todos os períodos' : 'Todos los períodos'}</option>
            {periodos.map((p) => (
              <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={etiqueta}>{pt ? 'Comparar com' : 'Comparar con'}</div>
          <select value={comparar} onChange={(e) => setComparar(e.target.value)} disabled={esTodos} style={{ ...campo, opacity: esTodos ? 0.5 : 1 }}>
            <option value="AUTO">{pt ? 'Mês anterior' : 'Mes anterior'}</option>
            <option value="NINGUNO">{pt ? 'Sem comparação' : 'Sin comparar'}</option>
            {periodos.filter((p) => p.valor !== periodo).map((p) => (
              <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={etiqueta}>{pt ? 'Visualização' : 'Visualización'}</div>
          <select value={vista} onChange={(e) => setVista(e.target.value as 'GRUPO' | 'CUENTA')} style={campo}>
            <option value="GRUPO">{pt ? 'Por grupo (sintético)' : 'Por grupo (sintético)'}</option>
            <option value="CUENTA">{pt ? 'Por conta (analítico)' : 'Por cuenta (analítico)'}</option>
          </select>
        </div>
        <div role="group" style={{ display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: 999, overflow: 'hidden', background: '#fff' }}>
          {([['MOV', pt ? '⇄ Movimentação' : '⇄ Movimiento'], ['SALDOS', pt ? '≣ Saldos' : '≣ Saldos']] as const).map(([v, et]) => (
            <button key={v} type="button" onClick={() => setModo(v)} aria-pressed={modo === v} style={{ padding: '9px 16px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: modo === v ? '#16a34a' : 'transparent', color: modo === v ? '#fff' : COL.azul }}>
              {et}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: COL.azul, fontWeight: 600, paddingBottom: 8 }}>
          <input type="checkbox" checked={mostrarCeros} onChange={(e) => setMostrarCeros(e.target.checked)} />
          {pt ? 'Mostrar contas zeradas' : 'Mostrar cuentas en cero'}
        </label>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setAbiertos(new Set(todosLosIds(arbol)))} style={botonSuave}>{pt ? 'Expandir tudo' : 'Expandir todo'}</button>
          <button type="button" onClick={() => setAbiertos(new Set())} style={botonSuave}>{pt ? 'Recolher' : 'Contraer'}</button>
          <button type="button" onClick={exportar} style={botonSuave}>📗 {pt ? 'Excel' : 'Excel'}</button>
          <button type="button" onClick={() => window.print()} style={botonSuave}>🖨 {pt ? 'Imprimir' : 'Imprimir'}</button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, overflow: 'hidden', background: '#fff' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: modo === 'MOV' ? 860 : 620, fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: COL.azul }}>
                <th style={{ ...th, textAlign: 'left' }}>{pt ? 'Código' : 'Código'}</th>
                <th style={{ ...th, textAlign: 'left' }}>{pt ? 'Conta / Grupo' : 'Cuenta / Grupo'}</th>
                <th style={th}>{pt ? 'Saldo Inicial' : 'Saldo Inicial'}</th>
                {modo === 'MOV' && <th style={th}>{pt ? 'Débito' : 'Debe'}</th>}
                {modo === 'MOV' && <th style={th}>{pt ? 'Crédito' : 'Haber'}</th>}
                <th style={th}>{pt ? 'Saldo Final' : 'Saldo Final'}</th>
                <th style={th}>{pt ? 'Variação' : 'Variación'}</th>
                <th style={th}>%</th>
              </tr>
            </thead>
            <tbody>
              {filas}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 22, textAlign: 'center', color: COL.gris }}>
                    <img className="dre-sabio-tarjeta" src="/sabio/sabio-hoodie-alcancia.webp" alt="" style={{ height: 70, width: 'auto', display: 'block', margin: '0 auto 6px' }} />
                    {pt ? 'Ainda não há saldos neste período.' : 'Todavía no hay saldos en este período.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total de cuentas de resultado */}
      <div style={{ marginTop: 12, background: COL.azul, color: '#fff', borderRadius: 16, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <img className="dre-sabio-tarjeta" src={`/sabio/${cuadra ? 'sabio-hoodie-checklist' : 'sabio-alerta'}.webp`} alt="" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
          <strong style={{ fontSize: 16 }}>{pt ? 'Total (Contas de Resultado)' : 'Total (Cuentas de Resultado)'}</strong>
        </span>
        {modo === 'MOV' && <span>{pt ? 'Débito' : 'Debe'} <strong>{dinero(totalDebeRes)}</strong></span>}
        {modo === 'MOV' && <span>{pt ? 'Crédito' : 'Haber'} <strong>{dinero(totalHaberRes)}</strong></span>}
        <span style={{ background: resultado < 0 ? '#dc2626' : '#16a34a', borderRadius: 999, padding: '5px 16px', fontWeight: 800 }}>{dinero(resultado)}</span>
        {varResultado && varResultado.pct !== null && <span style={{ fontWeight: 700 }}>{varResultado.monto >= 0 ? '▲' : '▼'} {varResultado.pct >= 0 ? '+' : ''}{varResultado.pct.toFixed(1).replace('.', ',')}%</span>}
        <span style={{ background: cuadra ? 'rgba(22,163,74,0.9)' : '#dc2626', borderRadius: 999, padding: '4px 12px', fontWeight: 800, fontSize: 12.5 }}>
          {cuadra ? (pt ? '✓ Débito = Crédito (todas as contas)' : '✓ Debe = Haber (todas las cuentas)') : pt ? '⚠ Não fecha' : '⚠ No cierra'}
        </span>
      </div>
    </div>
  );
}

const botonSuave: React.CSSProperties = { border: '1px solid #d1d5db', background: '#fff', color: '#1f3a5f', borderRadius: 12, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
