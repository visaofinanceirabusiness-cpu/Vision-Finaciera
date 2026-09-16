// lib/cuotasCobro.ts
//
// CUOTAS DE UNA CUENTA POR COBRAR (Venta/Cobro a crédito en cuotas)
// =====================================================
//
// Espejo exacto de lib/cuotas.ts, del lado del cobro: el asiento
// contable de la venta/cobro no cambia, se sigue registrando
// completo, en su fecha, contra la Cuenta por Cobrar elegida (el
// ingreso se devenga cuando se vende, no cuando se cobra cada cuota).
// Las cuotas son una capa aparte, de seguimiento y recordatorio.

import { supabase } from './supabase';

export type CuotaCobro = {
  id: string;
  id_operacion: string;
  forma_pago_nombre: string;
  numero_cuota: number;
  total_cuotas: number;
  monto: number;
  fecha_vencimiento: string;
  cobrada: boolean;
  fecha_cobro: string | null;
};

function esPT(idioma: string | null | undefined) {
  return idioma === 'PT';
}

function sumarMeses(fechaIso: string, meses: number): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + meses, dia);

  if (fecha.getDate() !== dia) {
    fecha.setDate(0);
  }

  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function repartirEnCuotas(total: number, cantidadCuotas: number): number[] {
  const base = Math.floor((total / cantidadCuotas) * 100) / 100;
  const montos = new Array(cantidadCuotas).fill(base);
  const diferencia = Math.round((total - base * cantidadCuotas) * 100) / 100;
  montos[0] = Math.round((montos[0] + diferencia) * 100) / 100;
  return montos;
}

export async function crearCuotasCobro(
  empresaId: string,
  idioma: string | null | undefined,
  datos: {
    idOperacion: string;
    formaPagoNombre: string;
    total: number;
    cantidadCuotas: number;
    fechaVenta: string;
  }
) {
  const { idOperacion, formaPagoNombre, total, cantidadCuotas, fechaVenta } = datos;

  if (!Number.isInteger(cantidadCuotas) || cantidadCuotas < 1) {
    throw new Error(
      esPT(idioma) ? 'A quantidade de parcelas tem que ser 1 ou mais.' : 'La cantidad de cuotas tiene que ser 1 o más.'
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const creadoPor = userData.user?.id ?? null;

  const montos = repartirEnCuotas(total, cantidadCuotas);
  const filas: Record<string, unknown>[] = [];

  for (let i = 0; i < cantidadCuotas; i++) {
    const numeroCuota = i + 1;
    // Con 1 sola cuota no es un plan de cuotas real (que recién
    // vencería al mes siguiente) sino un cobro pendiente sin
    // fraccionar — ya está pendiente desde la fecha de la venta, no
    // hay que esperar un mes para que aparezca como vencido.
    const fechaVencimiento = cantidadCuotas === 1 ? fechaVenta : sumarMeses(fechaVenta, numeroCuota);

    const titulo = esPT(idioma)
      ? `Receber ${numeroCuota}/${cantidadCuotas} — ${formaPagoNombre}`
      : `Cobrar ${numeroCuota}/${cantidadCuotas} — ${formaPagoNombre}`;

    const { data: evento, error: errorEvento } = await supabase
      .from('eventos_calendario')
      .insert({
        empresa_id: empresaId,
        creado_por: creadoPor,
        titulo,
        categoria: 'FINANCEIRO',
        fecha: fechaVencimiento,
        hora: '09:00:00',
        notas: null,
        notificar: true,
        antelacion_minutos: 1440,
      })
      .select('id')
      .single();

    if (errorEvento) {
      throw errorEvento;
    }

    filas.push({
      empresa_id: empresaId,
      id_operacion: idOperacion,
      forma_pago_nombre: formaPagoNombre,
      numero_cuota: numeroCuota,
      total_cuotas: cantidadCuotas,
      monto: montos[i],
      fecha_vencimiento: fechaVencimiento,
      cobrada: false,
      evento_calendario_id: evento.id,
    });
  }

  const { error: errorCuotas } = await supabase.from('cuotas_cobro').insert(filas);

  if (errorCuotas) {
    throw errorCuotas;
  }
}

export async function listarCuotasCobroPendientes(empresaId: string): Promise<CuotaCobro[]> {
  const { data, error } = await supabase
    .from('cuotas_cobro')
    .select('id, id_operacion, forma_pago_nombre, numero_cuota, total_cuotas, monto, fecha_vencimiento, cobrada, fecha_cobro')
    .eq('empresa_id', empresaId)
    .eq('cobrada', false)
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CuotaCobro[];
}

export async function listarTodasLasCuotasCobro(empresaId: string): Promise<CuotaCobro[]> {
  const { data, error } = await supabase
    .from('cuotas_cobro')
    .select('id, id_operacion, forma_pago_nombre, numero_cuota, total_cuotas, monto, fecha_vencimiento, cobrada, fecha_cobro')
    .eq('empresa_id', empresaId)
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CuotaCobro[];
}

// Marcar una cuota como cobrada borra su recordatorio del Calendário
// (ya cumplió la función) — si se destilda por error, no se recrea
// solo, el usuario puede cargarlo de nuevo a mano si hace falta.
export async function marcarCuotaCobrada(cuotaId: string, cobrada: boolean) {
  const { data: cuota, error: errorCuota } = await supabase
    .from('cuotas_cobro')
    .select('evento_calendario_id')
    .eq('id', cuotaId)
    .single();

  if (errorCuota) {
    throw errorCuota;
  }

  const { error } = await supabase
    .from('cuotas_cobro')
    .update({
      cobrada,
      fecha_cobro: cobrada ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', cuotaId);

  if (error) {
    throw error;
  }

  if (cobrada && cuota.evento_calendario_id) {
    await supabase.from('eventos_calendario').delete().eq('id', cuota.evento_calendario_id);
  }
}
