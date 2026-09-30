// lib/trofeos.ts
//
// TROFEOS — perfil Familia
// =====================================================
// A diferencia de "Objetivos Escalonados" (que resetean con cada
// nivel), los trofeos se calculan contra el ACUMULADO HISTÓRICO de
// operaciones de la empresa — mismo criterio que "Primeros pasos"
// (obtenerConteosActividad en objetivos.ts), pero a números más altos
// y organizados en categorías con 3 tiers (Bronce/Plata/Oro, igual
// vocabulario que los hitos de gamificación).
//
// Los trofeos ya obtenidos se guardan en trofeos_empresa (persistente,
// nunca se resetea) para no volver a festejarlos ni recalcularlos.

import { supabase } from './supabase';
import type { TipoHito } from './gamificacion';

export type TipoTrofeo = 'PAGO' | 'COBRO' | 'TRANSFERENCIA';

export type CategoriaTrofeo = {
  tipo: TipoTrofeo;
  emoji: string;
  nombre: string;
  nombrePT: string;
  umbrales: Record<TipoHito, number>;
};

export const CATALOGO_TROFEOS: Record<TipoTrofeo, CategoriaTrofeo> = {
  PAGO: {
    tipo: 'PAGO',
    emoji: '💸',
    nombre: 'Pagador Responsable',
    nombrePT: 'Pagador Responsável',
    umbrales: { BRONCE: 25, PLATA: 50, ORO: 85 },
  },
  COBRO: {
    tipo: 'COBRO',
    emoji: '💵',
    nombre: 'Cobrador Constante',
    nombrePT: 'Recebedor Constante',
    umbrales: { BRONCE: 15, PLATA: 35, ORO: 60 },
  },
  TRANSFERENCIA: {
    tipo: 'TRANSFERENCIA',
    emoji: '🔄',
    nombre: 'Ahorrista Organizado',
    nombrePT: 'Poupador Organizado',
    umbrales: { BRONCE: 10, PLATA: 25, ORO: 45 },
  },
};

const ORDEN_TIER: TipoHito[] = ['BRONCE', 'PLATA', 'ORO'];
const TIPOS: TipoTrofeo[] = ['PAGO', 'COBRO', 'TRANSFERENCIA'];

export type ProgresoTrofeo = CategoriaTrofeo & {
  conteo: number;
  tierActual: TipoHito | null;
};

export type TrofeoGanado = {
  tipo: TipoTrofeo;
  tier: TipoHito;
  obtenidoEn: string;
};

export type TrofeoPendiente = {
  tipo: TipoTrofeo;
  tier: TipoHito;
};

async function contarLifetime(empresaId: string, operacion: TipoTrofeo): Promise<number> {
  const { count } = await supabase
    .from('registro_operaciones')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion);

  return count ?? 0;
}

function tierAlcanzado(conteo: number, umbrales: Record<TipoHito, number>): TipoHito | null {
  let actual: TipoHito | null = null;
  for (const tier of ORDEN_TIER) {
    if (conteo >= umbrales[tier]) actual = tier;
  }
  return actual;
}

export async function obtenerProgresoTrofeos(empresaId: string): Promise<ProgresoTrofeo[]> {
  const conteos = await Promise.all(TIPOS.map((tipo) => contarLifetime(empresaId, tipo)));

  return TIPOS.map((tipo, i) => ({
    ...CATALOGO_TROFEOS[tipo],
    conteo: conteos[i],
    tierActual: tierAlcanzado(conteos[i], CATALOGO_TROFEOS[tipo].umbrales),
  }));
}

export async function obtenerTrofeosGanados(empresaId: string): Promise<TrofeoGanado[]> {
  const { data, error } = await supabase
    .from('trofeos_empresa')
    .select('tipo_operacion, tier, obtenido_en')
    .eq('empresa_id', empresaId);

  if (error) throw error;

  return (data ?? []).map((fila) => ({
    tipo: fila.tipo_operacion as TipoTrofeo,
    tier: fila.tier as TipoHito,
    obtenidoEn: fila.obtenido_en as string,
  }));
}

// Compara el progreso real contra lo ya guardado en trofeos_empresa y
// devuelve el trofeo nuevo más avanzado (todavía sin insertar) para
// festejarlo — o null si no hay ninguno pendiente. Se llama de nuevo
// después de marcar cada uno para encadenar el resto, igual que
// obtenerHitoPendiente en lib/gamificacion.ts.
export async function obtenerTrofeoPendiente(empresaId: string): Promise<TrofeoPendiente | null> {
  const [progreso, yaGanados] = await Promise.all([obtenerProgresoTrofeos(empresaId), obtenerTrofeosGanados(empresaId)]);

  const yaGanadosSet = new Set(yaGanados.map((g) => `${g.tipo}-${g.tier}`));
  const pendientes: TrofeoPendiente[] = [];

  for (const p of progreso) {
    for (const tier of ORDEN_TIER) {
      if (p.conteo >= p.umbrales[tier] && !yaGanadosSet.has(`${p.tipo}-${tier}`)) {
        pendientes.push({ tipo: p.tipo, tier });
      }
    }
  }

  if (pendientes.length === 0) return null;

  pendientes.sort((a, b) => ORDEN_TIER.indexOf(b.tier) - ORDEN_TIER.indexOf(a.tier));
  return pendientes[0];
}

export async function marcarTrofeoVisto(empresaId: string, tipo: TipoTrofeo, tier: TipoHito) {
  const { error } = await supabase.from('trofeos_empresa').insert({ empresa_id: empresaId, tipo_operacion: tipo, tier });

  // 23505 = ya estaba guardado (otra pestaña/carrera) — no es un error real.
  if (error && error.code !== '23505') {
    throw error;
  }
}
