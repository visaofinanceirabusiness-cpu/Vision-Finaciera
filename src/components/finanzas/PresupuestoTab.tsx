'use client';

// PESTAÑA · PRESUPUESTO (para Familia: "Metas del mes")
//
// Un tope por categoría de gasto frente a lo gastado en el mes (ver
// lib/presupuesto.ts). Es solo una vista: lo gastado sale de los asientos y
// los topes se guardan en la tabla `presupuestos`.

import { useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fechaLocalHoy, periodosDisponibles } from '@/lib/fecha';
import { cargarPresupuesto, copiarMesAnterior, guardarTope, sugerirConPromedio } from '@/lib/presupuestoDatos';
import type { EstadoPresupuesto, FilaPresupuesto, ResumenPresupuesto } from '@/lib/presupuesto';
import { SimboloContext, IdiomaContext, COLORES } from '@/components/contabilidad/compartido';

const COLOR_ESTADO: Record<EstadoPresupuesto, string> = {
  OK: '#16a34a',
  ALERTA: '#d97706',
  EXCEDIDO: '#dc2626',
  SIN_PRESUPUESTO: '#94a3b8',
  VACIA: '#e2e8f0',
};

export function PresupuestoTab() {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext) ?? 'ES';
  const esPT = idioma === 'PT';
  const hoy = fechaLocalHoy();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(`${hoy.slice(0, 7)}-01`);
  const [resumen, setResumen] = useState<ResumenPresupuesto | null>(null);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    async function cargarEmpresa() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', userData.user.id).maybeSingle();
      if (perfil?.empresa_id) setEmpresaId(perfil.empresa_id);
    }

    cargarEmpresa();
  }, []);

  async function recargar(id: string, mes: string) {
    try {
      setResumen(await cargarPresupuesto(id, mes));
      setBorradores({});
      setError('');
    } catch (e) {
      console.error('Error cargando el presupuesto:', e);
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    }
  }

  useEffect(() => {
    if (!empresaId) return;
    setResumen(null);
    setAviso('');
    recargar(empresaId, periodo);
  }, [empresaId, periodo]);

  async function ejecutar(accion: () => Promise<string>) {
    if (!empresaId) return;
    setOcupado(true);
    setError('');
    try {
      setAviso(await accion());
      await recargar(empresaId, periodo);
    } catch (e) {
      console.error('Error actualizando el presupuesto:', e);
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  async function guardarFila(fila: FilaPresupuesto) {
    const texto = borradores[fila.categoria];
    if (!empresaId || texto === undefined) return;

    const monto = Number(texto.replace(',', '.'));
    if (Number.isNaN(monto) || monto < 0) {
      setError(esPT ? 'Digite um valor válido.' : 'Ingresá un monto válido.');
      return;
    }

    if (monto === (fila.presupuesto ?? 0)) {
      setBorradores((previo) => {
        const { [fila.categoria]: _descartado, ...resto } = previo;
        return resto;
      });
      return;
    }

    await ejecutar(async () => {
      await guardarTope(empresaId, fila.categoria, periodo, monto);
      return '';
    });
  }

  const formatear = (valor: number) => `${valor < 0 ? '−' : ''}${simbolo} ${Math.abs(valor).toLocaleString(esPT ? 'pt-BR' : 'es-AR', { maximumFractionDigits: 0 })}`;

  if (!resumen && !error) return <p style={{ fontSize: 13, color: '#6e7781' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>;

  const sinTopes = resumen !== null && resumen.totalPresupuestado === 0;

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6e7781', lineHeight: 1.5 }}>
        {esPT
          ? 'Defina um teto por categoria de gasto e compare com o que você realmente gastou no mês.'
          : 'Definí un tope por categoría de gasto y compará con lo que realmente gastaste en el mes.'}
      </p>

      <div style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 16px', marginBottom: 18, border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          style={{ minWidth: 190, padding: '10px 14px', borderRadius: 12, border: `1px solid ${COLORES.gris}`, background: '#fff', color: COLORES.azul, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          {periodosDisponibles(hoy, esPT).map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={ocupado || !empresaId}
            onClick={() =>
              ejecutar(async () => {
                const n = await copiarMesAnterior(empresaId as string, periodo);
                return n > 0 ? (esPT ? `${n} tetos copiados do mês anterior.` : `Se copiaron ${n} topes del mes anterior.`) : esPT ? 'Não há tetos novos para copiar.' : 'No hay topes nuevos para copiar.';
              })
            }
            style={botonSecundario}
          >
            {esPT ? 'Copiar mês anterior' : 'Copiar mes anterior'}
          </button>
          <button
            type="button"
            disabled={ocupado || !empresaId}
            onClick={() =>
              ejecutar(async () => {
                const n = await sugerirConPromedio(empresaId as string, periodo);
                return n > 0 ? (esPT ? `${n} tetos sugeridos com a sua média.` : `Se sugirieron ${n} topes con tu promedio.`) : esPT ? 'Sem histórico para sugerir.' : 'No hay historial para sugerir.';
              })
            }
            style={botonSecundario}
          >
            {esPT ? 'Sugerir com minha média' : 'Sugerir con mi promedio'}
          </button>
        </div>
      </div>

      {error && <p style={{ margin: '0 0 12px', fontSize: 14, color: '#b91c1c' }}>{error}</p>}
      {aviso && !error && <p style={{ margin: '0 0 12px', fontSize: 14, color: '#166534' }}>{aviso}</p>}

      {resumen && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
            <Tarjeta titulo={esPT ? 'Orçado' : 'Presupuestado'} valor={formatear(resumen.totalPresupuestado)} color={COLORES.azul} />
            <Tarjeta titulo={esPT ? 'Gasto (com teto)' : 'Gastado (con tope)'} valor={formatear(resumen.gastadoConTope)} color="#c2410c" />
            <Tarjeta titulo={esPT ? 'Sobra' : 'Queda'} valor={formatear(resumen.restante)} color={resumen.restante < 0 ? '#b91c1c' : '#15803d'} />
            <Tarjeta titulo={esPT ? 'Gasto sem teto' : 'Gastado sin tope'} valor={formatear(resumen.gastadoSinTope)} color="#64748b" />
          </div>

          {sinTopes && (
            <p style={{ margin: '0 0 14px', fontSize: 14, color: '#6e7781', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, padding: '12px 16px' }}>
              {esPT
                ? 'Você ainda não definiu tetos neste mês. Escreva um valor em cada categoria, copie o mês anterior ou use sua média.'
                : 'Todavía no definiste topes este mes. Escribí un monto en cada categoría, copiá el mes anterior o usá tu promedio.'}
            </p>
          )}

          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={th}>{esPT ? 'Categoria' : 'Categoría'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'Teto' : 'Tope'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'Gasto' : 'Gastado'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{esPT ? 'Sobra' : 'Queda'}</th>
                  <th style={{ ...th, minWidth: 150 }}>{esPT ? 'Uso' : 'Uso'}</th>
                </tr>
              </thead>
              <tbody>
                {resumen.filas.map((fila) => (
                  <tr key={fila.categoria} style={{ borderTop: '1px solid #f1f5f9', opacity: fila.estado === 'VACIA' ? 0.65 : 1 }}>
                    <td style={{ ...td, fontWeight: 700 }}>{fila.categoria}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={ocupado}
                        value={borradores[fila.categoria] ?? (fila.presupuesto !== null ? String(fila.presupuesto) : '')}
                        placeholder="—"
                        onChange={(e) => setBorradores((previo) => ({ ...previo, [fila.categoria]: e.target.value }))}
                        onBlur={() => guardarFila(fila)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        style={{ width: 96, padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', textAlign: 'right', fontSize: 14, fontWeight: 700, color: COLORES.azul }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: '#c2410c', fontWeight: 700 }}>{formatear(fila.gastado)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: fila.restante === null ? '#94a3b8' : fila.restante < 0 ? '#b91c1c' : '#15803d' }}>
                      {fila.restante === null ? '—' : formatear(fila.restante)}
                    </td>
                    <td style={td}>
                      {fila.porcentaje === null ? (
                        <span style={{ fontSize: 12.5, color: '#94a3b8' }}>{fila.estado === 'SIN_PRESUPUESTO' ? (esPT ? 'Sem teto' : 'Sin tope') : ''}</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 10, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, fila.porcentaje)}%`, height: '100%', background: COLOR_ESTADO[fila.estado] }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: COLOR_ESTADO[fila.estado], minWidth: 42, textAlign: 'right' }}>{fila.porcentaje}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#6e7781', lineHeight: 1.5 }}>
            {esPT
              ? 'Verde até 80 %, amarelo de 80 a 100 %, vermelho se passar do teto. O gasto vem dos lançamentos já registrados no mês.'
              : 'Verde hasta el 80 %, amarillo del 80 al 100 %, rojo si te pasás del tope. Lo gastado sale de lo ya registrado en el mes.'}
          </p>
        </>
      )}
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

const botonSecundario: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: `1px solid ${COLORES.azul}`,
  background: '#fff',
  color: COLORES.azul,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const th: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 12,
  fontWeight: 800,
  color: '#374151',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const td: React.CSSProperties = { padding: '10px 14px' };
