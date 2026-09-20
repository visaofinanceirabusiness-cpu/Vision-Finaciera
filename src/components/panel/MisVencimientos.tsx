'use client';

// MIS VENCIMIENTOS — panel unificado del lobby operativo (Panel de
// Controle, dentro de "Tu negocio hoy"/"Tu familia hoy").
//
// Antes esto estaba repartido en tres lugares (Informes → Mis Deudas,
// Informes → Gastos Fijos, Configurações → Gastos Recorrentes) — acá
// se junta todo en una sola ventana, manteniendo la separación entre
// Pasivos (cuotas de una compra/pago a crédito) y Gastos Recorrentes
// (alquiler, servicios, suscripciones), porque son cosas distintas:
// una cuota ya tiene su asiento contable armado, un gasto recorrente
// todavía no.
//
// Cualquier usuario de la empresa puede cargar, editar, activar/
// desactivar o eliminar un Gasto Recorrente — no es "armado contable"
// como una Forma de Pago o un Pasivo nuevo (eso sigue en
// Configurações), es más parecido a un recordatorio personal.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { listarTodasLasCuotas, marcarCuotaPagada, type CuotaPasivo } from '@/lib/cuotas';
import {
  listarGastosRecurrentes,
  listarRecordatoriosConHistorial,
  generarRecordatoriosPendientes,
  crearGastoRecurrente,
  actualizarGastoRecurrente,
  cambiarActivoGastoRecurrente,
  eliminarGastoRecurrente,
  saldoPendiente,
  type GastoRecurrente,
  type RecordatorioGastoRecurrente,
} from '@/lib/gastosRecurrentes';
import { SabioRegistrarGastoModal } from './SabioRegistrarGastoModal';
import { VincularPagoModal } from './VincularPagoModal';
import { AcordeonSeccion } from './AcordeonSeccion';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

function fechaLocalHoy(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

export function MisVencimientos({
  empresaId,
  idioma,
  simbolo,
  colores,
}: {
  empresaId: string;
  idioma: string;
  simbolo: string;
  colores: Colores;
}) {
  const esPT = idioma === 'PT';

  const [cuotas, setCuotas] = useState<CuotaPasivo[]>([]);
  const [recordatorios, setRecordatorios] = useState<RecordatorioGastoRecurrente[]>([]);
  const [plantillas, setPlantillas] = useState<GastoRecurrente[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<GastoRecurrente | null>(null);
  const [creando, setCreando] = useState(false);
  const [recordatorioAConfirmar, setRecordatorioAConfirmar] = useState<RecordatorioGastoRecurrente | null>(null);
  const [recordatorioAVincular, setRecordatorioAVincular] = useState<RecordatorioGastoRecurrente | null>(null);
  // Un solo interruptor general para todo lo "extra" (ya pagadas de
  // ambos bloques + gestión de plantillas) — antes eran 3 botones
  // sueltos repartidos entre los dos acordeones, que ocupaban mucho
  // espacio para algo que se usa poco.
  const [mostrarExtra, setMostrarExtra] = useState(false);
  const mostrarPagados = mostrarExtra;
  const mostrarPasivosPagados = mostrarExtra;
  const mostrarPlantillas = mostrarExtra;

  async function recargar() {
    try {
      // Se asegura de que exista el recordatorio del período actual
      // antes de listar — si el usuario recién creó la plantilla y
      // todavía no pasó por el lobby (que también dispara esto), no
      // había ningún recordatorio armado todavía y el gasto no
      // aparecía en ningún lado, ni pendiente ni pagado.
      await generarRecordatoriosPendientes(empresaId, idioma).catch((e) =>
        console.warn('No se pudieron generar los recordatorios de gastos recurrentes:', e)
      );

      const [cuotasData, recordatoriosData, plantillasData, catData, fpData] = await Promise.all([
        listarTodasLasCuotas(empresaId),
        listarRecordatoriosConHistorial(empresaId),
        listarGastosRecurrentes(empresaId),
        supabase
          .from('categorias_operacion')
          .select('nombre')
          .eq('empresa_id', empresaId)
          .eq('operacion', 'PAGO')
          .eq('tipo', 'GASTO')
          .order('nombre'),
        supabase.from('formas_pago').select('nombre').eq('empresa_id', empresaId).order('nombre'),
      ]);

      setCuotas(cuotasData);
      setRecordatorios(recordatoriosData);
      setPlantillas(plantillasData);
      setCategorias((catData.data ?? []).map((c) => c.nombre));
      setFormasPago((fpData.data ?? []).map((f) => f.nombre));
      setError('');
    } catch (e) {
      console.error('Error cargando Mis Vencimientos:', e);
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const hoy = fechaLocalHoy();

  const cuotasPendientes = cuotas.filter((c) => !c.pagada);
  const cuotasPagadas = cuotas.filter((c) => c.pagada);

  // De cada plan de cuotas (mismo id_operacion) solo la que vence
  // primero es la que corresponde a este período — el resto ya están
  // ahí para referencia, pero no hay que sumarlas al total de hoy
  // porque todavía no llegó su vencimiento.
  const proximaVencimientoPorOperacion = new Map<string, string>();
  for (const cuota of cuotasPendientes) {
    const actual = proximaVencimientoPorOperacion.get(cuota.id_operacion);
    if (!actual || cuota.fecha_vencimiento < actual) {
      proximaVencimientoPorOperacion.set(cuota.id_operacion, cuota.fecha_vencimiento);
    }
  }
  function esProximoPeriodo(cuota: CuotaPasivo): boolean {
    return proximaVencimientoPorOperacion.get(cuota.id_operacion) === cuota.fecha_vencimiento;
  }

  const gruposPasivo = new Map<string, CuotaPasivo[]>();
  for (const cuota of cuotasPendientes) {
    const lista = gruposPasivo.get(cuota.forma_pago_nombre) ?? [];
    lista.push(cuota);
    gruposPasivo.set(cuota.forma_pago_nombre, lista);
  }

  const recordatoriosPendientes = recordatorios.filter((r) => !r.registrado);
  const recordatoriosPagados = recordatorios.filter((r) => r.registrado);

  const totalPasivos = cuotasPendientes.filter(esProximoPeriodo).reduce((suma, cuota) => suma + cuota.monto, 0);
  const totalGastosRecurrentes = recordatoriosPendientes.reduce((suma, r) => suma + saldoPendiente(r), 0);
  const totalGeneral = totalPasivos + totalGastosRecurrentes;

  async function pagarCuota(cuotaId: string) {
    await marcarCuotaPagada(cuotaId, true);
    await recargar();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ marginBottom: 5, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde }}>
            {esPT ? 'VENCIMENTOS' : 'VENCIMIENTOS'}
          </div>
          <h2 style={{ margin: 0, color: colores.azul, fontSize: 23 }}>
            {esPT ? '📅 Meus Vencimentos Futuros' : '📅 Mis Vencimientos Futuros'}
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: '#6e7781' }}>
            {esPT
              ? 'Cuotas de Passivos e Despesas Recorrentes, todas em um só lugar.'
              : 'Cuotas de Pasivos y Gastos Recurrentes, todo en un mismo lugar.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {!cargando && (cuotas.length > 0 || recordatorios.length > 0) && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#6e7781' }}>
                {esPT ? 'TOTAL GERAL' : 'TOTAL GENERAL'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#c2410c' }}>
                {simbolo} {totalGeneral.toFixed(2)}
              </div>
            </div>
          )}

          {!cargando && (cuotasPagadas.length > 0 || recordatoriosPagados.length > 0 || plantillas.length > 0) && (
            <button
              type="button"
              onClick={() => setMostrarExtra((m) => !m)}
              title={esPT ? 'Ver pagas e gerenciar modelos' : 'Ver pagadas y gestionar plantillas'}
              style={{ border: `1px solid ${colores.acento}`, background: 'transparent', color: colores.azul, borderRadius: 8, padding: '5px 10px', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
            >
              {mostrarExtra ? '✕' : '⋯'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {cargando ? (
        <p style={{ fontSize: 13, color: '#6e7781' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
      ) : (
        <>
          {/* ============ PASIVOS (cuotas pendientes) ============ */}
          <AcordeonSeccion
            titulo={<>💳 {esPT ? 'Passivos' : 'Pasivos'}</>}
            colorTitulo={colores.azul}
            total={
              gruposPasivo.size > 0 && (
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#c2410c' }}>
                  {esPT ? 'Total: ' : 'Total: '}
                  {simbolo} {totalPasivos.toFixed(2)}
                </div>
              )
            }
          >
            {gruposPasivo.size === 0 ? (
              <p style={{ fontSize: 12.5, color: '#6e7781' }}>
                {esPT ? 'Sem parcelas pendentes.' : 'Sin cuotas pendientes.'}
              </p>
            ) : (
              Array.from(gruposPasivo.entries()).map(([nombrePasivo, cuotasDelPasivo]) => {
                const subtotalPasivo = cuotasDelPasivo.filter(esProximoPeriodo).reduce((suma, cuota) => suma + cuota.monto, 0);

                return (
                <div key={nombrePasivo} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: colores.azul }}>{nombrePasivo}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6e7781' }}>
                      {esPT ? 'Subtotal: ' : 'Subtotal: '}
                      {simbolo} {subtotalPasivo.toFixed(2)}
                    </div>
                  </div>
                  {cuotasDelPasivo.map((cuota) => {
                    const vencida = cuota.fecha_vencimiento < hoy;
                    const esFutura = !esProximoPeriodo(cuota);
                    return (
                      <div
                        key={cuota.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: esFutura ? '#f3f4f6' : '#f8fafc',
                          border: '1px solid #e5e7eb',
                          marginBottom: 6,
                          gap: 10,
                          flexWrap: 'nowrap',
                          overflowX: 'auto',
                          opacity: esFutura ? 0.7 : 1,
                        }}
                      >
                        <span style={{ fontSize: 12.5, color: '#1f2937', whiteSpace: 'nowrap' }}>
                          {cuota.numero_cuota}/{cuota.total_cuotas} — {cuota.fecha_vencimiento}
                          {vencida && <strong style={{ color: '#dc2626', marginLeft: 6 }}>{esPT ? 'Vencida' : 'Vencida'}</strong>}
                          {esFutura && (
                            <span style={{ color: '#9ca3af', marginLeft: 6, fontWeight: 600 }}>
                              {esPT ? '(período futuro, não soma no total)' : '(período futuro, no suma en el total)'}
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            flexShrink: 0,
                            position: 'sticky',
                            right: 0,
                            background: esFutura ? '#f3f4f6' : '#f8fafc',
                            paddingLeft: 10,
                          }}
                        >
                          <strong style={{ fontSize: 12.5, color: esFutura ? '#9ca3af' : '#c2410c', whiteSpace: 'nowrap' }}>
                            {simbolo} {cuota.monto.toFixed(2)}
                          </strong>
                          <button
                            type="button"
                            onClick={() => pagarCuota(cuota.id)}
                            style={{ border: 'none', background: 'transparent', color: colores.verde, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            ✓ {esPT ? 'Marcar paga' : 'Marcar pagada'}
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
                );
              })
            )}

            {mostrarPasivosPagados && cuotasPagadas.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6e7781', marginBottom: 6, letterSpacing: 0.4 }}>
                  {esPT ? 'JÁ PAGAS' : 'YA PAGADAS'}
                </div>
                {cuotasPagadas.map((cuota) => (
                  <div
                    key={cuota.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      marginBottom: 6,
                      gap: 10,
                      flexWrap: 'nowrap',
                      overflowX: 'auto',
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: '#6e7781', whiteSpace: 'nowrap' }}>
                      ✓ {cuota.forma_pago_nombre} {cuota.numero_cuota}/{cuota.total_cuotas} — {cuota.fecha_pago ?? cuota.fecha_vencimiento}
                    </span>
                    <strong
                      style={{
                        fontSize: 12.5,
                        color: '#16a34a',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        right: 0,
                        background: '#f3f4f6',
                        paddingLeft: 10,
                      }}
                    >
                      {simbolo} {cuota.monto.toFixed(2)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </AcordeonSeccion>

          {/* ============ GASTOS RECURRENTES ============ */}
          <AcordeonSeccion
            titulo={<>🔁 {esPT ? 'Despesas Recorrentes' : 'Gastos Recurrentes'}</>}
            colorTitulo={colores.azul}
            total={
              recordatoriosPendientes.length > 0 && (
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#c2410c' }}>
                  {esPT ? 'Total: ' : 'Total: '}
                  {simbolo} {totalGastosRecurrentes.toFixed(2)}
                </div>
              )
            }
          >
            {recordatoriosPendientes.length === 0 ? (
              <p style={{ fontSize: 12.5, color: '#6e7781' }}>
                {esPT ? 'Sem despesas fixas pendentes.' : 'Sin gastos fijos pendientes.'}
              </p>
            ) : (
              recordatoriosPendientes.map((recordatorio) => {
                const vencido = recordatorio.fecha_vencimiento < hoy;
                const saldo = saldoPendiente(recordatorio);
                const tienePagoParcial = recordatorio.monto_pagado > 0;
                return (
                  <div
                    key={recordatorio.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      marginBottom: 6,
                      gap: 10,
                      flexWrap: 'nowrap',
                      overflowX: 'auto',
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: '#1f2937', whiteSpace: 'nowrap' }}>
                      {recordatorio.nombre} — {recordatorio.fecha_vencimiento}
                      {vencido && <strong style={{ color: '#dc2626', marginLeft: 6 }}>{esPT ? 'Vencida' : 'Vencido'}</strong>}
                      {tienePagoParcial && (
                        <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                          {esPT ? 'Pago' : 'Pagado'} {simbolo} {recordatorio.monto_pagado.toFixed(2)}{' '}
                          {esPT ? 'de' : 'de'} {simbolo} {recordatorio.monto_habitual.toFixed(2)} —{' '}
                          {esPT ? 'saldo' : 'saldo'} {simbolo} {saldo.toFixed(2)}
                        </div>
                      )}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexShrink: 0,
                        position: 'sticky',
                        right: 0,
                        background: '#f8fafc',
                        paddingLeft: 10,
                      }}
                    >
                      <span style={{ fontSize: 12, color: '#6e7781', whiteSpace: 'nowrap' }}>
                        {tienePagoParcial ? '' : esPT ? 'aprox.' : 'aprox.'} {simbolo} {saldo.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRecordatorioAVincular(recordatorio)}
                        style={{ border: 'none', background: 'transparent', color: '#6e7781', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                      >
                        {esPT ? 'Já paguei' : 'Ya lo pagué'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecordatorioAConfirmar(recordatorio)}
                        style={{ border: 'none', background: 'transparent', color: colores.verde, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        ✓ {esPT ? 'Registrar' : 'Registrar'}
                      </button>
                    </span>
                  </div>
                );
              })
            )}

            {mostrarPagados && recordatoriosPagados.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6e7781', marginBottom: 6, letterSpacing: 0.4 }}>
                  {esPT ? 'JÁ PAGOS' : 'YA PAGADOS'}
                </div>
                {recordatoriosPagados.map((recordatorio) => {
                  const deMas = recordatorio.monto_pagado - recordatorio.monto_habitual;
                  return (
                    <div
                      key={recordatorio.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        marginBottom: 6,
                        gap: 10,
                        flexWrap: 'nowrap',
                        overflowX: 'auto',
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: '#6e7781', whiteSpace: 'nowrap' }}>
                        ✓ {recordatorio.nombre} — {recordatorio.fecha_vencimiento}
                        {deMas > 0.01 && (
                          <div style={{ fontSize: 11, color: '#b45309' }}>
                            {esPT
                              ? `Este mês você pagou ${simbolo} ${deMas.toFixed(2)} a mais do que o esperado.`
                              : `Este mes pagaste ${simbolo} ${deMas.toFixed(2)} más de lo esperado.`}
                          </div>
                        )}
                      </span>
                      <strong
                        style={{
                          fontSize: 12.5,
                          color: '#16a34a',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          position: 'sticky',
                          right: 0,
                          background: '#f3f4f6',
                          paddingLeft: 10,
                        }}
                      >
                        {simbolo} {recordatorio.monto_pagado.toFixed(2)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            )}

            {mostrarPlantillas && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#fbfcfd', border: '1px solid #eef2f6' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: colores.azul, marginBottom: 8, letterSpacing: 0.4 }}>
                  {esPT ? 'MODELOS CADASTRADOS' : 'PLANTILLAS CARGADAS'}
                </div>

                {plantillas.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#6e7781', marginBottom: 10 }}>
                    {esPT ? 'Nenhuma cadastrada ainda.' : 'Todavía no hay ninguna cargada.'}
                  </p>
                ) : (
                  plantillas.map((plantilla) => {
                    const fondoFila = plantilla.activo ? '#fff' : '#f3f4f6';
                    return (
                    <div
                      key={plantilla.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 8,
                        background: fondoFila,
                        border: '1px solid #e5e7eb',
                        marginBottom: 6,
                        gap: 8,
                        flexWrap: 'nowrap',
                        overflowX: 'auto',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: plantilla.activo ? colores.azul : '#6e7781', whiteSpace: 'nowrap' }}>
                        {plantilla.nombre}
                        <span style={{ fontWeight: 400, color: '#6e7781' }}>
                          {' '}
                          · {plantilla.categoria} · {plantilla.forma_pago} · {esPT ? 'dia' : 'día'} {plantilla.dia_mes}
                        </span>
                      </span>

                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          flexShrink: 0,
                          position: 'sticky',
                          right: 0,
                          background: fondoFila,
                          paddingLeft: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setEditando(plantilla)}
                          style={{ border: 'none', background: 'transparent', color: colores.azul, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}
                        >
                          {esPT ? 'Editar' : 'Editar'}
                        </button>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6e7781', cursor: 'pointer' }}>
                          {plantilla.activo ? (esPT ? 'Ativa' : 'Activa') : (esPT ? 'Inativa' : 'Inactiva')}
                          <input
                            type="checkbox"
                            checked={plantilla.activo}
                            onChange={async (e) => {
                              await cambiarActivoGastoRecurrente(plantilla.id, e.target.checked);
                              await recargar();
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(esPT ? `Excluir "${plantilla.nombre}"?` : `¿Eliminar "${plantilla.nombre}"?`)) {
                              await eliminarGastoRecurrente(plantilla.id);
                              await recargar();
                            }
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontSize: 13, cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                      </span>
                    </div>
                    );
                  })
                )}

                {!creando && !editando && (
                  <button
                    type="button"
                    onClick={() => setCreando(true)}
                    style={{ marginTop: 6, border: 'none', background: colores.verde, color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + {esPT ? 'Adicionar despesa recorrente' : 'Agregar gasto recurrente'}
                  </button>
                )}

                {(creando || editando) && (
                  <FormularioGastoRecurrente
                    esPT={esPT}
                    colores={colores}
                    categorias={categorias}
                    formasPago={formasPago}
                    plantilla={editando}
                    onCancelar={() => {
                      setCreando(false);
                      setEditando(null);
                    }}
                    onGuardar={async (datos) => {
                      if (editando) {
                        await actualizarGastoRecurrente(editando.id, datos);
                      } else {
                        await crearGastoRecurrente(empresaId, datos);
                      }
                      setCreando(false);
                      setEditando(null);
                      await recargar();
                    }}
                  />
                )}
              </div>
            )}
          </AcordeonSeccion>
        </>
      )}

      {recordatorioAConfirmar && (
        <SabioRegistrarGastoModal
          empresaId={empresaId}
          recordatorio={recordatorioAConfirmar}
          idioma={idioma}
          simbolo={simbolo}
          colores={colores}
          onClose={() => setRecordatorioAConfirmar(null)}
          onRegistrado={() => {
            setRecordatorioAConfirmar(null);
            recargar();
          }}
        />
      )}

      {recordatorioAVincular && (
        <VincularPagoModal
          empresaId={empresaId}
          recordatorio={recordatorioAVincular}
          idioma={idioma}
          simbolo={simbolo}
          colores={colores}
          onClose={() => setRecordatorioAVincular(null)}
          onVinculado={() => {
            setRecordatorioAVincular(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}

function FormularioGastoRecurrente({
  esPT,
  colores,
  categorias,
  formasPago,
  plantilla,
  onGuardar,
  onCancelar,
}: {
  esPT: boolean;
  colores: Colores;
  categorias: string[];
  formasPago: string[];
  plantilla: GastoRecurrente | null;
  onGuardar: (datos: { nombre: string; categoria: string; formaPago: string; montoHabitual: number; diaMes: number }) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '');
  const [categoria, setCategoria] = useState(plantilla?.categoria ?? '');
  const [formaPago, setFormaPago] = useState(plantilla?.forma_pago ?? '');
  const [montoHabitual, setMontoHabitual] = useState(plantilla ? String(plantilla.monto_habitual) : '');
  const [diaMes, setDiaMes] = useState(plantilla ? String(plantilla.dia_mes) : '10');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    const monto = Number(montoHabitual);
    const dia = Number(diaMes);

    if (!nombre.trim() || !categoria || !formaPago || !monto || !dia) {
      setError(esPT ? 'Preencha todos os campos.' : 'Completá todos los campos.');
      return;
    }

    setError('');
    setGuardando(true);

    try {
      await onGuardar({ nombre: nombre.trim(), categoria, formaPago, montoHabitual: monto, diaMes: dia });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setGuardando(false);
    }
  }

  const inputEstilo: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 12.5,
    flex: '1 1 160px',
  };

  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      {error && <div style={{ fontSize: 11.5, color: '#b91c1c' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          style={inputEstilo}
          placeholder={esPT ? 'Nome (ex.: Aluguel do escritório)' : 'Nombre (ej. Alquiler oficina)'}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <select style={inputEstilo} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">{esPT ? 'Categoria de despesa...' : 'Categoría de gasto...'}</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select style={inputEstilo} value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
          <option value="">{esPT ? 'Forma de pagamento...' : 'Forma de pago...'}</option>
          {formasPago.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="number"
          style={{ ...inputEstilo, flex: '1 1 120px' }}
          placeholder={esPT ? 'Valor habitual' : 'Monto habitual'}
          value={montoHabitual}
          onChange={(e) => setMontoHabitual(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: '#6e7781', whiteSpace: 'nowrap' }}>{esPT ? 'Dia do mês:' : 'Día del mes:'}</label>
          <input
            type="number"
            min={1}
            max={28}
            style={{ ...inputEstilo, width: 60, flex: 'none' }}
            value={diaMes}
            onChange={(e) => setDiaMes(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={guardando}
          onClick={guardar}
          style={{ border: 'none', background: colores.verde, color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}
        >
          {esPT ? 'Salvar' : 'Guardar'}
        </button>

        <button
          type="button"
          onClick={onCancelar}
          style={{ border: '1px solid #d1d5db', background: 'transparent', color: '#374151', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          {esPT ? 'Cancelar' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}
