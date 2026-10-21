// lib/compromisosAbiertos.ts
//
// Además de los recurrentes, entran las cuotas pendientes de pasivos (tarjeta,
// préstamo, proveedores) y de cuentas a cobrar (clientes) vencidas o de este mes:
// se pagan/cobran contra la categoría de liquidación de su cuenta y, como la cuota
// no tiene medio de pago propio, ese medio lo elige la persona. Aceptan pagos
// parciales: la cuota sigue pendiente por el saldo hasta completar el total.
//
// Lo que el negocio tiene para cobrar o pagar este mes a partir de ingresos y
// gastos recurrentes, visto desde los métodos de carga (Mini-Juego, Sabio Bot,
// Central y Lanzamiento Rápido):
//   - devengado: ya está en "X a cobrar" / "X a pagar". Cargarlo como ingreso o
//     gasto directo lo contaría dos veces, así que se ofrece contra la cuenta del
//     compromiso (categoría de liquidación); la conciliación lo asocia sola.
//   - simple (sin devengo): es solo un recordatorio. Se carga con su propia
//     categoría y, como nada lo asocia solo, el método de carga lo cierra con
//     cerrarPendienteConOperacion al grabar.

import {
  listarRecordatoriosIngresosPendientes,
  obtenerRecordatorioIngreso,
  registrarCobroParcial,
  saldoPendienteCobro,
} from './ingresosRecurrentes';
import {
  listarRecordatoriosPendientes,
  obtenerRecordatorio,
  registrarPagoParcial,
  saldoPendiente,
} from './gastosRecurrentes';
import { buscarCuentaCompromisoPorNombre, resolverCuentaCompromiso } from './cuentasCompromiso';
import { listarCuotasPendientes, saldoCuotaPasivo } from './cuotas';
import { listarCuotasCobroPendientes, saldoCuotaCobro } from './cuotasCobro';
import { fechaLocalHoy } from './fecha';
import { supabase } from './supabase';

export type CompromisoAbierto = {
  recordatorioId: string;
  nombre: string;
  saldo: number;
  // Categoría con la que se carga el COBRO/PAGO: la de liquidación si está devengado,
  // la propia del recordatorio si no.
  categoriaLiquidacion: string;
  cuenta: string;
  lado: 'COBRAR' | 'PAGAR';
  devengado: boolean;
  // Vacío en las cuotas: el medio lo elige la persona al cargar.
  formaPago: string;
  fechaVencimiento: string;
  tipo: 'RECORDATORIO' | 'CUOTA';
};

export function estaVencido(fechaVencimiento: string): boolean {
  return fechaVencimiento < fechaLocalHoy();
}

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// 'YYYY-MM-DD' → "oct 2026": el periodo al que pertenece el vencimiento.
export function etiquetaPeriodo(fechaVencimiento: string, idioma: string): string {
  const [anio, mes] = fechaVencimiento.split('-').map(Number);
  return `${(idioma === 'PT' ? MESES_PT : MESES_ES)[mes - 1]} ${anio}`;
}

type Pendiente = {
  id: string;
  nombre: string;
  categoria: string;
  formaPago: string;
  estado: string | null;
  saldo: number;
  cuentaId: string | null;
  fechaVencimiento: string;
};

async function listarPendientes(empresaId: string, lado: 'COBRAR' | 'PAGAR'): Promise<Pendiente[]> {
  if (lado === 'COBRAR') {
    return (await listarRecordatoriosIngresosPendientes(empresaId)).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      categoria: r.categoria,
      formaPago: r.forma_pago,
      estado: r.estado,
      saldo: saldoPendienteCobro(r),
      cuentaId: r.cuenta_devengo_forma_pago_id,
      fechaVencimiento: r.fecha_vencimiento,
    }));
  }

  return (await listarRecordatoriosPendientes(empresaId)).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    categoria: r.categoria,
    formaPago: r.forma_pago,
    estado: r.estado,
    saldo: saldoPendiente(r),
    cuentaId: r.cuenta_devengo_forma_pago_id,
    fechaVencimiento: r.fecha_vencimiento,
  }));
}

async function armarCompromisos(empresaId: string, lado: 'COBRAR' | 'PAGAR', categoria?: string): Promise<CompromisoAbierto[]> {
  const pendientes = (await listarPendientes(empresaId, lado)).filter(
    (p) => p.saldo > 0.01 && (categoria === undefined || p.categoria === categoria)
  );

  const resultado: CompromisoAbierto[] = [];

  for (const p of pendientes) {
    const base = { recordatorioId: p.id, nombre: p.nombre, saldo: p.saldo, lado, formaPago: p.formaPago, fechaVencimiento: p.fechaVencimiento, tipo: 'RECORDATORIO' as const };

    if (p.estado === 'DEVENGADA') {
      if (!p.cuentaId) continue;

      try {
        const cuenta = await resolverCuentaCompromiso(p.cuentaId, lado);
        resultado.push({ ...base, categoriaLiquidacion: cuenta.categoriaLiquidacion, cuenta: cuenta.cuentaNombre, devengado: true });
      } catch {
        // Sin cuenta resoluble no hay a dónde redirigir: no se ofrece.
      }
    } else if (p.estado === null) {
      resultado.push({ ...base, categoriaLiquidacion: p.categoria, cuenta: '', devengado: false });
    }
  }

  return [...resultado, ...(await armarCuotas(empresaId, lado, categoria).catch(() => []))];
}

function finDeMesActual(): string {
  const hoy = new Date();
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, '0')}-${String(ultimo.getDate()).padStart(2, '0')}`;
}

async function armarCuotas(empresaId: string, lado: 'COBRAR' | 'PAGAR', categoria?: string): Promise<CompromisoAbierto[]> {
  const hasta = finDeMesActual();

  const cuotas: Array<{ id: string; formaPagoNombre: string; numero: number; total: number; saldo: number; fecha: string }> =
    lado === 'COBRAR'
      ? (await listarCuotasCobroPendientes(empresaId)).map((c) => ({
          id: c.id, formaPagoNombre: c.forma_pago_nombre, numero: c.numero_cuota, total: c.total_cuotas, saldo: saldoCuotaCobro(c), fecha: c.fecha_vencimiento,
        }))
      : (await listarCuotasPendientes(empresaId)).map((c) => ({
          id: c.id, formaPagoNombre: c.forma_pago_nombre, numero: c.numero_cuota, total: c.total_cuotas, saldo: saldoCuotaPasivo(c), fecha: c.fecha_vencimiento,
        }));

  // Vencidas de cualquier mes y las de este mes; las futuras todavía no corren.
  const aplicables = cuotas.filter((c) => c.saldo > 0.01 && c.fecha <= hasta);
  if (aplicables.length === 0) return [];

  const { data: empresa } = await supabase.from('empresas').select('idioma').eq('id', empresaId).maybeSingle();
  const palabra = empresa?.idioma === 'PT' ? 'Parcela' : 'Cuota';

  const cuentas = new Map<string, Awaited<ReturnType<typeof buscarCuentaCompromisoPorNombre>>>();
  for (const nombre of new Set(aplicables.map((c) => c.formaPagoNombre))) {
    cuentas.set(nombre, await buscarCuentaCompromisoPorNombre(empresaId, nombre, lado).catch(() => null));
  }

  const resultado: CompromisoAbierto[] = [];

  for (const c of aplicables) {
    const cuenta = cuentas.get(c.formaPagoNombre);
    if (!cuenta || (categoria !== undefined && cuenta.categoriaLiquidacion !== categoria)) continue;

    resultado.push({
      recordatorioId: c.id,
      nombre: `${palabra} ${c.numero}/${c.total} — ${c.formaPagoNombre}`,
      saldo: c.saldo,
      categoriaLiquidacion: cuenta.categoriaLiquidacion,
      cuenta: cuenta.cuentaNombre,
      lado,
      devengado: false,
      formaPago: '',
      fechaVencimiento: c.fecha,
      tipo: 'CUOTA',
    });
  }

  return resultado;
}

export async function compromisosAbiertosDeCategoria(
  empresaId: string,
  operacion: string,
  categoria: string
): Promise<CompromisoAbierto[]> {
  if (operacion !== 'COBRO' && operacion !== 'PAGO') return [];

  return armarCompromisos(empresaId, operacion === 'COBRO' ? 'COBRAR' : 'PAGAR', categoria);
}

// Todo lo pendiente del mes (cobros y pagos), lo más urgente primero.
export async function pendientesParaCargar(empresaId: string): Promise<CompromisoAbierto[]> {
  const [cobros, pagos] = await Promise.all([
    armarCompromisos(empresaId, 'COBRAR').catch(() => []),
    armarCompromisos(empresaId, 'PAGAR').catch(() => []),
  ]);

  return [...cobros, ...pagos].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
}

export function operacionDeCompromiso(item: Pick<CompromisoAbierto, 'lado'>): 'COBRO' | 'PAGO' {
  return item.lado === 'COBRAR' ? 'COBRO' : 'PAGO';
}

// Marca el recordatorio simple como cobrado/pagado con la operación recién grabada
// (no pasa por el motor: el asiento ya existe). Los devengados no hacen falta acá:
// los asocia conciliarTrasRegistrar.
export async function cerrarPendienteConOperacion(
  empresaId: string,
  item: Pick<CompromisoAbierto, 'recordatorioId' | 'lado' | 'devengado' | 'tipo'>,
  idOperacion: string,
  monto: number,
  fecha: string
): Promise<void> {
  if (item.devengado) return;

  try {
    if (item.tipo === 'CUOTA') {
      await aplicarACuota(empresaId, item, idOperacion, monto, fecha);
    } else if (item.lado === 'COBRAR') {
      const recordatorio = await obtenerRecordatorioIngreso(item.recordatorioId);
      if (recordatorio) await registrarCobroParcial(empresaId, recordatorio, idOperacion, monto, fecha);
    } else {
      const recordatorio = await obtenerRecordatorio(item.recordatorioId);
      if (recordatorio) await registrarPagoParcial(empresaId, recordatorio, idOperacion, monto, fecha);
    }
  } catch (error) {
    // La operación ya quedó grabada: no se la tira abajo por no poder cerrar el recordatorio.
    console.warn('No se pudo marcar el recordatorio como cumplido:', error);
  }
}

const TABLAS_CUOTA = {
  PAGAR: { tabla: 'cuotas_pasivo', lineas: 'cuotas_pasivo_pagos', movido: 'monto_pagado', cumplida: 'pagada', fechaCumplida: 'fecha_pago' },
  COBRAR: { tabla: 'cuotas_cobro', lineas: 'cuotas_cobro_cobros', movido: 'monto_cobrado', cumplida: 'cobrada', fechaCumplida: 'fecha_cobro' },
} as const;

// Un pago/cobro (total o parcial) contra una cuota: queda su línea y la cuota sigue
// pendiente por el saldo hasta que se completa el total. Lo que se pase del saldo
// no se aplica a otra cuota.
export async function aplicarACuota(
  empresaId: string,
  item: Pick<CompromisoAbierto, 'recordatorioId' | 'lado'>,
  idOperacion: string,
  monto: number,
  fecha: string
): Promise<void> {
  const cfg = TABLAS_CUOTA[item.lado];

  const { data: fila, error } = await supabase
    .from(cfg.tabla)
    .select(`monto, ${cfg.movido}, evento_calendario_id`)
    .eq('id', item.recordatorioId)
    .single();

  if (error) throw error;

  const registro = fila as unknown as Record<string, number | string | null>;
  const saldo = Math.max(0, Number(registro.monto) - Number(registro[cfg.movido] ?? 0));
  const aplicado = Math.min(Number(monto), saldo);
  if (aplicado <= 0) return;

  const { error: errorLinea } = await supabase.from(cfg.lineas).insert({
    cuota_id: item.recordatorioId,
    empresa_id: empresaId,
    id_operacion: idOperacion,
    monto: aplicado,
    fecha,
  });
  if (errorLinea) throw errorLinea;

  const nuevoMovido = Number(registro[cfg.movido] ?? 0) + aplicado;
  const cumplida = Number(registro.monto) - nuevoMovido <= 0.01;

  const { error: errorCuota } = await supabase
    .from(cfg.tabla)
    .update({ [cfg.movido]: nuevoMovido, [cfg.cumplida]: cumplida, [cfg.fechaCumplida]: cumplida ? fecha : null })
    .eq('id', item.recordatorioId);
  if (errorCuota) throw errorCuota;

  if (cumplida && registro.evento_calendario_id) {
    await supabase.from('eventos_calendario').delete().eq('id', registro.evento_calendario_id as string);
  }
}

const LADOS_REABRIR = [
  { tabla: 'gastos_recurrentes_recordatorios', lineas: 'gastos_recurrentes_recordatorios_pagos', movido: 'monto_pagado', fk: 'recordatorio_id', cumplida: 'registrado', fechaCumplida: null },
  { tabla: 'ingresos_recurrentes_recordatorios', lineas: 'ingresos_recurrentes_recordatorios_cobros', movido: 'monto_cobrado', fk: 'recordatorio_id', cumplida: 'registrado', fechaCumplida: null },
  { tabla: 'cuotas_pasivo', lineas: 'cuotas_pasivo_pagos', movido: 'monto_pagado', fk: 'cuota_id', cumplida: 'pagada', fechaCumplida: 'fecha_pago' },
  { tabla: 'cuotas_cobro', lineas: 'cuotas_cobro_cobros', movido: 'monto_cobrado', fk: 'cuota_id', cumplida: 'cobrada', fechaCumplida: 'fecha_cobro' },
] as const;

// Deshacer una operación (Lanzamiento Rápido) también tiene que devolver a
// pendiente el recordatorio que había quedado cumplido con ella; si no, el
// pago borrado seguiría figurando como hecho.
export async function reabrirPendientesDeOperacion(empresaId: string, idOperacion: string): Promise<void> {
  for (const lado of LADOS_REABRIR) {
    const { data: lineas } = await supabase
      .from(lado.lineas)
      .select(`id, ${lado.fk}, monto`)
      .eq('empresa_id', empresaId)
      .eq('id_operacion', idOperacion);

    for (const filaLinea of lineas ?? []) {
      const linea = filaLinea as unknown as Record<string, string | number>;
      const idPadre = linea[lado.fk] as string;

      const { data: fila } = await supabase
        .from(lado.tabla)
        .select(lado.fk === 'cuota_id' ? lado.movido : `${lado.movido}, estado`)
        .eq('id', idPadre)
        .maybeSingle();

      await supabase.from(lado.lineas).delete().eq('id', linea.id);

      if (!fila) continue;

      const registro = fila as unknown as Record<string, number | string | null>;
      const cambios: Record<string, unknown> = {
        [lado.movido]: Math.max(0, Number(registro[lado.movido] ?? 0) - Number(linea.monto)),
        [lado.cumplida]: false,
        ...(lado.fechaCumplida ? { [lado.fechaCumplida]: null } : {}),
      };
      if (registro.estado === 'SALDADA') cambios.estado = 'DEVENGADA';

      await supabase.from(lado.tabla).update(cambios).eq('id', idPadre);
    }
  }
}
