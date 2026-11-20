'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { resumirCierres, type LineaCierre, type ResumenEjercicio } from '@/lib/cierres';

type Linea = LineaCierre & { id_cierre: string; historico: string | null };

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Asientos de cierre del ejercicio (31/12), solo lectura. No forman parte de las operaciones del Libro Diario ni de sus indicadores.
export function AsientosDeCierre({ empresaId, idioma, titulo = true }: { empresaId: string; idioma: string; titulo?: boolean }) {
  const pt = idioma === 'PT';
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [resumen, setResumen] = useState<ResumenEjercicio[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [{ data: ls }, { data: cuentas }] = await Promise.all([
        supabase.from('asientos_cierre').select('ejercicio, id_cierre, cuenta_debito, cuenta_credito, importe, historico, es_prueba').eq('empresa_id', empresaId).order('id_cierre'),
        supabase.from('plan_cuentas').select('nombre, tipo_saldo').eq('empresa_id', empresaId),
      ]);
      if (!vivo) return;
      const filas = (ls ?? []).map((l) => ({ ...l, importe: Number(l.importe) })) as Linea[];
      setLineas(filas);
      setResumen(resumirCierres(filas, new Map((cuentas ?? []).map((c) => [c.nombre as string, c.tipo_saldo as string]))));
    })();
    return () => { vivo = false; };
  }, [empresaId]);

  if (resumen.length === 0) return null;

  return (
    <div style={{ border: '1px solid #ddd6fe', background: '#faf5ff', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      {titulo && <strong style={{ color: '#5b21b6' }}>🔒 {pt ? 'Lançamentos de fechamento do exercício' : 'Asientos de cierre del ejercicio'}</strong>}
      {resumen.map((r) => (
        <div key={r.ejercicio} style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <strong>{r.ejercicio}</strong>
            {r.esPrueba && (
              <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>
                {pt ? 'TESTE — empresa demo' : 'PRUEBA — empresa demo'}
              </span>
            )}
            <span style={{ fontSize: 13, color: '#374151' }}>
              {pt ? 'Receitas' : 'Ingresos'} {fmt(r.ingresos)} · {pt ? 'Custos' : 'Costos'} {fmt(r.costos)} · {pt ? 'Despesas' : 'Gastos'} {fmt(r.gastos)} ·{' '}
              <strong style={{ color: r.resultado >= 0 ? '#166534' : '#b91c1c' }}>{pt ? 'Resultado' : 'Resultado'} {fmt(r.resultado)}</strong>
            </span>
            <button type="button" onClick={() => setAbierto(abierto === r.ejercicio ? null : r.ejercicio)} style={{ border: 'none', background: 'none', color: '#5b21b6', fontWeight: 700, cursor: 'pointer' }}>
              {abierto === r.ejercicio ? (pt ? 'Ocultar' : 'Ocultar') : `${pt ? 'Ver' : 'Ver'} ${r.lineas} ${pt ? 'lançamentos' : 'asientos'}`}
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {pt ? `Fechado em 31/12/${r.ejercicio}: o resultado passou para Resultados Acumulados.` : `Cerrado el 31/12/${r.ejercicio}: el resultado pasó a Resultados Acumulados.`}
          </div>
          {abierto === r.ejercicio && (
            <div style={{ overflowX: 'auto', marginTop: 6 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%', minWidth: 480 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                    <th style={{ padding: '3px 6px' }}>N°</th>
                    <th style={{ padding: '3px 6px' }}>{pt ? 'Débito' : 'Debe'}</th>
                    <th style={{ padding: '3px 6px' }}>{pt ? 'Crédito' : 'Haber'}</th>
                    <th style={{ padding: '3px 6px', textAlign: 'right' }}>{pt ? 'Valor' : 'Importe'}</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.filter((l) => l.ejercicio === r.ejercicio).map((l) => (
                    <tr key={l.id_cierre} style={{ borderTop: '1px solid #ede9fe' }}>
                      <td style={{ padding: '3px 6px' }}>{l.id_cierre.split('-').pop()}</td>
                      <td style={{ padding: '3px 6px' }}>{l.cuenta_debito}</td>
                      <td style={{ padding: '3px 6px' }}>{l.cuenta_credito}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(l.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
