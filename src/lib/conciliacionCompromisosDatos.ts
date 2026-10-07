// lib/conciliacionCompromisosDatos.ts
//
// Concilia los meses devengados de ingresos/gastos recurrentes con el Libro
// Diario (ver conciliacionCompromisos.ts): un cobro/pago contra "X a cobrar" /
// "X a pagar" cargado por otro camino queda asociado al mes que corresponde.
// Reusa registrarCobroParcial / registrarPagoParcial, o sea la misma lógica
// que el botón Cobrar/Pagar; no toca el motor contable.

import { supabase } from './supabase';
import { repartirMovimientos, type FilaDevengada, type MovimientoLibro } from './conciliacionCompromisos';
import { listarRecordatoriosIngresosPendientes, registrarCobroParcial } from './ingresosRecurrentes';
import { listarRecordatoriosPendientes, registrarPagoParcial } from './gastosRecurrentes';

type Lado = 'COBRAR' | 'PAGAR';

const CONFIG = {
  COBRAR: {
    tabla: 'ingresos_recurrentes_recordatorios',
    columnaMovido: 'monto_cobrado',
    tablaLineas: 'ingresos_recurrentes_recordatorios_cobros',
    operacion: 'COBRO',
    columnaCuenta: 'cuenta_credito',
  },
  PAGAR: {
    tabla: 'gastos_recurrentes_recordatorios',
    columnaMovido: 'monto_pagado',
    tablaLineas: 'gastos_recurrentes_recordatorios_pagos',
    operacion: 'PAGO',
    columnaCuenta: 'cuenta_debito',
  },
} as const;

type Pendiente = { id: string; periodo: string; monto_habitual: number; cuenta_devengo_forma_pago_id: string | null; estado: string | null };

async function conciliarLado(empresaId: string, lado: Lado): Promise<number> {
  const cfg = CONFIG[lado];

  const pendientes: Array<Pendiente & Record<string, unknown>> =
    lado === 'COBRAR'
      ? ((await listarRecordatoriosIngresosPendientes(empresaId)) as never)
      : ((await listarRecordatoriosPendientes(empresaId)) as never);

  const abiertos = pendientes.filter((p) => p.estado === 'DEVENGADA' && p.cuenta_devengo_forma_pago_id);
  if (abiertos.length === 0) return 0;

  const [{ data: todas, error: errorTodas }, { data: lineas, error: errorLineas }] = await Promise.all([
    supabase
      .from(cfg.tabla)
      .select(`id, id_operacion, cuenta_devengo_forma_pago_id, ${cfg.columnaMovido}`)
      .eq('empresa_id', empresaId)
      .not('cuenta_devengo_forma_pago_id', 'is', null),
    supabase.from(cfg.tablaLineas).select('id_operacion').eq('empresa_id', empresaId),
  ]);

  if (errorTodas) throw errorTodas;
  if (errorLineas) throw errorLineas;

  const filasTodas = (todas ?? []) as unknown as Array<Record<string, unknown>>;
  const idsCuentas = Array.from(new Set(filasTodas.map((f) => f.cuenta_devengo_forma_pago_id as string)));
  const { data: formas, error: errorFormas } = await supabase.from('formas_pago').select('id, nombre').in('id', idsCuentas);
  if (errorFormas) throw errorFormas;

  const nombrePorId = new Map((formas ?? []).map((f) => [f.id as string, f.nombre as string]));
  const nombres = Array.from(new Set(nombrePorId.values()));
  if (nombres.length === 0) return 0;

  const movidoPorCuenta = new Map<string, number>();
  for (const f of filasTodas) {
    const cuenta = nombrePorId.get(f.cuenta_devengo_forma_pago_id as string);
    if (!cuenta) continue;
    movidoPorCuenta.set(cuenta, (movidoPorCuenta.get(cuenta) ?? 0) + Number(f[cfg.columnaMovido] ?? 0));
  }

  const { data: libro, error: errorLibro } = await supabase
    .from('registro_operaciones')
    .select(`id_operacion, fecha, total, ${cfg.columnaCuenta}`)
    .eq('empresa_id', empresaId)
    .eq('operacion', cfg.operacion)
    .in(cfg.columnaCuenta, nombres);

  if (errorLibro) throw errorLibro;

  const asociadas = new Set<string>([
    ...(lineas ?? []).map((l) => l.id_operacion as string),
    ...filasTodas.map((f) => f.id_operacion as string | null).filter((x): x is string => !!x),
  ]);

  const totalLibroPorCuenta = new Map<string, number>();
  const movimientos: MovimientoLibro[] = [];

  for (const op of (libro ?? []) as unknown as Array<Record<string, unknown>>) {
    const cuenta = op[cfg.columnaCuenta] as string;
    const monto = Number(op.total);
    totalLibroPorCuenta.set(cuenta, (totalLibroPorCuenta.get(cuenta) ?? 0) + monto);
    if (!asociadas.has(op.id_operacion as string)) {
      movimientos.push({ idOperacion: op.id_operacion as string, cuenta, fecha: op.fecha as string, monto });
    }
  }

  if (movimientos.length === 0) return 0;

  const filas: FilaDevengada[] = abiertos.map((p) => ({
    id: p.id,
    cuenta: nombrePorId.get(p.cuenta_devengo_forma_pago_id as string) ?? '',
    periodo: p.periodo as string,
    devengado: Number(p.monto_habitual),
    movido: Number((p as Record<string, unknown>)[lado === 'COBRAR' ? 'monto_cobrado' : 'monto_pagado'] ?? 0),
  }));

  const asignaciones = repartirMovimientos(filas, movimientos, movidoPorCuenta, totalLibroPorCuenta);

  // Se aplica de a una, actualizando el acumulado de cada mes, igual que haría
  // el botón Cobrar/Pagar con pagos parciales sucesivos.
  const porId = new Map(abiertos.map((p) => [p.id, { ...p }]));

  for (const a of asignaciones) {
    const recordatorio = porId.get(a.recordatorioId)!;

    if (lado === 'COBRAR') {
      const r = await registrarCobroParcial(empresaId, recordatorio as never, a.idOperacion, a.monto, a.fecha);
      (recordatorio as Record<string, unknown>).monto_cobrado = r.montoCobrado;
    } else {
      const r = await registrarPagoParcial(empresaId, recordatorio as never, a.idOperacion, a.monto, a.fecha);
      (recordatorio as Record<string, unknown>).monto_pagado = r.montoPagado;
    }
  }

  return asignaciones.length;
}

// Para llamar justo después de registrar una operación por cualquier camino:
// si fue un cobro/pago contra una cuenta a cobrar/pagar, queda asociado al mes al
// instante. Sin esperar y sin romper el registro si falla.
export function conciliarTrasRegistrar(empresaId: string): void {
  void Promise.all([conciliarCompromisos(empresaId, 'COBRAR'), conciliarCompromisos(empresaId, 'PAGAR')]).catch((e) =>
    console.warn('No se pudo conciliar tras registrar:', e)
  );
}

// Una sola corrida a la vez por empresa y lado (el lobby y la pantalla abierta
// pueden pedirla al mismo tiempo y duplicarían las asociaciones).
const enCurso = new Map<string, Promise<number>>();

export function conciliarCompromisos(empresaId: string, lado: Lado): Promise<number> {
  const clave = `${empresaId}|${lado}`;
  const previa = enCurso.get(clave);
  if (previa) return previa;

  const corrida = conciliarLado(empresaId, lado).finally(() => enCurso.delete(clave));
  enCurso.set(clave, corrida);
  return corrida;
}
