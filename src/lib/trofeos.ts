// lib/trofeos.ts
//
// TROFEOS — todos los perfiles (Familia: Pago/Cobro/Transferencia; empresas:
// Venta/Compra/Cobro/Pago — ver tiposTrofeoDelPerfil)
// =====================================================
// A diferencia de "Objetivos Escalonados" (que resetean con cada
// nivel), los trofeos se calculan contra el ACUMULADO HISTÓRICO de
// operaciones de la empresa — mismo criterio que "Primeros pasos"
// (obtenerConteosActividad en objetivos.ts), pero a números más altos.
//
// Cada tipo (Pagador, Cobrador, Ahorrista) tiene una escalera de 6
// títulos, cada uno con sus 3 medallas (Bronce/Plata/Oro): el catálogo y las
// cuentas puras viven en lib/trofeosRangos.ts. Acá se lee el conteo y se
// guardan las medallas ya festejadas.
//
// Los trofeos ya obtenidos se guardan en trofeos_empresa (persistente,
// nunca se resetea) para no volver a festejarlos ni recalcularlos. La columna
// `rango` es el título: 0 = el original (Pagador Responsable…), 1..5 = Bronce a
// Diamante.

import { supabase } from './supabase';
import {
  FAMILIAS_TROFEO,
  ORDEN_TIER,
  TIPOS_TROFEO,
  claveMedalla,
  medallasPendientes,
  progresoDeFamilia,
  type FamiliaTrofeo,
  type ProgresoDeFamilia,
  type TierMedalla,
  type TipoTrofeo,
} from './trofeosRangos';

export type { TipoTrofeo, TierMedalla } from './trofeosRangos';

export type ProgresoTrofeo = {
  familia: FamiliaTrofeo;
  conteo: number;
  progreso: ProgresoDeFamilia;
};

export type TrofeoGanado = {
  tipo: TipoTrofeo;
  rango: number;
  tier: TierMedalla;
  obtenidoEn: string;
};

export type TrofeoPendiente = {
  tipo: TipoTrofeo;
  rango: number;
  tier: TierMedalla;
};

async function contarLifetime(empresaId: string, operacion: TipoTrofeo): Promise<number> {
  const { count } = await supabase
    .from('registro_operaciones')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion);

  return count ?? 0;
}

async function contarTodos(empresaId: string, tipos: TipoTrofeo[]): Promise<Partial<Record<TipoTrofeo, number>>> {
  const conteos = await Promise.all(tipos.map((tipo) => contarLifetime(empresaId, tipo)));
  return Object.fromEntries(tipos.map((tipo, i) => [tipo, conteos[i]]));
}

export async function obtenerProgresoTrofeos(empresaId: string, tipos: TipoTrofeo[] = TIPOS_TROFEO): Promise<ProgresoTrofeo[]> {
  const conteos = await contarTodos(empresaId, tipos);

  return tipos.map((tipo) => ({
    familia: FAMILIAS_TROFEO[tipo],
    conteo: conteos[tipo] ?? 0,
    progreso: progresoDeFamilia(conteos[tipo] ?? 0, FAMILIAS_TROFEO[tipo]),
  }));
}

export async function obtenerTrofeosGanados(empresaId: string): Promise<TrofeoGanado[]> {
  const { data, error } = await supabase
    .from('trofeos_empresa')
    .select('tipo_operacion, rango, tier, obtenido_en')
    .eq('empresa_id', empresaId);

  if (error) throw error;

  return (data ?? []).map((fila) => ({
    tipo: fila.tipo_operacion as TipoTrofeo,
    rango: Number(fila.rango ?? 0),
    tier: fila.tier as TierMedalla,
    obtenidoEn: fila.obtenido_en as string,
  }));
}

// Compara el progreso real contra lo ya guardado en trofeos_empresa y
// devuelve la medalla nueva más avanzada (todavía sin insertar) para
// festejarla — o null si no hay ninguna pendiente. Se llama de nuevo
// después de marcar cada una para encadenar el resto, igual que
// obtenerHitoPendiente en lib/gamificacion.ts.
export async function obtenerTrofeoPendiente(empresaId: string, tipos: TipoTrofeo[] = TIPOS_TROFEO): Promise<TrofeoPendiente | null> {
  const [conteos, yaGanados] = await Promise.all([contarTodos(empresaId, tipos), obtenerTrofeosGanados(empresaId)]);

  const pendientes = medallasPendientes(conteos, new Set(yaGanados.map((g) => claveMedalla(g.tipo, g.rango, g.tier))), tipos);

  if (pendientes.length === 0) return null;

  pendientes.sort((a, b) => b.rango - a.rango || ORDEN_TIER.indexOf(b.tier) - ORDEN_TIER.indexOf(a.tier));
  return pendientes[0];
}

export async function marcarTrofeoVisto(empresaId: string, tipo: TipoTrofeo, tier: TierMedalla, rango: number) {
  const { error } = await supabase.from('trofeos_empresa').insert({ empresa_id: empresaId, tipo_operacion: tipo, tier, rango });

  // 23505 = ya estaba guardado (otra pestaña/carrera) — no es un error real.
  if (error && error.code !== '23505') {
    throw error;
  }
}
