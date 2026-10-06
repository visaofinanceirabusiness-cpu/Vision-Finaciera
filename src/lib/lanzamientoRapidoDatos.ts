// lib/lanzamientoRapidoDatos.ts
//
// Acceso a datos de Lanzamiento rápido. Registrar y deshacer usan el mismo
// motor de siempre (registrarOperacion / eliminarOperacion): acá no hay
// lógica contable nueva.

import { supabase } from './supabase';
import { fechaLocalHoy } from './fecha';
import { registrarOperacion, eliminarOperacion } from './motor';
import { obtenerFormasPagoOperacion } from './formasPagoOperacion';
import { armarTop, combinarConFavoritas, type FavoritaRapida, type OperacionReciente, type TarjetaRapida } from './lanzamientoRapido';

const DIAS_VENTANA = 60;

function fechaHaceDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Todo lo que muestra la pantalla: favoritas primero y después el top
// automático (validado contra la matriz actual).
export async function cargarTarjetas(empresaId: string): Promise<TarjetaRapida[]> {
  const [{ data, error }, { data: favs, error: errorFavs }] = await Promise.all([
    supabase
      .from('registro_operaciones')
      .select('id_operacion, fecha, operacion, categoria, forma_pago, total, historico, cliente_proveedor, creado_en')
      .eq('empresa_id', empresaId)
      .gte('fecha', fechaHaceDias(DIAS_VENTANA)),
    supabase
      .from('operaciones_rapidas_fijadas')
      .select('operacion, categoria, forma_pago, historico, cliente_proveedor, valor_sugerido')
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: true }),
  ]);

  if (error) throw error;
  if (errorFavs) throw errorFavs;

  const filas = (data ?? []) as OperacionReciente[];
  const historial = new Map(armarTop(filas, 10000).map((t) => [t.clave, t]));

  // Con margen y validadas en paralelo: una categoría o medio que ya no existe
  // (o que hoy es una cuenta interna) no debe ofrecerse.
  const candidatas = armarTop(filas, 16);
  const medios = new Map<string, Set<string>>();

  await Promise.all(
    Array.from(new Set(candidatas.map((c) => `${c.operacion}|${c.categoria}`))).map(async (par) => {
      const [operacion, categoria] = par.split('|');
      medios.set(par, new Set(await obtenerFormasPagoOperacion(empresaId, operacion, categoria).catch(() => [])));
    })
  );

  const top = candidatas.filter((c) => medios.get(`${c.operacion}|${c.categoria}`)?.has(c.formaPago)).slice(0, 10);

  return combinarConFavoritas(top, historial, (favs ?? []) as FavoritaRapida[]);
}

export async function agregarFavorita(empresaId: string, fav: Omit<FavoritaRapida, 'valor_sugerido'> & { valor_sugerido?: number }): Promise<void> {
  const { error } = await supabase.from('operaciones_rapidas_fijadas').upsert(
    { empresa_id: empresaId, valor_sugerido: 0, ...fav },
    { onConflict: 'empresa_id,operacion,categoria,forma_pago' }
  );
  if (error) throw error;
}

export async function quitarFavorita(empresaId: string, t: Pick<TarjetaRapida, 'operacion' | 'categoria' | 'formaPago'>): Promise<void> {
  const { error } = await supabase
    .from('operaciones_rapidas_fijadas')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('operacion', t.operacion)
    .eq('categoria', t.categoria)
    .eq('forma_pago', t.formaPago);
  if (error) throw error;
}

// Caché en el navegador: la pantalla se pinta al instante con lo último que se
// vio y se actualiza por detrás (la carga real son muchas consultas).
const MINUTOS_FRESCO = 10;

function claveCache(empresaId: string): string {
  return `lanzamientoRapido:${empresaId}`;
}

export type MetaEmpresa = { moneda: string | null; idioma: string; esFamiliar: boolean };

export function leerCache(empresaId: string): { tarjetas: TarjetaRapida[]; meta: MetaEmpresa; fresco: boolean } | null {
  try {
    const crudo = window.localStorage.getItem(claveCache(empresaId));
    if (!crudo) return null;
    const { t, tarjetas, meta } = JSON.parse(crudo);
    if (!meta) return null;
    return { tarjetas, meta: meta as MetaEmpresa, fresco: Date.now() - t < MINUTOS_FRESCO * 60_000 };
  } catch {
    return null;
  }
}

export function guardarCache(empresaId: string, tarjetas: TarjetaRapida[], meta: MetaEmpresa): void {
  try {
    window.localStorage.setItem(claveCache(empresaId), JSON.stringify({ t: Date.now(), tarjetas, meta }));
  } catch {
    // sin caché, la pantalla igual funciona
  }
}

export function invalidarCache(empresaId: string): void {
  try {
    window.localStorage.removeItem(claveCache(empresaId));
  } catch {
    // nada que invalidar
  }
}

export async function registrarLanzamiento(
  empresaId: string,
  tarjeta: TarjetaRapida,
  monto: number,
  fecha: string = fechaLocalHoy()
): Promise<string> {
  const resultado = await registrarOperacion(empresaId, {
    fecha,
    operacion: tarjeta.operacion,
    categoria: tarjeta.categoria,
    formaPago: tarjeta.formaPago,
    historico: tarjeta.ultimoHistorico || tarjeta.categoria,
    clienteProveedor: tarjeta.ultimoProveedor,
    lineas: [{ producto: '', cantidad: 1, monto }],
  });

  return resultado.idOperacion as string;
}

export async function deshacerLanzamiento(empresaId: string, idOperacion: string): Promise<void> {
  await eliminarOperacion(empresaId, idOperacion);
}
