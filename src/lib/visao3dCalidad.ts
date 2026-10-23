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

export type Preferencia = 'auto' | Calidad;
export const CLAVE_PREFERENCIA_CALIDAD = 'visao3d_calidad';

const esCalidad = (v: unknown): v is Calidad => v === 'bajo' || v === 'medio' || v === 'alto';

// Orden de prioridad: ?calidad=… en la dirección (para probar) → elección guardada en el menú → automático según el equipo.
export function resolverCalidad({ url, preferencia, equipo }: { url?: string | null; preferencia?: string | null; equipo: Equipo }): Calidad {
  if (esCalidad(url)) return url;
  if (esCalidad(preferencia)) return preferencia;
  return calcularCalidad(equipo);
}

export function leerPreferencia(): Preferencia {
  try {
    const guardada = localStorage.getItem(CLAVE_PREFERENCIA_CALIDAD);
    return esCalidad(guardada) ? guardada : 'auto';
  } catch {
    return 'auto';
  }
}

export function guardarPreferencia(p: Preferencia) {
  try {
    if (p === 'auto') localStorage.removeItem(CLAVE_PREFERENCIA_CALIDAD);
    else localStorage.setItem(CLAVE_PREFERENCIA_CALIDAD, p);
  } catch {
    // sin almacenamiento: la elección vale solo hasta recargar
  }
}

// Calidad que le corresponde a este equipo ahora, y la que mediría el modo automático (para mostrarla en el menú).
export function leerCalidad(): { calidad: Calidad; tactil: boolean; automatica: Calidad } {
  if (typeof window === 'undefined') return { calidad: 'medio', tactil: false, automatica: 'medio' };
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  const equipo: Equipo = { tactil, memoriaGB: nav.deviceMemory, nucleos: nav.hardwareConcurrency, ahorroDatos: nav.connection?.saveData };
  const automatica = calcularCalidad(equipo);
  return { tactil, automatica, calidad: resolverCalidad({ url: new URLSearchParams(window.location.search).get('calidad'), preferencia: leerPreferencia(), equipo }) };
}

// Sombras en tiempo real: solo en equipos que no son táctiles y de calidad alta (decisión de producto, ver memory.md).
export const usaSombras = (calidad: Calidad, tactil: boolean) => !tactil && calidad === 'alto';
