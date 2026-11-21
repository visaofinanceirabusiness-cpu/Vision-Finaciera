'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatearNumeroEntero } from '@/lib/moneda';
import { nombreCuentaDisplay } from '@/lib/i18n';
import { armarMayor } from '@/lib/mayorCuenta';
import { arbolMayor, profundidadMaxima, rutaHastaCuenta, sinCeros, type AsientoArbol, type CuentaArbol, type NodoMayor } from '@/lib/informes/mayorArbol';
import { IndicadoresMayor } from './IndicadoresMayor';
import { BotonExportarPdf, EstiloImpresion } from './DreVisual';

// Libro Mayor desplegable: el plan de cuentas como árbol con saldo inicial, debe, haber y saldo final de cada cuenta en el período.
// Tocar una cuenta con movimientos abre debajo su detalle cronológico con saldo corrido, para analizarla cuenta por cuenta.

const COL = { azul: 'var(--color-primario, #1f3a5f)', gris: '#6b7280' };

export type AsientoMayorVisual = AsientoArbol & { id_operacion: string | null; descripcion: string; operacion: string | null };

export function MayorVisual({
  cuentas,
  asientos,
  periodos,
  cuentaInicial,
  simbolo,
  idioma,
}: {
  cuentas: CuentaArbol[];
  asientos: AsientoMayorVisual[];
  periodos: { valor: string; etiqueta: string }[];
  cuentaInicial: string;
  simbolo: string;
  idioma: string | null;
}) {
  const pt = idioma === 'PT';
  const dinero = (n: number) => `${simbolo} ${formatearNumeroEntero(n)}`;
  const [periodo, setPeriodo] = useState('TODOS');
  const [nivel, setNivel] = useState(0); // 0 = todos los niveles
  const [mostrarCeros, setMostrarCeros] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [detalle, setDetalle] = useState<string | null>(null);
  const [cuentaElegida, setCuentaElegida] = useState('');
  const filaDetalle = useRef<HTMLTableRowElement>(null);

  const { raices, totalDebe, totalHaber } = useMemo(() => arbolMayor(cuentas, asientos, periodo), [cuentas, asientos, periodo]);
  const arbol = useMemo(() => (mostrarCeros ? raices : sinCeros(raices)), [raices, mostrarCeros]);
  const profundidad = useMemo(() => profundidadMaxima(raices), [raices]);

  // Abre el árbol hasta una cuenta (viene del Panel de Control o del selector) y deja su detalle abierto.
  const irACuenta = (nombre: string) => {
    const cuenta = cuentas.find((c) => c.nombre === nombre);
    if (!cuenta) return;
    setAbiertos((prev) => new Set([...prev, ...rutaHastaCuenta(cuentas, nombre)]));
    setDetalle(cuenta.id);
    setMostrarCeros(true);
    setNivel(0);
  };
  useEffect(() => {
    if (cuentaInicial) irACuenta(cuentaInicial);
    // solo al llegar con una cuenta en el enlace
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaInicial, cuentas.length]);
  useEffect(() => {
    if (detalle) filaDetalle.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [detalle]);

  // Por defecto se abre la primera rama (Activo), como en el modelo.
  useEffect(() => {
    if (arbol.length && abiertos.size === 0 && !cuentaInicial) setAbiertos(new Set([arbol[0].cuenta.id]));
    // solo la primera vez que hay datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arbol.length]);

  const alternar = (id: string) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todosLosIds = (nodos: NodoMayor[]): string[] => nodos.flatMap((n) => (n.esHoja ? [] : [n.cuenta.id, ...todosLosIds(n.hijos)]));
  const limpiar = () => { setPeriodo('TODOS'); setNivel(0); setMostrarCeros(false); setDetalle(null); setCuentaElegida(''); setAbiertos(new Set(arbol[0] ? [arbol[0].cuenta.id] : [])); };

  const hojas = useMemo(() => {
    const salida: CuentaArbol[] = [];
    const recorrer = (nodos: NodoMayor[]) => nodos.forEach((n) => (n.esHoja ? salida.push(n.cuenta) : recorrer(n.hijos)));
    recorrer(raices);
    return salida.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  }, [raices]);

  const colorRaiz = (tipo: string | null) => (tipo === 'ACTIVO' ? { fondo: '#e3f6e8', icono: '#16a34a' } : tipo === 'PASIVO' || tipo === 'PATRIMONIO' ? { fondo: '#e0ecfb', icono: '#2563eb' } : tipo === 'INGRESO' ? { fondo: '#e7f5ec', icono: '#16a34a' } : { fondo: '#fdecec', icono: '#dc2626' });

  const filas: React.ReactNode[] = [];
  const dibujar = (n: NodoMayor, tipoRaiz: string | null) => {
    if (nivel > 0 && n.nivel > nivel) return;
    const abierto = abiertos.has(n.cuenta.id) && (nivel === 0 || n.nivel < nivel);
    const esRaiz = n.nivel === 1;
    const c = colorRaiz(tipoRaiz);
    // Costos y gastos son plata que sale: su saldo va en rojo aunque sea positivo.
    const esSalida = tipoRaiz === 'COSTO' || tipoRaiz === 'GASTO';
    const tocable = !n.esHoja || n.debe + n.haber + n.saldoInicial !== 0 || mostrarCeros;
    filas.push(
      <tr
        key={n.cuenta.id}
        onClick={() => (n.esHoja ? (tocable ? setDetalle(detalle === n.cuenta.id ? null : n.cuenta.id) : undefined) : alternar(n.cuenta.id))}
        style={{ background: esRaiz ? c.fondo : n.esHoja ? (detalle === n.cuenta.id ? '#f0fdf4' : '#fff') : '#f8fafc', cursor: 'pointer', borderTop: '1px solid #eef0f2' }}
      >
        <td style={{ padding: '9px 10px', paddingLeft: 10 + (n.nivel - 1) * 18, whiteSpace: 'nowrap', fontWeight: n.esHoja ? 500 : 800, color: COL.azul }}>
          <span style={{ display: 'inline-block', width: 18, color: COL.gris }}>{n.esHoja ? '' : abierto ? '⌄' : '›'}</span>
          {!n.esHoja && <span style={{ marginRight: 6, color: c.icono }}>📁</span>}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n.cuenta.codigo}</span>
        </td>
        <td style={{ padding: '9px 10px', fontWeight: n.esHoja ? 500 : 800, color: n.esHoja ? '#1f2937' : COL.azul }}>{nombreCuentaDisplay(idioma, n.cuenta.nombre)}</td>
        <td style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: n.esHoja ? 500 : 700 }}>{dinero(n.saldoInicial)}</td>
        <td style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: n.esHoja ? 500 : 700 }}>{dinero(n.debe)}</td>
        <td style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: n.esHoja ? 500 : 700 }}>{dinero(n.haber)}</td>
        <td style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 800, color: n.saldoFinal < 0 || esSalida ? '#b91c1c' : COL.azul, background: esRaiz ? (n.saldoFinal < 0 || esSalida ? '#fee2e2' : '#bbf7d0') : 'transparent', borderRadius: 999, padding: esRaiz ? '3px 12px' : 0 }}>{dinero(n.saldoFinal)}</span>
        </td>
      </tr>
    );
    if (n.esHoja && detalle === n.cuenta.id) {
      filas.push(
        <tr key={`${n.cuenta.id}-detalle`} ref={filaDetalle}>
          <td colSpan={6} style={{ padding: '10px 14px 16px', background: '#f8fffb', borderTop: '1px solid #bbf7d0' }}>
            <DetalleCuenta cuenta={n.cuenta} asientos={asientos} periodo={periodo} simbolo={simbolo} idioma={idioma} />
          </td>
        </tr>
      );
    }
    if (!n.esHoja && abierto) n.hijos.forEach((h) => dibujar(h, tipoRaiz));
  };
  arbol.forEach((r) => dibujar(r, r.cuenta.tipo_saldo));

  const cuadra = Math.abs(totalDebe - totalHaber) < 0.01;
  const campo: React.CSSProperties = { padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, color: COL.azul, background: '#fff', minWidth: 150 };
  const etiqueta: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: COL.gris, marginBottom: 3 };

  return (
    <div>
      <EstiloImpresion />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img className="dre-sabio-tarjeta" src="/sabio/sabio-libro.webp" alt="" style={{ height: 78, width: 'auto', objectFit: 'contain' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 30, color: COL.azul }}>{pt ? 'Razão' : 'Mayor'}</h2>
            <p style={{ margin: '2px 0 0', color: COL.gris, fontSize: 14 }}>{pt ? 'Movimento detalhado de cada conta — toque em uma conta para analisá-la.' : 'Movimiento detallado de cada cuenta — tocá una cuenta para analizarla.'}</p>
          </div>
        </div>
        <BotonExportarPdf pt={pt} />
      </div>

      <div className="dre-no-imprimir" style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 18, padding: '12px 16px', marginBottom: 14 }}>
        <div>
          <div style={etiqueta}>{pt ? 'Conta' : 'Cuenta'}</div>
          <select value={cuentaElegida} onChange={(e) => { setCuentaElegida(e.target.value); if (e.target.value) irACuenta(e.target.value); }} style={{ ...campo, minWidth: 220 }}>
            <option value="">{pt ? 'Todas as contas' : 'Todas las cuentas'}</option>
            {hojas.map((h) => (
              <option key={h.id} value={h.nombre}>{h.codigo} · {nombreCuentaDisplay(idioma, h.nombre)}</option>
            ))}
          </select>
        </div>
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
          <div style={etiqueta}>{pt ? 'Nível' : 'Nivel'}</div>
          <select value={nivel} onChange={(e) => setNivel(Number(e.target.value))} style={{ ...campo, minWidth: 120 }}>
            <option value={0}>{pt ? 'Todos' : 'Todos'}</option>
            {Array.from({ length: profundidad }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{pt ? `Até o nível ${n}` : `Hasta el nivel ${n}`}</option>
            ))}
          </select>
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: COL.azul, fontWeight: 600, paddingBottom: 8 }}>
          <input type="checkbox" checked={mostrarCeros} onChange={(e) => setMostrarCeros(e.target.checked)} />
          {pt ? 'Mostrar contas zeradas' : 'Mostrar cuentas en cero'}
        </label>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button type="button" onClick={() => setAbiertos(new Set(todosLosIds(arbol)))} style={botonSuave}>{pt ? 'Expandir tudo' : 'Expandir todo'}</button>
          <button type="button" onClick={() => setAbiertos(new Set())} style={botonSuave}>{pt ? 'Recolher' : 'Contraer'}</button>
          <button type="button" onClick={limpiar} style={botonSuave}>↻ {pt ? 'Limpar' : 'Limpiar'}</button>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, overflow: 'hidden', background: '#fff' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: COL.azul, textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>{pt ? 'Código' : 'Código'}</th>
                <th style={{ padding: '10px' }}>{pt ? 'Conta' : 'Cuenta'}</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>{pt ? 'Saldo Inicial' : 'Saldo Inicial'}</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>{pt ? 'Débito' : 'Debe'}</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>{pt ? 'Crédito' : 'Haber'}</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>{pt ? 'Saldo Final' : 'Saldo Final'}</th>
              </tr>
            </thead>
            <tbody>{filas}</tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, background: COL.azul, color: '#fff', borderRadius: 16, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ fontSize: 17 }}>{pt ? 'Totais' : 'Totales'}</strong>
        <span>{pt ? 'Débito' : 'Debe'} <strong>{dinero(totalDebe)}</strong></span>
        <span>{pt ? 'Crédito' : 'Haber'} <strong>{dinero(totalHaber)}</strong></span>
        <span style={{ background: cuadra ? '#16a34a' : '#dc2626', borderRadius: 999, padding: '4px 14px', fontWeight: 800, fontSize: 13 }}>
          {cuadra ? (pt ? '✓ Débito = Crédito' : '✓ Debe = Haber') : pt ? '⚠ Não fecha' : '⚠ No cierra'}
        </span>
      </div>
    </div>
  );
}

const botonSuave: React.CSSProperties = { border: '1px solid #d1d5db', background: '#fff', color: '#1f3a5f', borderRadius: 12, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' };

function DetalleCuenta({ cuenta, asientos, periodo, simbolo, idioma }: { cuenta: CuentaArbol; asientos: AsientoMayorVisual[]; periodo: string; simbolo: string; idioma: string | null }) {
  const pt = idioma === 'PT';
  const [contrapartida, setContrapartida] = useState<string | null>(null);
  const mayor = useMemo(() => armarMayor({ nombre: cuenta.nombre, naturaleza: cuenta.naturaleza, saldo_inicial: cuenta.saldo_inicial }, asientos, periodo), [cuenta, asientos, periodo]);
  const filas = mayor.filas.filter((f) => !contrapartida || f.contrapartida === contrapartida);
  const dinero = (n: number) => `${simbolo} ${formatearNumeroEntero(n)}`;
  return (
    <div>
      <div style={{ fontWeight: 800, color: COL.azul, marginBottom: 8 }}>📖 {nombreCuentaDisplay(idioma, cuenta.nombre)}</div>
      <IndicadoresMayor mayor={mayor} esTodos={periodo === 'TODOS'} idioma={idioma} simbolo={simbolo} contrapartidaActiva={contrapartida} onContrapartida={setContrapartida} />
      {contrapartida && (
        <button type="button" onClick={() => setContrapartida(null)} style={{ border: 'none', background: '#fef3c7', color: '#78350f', borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', margin: '8px 0' }}>
          🔎 {pt ? 'Contrapartida' : 'Contrapartida'}: {contrapartida} ✕
        </button>
      )}
      <div style={{ overflowX: 'auto', marginTop: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', color: COL.azul, textAlign: 'left' }}>
              <th style={{ padding: '7px 10px' }}>{pt ? 'Data' : 'Fecha'}</th>
              <th style={{ padding: '7px 10px' }}>{pt ? 'Operação' : 'Operación'}</th>
              <th style={{ padding: '7px 10px' }}>{pt ? 'Descrição' : 'Descripción'}</th>
              <th style={{ padding: '7px 10px', textAlign: 'right' }}>{pt ? 'Débito' : 'Debe'}</th>
              <th style={{ padding: '7px 10px', textAlign: 'right' }}>{pt ? 'Crédito' : 'Haber'}</th>
              <th style={{ padding: '7px 10px', textAlign: 'right' }}>{pt ? 'Saldo' : 'Saldo'}</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: '1px solid #eef0f2' }}>
              <td colSpan={5} style={{ padding: '6px 10px', fontStyle: 'italic', color: COL.gris }}>{periodo === 'TODOS' ? (pt ? 'Saldo inicial' : 'Saldo inicial') : pt ? 'Saldo anterior' : 'Saldo anterior'}</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>{dinero(mayor.saldoAnterior)}</td>
            </tr>
            {filas.map((f, i) => (
              <tr key={`${f.id_operacion}-${i}`} style={{ borderTop: '1px solid #eef0f2' }}>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{new Date(`${f.fecha}T12:00:00`).toLocaleDateString(pt ? 'pt-BR' : 'es-AR')}</td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{f.id_operacion || '—'}</td>
                <td style={{ padding: '6px 10px' }}>{f.descripcion || '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{f.esDebe ? dinero(f.importe) : '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{!f.esDebe ? dinero(f.importe) : '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{dinero(f.saldo)}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 14, textAlign: 'center', color: COL.gris }}>{pt ? 'Sem movimentos validados neste período.' : 'Sin movimientos validados en este período.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
