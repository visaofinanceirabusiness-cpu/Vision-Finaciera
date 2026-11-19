// Generador pseudoaleatorio con semilla (mulberry32): con la misma semilla y el mismo día da siempre lo mismo, así se puede repetir y probar.

export type Rng = () => number;

export function crearRng(semilla: number): Rng {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Semilla distinta por día (y por empresa/semilla base) pero estable: «2026-03-04» siempre arma el mismo día.
export function semillaDelDia(semillaBase: number, fecha: string): number {
  let h = semillaBase >>> 0;
  for (let i = 0; i < fecha.length; i++) h = Math.imul(h ^ fecha.charCodeAt(i), 2654435761) >>> 0;
  return h;
}

export function entre(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function enteroEntre(rng: Rng, min: number, max: number): number {
  return Math.floor(entre(rng, min, max + 1));
}

export function elegir<T>(rng: Rng, lista: T[]): T {
  return lista[Math.floor(rng() * lista.length)];
}

// Elige según pesos (los pesos 0 o negativos nunca salen). Devuelve null si ninguno tiene peso.
export function elegirConPeso<T>(rng: Rng, lista: Array<{ valor: T; peso: number }>): T | null {
  const validos = lista.filter((x) => x.peso > 0);
  const total = validos.reduce((s, x) => s + x.peso, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const x of validos) {
    r -= x.peso;
    if (r <= 0) return x.valor;
  }
  return validos[validos.length - 1].valor;
}

// Hash estable de un texto a [0,1): para que un producto tenga siempre «su» factor de costo.
export function hashUnitario(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619) >>> 0;
  return h / 4294967296;
}
