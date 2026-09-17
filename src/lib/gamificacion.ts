// src/lib/gamificacion.ts
//
// MOTOR DE GAMIFICACIÓN DE SABIO
//
// La gamificación se calcula exclusivamente sobre:
// registro_operaciones
//
// Los registros automáticos, como CMV,
// NO cuentan para el progreso.
//
// La configuración de niveles vive en:
// niveles_gamificacion
//
// La lógica es genérica para cualquier empresa.
//

import { supabase } from './supabase';

// =====================================================
// TIPOS
// =====================================================

export type NivelGamificacion = {
  id: string;
  nivel: number;
  nombre: string;
  emoji: string | null;
  operaciones_min: number;
  operaciones_max: number | null;
  mision: string;
  mensaje: string;
};

export type TipoHito = 'BRONCE' | 'PLATA' | 'ORO';

export type HitoPendiente = {
  nivel: number;
  tipo: TipoHito;
  // Solo viene cargado cuando el hito es 'ORO': el Oro coincide
  // siempre con el cruce hacia el próximo nivel.
  nombreNivelNuevo: string | null;
  emojiNivelNuevo: string | null;
};

export type ProgresoGamificacion = {
  operaciones: number;

  nivel: number;
  nombre: string;
  emoji: string;

  operacionesMin: number;
  operacionesMax: number | null;

  mision: string;
  mensaje: string;

  progreso: number;
  faltan: number;
};

// =====================================================
// OBTENER NIVELES
// =====================================================

async function obtenerNiveles(): Promise<
  NivelGamificacion[]
> {
  const { data, error } = await supabase
    .from('niveles_gamificacion')
    .select(
      `
      id,
      nivel,
      nombre,
      emoji,
      operaciones_min,
      operaciones_max,
      mision,
      mensaje
      `
    )
    .order('nivel', {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as NivelGamificacion[];
}

// =====================================================
// CONTAR OPERACIONES REALES
// =====================================================
//
// IMPORTANTE:
// Solo cuenta registro_operaciones.
// NO cuenta:
// registros_automaticos
// movimientos_stock
// saldo_stock
//
// Esto evita que una venta que genera CMV
// avance dos veces en la gamificación.
// =====================================================

async function contarOperaciones(
  empresaId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('registro_operaciones')
    .select(
      'id',
      {
        count: 'exact',
        head: true,
      }
    )
    .eq(
      'empresa_id',
      empresaId
    );

  if (error) {
    throw error;
  }

  return Number(count ?? 0);
}

// =====================================================
// OBTENER NIVEL ACTUAL
// =====================================================

function obtenerNivelActual(
  operaciones: number,
  niveles: NivelGamificacion[]
): NivelGamificacion {
  if (!niveles.length) {
    throw new Error(
      'No existen niveles de gamificación configurados.'
    );
  }

  // Buscamos el nivel cuyo rango
  // contenga la cantidad actual.
  //
  // Para el último nivel, operaciones_max
  // puede ser null.

  const nivel = niveles.find(
    (item) => {
      const minimo =
        Number(
          item.operaciones_min
        );

      const maximo =
        item.operaciones_max === null
          ? Infinity
          : Number(
              item.operaciones_max
            );

      return (
        operaciones >= minimo &&
        operaciones <= maximo
      );
    }
  );

  // Respaldo:
  // si superó todos los rangos,
  // utilizamos el último nivel.
  return (
    nivel ??
    niveles[niveles.length - 1]
  );
}

// =====================================================
// CALCULAR PROGRESO
// =====================================================

function calcularProgreso(
  operaciones: number,
  nivel: NivelGamificacion
) {
  const minimo =
    Number(
      nivel.operaciones_min
    );

  // Nivel final:
  // no existe siguiente objetivo.
  if (
    nivel.operaciones_max === null
  ) {
    return {
      progreso: 100,
      faltan: 0,
    };
  }

  const maximo =
    Number(
      nivel.operaciones_max
    );

  const rango =
    maximo - minimo + 1;

  const avanzadas =
    operaciones - minimo;

  const progreso =
    rango > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (avanzadas / rango) *
              100
          )
        )
      : 100;

  const objetivo =
    maximo + 1;

  const faltan =
    Math.max(
      0,
      objetivo - operaciones
    );

  return {
    progreso,
    faltan,
  };
}

// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================

export async function obtenerProgresoGamificacion(
  empresaId: string
): Promise<ProgresoGamificacion> {
  if (!empresaId) {
    throw new Error(
      'Se necesita empresaId para calcular la gamificación.'
    );
  }

  // 1. Obtener cantidad real
  const operaciones =
    await contarOperaciones(
      empresaId
    );

  // 2. Obtener configuración global
  const niveles =
    await obtenerNiveles();

  // 3. Determinar nivel
  const nivelActual =
    obtenerNivelActual(
      operaciones,
      niveles
    );

  // 4. Calcular progreso
  const {
    progreso,
    faltan,
  } =
    calcularProgreso(
      operaciones,
      nivelActual
    );

  return {
    operaciones,

    nivel:
      Number(
        nivelActual.nivel
      ),

    nombre:
      nivelActual.nombre,

    emoji:
      nivelActual.emoji ??
      '⭐',

    operacionesMin:
      Number(
        nivelActual.operaciones_min
      ),

    operacionesMax:
      nivelActual.operaciones_max === null
        ? null
        : Number(
            nivelActual.operaciones_max
          ),

    mision:
      nivelActual.mision,

    mensaje:
      nivelActual.mensaje,

    progreso:

      Number(
        progreso.toFixed(2)
      ),

    faltan,
  };
}

// =====================================================
// HITOS INTERMEDIOS (BRONCE / PLATA / ORO)
// =====================================================
//
// Cada nivel acotado (operaciones_max != null) dura 75 operaciones,
// así que las tres medallas caen siempre en el mismo lugar relativo
// dentro de cualquier nivel: +25 Bronce, +50 Plata, +75 Oro — y el
// Oro coincide con el cruce al próximo nivel. El último nivel
// (Leyenda, sin techo) no tiene más metas numéricas, así que no
// genera medallas nuevas.
// =====================================================

const UMBRAL_BRONCE = 25;
const UMBRAL_PLATA = 50;
const UMBRAL_ORO = 75;

function calcularHitosAlcanzados(
  operaciones: number,
  niveles: NivelGamificacion[]
): Array<{ nivel: number; tipo: TipoHito }> {
  const hitos: Array<{ nivel: number; tipo: TipoHito }> = [];

  for (const nivelDef of niveles) {
    if (nivelDef.operaciones_max === null) continue;

    const avance = operaciones - Number(nivelDef.operaciones_min);

    if (avance >= UMBRAL_BRONCE) hitos.push({ nivel: nivelDef.nivel, tipo: 'BRONCE' });
    if (avance >= UMBRAL_PLATA) hitos.push({ nivel: nivelDef.nivel, tipo: 'PLATA' });
    if (avance >= UMBRAL_ORO) hitos.push({ nivel: nivelDef.nivel, tipo: 'ORO' });
  }

  return hitos;
}

const ORDEN_HITO: TipoHito[] = ['BRONCE', 'PLATA', 'ORO'];

// Devuelve el hito más avanzado que la empresa ya alcanzó pero
// todavía no vio — o null si no hay ninguno pendiente. Se llama de
// nuevo después de cerrar cada modal para encadenar el resto (si un
// lote grande de operaciones cruzó varias medallas de una vez, se
// muestran una por una en vez de saltear las intermedias).
export async function obtenerHitoPendiente(
  empresaId: string
): Promise<HitoPendiente | null> {
  const operaciones = await contarOperaciones(empresaId);
  const niveles = await obtenerNiveles();

  const alcanzados = calcularHitosAlcanzados(operaciones, niveles);
  if (alcanzados.length === 0) {
    return null;
  }

  const { data: vistos, error } = await supabase
    .from('gamificacion_hitos_vistos')
    .select('nivel, tipo_hito')
    .eq('empresa_id', empresaId);

  if (error) {
    throw error;
  }

  const vistosSet = new Set((vistos ?? []).map((v) => `${v.nivel}-${v.tipo_hito}`));
  const pendientes = alcanzados.filter((h) => !vistosSet.has(`${h.nivel}-${h.tipo}`));

  if (pendientes.length === 0) {
    return null;
  }

  pendientes.sort((a, b) => {
    if (a.nivel !== b.nivel) return b.nivel - a.nivel;
    return ORDEN_HITO.indexOf(b.tipo) - ORDEN_HITO.indexOf(a.tipo);
  });

  const masAvanzado = pendientes[0];

  let nombreNivelNuevo: string | null = null;
  let emojiNivelNuevo: string | null = null;

  if (masAvanzado.tipo === 'ORO') {
    const siguiente = niveles.find((n) => n.nivel === masAvanzado.nivel + 1);
    if (siguiente) {
      nombreNivelNuevo = siguiente.nombre;
      emojiNivelNuevo = siguiente.emoji ?? '⭐';
    }
  }

  return {
    nivel: masAvanzado.nivel,
    tipo: masAvanzado.tipo,
    nombreNivelNuevo,
    emojiNivelNuevo,
  };
}

export async function marcarHitoVisto(empresaId: string, nivel: number, tipo: TipoHito) {
  const { error } = await supabase
    .from('gamificacion_hitos_vistos')
    .insert({ empresa_id: empresaId, nivel, tipo_hito: tipo });

  // 23505 = ya estaba marcado como visto (otra pestaña/carrera) — no
  // es un error real, el objetivo (que no se repita) ya se cumplió.
  if (error && error.code !== '23505') {
    throw error;
  }
}
