'use client';

// MIS INGRESOS — espejo de MisVencimientos, del lado del cobro.
// Vive en Panel de Controle, debajo de Mis Vencimientos.
//
// Dos bloques, igual que allá: Cuentas por Cobrar (cuotas de una
// venta/cobro ya facturado a crédito — espejo de Pasivos) e Ingresos
// Recurrentes (sueldo, alquiler que cobrás, suscripciones de un
// cliente... — espejo de Gastos Recurrentes).
//
// Cualquier usuario de la empresa puede cargar, editar, activar/
// desactivar o eliminar un Ingreso Recurrente — igual que un Gasto
// Recurrente, es más parecido a un recordatorio personal que a
// "armado contable".

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { listarTodasLasCuotasCobro, marcarCuotaCobrada, type CuotaCobro } from '@/lib/cuotasCobro';
import {
  listarIngresosRecurrentes,
  listarRecordatoriosIngresosConHistorial,
  generarRecordatoriosIngresosPendientes,
  crearIngresoRecurrente,
  actualizarIngresoRecurrente,
  cambiarActivoIngresoRecurrente,
  saldoPendienteCobro,
  type IngresoRecurrente,
  type RecordatorioIngresoRecurrente,
} from '@/lib/ingresosRecurrentes';
import { SabioRegistrarIngresoModal } from './SabioRegistrarIngresoModal';
import { VincularCobroModal } from './VincularCobroModal';
import { ConfirmarDevengoModal } from './ConfirmarDevengoModal';
import { ajustarMontoDevengado } from '@/lib/devengoAjuste';
import { ofrecerAjustarMesesDevengados } from './ajustarMesesDevengados';
import { ActivarDevengoModal } from './ActivarDevengoModal';
import { buscarCuentaCompromisoPorNombre, listarCuentasElegibles, listarGrupos } from '@/lib/cuentasCompromiso';
import { nombreCuentaCompromiso } from '@/lib/cuentasCompromisoNombres';
import { empresaTieneDevengo } from '@/lib/devengoGastos';
import {
  ejecutarDevengoIngresos,
  activarDevengoIngreso,
  migrarCuentaGeneralIngreso,
  desactivarDevengoIngresoYLiberar,
  eliminarOBajaIngresoRecurrente,
  confirmarDevengoIngreso,
} from '@/lib/devengoIngresos';
import { ETIQUETA_ESTADO } from '@/lib/devengo';
import { AcordeonSeccion } from './AcordeonSeccion';
import { fechaLocalHoy } from '@/lib/fecha';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

export function MisIngresos({
  empresaId,
  idioma,
  simbolo,
  colores,
  periodoSeleccionado,
  soloLectura = false,
  onActualizado,
}: {
  empresaId: string;
  idioma: string;
  simbolo: string;
  colores: Colores;
  // Controlado desde Panel de Controle — mismo período que Mis
  // Vencimientos y Salud de Caja, elegido una sola vez arriba de los
  // tres.
  periodoSeleccionado: string;
  // En Panel de Control (ventana de análisis) se muestra solo la vista;
  // cargar, cobrar/pagar y gestionar plantillas se hace en Finanzas → Compromisos.
  soloLectura?: boolean;
  // Para que Compromisos refresque la proyección tras cada cambio.
  onActualizado?: () => void;
}) {
  const esPT = idioma === 'PT';

  const [cuotas, setCuotas] = useState<CuotaCobro[]>([]);
  const [recordatorios, setRecordatorios] = useState<RecordatorioIngresoRecurrente[]>([]);
  const [plantillas, setPlantillas] = useState<IngresoRecurrente[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<IngresoRecurrente | null>(null);
  const [creando, setCreando] = useState(false);
  const [recordatorioAConfirmar, setRecordatorioAConfirmar] = useState<RecordatorioIngresoRecurrente | null>(null);
  const [recordatorioAVincular, setRecordatorioAVincular] = useState<RecordatorioIngresoRecurrente | null>(null);
  const [recordatorioADevengar, setRecordatorioADevengar] = useState<RecordatorioIngresoRecurrente | null>(null);
  const [recordatorioAAjustar, setRecordatorioAAjustar] = useState<RecordatorioIngresoRecurrente | null>(null);
  const [errorDevengo, setErrorDevengo] = useState('');
  const [plantillaAActivar, setPlantillaAActivar] = useState<IngresoRecurrente | null>(null);
  const [plantillaAMigrar, setPlantillaAMigrar] = useState<IngresoRecurrente | null>(null);
  const [mensajeBaja, setMensajeBaja] = useState('');
  // id de forma de pago -> nombre, para mostrar a qué cuenta apunta cada plantilla.
  const [nombreCuentaPorId, setNombreCuentaPorId] = useState<Record<string, string>>({});
  const permiteDevengo = empresaTieneDevengo(empresaId);
  // Antes el interruptor "⋯" destapaba también lo ya cobrado de ambos
  // bloques — ahora que el selector de período (Panel de Controle) ya
  // separa todo, lo ya cobrado del período elegido se ve siempre; el
  // interruptor queda solo para gestionar las plantillas de Ingresos
  // Recurrentes. Mismo cambio que se hizo en Mis Vencimientos.
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false);

  async function recargar() {
    try {
      // Se asegura de que exista el recordatorio del período actual
      // antes de listar — si el usuario recién creó la plantilla y
      // todavía no pasó por el lobby (que también dispara esto), no
      // había ningún recordatorio armado todavía y el ingreso no
      // aparecía en ningún lado, ni pendiente ni cobrado.
      await generarRecordatoriosIngresosPendientes(empresaId, idioma).catch((e) =>
        console.warn('No se pudieron generar los recordatorios de ingresos recurrentes:', e)
      );

      // Devengo mes a mes (plantillas con "Mes a mes"): completa la ventana de 12
      // meses y reconoce lo que ya llegó al día 1. Corre solo, al abrir.
      await ejecutarDevengoIngresos(empresaId).catch((e) => {
        console.warn('No se pudo ejecutar el devengo de ingresos recurrentes:', e);
        setErrorDevengo(e instanceof Error ? e.message : 'Error inesperado.');
      });

      const [cuotasData, recordatoriosData, plantillasData, catData, fpData] = await Promise.all([
        listarTodasLasCuotasCobro(empresaId),
        listarRecordatoriosIngresosConHistorial(empresaId),
        listarIngresosRecurrentes(empresaId),
        supabase
          .from('categorias_operacion')
          .select('nombre')
          .eq('empresa_id', empresaId)
          .eq('operacion', 'COBRO')
          .eq('tipo', 'INGRESO')
          .order('nombre'),
        supabase.from('formas_pago').select('id, nombre').eq('empresa_id', empresaId).order('nombre'),
      ]);

      setCuotas(cuotasData);
      setRecordatorios(recordatoriosData);
      setPlantillas(plantillasData);
      setCategorias((catData.data ?? []).map((c) => c.nombre));
      setFormasPago((fpData.data ?? []).map((f) => f.nombre));
      setNombreCuentaPorId(Object.fromEntries((fpData.data ?? []).map((f) => [f.id as string, f.nombre as string])));
      setError('');
    } catch (e) {
      console.error('Error cargando Mis Ingresos:', e);
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setCargando(false);
      onActualizado?.();
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const hoy = fechaLocalHoy();

  // Todo lo que vence en el período elegido — cobrado y pendiente, se
  // muestran los dos; el total solo suma lo pendiente. Mismo criterio
  // que Mis Vencimientos (ver memory.md).
  const cuotasDelPeriodo = cuotas.filter((c) => `${c.fecha_vencimiento.slice(0, 7)}-01` === periodoSeleccionado);
  const cuotasPendientes = cuotasDelPeriodo.filter((c) => !c.cobrada);
  const cuotasCobradas = cuotasDelPeriodo.filter((c) => c.cobrada);

  const gruposCuentaPorCobrar = new Map<string, CuotaCobro[]>();
  for (const cuota of cuotasPendientes) {
    const lista = gruposCuentaPorCobrar.get(cuota.forma_pago_nombre) ?? [];
    lista.push(cuota);
    gruposCuentaPorCobrar.set(cuota.forma_pago_nombre, lista);
  }

  const recordatoriosDelPeriodo = recordatorios.filter((r) => r.periodo === periodoSeleccionado);
  const recordatoriosPendientes = recordatoriosDelPeriodo
    .filter((r) => !r.registrado)
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  const recordatoriosCobrados = recordatoriosDelPeriodo.filter((r) => r.registrado);

  const totalCuentasPorCobrar = cuotasPendientes.reduce((suma, cuota) => suma + cuota.monto, 0);
  const totalIngresosRecurrentes = recordatoriosPendientes.reduce((suma, r) => suma + saldoPendienteCobro(r), 0);
  const totalGeneral = totalCuentasPorCobrar + totalIngresosRecurrentes;

  async function cobrarCuota(cuotaId: string) {
    await marcarCuotaCobrada(cuotaId, true);
    await recargar();
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6e7781' }}>
        {esPT ? 'Receitas recorrentes por cobrar, tudo em um só lugar.' : 'Ingresos recurrentes por cobrar, todo en un mismo lugar.'}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%', justifyContent: 'space-between' }}>
          {!cargando && (cuotasDelPeriodo.length > 0 || recordatoriosDelPeriodo.length > 0) && (
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#6e7781' }}>
                {esPT ? 'TOTAL GERAL' : 'TOTAL GENERAL'}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#15803d' }}>
                {simbolo} {totalGeneral.toFixed(2)}
              </div>
            </div>
          )}

          {!cargando && !soloLectura && (
            <button
              type="button"
              onClick={() => setMostrarPlantillas((m) => !m)}
              title={esPT ? 'Gerenciar modelos de receita recorrente' : 'Gestionar plantillas de ingreso recurrente'}
              style={{ border: `1px solid ${colores.acento}`, background: 'transparent', color: colores.azul, borderRadius: 8, padding: '5px 10px', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
            >
              {mostrarPlantillas ? '✕' : '⋯'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {mensajeBaja && (
        <div style={{ fontSize: 12.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '9px 12px', marginBottom: 14 }}>
          {mensajeBaja}
        </div>
      )}

      {errorDevengo && (
        <div style={{ fontSize: 12.5, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', marginBottom: 14 }}>
          {errorDevengo}
        </div>
      )}

      {cargando ? (
        <p style={{ fontSize: 13, color: '#6e7781' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
      ) : (
        <>
          {/* ============ CUENTAS POR COBRAR (cuotas pendientes) ============ */}
          <AcordeonSeccion
            titulo={<>💵 {esPT ? 'Contas a Receber' : 'Cuentas por Cobrar'}</>}
            colorTitulo={colores.azul}
            total={
              gruposCuentaPorCobrar.size > 0 && (
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#15803d' }}>
                  {esPT ? 'Total: ' : 'Total: '}
                  {simbolo} {totalCuentasPorCobrar.toFixed(2)}
                </div>
              )
            }
          >
            {gruposCuentaPorCobrar.size === 0 ? (
              <p style={{ fontSize: 12.5, color: '#6e7781' }}>
                {esPT ? 'Sem parcelas pendentes neste período.' : 'Sin cuotas pendientes en este período.'}
              </p>
            ) : (
              Array.from(gruposCuentaPorCobrar.entries()).map(([nombreCuenta, cuotasDeLaCuenta]) => {
                const subtotal = cuotasDeLaCuenta.reduce((suma, cuota) => suma + cuota.monto, 0);

                return (
                  <div key={nombreCuenta} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: colores.azul }}>{nombreCuenta}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6e7781' }}>
                        {esPT ? 'Subtotal: ' : 'Subtotal: '}
                        {simbolo} {subtotal.toFixed(2)}
                      </div>
                    </div>
                    {cuotasDeLaCuenta.map((cuota) => {
                      const vencida = cuota.fecha_vencimiento < hoy;
                      return (
                        <div
                          key={cuota.id}
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
                            {cuota.numero_cuota}/{cuota.total_cuotas} — {cuota.fecha_vencimiento}
                            {vencida && <strong style={{ color: '#dc2626', marginLeft: 6 }}>{esPT ? 'Vencida' : 'Vencida'}</strong>}
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
                            <strong style={{ fontSize: 12.5, color: '#15803d', whiteSpace: 'nowrap' }}>
                              {simbolo} {cuota.monto.toFixed(2)}
                            </strong>
                            {!soloLectura && (
                            <button
                              type="button"
                              onClick={() => cobrarCuota(cuota.id)}
                              style={{ border: 'none', background: 'transparent', color: colores.verde, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              ✓ {esPT ? 'Marcar recebida' : 'Marcar cobrada'}
                            </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}

            {cuotasCobradas.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6e7781', marginBottom: 6, letterSpacing: 0.4 }}>
                  {esPT ? 'JÁ RECEBIDAS' : 'YA COBRADAS'}
                </div>
                {cuotasCobradas.map((cuota) => (
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
                      ✓ {cuota.forma_pago_nombre} {cuota.numero_cuota}/{cuota.total_cuotas} — {cuota.fecha_cobro ?? cuota.fecha_vencimiento}
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

          {/* ============ INGRESOS RECURRENTES ============ */}
          <AcordeonSeccion
            titulo={<>🔁 {esPT ? 'Receitas Recorrentes' : 'Ingresos Recurrentes'}</>}
            colorTitulo={colores.azul}
            total={
              recordatoriosPendientes.length > 0 && (
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#15803d' }}>
                  {esPT ? 'Total: ' : 'Total: '}
                  {simbolo} {totalIngresosRecurrentes.toFixed(2)}
                </div>
              )
            }
          >
            {recordatoriosPendientes.length === 0 ? (
            <p style={{ fontSize: 12.5, color: '#6e7781' }}>
              {esPT ? 'Sem receitas recorrentes pendentes neste período.' : 'Sin ingresos recurrentes pendientes en este período.'}
            </p>
          ) : (
            recordatoriosPendientes.map((recordatorio) => {
              const vencido = recordatorio.fecha_vencimiento < hoy;
              const saldo = saldoPendienteCobro(recordatorio);
              const tieneCobroParcial = recordatorio.monto_cobrado > 0;
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
                    {recordatorio.estado && (
                      <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: recordatorio.estado === 'DEVENGADA' ? '#dcfce7' : '#e0e7ff', color: recordatorio.estado === 'DEVENGADA' ? '#166534' : '#3730a3' }}>
                        {esPT ? ETIQUETA_ESTADO[recordatorio.estado].pt : ETIQUETA_ESTADO[recordatorio.estado].es}
                      </span>
                    )}
                    {vencido && recordatorio.estado !== 'PROGRAMADA' && <strong style={{ color: '#dc2626', marginLeft: 6 }}>{esPT ? 'Vencida' : 'Vencido'}</strong>}
                    {tieneCobroParcial && (
                      <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
                        {esPT ? 'Recebido' : 'Cobrado'} {simbolo} {recordatorio.monto_cobrado.toFixed(2)}{' '}
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
                      {tieneCobroParcial ? '' : esPT ? 'aprox.' : 'aprox.'} {simbolo} {saldo.toFixed(2)}
                    </span>
                    {!soloLectura && recordatorio.estado === null && (
                    <>
                    <button
                      type="button"
                      onClick={() => setRecordatorioAVincular(recordatorio)}
                      style={{ border: 'none', background: 'transparent', color: '#6e7781', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                    >
                      {esPT ? 'Já recebi' : 'Ya lo cobré'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecordatorioAConfirmar(recordatorio)}
                      style={{ border: 'none', background: 'transparent', color: colores.verde, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      ✓ {esPT ? 'Registrar' : 'Registrar'}
                    </button>
                                        </>
                    )}
                    {!soloLectura && recordatorio.estado === 'DEVENGADA' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRecordatorioAAjustar(recordatorio)}
                          style={{ border: 'none', background: 'transparent', color: '#6e7781', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                        >
                          {esPT ? 'Ajustar valor' : 'Ajustar monto'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecordatorioAConfirmar(recordatorio)}
                          style={{ border: 'none', background: 'transparent', color: colores.verde, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          ✓ {esPT ? 'Cobrar' : 'Cobrar'}
                        </button>
                      </>
                    )}
                    {!soloLectura && recordatorio.estado === 'POR_CONFIRMAR' && (
                      <button
                        type="button"
                        onClick={() => setRecordatorioADevengar(recordatorio)}
                        style={{ border: 'none', background: 'transparent', color: colores.verde, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        ✓ {esPT ? 'Confirmar valor' : 'Confirmar monto'}
                      </button>
                    )}
                  </span>
                </div>
              );
            })
          )}

          {recordatoriosCobrados.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6e7781', marginBottom: 6, letterSpacing: 0.4 }}>
                {esPT ? 'JÁ RECEBIDOS' : 'YA COBRADOS'}
              </div>
              {recordatoriosCobrados.map((recordatorio) => {
                const deMas = recordatorio.monto_cobrado - recordatorio.monto_habitual;
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
                            ? `Este mês você recebeu ${simbolo} ${deMas.toFixed(2)} a mais do que o esperado.`
                            : `Este mes cobraste ${simbolo} ${deMas.toFixed(2)} más de lo esperado.`}
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
                      {simbolo} {recordatorio.monto_cobrado.toFixed(2)}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}

          {!soloLectura && mostrarPlantillas && (
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
                        {plantilla.devengar && plantilla.cuenta_a_cobrar_forma_pago_id && nombreCuentaPorId[plantilla.cuenta_a_cobrar_forma_pago_id] && ` · ${nombreCuentaPorId[plantilla.cuenta_a_cobrar_forma_pago_id]}`}
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
                      {permiteDevengo && (
                        <label
                          title={esPT ? 'Reconhece o ingresso todo mês no seu período (Contas a Receber / Receita)' : 'Reconoce el ingreso cada mes en su período (Cuentas a Cobrar / Ingreso)'}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6e7781', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {esPT ? 'Mês a mês' : 'Mes a mes'}
                          <input
                            type="checkbox"
                            checked={plantilla.devengar}
                            onChange={async (e) => {
                              setErrorDevengo('');
                              try {
                                if (e.target.checked) {
                                  setPlantillaAActivar(plantilla);
                                  return;
                                } else if (
                                  window.confirm(
                                    esPT
                                      ? 'Desativar? Os meses futuros sem lançamento são removidos; o que já foi reconhecido fica.'
                                      : '¿Desactivar? Se quitan los meses futuros sin asiento; lo ya devengado queda como está.'
                                  )
                                ) {
                                  await desactivarDevengoIngresoYLiberar(empresaId, plantilla.id);
                                }
                              } catch (err) {
                                console.error(err);
                                setErrorDevengo(err instanceof Error ? err.message : 'Error inesperado.');
                              }
                              await recargar();
                            }}
                          />
                        </label>
                      )}

                      {permiteDevengo && plantilla.devengar && !plantilla.cuenta_a_cobrar_forma_pago_id && (
                        <button
                          type="button"
                          onClick={() => setPlantillaAMigrar(plantilla)}
                          title={esPT ? 'Cria uma conta a receber própria com o nome deste ingresso' : 'Crea una cuenta a cobrar propia con el nombre de este ingreso'}
                          style={{ border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', borderRadius: 8, padding: '3px 8px', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {esPT ? 'Conta própria' : 'Cuenta propia'}
                        </button>
                      )}

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
                            await cambiarActivoIngresoRecurrente(plantilla.id, e.target.checked);
                            await recargar();
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(esPT ? `Excluir "${plantilla.nombre}"?` : `¿Eliminar "${plantilla.nombre}"?`)) {
                            setMensajeBaja('');
                            try {
                              const resultado = await eliminarOBajaIngresoRecurrente(empresaId, plantilla);
                              if (resultado === 'BAJA') {
                                setMensajeBaja(
                                  esPT
                                    ? `"${plantilla.nombre}" tem meses reconhecidos sem receber: foi dada de baixa (não gera meses novos) e o que está pendente continua podendo ser recebido.`
                                    : `"${plantilla.nombre}" tiene meses devengados sin cobrar: se dio de baja (no genera meses nuevos) y lo pendiente se sigue pudiendo cobrar.`
                                );
                              }
                            } catch (err) {
                              console.error(err);
                              setErrorDevengo(err instanceof Error ? err.message : 'Error inesperado.');
                            }
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
                  + {esPT ? 'Adicionar receita recorrente' : 'Agregar ingreso recurrente'}
                </button>
              )}

              {(creando || editando) && (
                <FormularioIngresoRecurrente
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
                      const montoAnterior = editando.monto_habitual;
                      await actualizarIngresoRecurrente(editando.id, datos);
                      // Si el monto cambió, los meses ya devengados siguen con el viejo:
                      // se ofrece aplicarles el nuevo.
                      if (editando.devengar && Number(datos.montoHabitual) !== Number(montoAnterior)) {
                        await ofrecerAjustarMesesDevengados(empresaId, 'INGRESO', editando.id, datos.montoHabitual, idioma, simbolo);
                      }
                    } else {
                      await crearIngresoRecurrente(empresaId, datos);
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

          {soloLectura && (
            <p style={{ margin: '12px 0 0', fontSize: 12, color: '#6e7781' }}>
              {esPT ? 'Para registrar ou gerenciar, vá em ' : 'Para registrar o gestionar, andá a '}
              <Link href="/finanzas" style={{ color: colores.azul, fontWeight: 700 }}>
                Finanzas → Compromisos
              </Link>
              .
            </p>
          )}
        </>
      )}

      {recordatorioAConfirmar && (
        <SabioRegistrarIngresoModal
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

      {plantillaAActivar && (
        <ActivarDevengoModal
          lado="COBRAR"
          nombrePlantilla={plantillaAActivar.nombre}
          idioma={idioma}
          colores={colores}
          cargarOpciones={async () => ({
            existentes: await listarCuentasElegibles(empresaId, 'COBRAR'),
            grupos: await listarGrupos(empresaId, 'COBRAR'),
            individualYaExiste: Boolean(
              await buscarCuentaCompromisoPorNombre(empresaId, nombreCuentaCompromiso(plantillaAActivar.nombre, 'COBRAR'), 'COBRAR')
            ),
          })}
          onActivar={async (opciones) => {
            setErrorDevengo('');
            await activarDevengoIngreso(empresaId, plantillaAActivar.id, opciones);
            setPlantillaAActivar(null);
            await recargar();
          }}
          onClose={() => setPlantillaAActivar(null)}
        />
      )}

      {plantillaAMigrar && (
        <ActivarDevengoModal
          modo="MIGRAR"
          lado="COBRAR"
          nombrePlantilla={plantillaAMigrar.nombre}
          idioma={idioma}
          colores={colores}
          cargarOpciones={async () => ({
            existentes: [],
            grupos: await listarGrupos(empresaId, 'COBRAR'),
            individualYaExiste: false,
          })}
          onActivar={async (opciones) => {
            setErrorDevengo('');
            await migrarCuentaGeneralIngreso(empresaId, plantillaAMigrar.id, opciones.grupo ?? null);
            setPlantillaAMigrar(null);
            await recargar();
          }}
          onClose={() => setPlantillaAMigrar(null)}
        />
      )}

      {recordatorioADevengar && (
        <ConfirmarDevengoModal
          recordatorio={recordatorioADevengar}
          onConfirmar={(monto) => confirmarDevengoIngreso(empresaId, recordatorioADevengar.id, monto)}
          idioma={idioma}
          simbolo={simbolo}
          colores={colores}
          onClose={() => setRecordatorioADevengar(null)}
          onConfirmado={() => {
            setRecordatorioADevengar(null);
            recargar();
          }}
        />
      )}

      {recordatorioAAjustar && (
        <ConfirmarDevengoModal
          modo="AJUSTAR"
          yaMovido={recordatorioAAjustar.monto_cobrado}
          recordatorio={recordatorioAAjustar}
          onConfirmar={(monto) => ajustarMontoDevengado(empresaId, 'INGRESO', recordatorioAAjustar.id, monto)}
          idioma={idioma}
          simbolo={simbolo}
          colores={colores}
          onClose={() => setRecordatorioAAjustar(null)}
          onConfirmado={() => {
            setRecordatorioAAjustar(null);
            recargar();
          }}
        />
      )}

      {recordatorioAVincular && (
        <VincularCobroModal
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

function FormularioIngresoRecurrente({
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
  plantilla: IngresoRecurrente | null;
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
          placeholder={esPT ? 'Nome (ex.: Aluguel recebido)' : 'Nombre (ej. Alquiler que cobro)'}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <select style={inputEstilo} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">{esPT ? 'Categoria de receita...' : 'Categoría de ingreso...'}</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select style={inputEstilo} value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
          <option value="">{esPT ? 'Forma de recebimento...' : 'Forma de cobro...'}</option>
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
