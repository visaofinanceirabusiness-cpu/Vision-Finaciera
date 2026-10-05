'use client';

// PESTAÑA · DEUDAS Y PRÉSTAMOS
//
// Todo lo que se debe, con su saldo, cuotas pendientes y próximo vencimiento
// (ver lib/deudas.ts). Es solo una vista: pagar se hace desde Compromisos o
// desde la Central de Lanzamientos.

import { useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fechaLocalHoy } from '@/lib/fecha';
import { cargarDeudas } from '@/lib/deudasDatos';
import type { DeudaFila, Deudas } from '@/lib/deudas';
import { SimboloContext, IdiomaContext, COLORES } from '@/components/contabilidad/compartido';

export function DeudasTab() {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext) ?? 'ES';
  const esPT = idioma === 'PT';
  const hoy = fechaLocalHoy();

  const [datos, setDatos] = useState<Deudas | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', userData.user.id).maybeSingle();
      if (!perfil?.empresa_id) return;

      try {
        const resultado = await cargarDeudas(perfil.empresa_id, hoy);
        if (vigente) setDatos(resultado);
      } catch (e) {
        console.error('Error cargando deudas y préstamos:', e);
        if (vigente) setError(e instanceof Error ? e.message : 'Error inesperado.');
      }
    }

    cargar();

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatear = (valor: number) => `${simbolo} ${valor.toLocaleString(esPT ? 'pt-BR' : 'es-AR', { maximumFractionDigits: 0 })}`;
  const fecha = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

  if (error) return <p style={{ fontSize: 14, color: '#b91c1c' }}>{error}</p>;
  if (!datos) return <p style={{ fontSize: 13, color: '#6e7781' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>;

  if (datos.total === 0) {
    return (
      <p style={{ fontSize: 15, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px' }}>
        {esPT ? '✅ Você não tem dívidas registradas.' : '✅ No tenés deudas registradas.'}
      </p>
    );
  }

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6e7781', lineHeight: 1.5 }}>
        {esPT
          ? 'Tudo o que você deve hoje, com o saldo de cada conta, as parcelas pendentes e o próximo vencimento.'
          : 'Todo lo que debés hoy, con el saldo de cada cuenta, las cuotas pendientes y el próximo vencimiento.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 22 }}>
        <Tarjeta titulo={esPT ? 'Dívida total' : 'Deuda total'} valor={formatear(datos.total)} color="#c2410c" />
        <Tarjeta titulo={esPT ? 'Dívidas e empréstimos' : 'Deudas y préstamos'} valor={formatear(datos.totalDeudas)} color={COLORES.azul} />
        <Tarjeta titulo={esPT ? 'Compromissos' : 'Compromisos'} valor={formatear(datos.totalCompromisos)} color={COLORES.azul} />
        <Tarjeta titulo={esPT ? 'Vence em 30 dias' : 'Vence en 30 días'} valor={formatear(datos.venceEn30Dias)} color={datos.venceEn30Dias > 0 ? '#b91c1c' : '#15803d'} />
      </div>

      <Seccion
        titulo={esPT ? 'DÍVIDAS E EMPRÉSTIMOS' : 'DEUDAS Y PRÉSTAMOS'}
        ayuda={esPT ? 'Cartões, empréstimos, impostos e outras dívidas.' : 'Tarjetas, préstamos, impuestos y otras deudas.'}
        filas={datos.deudas}
        esPT={esPT}
        formatear={formatear}
        fecha={fecha}
      />

      <Seccion
        titulo={esPT ? 'COMPROMISSOS A PAGAR' : 'COMPROMISOS A PAGAR'}
        ayuda={esPT ? 'O que já foi reconhecido mês a mês e ainda não foi pago. Pague em Compromissos.' : 'Lo que ya se reconoció mes a mes y todavía no se pagó. Se paga desde Compromisos.'}
        filas={datos.compromisos}
        esPT={esPT}
        formatear={formatear}
        fecha={fecha}
      />
    </div>
  );
}

function Seccion({
  titulo,
  ayuda,
  filas,
  esPT,
  formatear,
  fecha,
}: {
  titulo: string;
  ayuda: string;
  filas: DeudaFila[];
  esPT: boolean;
  formatear: (valor: number) => string;
  fecha: (iso: string) => string;
}) {
  if (filas.length === 0) return null;

  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.3, color: COLORES.verde }}>{titulo}</div>
      <p style={{ margin: '2px 0 10px', fontSize: 13, color: '#6e7781' }}>{ayuda}</p>

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
              <th style={th}>{esPT ? 'Conta' : 'Cuenta'}</th>
              <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'Saldo devido' : 'Saldo adeudado'}</th>
              <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'Pendentes' : 'Pendientes'}</th>
              <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'Próximo vencimento' : 'Próximo vencimiento'}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.cuentaId} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ ...td, fontWeight: 700 }}>{fila.nombre}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#c2410c' }}>{formatear(fila.saldo)}</td>
                <td style={{ ...td, textAlign: 'right', color: '#6e7781' }}>
                  {fila.pendientes > 0 ? `${fila.pendientes} · ${formatear(fila.montoPendiente)}` : '—'}
                </td>
                <td style={{ ...td, textAlign: 'right', color: fila.vencida ? '#b91c1c' : COLORES.azul, fontWeight: fila.vencida ? 800 : 600 }}>
                  {fila.proximoVencimiento ? `${fila.vencida ? '⚠️ ' : ''}${fecha(fila.proximoVencimiento)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
