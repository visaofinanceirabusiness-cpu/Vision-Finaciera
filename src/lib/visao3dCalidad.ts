// Nivel de calidad gráfica de Visão 3D según el equipo: decide sombras, texturas y modelos pesados.
// Pura (recibe lo que mide el navegador) para poder probarla; `leerCalidad` hace la medición real.

export type Calidad = 'bajo' | 'medio' | 'alto';

export type Equipo = { tactil: boolean; memoriaGB?: number; nucleos?: number; ahorroDatos?: boolean };

export function calcularCalidad({ tactil, memoriaGB, nucleos, ahorroDatos }: Equipo): Calidad {
  if (ahorroDatos) return 'bajo';
  const memoria = memoriaGB ?? (tactil ? 3 : 8);
  const cpu = nucleos ?? (tactil ? 6 : 8);
  if (tactil) return memoria >= 6 && cpu >= 8 ? 'medio' : 'bajo';
  return memoria >= 8 && cpu >= 8 ? 'alto' : 'medio';
}

export function leerCalidad(): { calidad: Calidad; tactil: boolean } {
  if (typeof window === 'undefined') return { calidad: 'medio', tactil: false };
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  // ?calidad=bajo|medio|alto fuerza el nivel (para probar en un equipo y ver cómo se vería en otro).
  const forzada = new URLSearchParams(window.location.search).get('calidad');
  if (forzada === 'bajo' || forzada === 'medio' || forzada === 'alto') return { tactil, calidad: forzada };
  return { tactil, calidad: calcularCalidad({ tactil, memoriaGB: nav.deviceMemory, nucleos: nav.hardwareConcurrency, ahorroDatos: nav.connection?.saveData }) };
}

// Sombras en tiempo real: solo en equipos que no son táctiles y de calidad alta (decisión de producto, ver memory.md).
export const usaSombras = (calidad: Calidad, tactil: boolean) => !tactil && calidad === 'alto';
