// lib/compromisosAbiertos.ts
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
import { resolverCuentaCompromiso } from './cuentasCompromiso';
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
  formaPago: string;
  fechaVencimiento: string;
};

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
    const base = { recordatorioId: p.id, nombre: p.nombre, saldo: p.saldo, lado, formaPago: p.formaPago, fechaVencimiento: p.fechaVencimiento };

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
  item: Pick<CompromisoAbierto, 'recordatorioId' | 'lado' | 'devengado'>,
  idOperacion: string,
  monto: number,
  fecha: string
): Promise<void> {
  if (item.devengado) return;

  try {
    if (item.lado === 'COBRAR') {
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

const LADOS_REABRIR = [
  { tabla: 'gastos_recurrentes_recordatorios', lineas: 'gastos_recurrentes_recordatorios_pagos', movido: 'monto_pagado' },
  { tabla: 'ingresos_recurrentes_recordatorios', lineas: 'ingresos_recurrentes_recordatorios_cobros', movido: 'monto_cobrado' },
] as const;

// Deshacer una operación (Lanzamiento Rápido) también tiene que devolver a
// pendiente el recordatorio que había quedado cumplido con ella; si no, el
// pago borrado seguiría figurando como hecho.
export async function reabrirPendientesDeOperacion(empresaId: string, idOperacion: string): Promise<void> {
  for (const lado of LADOS_REABRIR) {
    const { data: lineas } = await supabase
      .from(lado.lineas)
      .select('id, recordatorio_id, monto')
      .eq('empresa_id', empresaId)
      .eq('id_operacion', idOperacion);

    for (const linea of lineas ?? []) {
      const { data: fila } = await supabase
        .from(lado.tabla)
        .select(`${lado.movido}, estado`)
        .eq('id', linea.recordatorio_id)
        .maybeSingle();

      await supabase.from(lado.lineas).delete().eq('id', linea.id);

      if (!fila) continue;

      const registro = fila as unknown as Record<string, number | string | null>;
      const cambios: Record<string, unknown> = {
        [lado.movido]: Math.max(0, Number(registro[lado.movido] ?? 0) - Number(linea.monto)),
        registrado: false,
      };
      if (registro.estado === 'SALDADA') cambios.estado = 'DEVENGADA';

      await supabase.from(lado.tabla).update(cambios).eq('id', linea.recordatorio_id);
    }
  }
}
