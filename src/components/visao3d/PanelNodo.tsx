'use client';

// Panel de información de Visão 3D: el nodo elegido (o el que se está recorriendo), sus cifras y, a la vez,
// la navegación alternativa por lista (accesible, sin 3D) hacia los niveles de abajo.

import Link from 'next/link';
import { formatearNumeroEntero } from '@/lib/moneda';
import type { MovimientoCuenta, NodoEdificio } from '@/lib/visao3d';
import { COLOR_GRUPO } from '@/lib/visao3dLayout';

type Props = {
  nodo: NodoEdificio;
  hijos: NodoEdificio[];
  ocultosEnCero: number;
  movimientos: MovimientoCuenta[];
  esPT: boolean;
  simbolo: string;
  puedeVolver: boolean;
  hayPeriodoAnterior: boolean;
  onEntrar: (nodo: NodoEdificio) => void;
  onSeleccionar: (nodo: NodoEdificio) => void;
  onVolver: () => void;
  onEmpresa: () => void;
  // Dentro de la hoja inferior de pantalla completa: sin marco propio ni título/saldo repetidos arriba.
  incrustado?: boolean;
};

const texto = { fontSize: 12.5, color: '#cbd5e1' } as const;

export function PanelNodo({ nodo, hijos, ocultosEnCero, movimientos, esPT, simbolo, puedeVolver, hayPeriodoAnterior, onEntrar, onSeleccionar, onVolver, onEmpresa, incrustado = false }: Props) {
  const local = esPT ? 'pt-BR' : 'es-AR';
  const dinero = (n: number) => `${n < 0 ? '−' : ''}${simbolo} ${formatearNumeroEntero(Math.abs(n))}`;
  const color = COLOR_GRUPO[nodo.grupo];
  const puedeEntrar = nodo.hijos.length > 0;

  return (
    <aside
      aria-label={esPT ? 'Informações do item selecionado' : 'Información del elemento seleccionado'}
      style={incrustado ? { color: '#fff' } : { background: 'rgba(11,20,36,0.94)', color: '#fff', borderRadius: 18, padding: 16, border: `1px solid ${color}55`, maxHeight: '100%', overflowY: 'auto' }}
    >
      {!incrustado ? (
        <>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color }}>{nodo.codigo ? `${esPT ? 'CÓDIGO' : 'CÓDIGO'} ${nodo.codigo}` : nodo.sintetico ? (esPT ? 'LINHA CALCULADA' : 'LÍNEA CALCULADA') : esPT ? 'GRUPO' : 'GRUPO'}</div>
      <h2 style={{ margin: '2px 0 8px', fontSize: 19 }}>{nodo.nombre}</h2>

      <div style={{ fontSize: 26, fontWeight: 900, color: nodo.saldo < 0 ? '#fca5a5' : '#fff' }}>{dinero(nodo.saldo)}</div>
      {nodo.saldo < 0 && <div style={{ ...texto, color: '#fca5a5' }}>{esPT ? 'Saldo negativo (reduz o grupo)' : 'Saldo negativo (resta del grupo)'}</div>}

        </>
      ) : (
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color }}>{nodo.codigo ? `CÓDIGO ${nodo.codigo}` : nodo.sintetico ? (esPT ? 'LINHA CALCULADA' : 'LÍNEA CALCULADA') : esPT ? 'GRUPO' : 'GRUPO'}</div>
      )}

      <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>
        {hayPeriodoAnterior && (
          <div style={texto}>
            {esPT ? 'Mês anterior' : 'Mes anterior'}: <b>{nodo.saldoAnterior === null ? '—' : dinero(nodo.saldoAnterior)}</b>
            {nodo.variacion !== null && (
              <span style={{ marginLeft: 8, fontWeight: 700, color: nodo.variacion >= 0 ? '#86efac' : '#fca5a5' }}>
                {nodo.variacion >= 0 ? '↑' : '↓'} {dinero(Math.abs(nodo.variacion))}
                {nodo.variacionPct !== null && ` (${Math.abs(nodo.variacionPct).toLocaleString(local)}%)`}
              </span>
            )}
          </div>
        )}
        {nodo.participacion !== null && (
          <div style={texto}>
            {esPT ? 'Participação no total' : 'Participación en el total'}: <b>{nodo.participacion.toLocaleString(local)}%</b>
          </div>
        )}
        {!nodo.esHoja && (
          <div style={texto}>
            {esPT ? 'Contas dependentes' : 'Cuentas dependientes'}: <b>{nodo.cuentasDependientes}</b>
          </div>
        )}
      </div>

      {!incrustado && (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
        {puedeEntrar && (
          <button type="button" onClick={() => onEntrar(nodo)} style={{ border: 'none', background: color, color: '#fff', borderRadius: 999, padding: '8px 16px', fontWeight: 800, cursor: 'pointer' }}>
            {esPT ? 'Entrar' : 'Entrar'} →
          </button>
        )}
        {puedeVolver && (
          <button type="button" onClick={onVolver} style={{ border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', borderRadius: 999, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>
            ← {esPT ? 'Voltar' : 'Volver'}
          </button>
        )}
        <button type="button" onClick={onEmpresa} style={{ border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', borderRadius: 999, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>
          🏢 {esPT ? 'Empresa completa' : 'Empresa completa'}
        </button>
      </div>
      )}

      {nodo.cuentaNombre && (
        <Link href={`/informes?pestana=mayor&cuenta=${encodeURIComponent(nodo.cuentaNombre)}`} style={{ color: '#7dd3fc', fontSize: 12.5, fontWeight: 700 }}>
          📒 {esPT ? 'Abrir no Razão' : 'Abrir en el Mayor'}
        </Link>
      )}

      {hijos.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: '#94a3b8', marginBottom: 6 }}>{esPT ? 'CONTÉM' : 'CONTIENE'}</div>
          {hijos.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onSeleccionar(h)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', borderRadius: 10, padding: '7px 10px', marginBottom: 4, cursor: 'pointer', fontSize: 13 }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {h.hijos.length > 0 ? '▸ ' : ''}
                {h.nombre}
              </span>
              <b style={{ whiteSpace: 'nowrap', color: h.saldo < 0 ? '#fca5a5' : '#fff' }}>{dinero(h.saldo)}</b>
            </button>
          ))}
          {ocultosEnCero > 0 && <div style={{ ...texto, marginTop: 4 }}>{ocultosEnCero} {esPT ? 'contas em zero ocultas' : 'cuentas en cero ocultas'}</div>}
        </div>
      )}

      {nodo.esHoja && !nodo.sintetico && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: '#94a3b8', marginBottom: 6 }}>{esPT ? 'ÚLTIMOS MOVIMENTOS' : 'ÚLTIMOS MOVIMIENTOS'}</div>
          {movimientos.length === 0 ? (
            <div style={texto}>{esPT ? 'Sem movimentos no período.' : 'Sin movimientos en el período.'}</div>
          ) : (
            movimientos.map((m, i) => (
              <div key={`${m.id_operacion}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#cbd5e1', minWidth: 0 }}>
                  <span style={{ color: '#94a3b8' }}>{new Date(`${m.fecha}T12:00:00`).toLocaleDateString(local, { day: '2-digit', month: '2-digit' })}</span> {m.id_operacion} · {m.descripcion}
                </span>
                <b style={{ whiteSpace: 'nowrap', color: m.esDebe ? '#93c5fd' : '#fdba74' }}>
                  {m.esDebe ? 'D ' : esPT ? 'C ' : 'H '}
                  {dinero(m.importe)}
                </b>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
