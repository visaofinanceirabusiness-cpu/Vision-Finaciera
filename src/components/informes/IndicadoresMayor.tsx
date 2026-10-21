'use client';

// 3 indicadores de la cuenta y el mes elegidos en el Mayor (ver lib/mayorCuenta.ts).
// Tocar una contrapartida filtra la tabla a los movimientos contra esa cuenta.

import { formatearNumeroEntero } from '@/lib/moneda';
import type { MayorDelMes } from '@/lib/mayorCuenta';

const COLORES = { azul: 'var(--color-primario, #1f3a5f)', verde: 'var(--color-secundario, #2e8b57)', gris: 'var(--color-acento, #6e7781)' };

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: COLORES.gris, marginBottom: 8 }}>{titulo}</div>
      {children}
    </section>
  );
}

const texto: React.CSSProperties = { fontSize: 12.5, color: '#374151' };

export function IndicadoresMayor({
  mayor,
  esTodos,
  idioma,
  simbolo,
  contrapartidaActiva,
  onContrapartida,
}: {
  mayor: MayorDelMes;
  esTodos: boolean;
  idioma: string | null;
  simbolo: string;
  contrapartidaActiva: string | null;
  onContrapartida: (cuenta: string | null) => void;
}) {
  const esPT = idioma === 'PT';
  const { indicadores: ind } = mayor;
  const dinero = (n: number) => `${simbolo} ${formatearNumeroEntero(n)}`;
  const firmado = (n: number) => `${n >= 0 ? '+' : '−'}${dinero(Math.abs(n))}`;
  const local = esPT ? 'pt-BR' : 'es-AR';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 18 }}>
      <Tarjeta titulo={esTodos ? (esPT ? '1 · SALDO DO PERÍODO' : '1 · SALDO DEL PERÍODO') : esPT ? '1 · SALDO DO MÊS' : '1 · SALDO DEL MES'}>
        <div style={{ fontSize: 20, fontWeight: 900, color: COLORES.azul }}>
          {dinero(mayor.saldoAnterior)} → {dinero(mayor.saldoFinal)}
        </div>
        <div style={{ ...texto, fontWeight: 700, color: ind.variacionSaldo >= 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>
          {ind.variacionSaldo >= 0 ? '↑' : '↓'} {firmado(ind.variacionSaldo)}
        </div>
        <div style={{ ...texto, color: COLORES.gris }}>{esTodos ? (esPT ? 'Do saldo inicial ao atual' : 'Del saldo inicial al actual') : esPT ? 'Do saldo anterior ao fechamento' : 'Del saldo anterior al cierre'}</div>
      </Tarjeta>

      <Tarjeta titulo={esPT ? '2 · DÉBITO VS CRÉDITO' : '2 · DEBE VS HABER'}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: COLORES.gris }}>{esPT ? 'Débito' : 'Debe'}</div>
            <b style={{ color: COLORES.azul }}>{dinero(ind.debe)}</b>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORES.gris }}>{esPT ? 'Crédito' : 'Haber'}</div>
            <b style={{ color: COLORES.azul }}>{dinero(ind.haber)}</b>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORES.gris }}>{esPT ? 'Líquido' : 'Neto'}</div>
            <b style={{ color: ind.neto >= 0 ? '#16a34a' : '#dc2626' }}>{firmado(ind.neto)}</b>
          </div>
        </div>
        <div style={{ ...texto, marginTop: 6 }}>
          {ind.movimientos} {esPT ? 'movimentos' : 'movimientos'}
          {ind.variacionVolumen !== null && (
            <b style={{ marginLeft: 8, color: ind.variacionVolumen >= 0 ? '#16a34a' : '#dc2626' }}>
              {ind.variacionVolumen >= 0 ? '↑' : '↓'} {Math.abs(ind.variacionVolumen).toLocaleString(local)}% {esPT ? 'vs. mês anterior' : 'vs. mes anterior'}
            </b>
          )}
        </div>
      </Tarjeta>

      <Tarjeta titulo={esPT ? '3 · CONTRAPARTIDAS PRINCIPAIS' : '3 · CONTRAPARTIDAS PRINCIPALES'}>
        {ind.contrapartidas.length === 0 ? (
          <div style={texto}>—</div>
        ) : (
          ind.contrapartidas.map((c) => {
            const activa = contrapartidaActiva === c.cuenta;
            return (
              <button
                key={c.cuenta}
                type="button"
                aria-pressed={activa}
                onClick={() => onContrapartida(activa ? null : c.cuenta)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: activa ? `1.5px solid ${COLORES.verde}` : '1.5px solid transparent',
                  background: activa ? '#edf6f0' : 'transparent',
                  borderRadius: 10,
                  padding: '5px 7px',
                  marginBottom: 3,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...texto }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cuenta}</span>
                  <b style={{ whiteSpace: 'nowrap' }}>{dinero(c.importe)} · {c.porcentaje.toLocaleString(local)}%</b>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: '#eef2f6', marginTop: 2 }}>
                  <div style={{ width: `${Math.min(100, c.porcentaje)}%`, height: '100%', borderRadius: 3, background: COLORES.verde }} />
                </div>
              </button>
            );
          })
        )}
      </Tarjeta>
    </div>
  );
}
