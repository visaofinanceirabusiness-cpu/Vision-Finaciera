import { PaletaCielo } from '../base/Compartido3D';
import { GrupoId } from '@/lib/visao3d';
import { ObjetoCasa } from '@/lib/visao3dCasa';
import type { PlanoCasa } from '@/lib/visao3dCasaPlano';

export type V3 = [number, number, number];

// Dónde va cada objeto de cuenta. Los que van sobre un pilar se acomodan en filas al frente de su habitación (llenado corrido,
// hasta 5 por habitación, centradas); las piezas grandes tienen sitio propio: el auto en la entrada, el sofá y la TV en el living.
export type Lugar = { pos: V3; escala: number; rot: number; sobrePilar: boolean };

export const ALTO_PILAR = 0.7;
export const ESCALA_TIPO: Partial<Record<string, number>> = { casa: 0.55, banco: 0.7, resultado: 0.9, capital: 0.8 };

export function lugarDe(o: ObjetoCasa, plano: PlanoCasa): Lugar {
  if (o.modo === 'auto') return { pos: [o.indice === 0 ? -9.5 : -7.6, 0, 9.2], escala: 1, rot: Math.PI / 2, sobrePilar: false };
  if (o.modo === 'sofa') return { pos: [-5.15, 0, -1.6], escala: 1, rot: Math.PI / 2, sobrePilar: false };
  if (o.modo === 'tv') return { pos: [-2.6, 0, -3.0], escala: 1, rot: 0, sobrePilar: false };
  const area = plano.cuartos.find((c) => c.id === o.sala) ?? plano.cuartos[0];
  const cx = (area.x0 + area.x1) / 2;
  const paso = Math.min(1.3, (area.x1 - area.x0 - 1.4) / Math.max(1, o.enFila - 1));
  return { pos: [cx + (o.indice - (o.enFila - 1) / 2) * paso, area.y0 + ALTO_PILAR, 2.4], escala: ESCALA_TIPO[o.tipo] ?? 0.8, rot: 0, sobrePilar: true };
}

// Cuánto se acerca la cámara al tocar cada objeto (los chicos necesitan más cerca) y a qué altura sobre su base mira.
export function encuadreDe(o: ObjetoCasa): { dist: number; alto: number } {
  if (o.modo === 'auto') return { dist: 10, alto: 0.8 };
  if (o.modo === 'sofa') return { dist: 7, alto: 0.6 };
  if (o.modo === 'tv') return { dist: 7, alto: 0.9 };
  if (o.tipo === 'resultado') return { dist: 5.4, alto: 0.8 };
  return { dist: 4.3, alto: 0.5 };
}

export type Hora = PaletaCielo;
export const HORAS: Record<Hora, { ambiente: number; hemisferio: [string, string, number]; sol: [string, number]; exposicion: number; niebla: string; formas: [number, number, number]; piso: number }> = {
  dia: { ambiente: 0.95, hemisferio: ['#cfe6ff', '#6b8b5a', 0.7], sol: ['#fff4dc', 1.6], exposicion: 1.05, niebla: '#cfe3f2', formas: [3.2, 4, 2.4], piso: 0.1 },
  atardecer: { ambiente: 1.15, hemisferio: ['#bcd0ff', '#3a2f26', 0.5], sol: ['#ffffff', 1.1], exposicion: 1.2, niebla: '#2a2f55', formas: [4, 3, 2], piso: 0.14 },
  noche: { ambiente: 0.42, hemisferio: ['#6f86c9', '#141a2a', 0.3], sol: ['#9fb4ff', 0.35], exposicion: 1.15, niebla: '#050813', formas: [0.8, 1.2, 0.6], piso: 0.05 },
};
export const CLAVE_HORA = 'visao3d_hora';

// Paredes: todas menos la de frente (z positivo), que falta a propósito para ver el interior.
// Camino de entrada: losas parejas desde la vereda hasta la casa, con cordón y balizas; el pasto y las flores lo respetan.
export const CAMINO_X = -2.4;
export const CAMINO_ANCHO = 1.9;
export const sobreCamino = (x: number) => Math.abs(x - CAMINO_X) < CAMINO_ANCHO / 2 + 0.55;
// Lugar donde espera Sabio, a un costado del camino.
export const SABIO_POS: V3 = [-0.8, 0, 11.4];
export const enSabio = (x: number, z: number) => Math.hypot(x - SABIO_POS[0], z - SABIO_POS[2]) < 1.5;
