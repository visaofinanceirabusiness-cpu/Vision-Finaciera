'use client';

// PESTAÑA · FLUJO PROYECTADO
//
// De la plata disponible hoy, cuánto queda al cierre de cada mes si se cobra y
// se paga lo ya comprometido. Es solo una vista (ver lib/flujoProyectado.ts):
// no incluye ventas ni gastos que todavía nadie planeó.

import { Fragment, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fechaLocalHoy, formatearPeriodo } from '@/lib/fecha';
import { MESES_FLUJO, type OrigenFlujo } from '@/lib/flujoProyectado';
import { cargarFlujoProyectado, type FlujoCargado } from '@/lib/flujoProyectadoDatos';
import { SimboloContext, IdiomaContext, COLORES } from '@/components/contabilidad/compartido';

const ETIQUETA_ORIGEN: Record<OrigenFlujo, { es: string; pt: string }> = {
  CUOTA: { es: 'Cuota', pt: 'Parcela' },
  COMPROMISO: { es: 'Compromiso', pt: 'Compromisso' },
  RECURRENTE: { es: 'Recurrente', pt: 'Recorrente' },
};

export function FlujoProyectadoTab() {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext) ?? 'ES';
  const esPT = idioma === 'PT';
  const hoy = fechaLocalHoy();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [meses, setMeses] = useState<number>(6);
  const [datos, setDatos] = useState<FlujoCargado | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    async function cargarEmpresa() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', userData.user.id).maybeSingle();
      if (perfil?.empresa_id) setEmpresaId(perfil.empresa_id);
    }

    cargarEmpresa();
  }, []);

  useEffect(() => {
    if (!empresaId) return;

    let vigente = true;
    setDatos(null);
    cargarFlujoProyectado(empresaId, hoy, meses)
      .then((resultado) => {
        if (vigente) {
          setDatos(resultado);
          setError('');
        }
      })
      .catch((e) => {
        console.error('Error cargando el flujo proyectado:', e);
        if (vigente) setError(e instanceof Error ? e.message : 'Error inesperado.');
      });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, meses]);

  const formatear = (valor: number) =>
    `${valor < 0 ? '−' : ''}${simbolo} ${Math.abs(valor).toLocaleString(esPT ? 'pt-BR' : 'es-AR', { maximumFractionDigits: 0 })}`;
  const colorSaldo = (valor: number) => (valor < 0 ? '#b91c1c' : '#15803d');

  if (error) {
    return <p style={{ fontSize: 14, color: '#b91c1c' }}>{error}</p>;
  }

  if (!datos) {
    return <p style={{ fontSize: 13, color: '#6e7781' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>;
  }

  const { flujo, saldoInicial, cuentasIncluidas } = datos;

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6e7781', lineHeight: 1.5 }}>
        {esPT
          ? 'Do dinheiro que você tem hoje, quanto sobra no fim de cada mês se você receber e pagar o que já está comprometido. Não inclui vendas nem gastos que ainda ninguém planejou.'
          : 'De la plata que tenés hoy, cuánto queda al cierre de cada mes si cobrás y pagás lo que ya está comprometido. No incluye ventas ni gastos que todavía nadie planeó.'}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.3, color: COLORES.verde, marginRight: 4 }}>{esPT ? 'HORIZONTE' : 'HORIZONTE'}</span>
        {MESES_FLUJO.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setMeses(n)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: `1px solid ${meses === n ? COLORES.verde : '#d1d5db'}`,
              background: meses === n ? COLORES.verde : '#fff',
              color: meses === n ? '#fff' : COLORES.azul,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {n} {esPT ? 'meses' : 'meses'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
        <Tarjeta titulo={esPT ? 'Dinheiro hoje' : 'Plata hoy'} valor={formatear(saldoInicial)} color={colorSaldo(saldoInicial)} />
        <Tarjeta titulo={esPT ? 'A receber' : 'Por cobrar'} valor={formatear(flujo.totalCobros)} color="#15803d" />
        <Tarjeta titulo={esPT ? 'A pagar' : 'Por pagar'} valor={formatear(flujo.totalPagos)} color="#c2410c" />
        <Tarjeta
          titulo={esPT ? `Saldo em ${meses} meses` : `Saldo en ${meses} meses`}
          valor={formatear(flujo.saldoFinal)}
          color={colorSaldo(flujo.saldoFinal)}
        />
      </div>

      {flujo.mesCritico ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 14, padding: '12px 16px', marginBottom: 18, fontSize: 14, lineHeight: 1.5 }}>
          {esPT
            ? `⚠️ Em ${formatearPeriodo(flujo.mesCritico.periodo, true)} o dinheiro não alcança: fecha em ${formatear(flujo.mesCritico.saldoFinal)}.`
            : `⚠️ En ${formatearPeriodo(flujo.mesCritico.periodo, false)} la plata no alcanza: cierra en ${formatear(flujo.mesCritico.saldoFinal)}.`}
        </div>
      ) : (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 14, padding: '12px 16px', marginBottom: 18, fontSize: 14 }}>
          {esPT ? '✅ Com o que está comprometido, o dinheiro alcança em todos os meses.' : '✅ Con lo comprometido, la plata alcanza todos los meses.'}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
              <th style={th}>{esPT ? 'Mês' : 'Mes'}</th>
              <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'Saldo inicial' : 'Saldo inicial'}</th>
              <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'A receber' : 'Por cobrar'}</th>
              <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'A pagar' : 'Por pagar'}</th>
              <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'Saldo final' : 'Saldo final'}</th>
            </tr>
          </thead>
          <tbody>
            {flujo.meses.map((mes) => {
              const expandido = abierto === mes.periodo;
              return (
                <Fragment key={mes.periodo}>
                  <tr
                    onClick={() => setAbierto(expandido ? null : mes.periodo)}
                    style={{ borderTop: '1px solid #f1f5f9', cursor: mes.eventos.length > 0 ? 'pointer' : 'default' }}
                  >
                    <td style={{ ...td, textTransform: 'capitalize', fontWeight: 700 }}>
                      {mes.eventos.length > 0 ? (expandido ? '▾ ' : '▸ ') : ''}
                      {formatearPeriodo(mes.periodo, esPT)}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{formatear(mes.saldoInicial)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#15803d', fontWeight: 700 }}>{formatear(mes.cobros)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#c2410c', fontWeight: 700 }}>{formatear(mes.pagos)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: colorSaldo(mes.saldoFinal) }}>{formatear(mes.saldoFinal)}</td>
                  </tr>
                  {expandido &&
                    mes.eventos.map((evento, i) => (
                      <tr key={`${mes.periodo}-${i}`} style={{ background: '#f8fafc' }}>
                        <td style={{ ...td, paddingLeft: 32, fontSize: 13 }} colSpan={3}>
                          {evento.fecha.slice(8)}/{evento.fecha.slice(5, 7)} · {evento.nombre}{' '}
                          <span style={{ color: '#6e7781' }}>({ETIQUETA_ORIGEN[evento.origen][esPT ? 'pt' : 'es']})</span>
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontSize: 13, color: evento.tipo === 'COBRO' ? '#15803d' : '#c2410c' }} colSpan={2}>
                          {evento.tipo === 'COBRO' ? '+' : '−'} {formatear(evento.monto).replace('−', '')}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#6e7781', lineHeight: 1.5 }}>
        {esPT ? 'Dinheiro de hoje: ' : 'Plata de hoy: '}
        {cuentasIncluidas.length > 0 ? cuentasIncluidas.join(', ') : esPT ? 'nenhuma conta de dinheiro' : 'ninguna cuenta de dinero'}
        {esPT
          ? '. O que já venceu e continua pendente conta no mês atual.'
          : '. Lo que ya venció y sigue pendiente cuenta en el mes en curso.'}
      </p>
    </div>
  );
}

function Tarjeta({ titulo, valor, color }: { titulo: string; valor: string; color: string }) {
  return (
    <div style={{ background: COLORES.blanco, border: '1px solid #e5e7eb', borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: '#6e7781', textTransform: 'uppercase' }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{valor}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 12,
  fontWeight: 800,
  color: '#374151',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const td: React.CSSProperties = { padding: '12px 14px' };
