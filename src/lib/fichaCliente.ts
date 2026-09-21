// lib/fichaCliente.ts
//
// FICHA DE CLIENTE (Panel Maestro) — dos capas complementarias para
// entender mejor a cada cliente, más allá de la operación técnica:
//
//   - CAPA A (cualitativa, la carga el admin a mano): descripción de
//     perfil + un historial de notas con fecha. Es el "por qué" y el
//     lado humano que ningún dato de uso captura solo.
//   - CAPA B (cuantitativa, se calcula sola de sus propios datos):
//     en qué categorías gasta más, qué forma de pago usa más, cuánto
//     movió el último mes y si su ritmo de uso viene subiendo o
//     bajando — no depende de que el admin cargue nada.

import { supabase } from './supabase';
import { fechaLocalHoy } from './fecha';

export type NotaCliente = {
  id: string;
  empresa_id: string;
  texto: string;
  creado_en: string;
};

export async function obtenerNotasCliente(empresaId: string): Promise<NotaCliente[]> {
  const { data, error } = await supabase
    .from('notas_cliente')
    .select('id, empresa_id, texto, creado_en')
    .eq('empresa_id', empresaId)
    .order('creado_en', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as NotaCliente[];
}

export async function agregarNotaCliente(empresaId: string, texto: string): Promise<void> {
  const textoLimpio = texto.trim();

  if (!textoLimpio) {
    throw new Error('La nota no puede estar vacía.');
  }

  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from('notas_cliente').insert({
    empresa_id: empresaId,
    texto: textoLimpio,
    creado_por: userData.user?.id ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function eliminarNotaCliente(notaId: string): Promise<void> {
  const { error } = await supabase.from('notas_cliente').delete().eq('id', notaId);

  if (error) {
    throw error;
  }
}

export async function actualizarDescripcionPerfil(empresaId: string, descripcion: string): Promise<void> {
  const { error } = await supabase
    .from('empresas')
    .update({ descripcion_perfil: descripcion.trim() || null })
    .eq('id', empresaId);

  if (error) {
    throw error;
  }
}

// ---------------------------------------------------------------
// CAPA B — perfil de uso, calculado de registro_operaciones
// ---------------------------------------------------------------

export type PerfilDeUso = {
  topCategorias: { nombre: string; total: number }[];
  formaPagoMasUsada: string | null;
  totalUltimoMes: number;
  operacionesUltimoMes: number;
  operacionesMesAnterior: number;
  tendencia: 'SUBIENDO' | 'BAJANDO' | 'ESTABLE' | 'SIN_DATOS';
};

function restarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(fechaIso);
  fecha.setDate(fecha.getDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

export async function obtenerPerfilDeUso(empresaId: string): Promise<PerfilDeUso> {
  const hoy = fechaLocalHoy();
  const hace30 = restarDias(hoy, 30);
  const hace60 = restarDias(hoy, 60);

  const { data, error } = await supabase
    .from('registro_operaciones')
    .select('fecha, categoria, forma_pago, total, operacion')
    .eq('empresa_id', empresaId)
    .gte('fecha', hace60);

  if (error) {
    throw error;
  }

  const filas = data ?? [];

  // Top categorías de GASTO/PAGO — las que más informan sobre en qué
  // se le va la plata al cliente (una categoría de Ingreso/Cobro no
  // dice mucho de "gustos y preferencias").
  const totalPorCategoria = new Map<string, number>();
  const conteoPorFormaPago = new Map<string, number>();

  for (const fila of filas) {
    if ((fila.operacion === 'PAGO' || fila.operacion === 'COMPRA') && fila.categoria) {
      totalPorCategoria.set(fila.categoria, (totalPorCategoria.get(fila.categoria) ?? 0) + Number(fila.total ?? 0));
    }

    if (fila.forma_pago) {
      conteoPorFormaPago.set(fila.forma_pago, (conteoPorFormaPago.get(fila.forma_pago) ?? 0) + 1);
    }
  }

  const topCategorias = Array.from(totalPorCategoria.entries())
    .map(([nombre, total]) => ({ nombre, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const formaPagoMasUsada =
    Array.from(conteoPorFormaPago.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const filasUltimoMes = filas.filter((f) => f.fecha >= hace30);
  const filasMesAnterior = filas.filter((f) => f.fecha < hace30 && f.fecha >= hace60);

  const totalUltimoMes = Math.round(filasUltimoMes.reduce((s, f) => s + Number(f.total ?? 0), 0) * 100) / 100;
  const operacionesUltimoMes = filasUltimoMes.length;
  const operacionesMesAnterior = filasMesAnterior.length;

  let tendencia: PerfilDeUso['tendencia'] = 'SIN_DATOS';

  if (operacionesUltimoMes === 0 && operacionesMesAnterior === 0) {
    tendencia = 'SIN_DATOS';
  } else if (operacionesMesAnterior === 0) {
    tendencia = operacionesUltimoMes > 0 ? 'SUBIENDO' : 'SIN_DATOS';
  } else {
    const variacion = (operacionesUltimoMes - operacionesMesAnterior) / operacionesMesAnterior;
    tendencia = variacion > 0.15 ? 'SUBIENDO' : variacion < -0.15 ? 'BAJANDO' : 'ESTABLE';
  }

  return {
    topCategorias,
    formaPagoMasUsada,
    totalUltimoMes,
    operacionesUltimoMes,
    operacionesMesAnterior,
    tendencia,
  };
}
