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
import { supabase } from '@/lib/supabase';
import { listarCuotasCobroPendientes, marcarCuotaCobrada, type CuotaCobro } from '@/lib/cuotasCobro';
import {
  listarIngresosRecurrentes,
  listarRecordatoriosIngresosConHistorial,
  generarRecordatoriosIngresosPendientes,
  crearIngresoRecurrente,
  actualizarIngresoRecurrente,
  cambiarActivoIngresoRecurrente,
  eliminarIngresoRecurrente,
  saldoPendienteCobro,
  type IngresoRecurrente,
  type RecordatorioIngresoRecurrente,
} from '@/lib/ingresosRecurrentes';
import { SabioRegistrarIngresoModal } from './SabioRegistrarIngresoModal';
import { VincularCobroModal } from './VincularCobroModal';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

function fechaLocalHoy(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

export function MisIngresos({
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

  const [cuotas, setCuotas] = useState<CuotaCobro[]>([]);
  const [recordatorios, setRecordatorios] = useState<RecordatorioIngresoRecurrente[]>([]);
  const [plantillas, setPlantillas] = useState<IngresoRecurrente[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false);
  const [editando, setEditando] = useState<IngresoRecurrente | null>(null);
  const [creando, setCreando] = useState(false);
  const [recordatorioAConfirmar, setRecordatorioAConfirmar] = useState<RecordatorioIngresoRecurrente | null>(null);
  const [recordatorioAVincular, setRecordatorioAVincular] = useState<RecordatorioIngresoRecurrente | null>(null);
  const [mostrarCobrados, setMostrarCobrados] = useState(false);

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

      const [cuotasData, recordatoriosData, plantillasData, catData, fpData] = await Promise.all([
        listarCuotasCobroPendientes(empresaId),
        listarRecordatoriosIngresosConHistorial(empresaId),
        listarIngresosRecurrentes(empresaId),
        supabase
          .from('categorias_operacion')
          .select('nombre')
          .eq('empresa_id', empresaId)
          .eq('operacion', 'COBRO')
          .eq('tipo', 'INGRESO')
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
      console.error('Error cargando Mis Ingresos:', e);
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

  const gruposCuentaPorCobrar = new Map<string, CuotaCobro[]>();
  for (const cuota of cuotas) {
    const lista = gruposCuentaPorCobrar.get(cuota.forma_pago_nombre) ?? [];
    lista.push(cuota);
    gruposCuentaPorCobrar.set(cuota.forma_pago_nombre, lista);
  }

  const recordatoriosPendientes = recordatorios.filter((r) => !r.registrado);
  const recordatoriosCobrados = recordatorios.filter((r) => r.registrado);

  const totalCuentasPorCobrar = cuotas.reduce((suma, cuota) => suma + cuota.monto, 0);
  const totalIngresosRecurrentes = recordatoriosPendientes.reduce((suma, r) => suma + saldoPendienteCobro(r), 0);
  const totalGeneral = totalCuentasPorCobrar + totalIngresosRecurrentes;

  async function cobrarCuota(cuotaId: string) {
    await marcarCuotaCobrada(cuotaId, true);
    await recargar();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ marginBottom: 5, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde }}>
            {esPT ? 'RECEITAS' : 'INGRESOS'}
          </div>
          <h2 style={{ margin: 0, color: colores.azul, fontSize: 23 }}>
            {esPT ? '💰 Minhas Receitas' : '💰 Mis Ingresos'}
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: '#6e7781' }}>
            {esPT ? 'Receitas recorrentes por cobrar, tudo em um só lugar.' : 'Ingresos recurrentes por cobrar, todo en un mismo lugar.'}
          </p>
        </div>

        {!cargando && (cuotas.length > 0 || recordatorios.length > 0) && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#6e7781' }}>
              {esPT ? 'TOTAL GERAL' : 'TOTAL GENERAL'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d' }}>
              {simbolo} {totalGeneral.toFixed(2)}
            </div>
          </div>
        )}
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
          {/* ============ CUENTAS POR COBRAR (cuotas pendientes) ============ */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: colores.azul }}>
                💵 {esPT ? 'Contas a Receber' : 'Cuentas por Cobrar'}
              </div>

              {gruposCuentaPorCobrar.size > 0 && (
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#15803d' }}>
                  {esPT ? 'Total: ' : 'Total: '}
                  {simbolo} {totalCuentasPorCobrar.toFixed(2)}
                </div>
              )}
            </div>

            {gruposCuentaPorCobrar.size === 0 ? (
              <p style={{ fontSize: 12.5, color: '#6e7781' }}>
                {esPT ? 'Sem parcelas pendentes.' : 'Sin cuotas pendientes.'}
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
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ fontSize: 12.5, color: '#1f2937' }}>
                            {cuota.numero_cuota}/{cuota.total_cuotas} — {cuota.fecha_vencimiento}
                            {vencida && <strong style={{ color: '#dc2626', marginLeft: 6 }}>{esPT ? 'Vencida' : 'Vencida'}</strong>}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <strong style={{ fontSize: 12.5, color: '#15803d' }}>
                              {simbolo} {cuota.monto.toFixed(2)}
                            </strong>
                            <button
                              type="button"
                              onClick={() => cobrarCuota(cuota.id)}
                              style={{ border: 'none', background: 'transparent', color: colores.verde, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                            >
                              ✓ {esPT ? 'Marcar recebida' : 'Marcar cobrada'}
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* ============ INGRESOS RECURRENTES ============ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: colores.azul }}>
                🔁 {esPT ? 'Receitas Recorrentes' : 'Ingresos Recurrentes'}
              </div>

              {recordatoriosPendientes.length > 0 && (
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#15803d' }}>
                  {esPT ? 'Total: ' : 'Total: '}
                  {simbolo} {totalIngresosRecurrentes.toFixed(2)}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recordatoriosCobrados.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMostrarCobrados((m) => !m)}
                  style={{ border: `1px solid ${colores.acento}`, background: 'transparent', color: colores.azul, borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  {mostrarCobrados ? (esPT ? 'Ocultar recebidos' : 'Ocultar cobrados') : (esPT ? 'Mostrar recebidos' : 'Mostrar cobrados')}
                </button>
              )}

              <button
                type="button"
                onClick={() => setMostrarPlantillas((m) => !m)}
                style={{ border: `1px solid ${colores.acento}`, background: 'transparent', color: colores.azul, borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
              >
                {mostrarPlantillas ? (esPT ? 'Ocultar gerenciamento' : 'Ocultar gestión') : (esPT ? 'Gerenciar' : 'Gestionar')}
              </button>
            </div>
          </div>

          {recordatoriosPendientes.length === 0 ? (
            <p style={{ fontSize: 12.5, color: '#6e7781' }}>
              {esPT ? 'Sem receitas recorrentes pendentes.' : 'Sin ingresos recurrentes pendientes.'}
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
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 12.5, color: '#1f2937' }}>
                    {recordatorio.nombre} — {recordatorio.fecha_vencimiento}
                    {vencido && <strong style={{ color: '#dc2626', marginLeft: 6 }}>{esPT ? 'Vencida' : 'Vencido'}</strong>}
                    {tieneCobroParcial && (
                      <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
                        {esPT ? 'Recebido' : 'Cobrado'} {simbolo} {recordatorio.monto_cobrado.toFixed(2)}{' '}
                        {esPT ? 'de' : 'de'} {simbolo} {recordatorio.monto_habitual.toFixed(2)} —{' '}
                        {esPT ? 'saldo' : 'saldo'} {simbolo} {saldo.toFixed(2)}
                      </div>
                    )}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: '#6e7781' }}>
                      {tieneCobroParcial ? '' : esPT ? 'aprox.' : 'aprox.'} {simbolo} {saldo.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecordatorioAVincular(recordatorio)}
                      style={{ border: 'none', background: 'transparent', color: '#6e7781', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {esPT ? 'Já recebi' : 'Ya lo cobré'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecordatorioAConfirmar(recordatorio)}
                      style={{ border: 'none', background: 'transparent', color: colores.verde, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                    >
                      ✓ {esPT ? 'Registrar' : 'Registrar'}
                    </button>
                  </span>
                </div>
              );
            })
          )}

          {mostrarCobrados && recordatoriosCobrados.length > 0 && (
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
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: '#6e7781' }}>
                      ✓ {recordatorio.nombre} — {recordatorio.fecha_vencimiento}
                      {deMas > 0.01 && (
                        <div style={{ fontSize: 11, color: '#b45309' }}>
                          {esPT
                            ? `Este mês você recebeu ${simbolo} ${deMas.toFixed(2)} a mais do que o esperado.`
                            : `Este mes cobraste ${simbolo} ${deMas.toFixed(2)} más de lo esperado.`}
                        </div>
                      )}
                    </span>
                    <strong style={{ fontSize: 12.5, color: '#16a34a' }}>
                      {simbolo} {recordatorio.monto_cobrado.toFixed(2)}
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
                plantillas.map((plantilla) => (
                  <div
                    key={plantilla.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: 8,
                      background: plantilla.activo ? '#fff' : '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      marginBottom: 6,
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: plantilla.activo ? colores.azul : '#6e7781' }}>
                      {plantilla.nombre}
                      <span style={{ fontWeight: 400, color: '#6e7781' }}>
                        {' '}
                        · {plantilla.categoria} · {plantilla.forma_pago} · {esPT ? 'dia' : 'día'} {plantilla.dia_mes}
                      </span>
                    </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                            await eliminarIngresoRecurrente(plantilla.id);
                            await recargar();
                          }
                        }}
                        style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontSize: 13, cursor: 'pointer' }}
                      >
                        🗑️
                      </button>
                    </span>
                  </div>
                ))
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
                      await actualizarIngresoRecurrente(editando.id, datos);
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
