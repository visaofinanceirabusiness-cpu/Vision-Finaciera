// lib/objetivosEscalonados.ts
//
// OBJETIVOS ESCALONADOS — perfil Familia
// =====================================================
// Capa motivacional adicional a "Primeros pasos": dentro de cada
// nivel de gamificación (10 niveles, 75 operaciones cada uno — ver
// lib/gamificacion.ts) se proponen 3 operaciones (Pago, Cobro,
// Transferencia) con 3 checkpoints crecientes cada una — otra forma
// de acercarse a las 75 operaciones del nivel, pero por etapas.
//
// El conteo es SOLO del nivel actual: arranca de nuevo cada vez que
// la empresa sube de nivel. Como registro_operaciones no guarda un
// índice de "operación número N dentro del nivel", se usa la fecha de
// creación de la operación que marcó el ingreso al nivel actual (la
// operación número `operaciones_min` de toda la empresa, contando
// desde 1) como punto de corte: todo lo registrado desde ahí cuenta
// para este nivel.

import { supabase } from './supabase';

export type TipoEscalonado = 'PAGO' | 'COBRO' | 'TRANSFERENCIA';

export type ObjetivoEscalonado = {
  tipo: TipoEscalonado;
  emoji: string;
  nombre: string;
  nombrePT: string;
  checkpoints: number[];
  conteo: number;
  checkpointsCumplidos: number;
};

// Checkpoints por nivel (índice 0 = nivel 1 ... índice 9 = nivel 10) y
// tipo de operación — crecen de forma moderada nivel a nivel; el
// checkpoint final de los 3 tipos queda siempre bastante por debajo
// de las 75 operaciones del nivel, dejando lugar para el resto de las
// operaciones (Venta, Compra, etc.) que también cuentan para subir de
// nivel pero no tienen objetivo escalonado propio.
const ESCALAS: Record<TipoEscalonado, number[][]> = {
  PAGO: [
    [5, 15, 20],
    [6, 18, 24],
    [7, 20, 28],
    [8, 23, 32],
    [9, 25, 35],
    [10, 28, 38],
    [11, 30, 42],
    [12, 33, 45],
    [13, 35, 48],
    [15, 40, 52],
  ],
  COBRO: [
    [3, 10, 15],
    [4, 12, 18],
    [5, 14, 20],
    [5, 16, 23],
    [6, 18, 25],
    [7, 20, 28],
    [7, 22, 30],
    [8, 24, 32],
    [9, 26, 35],
    [10, 28, 38],
  ],
  TRANSFERENCIA: [
    [2, 6, 10],
    [3, 7, 12],
    [3, 8, 13],
    [4, 9, 15],
    [4, 10, 16],
    [5, 11, 18],
    [5, 12, 19],
    [6, 13, 21],
    [6, 14, 22],
    [7, 15, 24],
  ],
};

const INFO: Record<TipoEscalonado, { emoji: string; nombre: string; nombrePT: string }> = {
  PAGO: { emoji: '💸', nombre: 'Pagos registrados', nombrePT: 'Pagamentos registrados' },
  COBRO: { emoji: '💵', nombre: 'Cobros registrados', nombrePT: 'Recebimentos registrados' },
  TRANSFERENCIA: { emoji: '🔄', nombre: 'Transferencias registradas', nombrePT: 'Transferências registradas' },
};

export function checkpointsDelNivel(tipo: TipoEscalonado, nivel: number): number[] {
  const indice = Math.min(Math.max(nivel, 1), 10) - 1;
  return ESCALAS[tipo][indice];
}

async function fechaInicioNivel(empresaId: string, operacionesMin: number): Promise<string | null> {
  if (operacionesMin <= 0) return null;

  const { data } = await supabase
    .from('registro_operaciones')
    .select('creado_en')
    .eq('empresa_id', empresaId)
    .order('creado_en', { ascending: true })
    .range(operacionesMin - 1, operacionesMin - 1);

  return data?.[0]?.creado_en ?? null;
}

async function contarDesde(empresaId: string, operacion: TipoEscalonado, desde: string | null): Promise<number> {
  let consulta = supabase
    .from('registro_operaciones')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion);

  if (desde) {
    consulta = consulta.gte('creado_en', desde);
  }

  const { count } = await consulta;
  return count ?? 0;
}

const TIPOS: TipoEscalonado[] = ['PAGO', 'COBRO', 'TRANSFERENCIA'];

export async function obtenerObjetivosEscalonados(
  empresaId: string,
  nivel: number,
  operacionesMin: number
): Promise<ObjetivoEscalonado[]> {
  const desde = await fechaInicioNivel(empresaId, operacionesMin);
  const conteos = await Promise.all(TIPOS.map((tipo) => contarDesde(empresaId, tipo, desde)));

  return TIPOS.map((tipo, i) => {
    const checkpoints = checkpointsDelNivel(tipo, nivel);
    const conteo = conteos[i];
    const checkpointsCumplidos = checkpoints.filter((c) => conteo >= c).length;

    return {
      tipo,
      emoji: INFO[tipo].emoji,
      nombre: INFO[tipo].nombre,
      nombrePT: INFO[tipo].nombrePT,
      checkpoints,
      conteo,
      checkpointsCumplidos,
    };
  });
}
