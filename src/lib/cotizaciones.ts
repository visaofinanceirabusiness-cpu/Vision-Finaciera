// lib/cotizaciones.ts
//
// COTIZACIONES USD/ARS/BRL — dato compartido de referencia (no
// pertenece a ninguna empresa puntual), actualizado una vez por día
// por el cron /api/cotizaciones/actualizar. Acá solo vive la LECTURA
// (para el panel); la escritura vive en ese endpoint, con
// service_role.

import { supabase } from './supabase';

export type ParCotizacion = 'USD_BRL' | 'ARS_BRL' | 'USD_ARS';

export type CotizacionActual = {
  par: ParCotizacion;
  fecha: string;
  valor: number;
  valorAnterior: number | null;
  variacionPorcentual: number | null;
};

export type PuntoCotizacion = {
  fecha: string;
  valor: number;
};

// En la base se guarda "cuántos BRL vale 1 ARS" (ARS_BRL, ~0,003 —
// así sale de cruzar USD/ARS con USD/BRL), pero para leer un cliente
// entiende mejor "cuántos pesos ARS vale 1 Real" (~310) — se invierte
// acá, solo para mostrar, sin tocar lo que guarda el cron.
function invertirSiCorresponde(par: ParCotizacion, valor: number): number {
  return par === 'ARS_BRL' ? 1 / valor : valor;
}

// Últimas dos cotizaciones de cada par (hoy — o la más reciente que
// haya, si el cron todavía no corrió — y la anterior, para calcular
// la variación del día).
export async function obtenerCotizacionesActuales(): Promise<CotizacionActual[]> {
  const pares: ParCotizacion[] = ['USD_BRL', 'ARS_BRL', 'USD_ARS'];

  const resultados = await Promise.all(
    pares.map(async (par) => {
      const { data, error } = await supabase
        .from('cotizaciones_moneda')
        .select('fecha, valor')
        .eq('par', par)
        .order('fecha', { ascending: false })
        .limit(2);

      if (error) {
        throw error;
      }

      const [actual, anterior] = data ?? [];

      if (!actual) {
        return null;
      }

      const valor = invertirSiCorresponde(par, Number(actual.valor));
      const valorAnterior = anterior ? invertirSiCorresponde(par, Number(anterior.valor)) : null;

      return {
        par,
        fecha: actual.fecha,
        valor,
        valorAnterior,
        variacionPorcentual: valorAnterior ? ((valor - valorAnterior) / valorAnterior) * 100 : null,
      };
    })
  );

  return resultados.filter((r): r is CotizacionActual => r !== null);
}

// Historial para el gráfico de evolución. "dia" trae los últimos N
// días tal cual (una cotización por día). "mes" agrupa por mes y se
// queda con el último valor de cada uno (cotización de cierre).
export async function obtenerHistorialCotizacion(
  par: ParCotizacion,
  granularidad: 'dia' | 'mes',
  cantidad: number
): Promise<PuntoCotizacion[]> {
  const limiteFilas = granularidad === 'dia' ? cantidad : cantidad * 31;

  const { data, error } = await supabase
    .from('cotizaciones_moneda')
    .select('fecha, valor')
    .eq('par', par)
    .order('fecha', { ascending: false })
    .limit(limiteFilas);

  if (error) {
    throw error;
  }

  const filas = (data ?? []).map((f) => ({ fecha: f.fecha as string, valor: invertirSiCorresponde(par, Number(f.valor)) }));

  if (granularidad === 'dia') {
    return filas.slice(0, cantidad).reverse();
  }

  // Agrupa por "YYYY-MM" y se queda con la fila de fecha más alta
  // (el cierre) de cada mes — filas ya vienen ordenadas desc, así que
  // la primera que aparece para cada mes es la más reciente de ese mes.
  const porMes = new Map<string, PuntoCotizacion>();
  for (const fila of filas) {
    const clave = fila.fecha.slice(0, 7);
    if (!porMes.has(clave)) {
      porMes.set(clave, fila);
    }
  }

  return Array.from(porMes.values())
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-cantidad);
}
