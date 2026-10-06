// lib/trofeosRangos.ts
//
// ESCALERA DE TÍTULOS DE LOS TROFEOS (perfil Familia)
// =====================================================
// Cada tipo de trofeo (Pagador, Cobrador, Ahorrista) tiene una escalera de
// títulos ("rangos"): el 0 es el original (Pagador Responsable…) y del 1 al 5
// van mejorando — Bronce, Plata, Oro, Platino, Diamante — cada uno con SUS
// tres medallas (Bronce/Plata/Oro) y umbrales cada vez más altos. Se mide
// contra el acumulado histórico de operaciones (nunca se reinicia).
//
// Todo acá es puro (sin base de datos): el catálogo, los umbrales y las cuentas
// de "en qué título estoy" y "qué medallas se ganaron" — ver lib/trofeos.ts
// para lo que se lee y guarda.

export type TipoTrofeo = 'PAGO' | 'COBRO' | 'TRANSFERENCIA';
export type TierMedalla = 'BRONCE' | 'PLATA' | 'ORO';

export const ORDEN_TIER: TierMedalla[] = ['BRONCE', 'PLATA', 'ORO'];

export type EstiloRango = {
  fondo: string;
  borde: string;
  acento: string;
  sombra: string;
};

export type Rango = {
  indice: number; // 0 = título original; 1..5 = Bronce..Diamante
  emblema: string;
  nombre: string;
  nombrePT: string;
  umbrales: Record<TierMedalla, number>;
  estilo: EstiloRango;
};

export type FamiliaTrofeo = {
  tipo: TipoTrofeo;
  emoji: string;
  rangos: Rango[];
};

// Fondo y borde de la tarjeta según el título en curso: del cobre al diamante.
const ESTILOS: EstiloRango[] = [
  { fondo: '#ffffff', borde: '#e5e7eb', acento: '#6e7781', sombra: 'none' },
  { fondo: 'linear-gradient(160deg, #fff7ed 0%, #fed7aa 100%)', borde: '#c2813f', acento: '#9a5b1f', sombra: '0 4px 14px rgba(194,129,63,0.25)' },
  { fondo: 'linear-gradient(160deg, #f8fafc 0%, #cbd5e1 100%)', borde: '#94a3b8', acento: '#475569', sombra: '0 4px 14px rgba(100,116,139,0.25)' },
  { fondo: 'linear-gradient(160deg, #fffbeb 0%, #fde68a 100%)', borde: '#d4a017', acento: '#92400e', sombra: '0 4px 16px rgba(212,160,23,0.35)' },
  { fondo: 'linear-gradient(160deg, #ecfeff 0%, #a5f3fc 100%)', borde: '#22b8cf', acento: '#0e7490', sombra: '0 4px 18px rgba(34,184,207,0.4)' },
  { fondo: 'linear-gradient(160deg, #f5f3ff 0%, #c4b5fd 100%)', borde: '#8b5cf6', acento: '#5b21b6', sombra: '0 6px 22px rgba(139,92,246,0.5)' },
];

const EMBLEMAS = ['🎖️', '🥉', '🥈', '🥇', '💎', '👑'];

function rangos(
  nombres: Array<[string, string]>,
  umbrales: Array<[number, number, number]>
): Rango[] {
  return nombres.map(([nombre, nombrePT], indice) => ({
    indice,
    emblema: EMBLEMAS[indice],
    nombre,
    nombrePT,
    umbrales: { BRONCE: umbrales[indice][0], PLATA: umbrales[indice][1], ORO: umbrales[indice][2] },
    estilo: ESTILOS[indice],
  }));
}

export const FAMILIAS_TROFEO: Record<TipoTrofeo, FamiliaTrofeo> = {
  PAGO: {
    tipo: 'PAGO',
    emoji: '💳',
    rangos: rangos(
      [
        ['Pagador Responsable', 'Pagador Responsável'],
        ['Pagador al Día', 'Pagador em Dia'],
        ['Pagador Ejemplar', 'Pagador Exemplar'],
        ['Pagador Impecable', 'Pagador Impecável'],
        ['Pagador Virtuoso', 'Pagador Virtuoso'],
        ['Pagador Legendario', 'Pagador Lendário'],
      ],
      [[25, 50, 85], [90, 120, 160], [240, 320, 400], [520, 640, 800], [1000, 1200, 1440], [1760, 2080, 2400]]
    ),
  },
  COBRO: {
    tipo: 'COBRO',
    emoji: '💰',
    rangos: rangos(
      [
        ['Cobrador Constante', 'Recebedor Constante'],
        ['Cobrador Atento', 'Recebedor Atento'],
        ['Cobrador Eficaz', 'Recebedor Eficaz'],
        ['Cobrador Infalible', 'Recebedor Infalível'],
        ['Cobrador Maestro', 'Recebedor Mestre'],
        ['Cobrador Soberano', 'Recebedor Soberano'],
      ],
      [[15, 35, 60], [65, 80, 120], [160, 200, 240], [320, 400, 520], [640, 800, 1000], [1200, 1440, 1760]]
    ),
  },
  TRANSFERENCIA: {
    tipo: 'TRANSFERENCIA',
    emoji: '🏦',
    rangos: rangos(
      [
        ['Ahorrista Organizado', 'Poupador Organizado'],
        ['Ahorrista Aplicado', 'Poupador Dedicado'],
        ['Ahorrista Estratega', 'Poupador Estrategista'],
        ['Ahorrista Visionario', 'Poupador Visionário'],
        ['Ahorrista Magnate', 'Poupador Magnata'],
        ['Ahorrista Imperial', 'Poupador Imperial'],
      ],
      [[10, 25, 45], [48, 64, 80], [100, 120, 160], [200, 240, 320], [400, 480, 600], [720, 880, 1040]]
    ),
  },
};

export const TIPOS_TROFEO: TipoTrofeo[] = ['PAGO', 'COBRO', 'TRANSFERENCIA'];

export const EMOJI_MEDALLA: Record<TierMedalla, string> = { BRONCE: '🥉', PLATA: '🥈', ORO: '🏆' };
export const NOMBRE_MEDALLA: Record<TierMedalla, { es: string; pt: string }> = {
  BRONCE: { es: 'Bronce', pt: 'Bronze' },
  PLATA: { es: 'Plata', pt: 'Prata' },
  ORO: { es: 'Oro', pt: 'Ouro' },
};

// Cuántas de las 3 medallas de un título ya se alcanzaron (0 a 3).
export function medallasAlcanzadas(conteo: number, rango: Rango): number {
  return ORDEN_TIER.filter((tier) => conteo >= rango.umbrales[tier]).length;
}

export type ProgresoDeFamilia = {
  rango: Rango;
  // El título en curso: el primero que todavía no tiene sus 3 medallas. Si ya
  // están todos completos queda el último, marcado como `completo`.
  completo: boolean;
  medallas: number;
  siguiente: { tier: TierMedalla; umbral: number; faltan: number } | null;
  // Avance (0 a 100) hacia la próxima medalla, desde la anterior.
  porcentaje: number;
  titulosCompletos: number[];
};

export function progresoDeFamilia(conteo: number, familia: FamiliaTrofeo): ProgresoDeFamilia {
  const titulosCompletos = familia.rangos.filter((r) => medallasAlcanzadas(conteo, r) === 3).map((r) => r.indice);
  const enCurso = familia.rangos.find((r) => medallasAlcanzadas(conteo, r) < 3);

  if (!enCurso) {
    const ultimo = familia.rangos[familia.rangos.length - 1];
    return { rango: ultimo, completo: true, medallas: 3, siguiente: null, porcentaje: 100, titulosCompletos };
  }

  const medallas = medallasAlcanzadas(conteo, enCurso);
  const tier = ORDEN_TIER[medallas];
  const umbral = enCurso.umbrales[tier];
  const base = medallas > 0 ? enCurso.umbrales[ORDEN_TIER[medallas - 1]] : enCurso.indice > 0 ? familia.rangos[enCurso.indice - 1].umbrales.ORO : 0;
  const porcentaje = Math.max(0, Math.min(100, Math.round(((conteo - base) / (umbral - base)) * 100)));

  return { rango: enCurso, completo: false, medallas, siguiente: { tier, umbral, faltan: umbral - conteo }, porcentaje, titulosCompletos };
}

export type MedallaGanable = { tipo: TipoTrofeo; rango: number; tier: TierMedalla };

// Todas las medallas que el conteo ya alcanzó y todavía no están guardadas.
export function medallasPendientes(
  conteos: Record<TipoTrofeo, number>,
  yaGanadas: Set<string>
): MedallaGanable[] {
  const pendientes: MedallaGanable[] = [];

  for (const tipo of TIPOS_TROFEO) {
    for (const rango of FAMILIAS_TROFEO[tipo].rangos) {
      for (const tier of ORDEN_TIER) {
        if (conteos[tipo] >= rango.umbrales[tier] && !yaGanadas.has(claveMedalla(tipo, rango.indice, tier))) {
          pendientes.push({ tipo, rango: rango.indice, tier });
        }
      }
    }
  }

  return pendientes;
}

export function claveMedalla(tipo: TipoTrofeo, rango: number, tier: TierMedalla): string {
  return `${tipo}-${rango}-${tier}`;
}

// Texto del festejo: "Pagador Ejemplar — medalla Oro".
export function descripcionMedalla(tipo: TipoTrofeo, rangoIndice: number, tier: TierMedalla, esPT: boolean): string {
  const rango = FAMILIAS_TROFEO[tipo].rangos[rangoIndice];
  return `${esPT ? rango.nombrePT : rango.nombre} — ${esPT ? 'medalha' : 'medalla'} ${NOMBRE_MEDALLA[tier][esPT ? 'pt' : 'es']}`;
}
