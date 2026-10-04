'use client';

// PESTAÑA · COMPROMISOS
//
// Acá se CARGA y se gestiona lo que está por cobrar y por pagar
// (cuentas a cobrar, pasivos e ingresos/gastos recurrentes): crear y
// editar plantillas, registrar cobros y pagos, vincular lo ya
// cobrado/pagado. Antes esto vivía en el Panel de Control, que es una
// ventana de análisis y ahora solo lo muestra (soloLectura).
//
// Los 12 meses siguientes se muestran como "programados": no son
// asientos ni forman parte del balance (ver lib/compromisosProgramados.ts).

import { useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fechaLocalHoy, periodosDisponibles } from '@/lib/fecha';
import { listarIngresosRecurrentes } from '@/lib/ingresosRecurrentes';
import { listarGastosRecurrentes } from '@/lib/gastosRecurrentes';
import { proyectarCompromisos, totalesProgramados, MESES_HORIZONTE, type MesProgramado } from '@/lib/compromisosProgramados';
import { formatearPeriodo } from '@/lib/fecha';
import { MisIngresos } from '@/components/panel/MisIngresos';
import { MisVencimientos } from '@/components/panel/MisVencimientos';
import { SimboloContext, IdiomaContext, COLORES } from './compartido';

const COLORES_PANEL = { azul: COLORES.azul, verde: COLORES.verde, acento: COLORES.gris, blanco: COLORES.blanco };

export function CompromisosTab() {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext) ?? 'ES';
  const esPT = idioma === 'PT';
  const hoy = fechaLocalHoy();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(`${hoy.slice(0, 7)}-01`);
  const [programados, setProgramados] = useState<MesProgramado[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id) return;

      setEmpresaId(perfil.empresa_id);

      try {
        const [ingresos, gastos] = await Promise.all([
          listarIngresosRecurrentes(perfil.empresa_id),
          listarGastosRecurrentes(perfil.empresa_id),
        ]);
        setProgramados(proyectarCompromisos(ingresos, gastos, hoy));
      } catch (e) {
        console.warn('No se pudieron cargar los compromisos programados:', e);
      }
    }

    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  if (!empresaId) {
    return <p style={{ fontSize: 13, color: '#6e7781' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>;
  }

  const totales = totalesProgramados(programados);
  const formatear = (valor: number) => `${simbolo} ${valor.toLocaleString(esPT ? 'pt-BR' : 'es-AR', { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6e7781', lineHeight: 1.5 }}>
        {esPT
          ? 'Tudo o que você tem a receber e a pagar, em um só lugar. Cada mês é reconhecido no seu período; os próximos meses ficam programados.'
          : 'Todo lo que tenés por cobrar y por pagar, en un solo lugar. Cada mes se reconoce en su período; los meses siguientes quedan programados.'}
      </p>

      <div style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 16px', marginBottom: 20, border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: COLORES.verde }}>PERÍODO</div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          style={{ minWidth: 190, padding: '10px 14px', borderRadius: 12, border: `1px solid ${COLORES.gris}`, background: '#fff', color: COLORES.azul, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          {periodosDisponibles(hoy, esPT).map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}
      >
        <section style={tarjeta}>
          <MisIngresos empresaId={empresaId} idioma={idioma} simbolo={simbolo} colores={COLORES_PANEL} periodoSeleccionado={periodo} onActualizado={() => setVersion((v) => v + 1)} />
        </section>

        <section style={tarjeta}>
          <MisVencimientos empresaId={empresaId} idioma={idioma} simbolo={simbolo} colores={COLORES_PANEL} periodoSeleccionado={periodo} onActualizado={() => setVersion((v) => v + 1)} />
        </section>
      </div>

      {programados.length > 0 && (totales.porCobrar > 0 || totales.porPagar > 0) && (
        <section style={tarjeta}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: COLORES.verde, marginBottom: 4 }}>
            {esPT ? 'COMPROMISSOS PROGRAMADOS' : 'COMPROMISOS PROGRAMADOS'}
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#6e7781', lineHeight: 1.5 }}>
            {esPT
              ? `Próximos ${MESES_HORIZONTE} meses, a partir das plantillas recorrentes ativas. Não fazem parte do balanço até chegar o mês.`
              : `Próximos ${MESES_HORIZONTE} meses, a partir de las plantillas recurrentes activas. No forman parte del balance hasta que llega el mes.`}
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={th}>{esPT ? 'Mês' : 'Mes'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'A receber' : 'Por cobrar'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'A pagar' : 'Por pagar'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {programados.map((mes) => (
                  <tr key={mes.periodo} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...td, textTransform: 'capitalize' }}>{formatearPeriodo(mes.periodo, esPT)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#15803d', fontWeight: 700 }}>{formatear(mes.porCobrar)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#c2410c', fontWeight: 700 }}>{formatear(mes.porPagar)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: mes.neto >= 0 ? '#15803d' : '#b91c1c' }}>{formatear(mes.neto)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f8fafc' }}>
                  <td style={{ ...td, fontWeight: 800 }}>Total</td>
                  <td style={{ ...td, textAlign: 'right', color: '#15803d', fontWeight: 800 }}>{formatear(totales.porCobrar)}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#c2410c', fontWeight: 800 }}>{formatear(totales.porPagar)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: totales.neto >= 0 ? '#15803d' : '#b91c1c' }}>{formatear(totales.neto)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

const tarjeta: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 20,
  padding: 20,
  border: '1px solid #e5e7eb',
};

const th: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 11.5,
  fontWeight: 800,
  color: '#374151',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const td: React.CSSProperties = { padding: '10px 14px' };
