// lib/conciliacionCompromisosDatos.ts
//
// Concilia los meses devengados de ingresos/gastos recurrentes con el Libro
// Diario (ver conciliacionCompromisos.ts): un cobro/pago contra "X a cobrar" /
// "X a pagar" cargado por otro camino queda asociado al mes que corresponde.
// Reusa registrarCobroParcial / registrarPagoParcial, o sea la misma lógica
// que el botón Cobrar/Pagar; no toca el motor contable.

import { supabase } from './supabase';
import { repartirMovimientos, repartirMovimientosEnCuotas, type CuotaAbiertaConciliable, type FilaDevengada, type MovimientoLibro, type MovimientoLibreCuota } from './conciliacionCompromisos';
import { aplicarACuota } from './compromisosAbiertos';
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


const CONFIG_CUOTAS = {
  COBRAR: {
    tabla: 'cuotas_cobro',
    lineas: 'cuotas_cobro_cobros',
    movido: 'monto_cobrado',
    cumplida: 'cobrada',
    operacion: 'COBRO',
    // La cuenta de la deuda: la que origen y movimiento libre tocan del mismo lado.
    cuentaOrigen: 'cuenta_debito',
    cuentaMovimiento: 'cuenta_credito',
  },
  PAGAR: {
    tabla: 'cuotas_pasivo',
    lineas: 'cuotas_pasivo_pagos',
    movido: 'monto_pagado',
    cumplida: 'pagada',
    operacion: 'PAGO',
    cuentaOrigen: 'cuenta_credito',
    cuentaMovimiento: 'cuenta_debito',
  },
} as const;

// Un pago/cobro contra la cuenta de una deuda en cuotas, cargado por cualquier camino sin
// asociarlo a la cuota, se aplica solo a las cuotas abiertas (la que vence primero), como un
// pago parcial. Solo toma lo cargado después de que existiera la cuota.
async function conciliarCuotasLado(empresaId: string, lado: Lado): Promise<number> {
  const cfg = CONFIG_CUOTAS[lado];

  const { data: abiertas, error: errorAbiertas } = await supabase
    .from(cfg.tabla)
    .select(`id, id_operacion, monto, ${cfg.movido}, fecha_vencimiento, created_at`)
    .eq('empresa_id', empresaId)
    .eq(cfg.cumplida, false);

  if (errorAbiertas) throw errorAbiertas;

  const filasAbiertas = (abiertas ?? []) as unknown as Array<Record<string, unknown>>;
  if (filasAbiertas.length === 0) return 0;

  const idsOrigen = Array.from(new Set(filasAbiertas.map((c) => c.id_operacion as string)));
  const { data: origenes, error: errorOrigenes } = await supabase
    .from('registro_operaciones')
    .select(`id_operacion, ${cfg.cuentaOrigen}`)
    .eq('empresa_id', empresaId)
    .in('id_operacion', idsOrigen);

  if (errorOrigenes) throw errorOrigenes;

  const cuentaPorOperacion = new Map(
    ((origenes ?? []) as unknown as Array<Record<string, string>>).map((o) => [o.id_operacion, o[cfg.cuentaOrigen]])
  );

  const cuotas: CuotaAbiertaConciliable[] = filasAbiertas
    .filter((c) => cuentaPorOperacion.get(c.id_operacion as string))
    .map((c) => ({
      id: c.id as string,
      cuenta: cuentaPorOperacion.get(c.id_operacion as string)!,
      vencimiento: c.fecha_vencimiento as string,
      creadaEn: c.created_at as string,
      saldo: Math.max(0, Number(c.monto) - Number(c[cfg.movido] ?? 0)),
    }));

  const cuentas = Array.from(new Set(cuotas.map((c) => c.cuenta)));
  if (cuentas.length === 0) return 0;

  const desde = cuotas.map((c) => c.creadaEn).sort()[0];

  const { data: libro, error: errorLibro } = await supabase
    .from('registro_operaciones')
    .select(`id_operacion, fecha, total, creado_en, ${cfg.cuentaMovimiento}`)
    .eq('empresa_id', empresaId)
    .eq('operacion', cfg.operacion)
    .neq('estado', 'ANULADO')
    .gte('creado_en', desde)
    .in(cfg.cuentaMovimiento, cuentas);

  if (errorLibro) throw errorLibro;
  if ((libro ?? []).length === 0) return 0;

  // Lo ya asociado a algo (cuotas, recordatorios recurrentes, devengos) no se vuelve a aplicar.
  const lineasRecurrentes = lado === 'PAGAR' ? CONFIG.PAGAR : CONFIG.COBRAR;
  const [propias, recurrentes, devengos] = await Promise.all([
    supabase.from(cfg.lineas).select('id_operacion').eq('empresa_id', empresaId),
    supabase.from(lineasRecurrentes.tablaLineas).select('id_operacion').eq('empresa_id', empresaId),
    supabase.from(lineasRecurrentes.tabla).select('id_operacion').eq('empresa_id', empresaId).not('id_operacion', 'is', null),
  ]);

  for (const r of [propias, recurrentes, devengos]) if (r.error) throw r.error;

  const asociadas = new Set<string>(
    [...(propias.data ?? []), ...(recurrentes.data ?? []), ...(devengos.data ?? [])].map((f) => (f as { id_operacion: string }).id_operacion)
  );

  const movimientos: MovimientoLibreCuota[] = (libro as unknown as Array<Record<string, unknown>>)
    .filter((op) => !asociadas.has(op.id_operacion as string))
    .map((op) => ({
      idOperacion: op.id_operacion as string,
      cuenta: op[cfg.cuentaMovimiento] as string,
      fecha: op.fecha as string,
      creadoEn: op.creado_en as string,
      monto: Number(op.total),
    }));

  const asignaciones = repartirMovimientosEnCuotas(cuotas, movimientos);

  for (const a of asignaciones) {
    await aplicarACuota(empresaId, { recordatorioId: a.recordatorioId, lado }, a.idOperacion, a.monto, a.fecha);
  }

  return asignaciones.length;
}

// Para llamar justo después de registrar una operación por cualquier camino:
// si fue un cobro/pago contra una cuenta a cobrar/pagar, queda asociado al mes al
// instante. Sin esperar y sin romper el registro si falla.
export function conciliarTrasRegistrar(empresaId: string): void {
  // Primero los recurrentes y recién después las cuotas, para que un mismo pago no se aplique a las dos cosas.
  void Promise.all([conciliarCompromisos(empresaId, 'COBRAR'), conciliarCompromisos(empresaId, 'PAGAR')])
    .then(() => Promise.all([conciliarCuotas(empresaId, 'COBRAR'), conciliarCuotas(empresaId, 'PAGAR')]))
    .catch((e) => console.warn('No se pudo conciliar tras registrar:', e));
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

export function conciliarCuotas(empresaId: string, lado: Lado): Promise<number> {
  const clave = `cuotas|${empresaId}|${lado}`;
  const previa = enCurso.get(clave);
  if (previa) return previa;

  const corrida = conciliarCuotasLado(empresaId, lado).finally(() => enCurso.delete(clave));
  enCurso.set(clave, corrida);
  return corrida;
}
