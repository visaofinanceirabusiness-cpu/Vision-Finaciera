// lib/suscripcion.ts
//
// Control de la suscripción (30 días corridos por período, control de
// pago manual — todavía no hay integración con webhooks de InfinitePay
// ni Naranja X). Por ahora esto NO bloquea el acceso: solo informa.

import { supabase } from './supabase';

export const DIAS_POR_PERIODO = 30;

export type EstadoSuscripcion = 'AL_DIA' | 'POR_VENCER' | 'VENCIDA';

export type ResumenSuscripcion = {
  fechaVencimiento: string; // YYYY-MM-DD
  diasRestantes: number; // negativo si ya venció
  estado: EstadoSuscripcion;
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function diferenciaEnDias(fechaA: string, fechaB: string): number {
  const msPorDia = 1000 * 60 * 60 * 24;
  const a = new Date(`${fechaA}T00:00:00Z`).getTime();
  const b = new Date(`${fechaB}T00:00:00Z`).getTime();
  return Math.round((a - b) / msPorDia);
}

export function resumirSuscripcion(fechaVencimiento: string): ResumenSuscripcion {
  const diasRestantes = diferenciaEnDias(fechaVencimiento, hoyISO());

  const estado: EstadoSuscripcion =
    diasRestantes < 0 ? 'VENCIDA' : diasRestantes <= 7 ? 'POR_VENCER' : 'AL_DIA';

  return { fechaVencimiento, diasRestantes, estado };
}

// ---------------------------------------------------------
// MARCAR PAGO RECIBIDO (control manual, hecho por un admin)
//
// Si todavía no venció: se suman 30 días a la fecha de vencimiento
// actual (así un pago adelantado no "pierde" los días que ya tenía
// pagos, se acumulan).
// Si ya venció: se reinicia — 30 días a partir de hoy — pero se deja
// grabado cuántos días estuvo vencida (para tener el dato, aunque hoy
// no bloqueemos nada).
// ---------------------------------------------------------

export async function marcarPagoRecibido(
  empresaId: string,
  opciones: { medio?: string; monto?: number | null; nota?: string } = {}
) {
  const { data: empresa, error: errorEmpresa } = await supabase
    .from('empresas')
    .select('fecha_vencimiento_suscripcion')
    .eq('id', empresaId)
    .single();

  if (errorEmpresa || !empresa) {
    throw new Error(errorEmpresa?.message ?? 'No se pudo leer la empresa.');
  }

  const hoy = hoyISO();
  const vencimientoAnterior = empresa.fecha_vencimiento_suscripcion as string;
  const diasVencido = Math.max(0, diferenciaEnDias(hoy, vencimientoAnterior));

  const baseParaSumar = diasVencido > 0 ? hoy : vencimientoAnterior;
  const fechaVencimientoNueva = sumarDias(baseParaSumar, DIAS_POR_PERIODO);

  const { error: errorUpdate } = await supabase
    .from('empresas')
    .update({ fecha_vencimiento_suscripcion: fechaVencimientoNueva })
    .eq('id', empresaId);

  if (errorUpdate) {
    throw new Error(errorUpdate.message);
  }

  const { error: errorInsert } = await supabase.from('pagos_suscripcion').insert({
    empresa_id: empresaId,
    fecha: hoy,
    medio: opciones.medio ?? null,
    monto: opciones.monto ?? null,
    dias_vencido_al_registrar: diasVencido,
    fecha_vencimiento_anterior: vencimientoAnterior,
    fecha_vencimiento_nueva: fechaVencimientoNueva,
    nota: opciones.nota ?? null,
  });

  if (errorInsert) {
    throw new Error(errorInsert.message);
  }

  return { fechaVencimientoAnterior: vencimientoAnterior, fechaVencimientoNueva, diasVencido };
}

// ---------------------------------------------------------
// SOLO PARA TESTS — retrasa la fecha de vencimiento para poder
// probar el estado "por vencer"/"vencida" sin esperar 30 días.
// No graba nada en el historial de pagos.
// ---------------------------------------------------------

export async function restarDiasDeTest(empresaId: string, dias: number) {
  const { data: empresa, error: errorEmpresa } = await supabase
    .from('empresas')
    .select('fecha_vencimiento_suscripcion')
    .eq('id', empresaId)
    .single();

  if (errorEmpresa || !empresa) {
    throw new Error(errorEmpresa?.message ?? 'No se pudo leer la empresa.');
  }

  const nuevaFecha = sumarDias(empresa.fecha_vencimiento_suscripcion as string, -dias);

  const { error } = await supabase
    .from('empresas')
    .update({ fecha_vencimiento_suscripcion: nuevaFecha })
    .eq('id', empresaId);

  if (error) {
    throw new Error(error.message);
  }

  return nuevaFecha;
}

function sumarDias(fechaISO: string, dias: number): string {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}
