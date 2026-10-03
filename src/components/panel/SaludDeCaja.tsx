'use client';

// SALUD DE CAJA — entre Mis Ingresos y Mis Vencimientos en Panel de
// Controle. Compara, para el período elegido (mismo selector que
// alimenta a los otros dos):
//
//   DISPONIBLE = saldo de las cuentas de dinero elegidas (Banco Nu,
//                Caja...) + lo que falta cobrar ese período
//   NECESARIO  = Pasivos + Gastos Recurrentes pendientes ese período
//
// y muestra la diferencia en un círculo: verde con lo que sobra, o
// naranja/rojo con lo que falta. Las cuentas que se suman al
// disponible quedan guardadas en formas_pago.incluir_en_salud_caja
// (ver lib/saludCaja.ts) — fijas hasta que alguien las cambia a mano
// acá mismo.

import { useEffect, useState } from 'react';
import { listarTodasLasCuotasCobro, type CuotaCobro } from '@/lib/cuotasCobro';
import { listarRecordatoriosIngresosConHistorial, saldoPendienteCobro, type RecordatorioIngresoRecurrente } from '@/lib/ingresosRecurrentes';
import { listarTodasLasCuotas, type CuotaPasivo } from '@/lib/cuotas';
import { listarRecordatoriosConHistorial, saldoPendiente, type RecordatorioGastoRecurrente } from '@/lib/gastosRecurrentes';
import { listarCuentasDeDinero, cambiarCuentaEnSaludCaja, type CuentaDeDinero } from '@/lib/saludCaja';
import { fechaLocalHoy, periodosDisponibles } from '@/lib/fecha';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

export function SaludDeCaja({
  empresaId,
  idioma,
  simbolo,
  colores,
  periodoSeleccionado,
  onCambiarPeriodo,
}: {
  empresaId: string;
  idioma: string;
  simbolo: string;
  colores: Colores;
  periodoSeleccionado: string;
  onCambiarPeriodo: (periodo: string) => void;
}) {
  const esPT = idioma === 'PT';
  const hoy = fechaLocalHoy();

  const [cuentas, setCuentas] = useState<CuentaDeDinero[]>([]);
  const [cuotasCobro, setCuotasCobro] = useState<CuotaCobro[]>([]);
  const [recordatoriosIngreso, setRecordatoriosIngreso] = useState<RecordatorioIngresoRecurrente[]>([]);
  const [cuotasPasivo, setCuotasPasivo] = useState<CuotaPasivo[]>([]);
  const [recordatoriosGasto, setRecordatoriosGasto] = useState<RecordatorioGastoRecurrente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardandoCuentaId, setGuardandoCuentaId] = useState<string | null>(null);

  async function recargar() {
    try {
      const [cuentasData, cuotasCobroData, recordatoriosIngresoData, cuotasPasivoData, recordatoriosGastoData] = await Promise.all([
        listarCuentasDeDinero(empresaId, hoy),
        listarTodasLasCuotasCobro(empresaId),
        listarRecordatoriosIngresosConHistorial(empresaId),
        listarTodasLasCuotas(empresaId),
        listarRecordatoriosConHistorial(empresaId),
      ]);

      setCuentas(cuentasData);
      setCuotasCobro(cuotasCobroData);
      setRecordatoriosIngreso(recordatoriosIngresoData);
      setCuotasPasivo(cuotasPasivoData);
      setRecordatoriosGasto(recordatoriosGastoData);
      setError('');
    } catch (e) {
      console.error('Error cargando Salud de Caja:', e);
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const cuotasCobroPendientesPeriodo = cuotasCobro.filter(
    (c) => !c.cobrada && `${c.fecha_vencimiento.slice(0, 7)}-01` === periodoSeleccionado
  );
  const recordatoriosIngresoPendientesPeriodo = recordatoriosIngreso.filter(
    (r) => !r.registrado && r.periodo === periodoSeleccionado
  );
  const totalPorCobrarPeriodo =
    cuotasCobroPendientesPeriodo.reduce((suma, c) => suma + c.monto, 0) +
    recordatoriosIngresoPendientesPeriodo.reduce((suma, r) => suma + saldoPendienteCobro(r), 0);

  const cuotasPasivoPendientesPeriodo = cuotasPasivo.filter(
    (c) => !c.pagada && `${c.fecha_vencimiento.slice(0, 7)}-01` === periodoSeleccionado
  );
  const recordatoriosGastoPendientesPeriodo = recordatoriosGasto.filter(
    (r) => !r.registrado && r.periodo === periodoSeleccionado
  );
  const totalNecesarioPeriodo =
    cuotasPasivoPendientesPeriodo.reduce((suma, c) => suma + c.monto, 0) +
    recordatoriosGastoPendientesPeriodo.reduce((suma, r) => suma + saldoPendiente(r), 0);

  const cuentasIncluidas = cuentas.filter((c) => c.incluida);
  const saldoCuentasIncluidas = cuentasIncluidas.reduce((suma, c) => suma + c.saldo, 0);

  const totalDisponible = saldoCuentasIncluidas + totalPorCobrarPeriodo;
  const diferencia = totalDisponible - totalNecesarioPeriodo;
  const cubierto = totalNecesarioPeriodo <= 0 ? 1 : Math.max(0, Math.min(1, totalDisponible / totalNecesarioPeriodo));

  async function alternarCuenta(cuenta: CuentaDeDinero) {
    setGuardandoCuentaId(cuenta.formaPagoId);
    try {
      await cambiarCuentaEnSaludCaja(cuenta.formaPagoId, !cuenta.incluida);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setGuardandoCuentaId(null);
    }
  }

  // Círculo SVG: arco proporcional a `cubierto` (0 a 1), verde si
  // diferencia >= 0 (alcanza o sobra), naranja/rojo si falta.
  const radio = 54;
  const circunferencia = 2 * Math.PI * radio;
  const colorArco = diferencia >= 0 ? '#16a34a' : totalDisponible > 0 ? '#d97706' : '#dc2626';

  return (
    <div>
      <div style={{ marginBottom: 5, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde }}>
        {esPT ? 'SAÚDE DE CAIXA' : 'SALUD DE CAJA'}
      </div>
      <h2 style={{ margin: 0, color: colores.azul, fontSize: 23 }}>♻️ {esPT ? 'Saúde de Caixa' : 'Salud de Caja'}</h2>
      <p style={{ margin: '5px 0 16px', fontSize: 12, color: '#6e7781' }}>
        {esPT
          ? 'O que vai entrar (saldo guardado + a receber) contra o que vai sair (vencimentos) no período escolhido.'
          : 'Lo que va a entrar (saldo guardado + a cobrar) contra lo que va a salir (vencimientos) en el período elegido.'}
      </p>

      <div style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 16px', marginBottom: 18, border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde }}>
          {esPT ? 'PERÍODO' : 'PERÍODO'}
        </div>
        <select
          value={periodoSeleccionado}
          onChange={(e) => onCambiarPeriodo(e.target.value)}
          style={{ minWidth: 190, padding: '10px 14px', borderRadius: 12, border: `1px solid ${colores.acento}`, background: '#fff', color: colores.azul, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          {periodosDisponibles(hoy, esPT).map((periodo) => (
            <option key={periodo.valor} value={periodo.valor}>
              {periodo.etiqueta}
            </option>
          ))}
        </select>
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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={radio} fill="none" stroke="#e5e7eb" strokeWidth="14" />
              <circle
                cx="70"
                cy="70"
                r={radio}
                fill="none"
                stroke={colorArco}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${circunferencia * cubierto} ${circunferencia}`}
                transform="rotate(-90 70 70)"
                style={{ transition: 'stroke-dasharray 300ms ease' }}
              />
              <text x="70" y="64" textAnchor="middle" fontSize="11" fontWeight="700" fill="#6e7781">
                {diferencia >= 0 ? (esPT ? 'SOBRA' : 'SOBRA') : esPT ? 'FALTA' : 'FALTA'}
              </text>
              <text x="70" y="86" textAnchor="middle" fontSize="15" fontWeight="800" fill={colorArco}>
                {simbolo} {Math.abs(diferencia).toFixed(0)}
              </text>
            </svg>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#6e7781' }}>
                {esPT ? 'DISPONÍVEL' : 'DISPONIBLE'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>
                {simbolo} {totalDisponible.toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#6e7781' }}>
                {esPT ? 'NECESSÁRIO' : 'NECESARIO'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#c2410c' }}>
                {simbolo} {totalNecesarioPeriodo.toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: colores.azul, marginBottom: 8, letterSpacing: 0.4 }}>
            {esPT ? 'CONTAS CONSIDERADAS' : 'CUENTAS CONSIDERADAS'}
          </div>

          {cuentas.length === 0 ? (
            <p style={{ fontSize: 12, color: '#6e7781' }}>
              {esPT
                ? 'Nenhuma conta de dinheiro (Caixa/Banco) configurada ainda em Formas de Pagamento.'
                : 'Todavía no hay ninguna cuenta de dinero (Caja/Banco) configurada en Formas de Pago.'}
            </p>
          ) : (
            cuentas.map((cuenta) => (
              <label
                key={cuenta.formaPagoId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: cuenta.incluida ? '#f0fdf4' : '#fff',
                  border: '1px solid #e5e7eb',
                  marginBottom: 6,
                  gap: 8,
                  cursor: guardandoCuentaId ? 'wait' : 'pointer',
                  opacity: guardandoCuentaId === cuenta.formaPagoId ? 0.6 : 1,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: colores.azul }}>
                  <input
                    type="checkbox"
                    checked={cuenta.incluida}
                    disabled={guardandoCuentaId !== null}
                    onChange={() => alternarCuenta(cuenta)}
                  />
                  {cuenta.nombre}
                </span>
                <strong style={{ fontSize: 12.5, color: '#15803d', whiteSpace: 'nowrap' }}>
                  {simbolo} {cuenta.saldo.toFixed(2)}
                </strong>
              </label>
            ))
          )}
        </>
      )}
    </div>
  );
}
