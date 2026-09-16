// lib/cuotas.ts
//
// CUOTAS DE UN PASIVO (Compra/Pago a crédito en cuotas)
// =====================================================
//
// El asiento contable de la compra/pago no cambia: se sigue
// registrando completo, en su fecha, contra el Pasivo elegido (eso ya
// es correcto — el gasto se devenga cuando se compra, no cuando se
// paga cada cuota). Las cuotas son una capa aparte, de seguimiento y
// recordatorio: por cada una se guarda su vencimiento y se crea un
// evento en el Calendário Organizador del lobby (categoría
// Financeiro) para que el cliente lo vea y reciba el aviso — no se
// inventa un sistema de notificación nuevo, se reusa el que ya existe
// para eventos.

import { supabase } from './supabase';

export type CuotaPasivo = {
  id: string;
  id_operacion: string;
  forma_pago_nombre: string;
  numero_cuota: number;
  total_cuotas: number;
  monto: number;
  fecha_vencimiento: string;
  pagada: boolean;
  fecha_pago: string | null;
};

function esPT(idioma: string | null | undefined) {
  return idioma === 'PT';
}

// Suma N meses a una fecha 'YYYY-MM-DD' — si el mes de destino no
// tiene ese día (ej. 31 de un mes que termina antes), lo clampea al
// último día real de ese mes en vez de "desbordar" al mes siguiente
// (comportamiento por defecto de Date).
function sumarMeses(fechaIso: string, meses: number): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + meses, dia);

  if (fecha.getDate() !== dia) {
    fecha.setDate(0);
  }

  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

// Reparte el total en N cuotas de a centavos — la primera se lleva el
// redondeo, así la suma de todas cierra exacto con el total original.
function repartirEnCuotas(total: number, cantidadCuotas: number): number[] {
  const base = Math.floor((total / cantidadCuotas) * 100) / 100;
  const montos = new Array(cantidadCuotas).fill(base);
  const diferencia = Math.round((total - base * cantidadCuotas) * 100) / 100;
  montos[0] = Math.round((montos[0] + diferencia) * 100) / 100;
  return montos;
}

export async function crearCuotasPasivo(
  empresaId: string,
  idioma: string | null | undefined,
  datos: {
    idOperacion: string;
    formaPagoNombre: string;
    total: number;
    cantidadCuotas: number;
    fechaCompra: string;
  }
) {
  const { idOperacion, formaPagoNombre, total, cantidadCuotas, fechaCompra } = datos;

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
    // vencería al mes siguiente) sino una deuda pendiente sin
    // fraccionar — ya está pendiente desde la fecha de la compra, no
    // hay que esperar un mes para que aparezca como vencida.
    const fechaVencimiento = cantidadCuotas === 1 ? fechaCompra : sumarMeses(fechaCompra, numeroCuota);

    const titulo = esPT(idioma)
      ? `Parcela ${numeroCuota}/${cantidadCuotas} — ${formaPagoNombre}`
      : `Cuota ${numeroCuota}/${cantidadCuotas} — ${formaPagoNombre}`;

    const { data: evento, error: errorEvento } = await supabase
      .from('eventos_calendario')
      .insert({
        empresa_id: empresaId,
        creado_por: creadoPor,
        titulo,
        categoria: 'FINANCEIRO',
        fecha: fechaVencimiento,
        // El cron que manda el push (/api/calendario/verificar-
        // recordatorios) ignora los eventos sin "hora" — sin esto el
        // aviso quedaba armado pero nunca se enviaba.
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
      pagada: false,
      evento_calendario_id: evento.id,
    });
  }

  const { error: errorCuotas } = await supabase.from('cuotas_pasivo').insert(filas);

  if (errorCuotas) {
    throw errorCuotas;
  }
}

export async function listarCuotasPendientes(empresaId: string): Promise<CuotaPasivo[]> {
  const { data, error } = await supabase
    .from('cuotas_pasivo')
    .select('id, id_operacion, forma_pago_nombre, numero_cuota, total_cuotas, monto, fecha_vencimiento, pagada, fecha_pago')
    .eq('empresa_id', empresaId)
    .eq('pagada', false)
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CuotaPasivo[];
}

export async function listarTodasLasCuotas(empresaId: string): Promise<CuotaPasivo[]> {
  const { data, error } = await supabase
    .from('cuotas_pasivo')
    .select('id, id_operacion, forma_pago_nombre, numero_cuota, total_cuotas, monto, fecha_vencimiento, pagada, fecha_pago')
    .eq('empresa_id', empresaId)
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CuotaPasivo[];
}

// Marcar una cuota como pagada borra su recordatorio del Calendário
// (ya cumplió la función) — si se destilda por error, no se recrea
// solo, el usuario puede cargarlo de nuevo a mano si hace falta.
export async function marcarCuotaPagada(cuotaId: string, pagada: boolean) {
  const { data: cuota, error: errorCuota } = await supabase
    .from('cuotas_pasivo')
    .select('evento_calendario_id')
    .eq('id', cuotaId)
    .single();

  if (errorCuota) {
    throw errorCuota;
  }

  const { error } = await supabase
    .from('cuotas_pasivo')
    .update({
      pagada,
      fecha_pago: pagada ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', cuotaId);

  if (error) {
    throw error;
  }

  if (pagada && cuota.evento_calendario_id) {
    await supabase.from('eventos_calendario').delete().eq('id', cuota.evento_calendario_id);
  }
}
