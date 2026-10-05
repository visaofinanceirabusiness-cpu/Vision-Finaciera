// lib/flujoProyectadoDatos.ts
//
// Junta los datos reales (saldo de las cuentas de dinero, cuotas, recordatorios
// y plantillas) y se los pasa a la lógica pura de flujoProyectado.ts.

import { listarCuentasDeDinero } from './saludCaja';
import { listarTodasLasCuotas } from './cuotas';
import { listarTodasLasCuotasCobro } from './cuotasCobro';
import { listarGastosRecurrentes, listarRecordatoriosConHistorial, saldoPendiente } from './gastosRecurrentes';
import { listarIngresosRecurrentes, listarRecordatoriosIngresosConHistorial, saldoPendienteCobro } from './ingresosRecurrentes';
import {
  construirFlujo,
  eventosDeRecordatorios,
  proyectarPlantillasSinDevengo,
  type EventoFlujo,
  type Flujo,
} from './flujoProyectado';

export type FlujoCargado = { saldoInicial: number; cuentasIncluidas: string[]; flujo: Flujo };

export async function cargarFlujoProyectado(empresaId: string, hoy: string, meses: number): Promise<FlujoCargado> {
  const [cuentas, cuotasPago, cuotasCobro, gastos, ingresos, recordatoriosGasto, recordatoriosIngreso] = await Promise.all([
    listarCuentasDeDinero(empresaId, hoy),
    listarTodasLasCuotas(empresaId),
    listarTodasLasCuotasCobro(empresaId),
    listarGastosRecurrentes(empresaId),
    listarIngresosRecurrentes(empresaId),
    listarRecordatoriosConHistorial(empresaId),
    listarRecordatoriosIngresosConHistorial(empresaId),
  ]);

  // Mismas cuentas que eligió mostrar el cliente en Salud de Caja; si no eligió
  // ninguna, todas las de dinero.
  const incluidas = cuentas.filter((c) => c.incluida);
  const usadas = incluidas.length > 0 ? incluidas : cuentas;
  const saldoInicial = Math.round(usadas.reduce((suma, c) => suma + c.saldo, 0) * 100) / 100;

  const ultimoPeriodo = (filas: { id: string; periodo: string }[]) => {
    const mapa = new Map<string, string>();
    for (const fila of filas) {
      const actual = mapa.get(fila.id);
      if (!actual || fila.periodo > actual) mapa.set(fila.id, fila.periodo);
    }
    return mapa;
  };

  const activasGasto = new Set(gastos.filter((g) => g.activo).map((g) => g.id));
  const activasIngreso = new Set(ingresos.filter((i) => i.activo).map((i) => i.id));

  const eventos: EventoFlujo[] = [
    ...cuotasPago
      .filter((c) => !c.pagada)
      .map((c): EventoFlujo => ({
        fecha: c.fecha_vencimiento,
        monto: Number(c.monto),
        tipo: 'PAGO',
        origen: 'CUOTA',
        nombre: `${c.forma_pago_nombre} ${c.numero_cuota}/${c.total_cuotas}`,
      })),
    ...cuotasCobro
      .filter((c) => !c.cobrada)
      .map((c): EventoFlujo => ({
        fecha: c.fecha_vencimiento,
        monto: Number(c.monto),
        tipo: 'COBRO',
        origen: 'CUOTA',
        nombre: `${c.forma_pago_nombre} ${c.numero_cuota}/${c.total_cuotas}`,
      })),
    ...eventosDeRecordatorios(
      recordatoriosGasto.map((r) => ({
        gastoOIngresoId: r.gasto_recurrente_id,
        nombre: r.nombre,
        periodo: r.periodo,
        fecha_vencimiento: r.fecha_vencimiento,
        registrado: r.registrado,
        estado: r.estado,
        saldo: saldoPendiente(r),
      })),
      activasGasto,
      'PAGO'
    ),
    ...eventosDeRecordatorios(
      recordatoriosIngreso.map((r) => ({
        gastoOIngresoId: r.ingreso_recurrente_id,
        nombre: r.nombre,
        periodo: r.periodo,
        fecha_vencimiento: r.fecha_vencimiento,
        registrado: r.registrado,
        estado: r.estado,
        saldo: saldoPendienteCobro(r),
      })),
      activasIngreso,
      'COBRO'
    ),
    ...proyectarPlantillasSinDevengo(
      gastos,
      ultimoPeriodo(recordatoriosGasto.map((r) => ({ id: r.gasto_recurrente_id, periodo: r.periodo }))),
      hoy,
      meses,
      'PAGO'
    ),
    ...proyectarPlantillasSinDevengo(
      ingresos,
      ultimoPeriodo(recordatoriosIngreso.map((r) => ({ id: r.ingreso_recurrente_id, periodo: r.periodo }))),
      hoy,
      meses,
      'COBRO'
    ),
  ];

  return {
    saldoInicial,
    cuentasIncluidas: usadas.map((c) => c.nombre),
    flujo: construirFlujo(saldoInicial, hoy, meses, eventos),
  };
}
