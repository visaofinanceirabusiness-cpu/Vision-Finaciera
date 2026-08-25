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
