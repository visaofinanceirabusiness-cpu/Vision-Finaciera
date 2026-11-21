// lib/informes/escala.ts — ejes y formatos de los gráficos interactivos de Informes (misma escala que el gráfico de Evolución).

export function compacto(n: number, simbolo: string): string {
  const a = Math.abs(n);
  const t = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}M` : a >= 10_000 ? `${(a / 1000).toFixed(0)}k` : a >= 1000 ? `${(a / 1000).toFixed(1)}k` : a.toFixed(0);
  return `${n < 0 ? '−' : ''}${simbolo ? `${simbolo} ` : ''}${t}`;
}

// Eje con marcas «redondas» que siempre incluye el rango pedido.
export function escalaBonita(min: number, max: number): { min: number; max: number; marcas: number[] } {
  if (max === min) max = min + 1;
  const paso0 = (max - min) / 5;
  const p = Math.pow(10, Math.floor(Math.log10(paso0)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= paso0) ?? 10 * p;
  const lo = Math.floor(min / paso) * paso;
  const hi = Math.ceil(max / paso) * paso;
  const marcas: number[] = [];
  for (let v = lo; v <= hi + paso / 2; v += paso) marcas.push(Math.round(v * 100) / 100);
  return { min: lo, max: hi, marcas };
}

export type RangoRapido = '3M' | '6M' | '12M' | 'TODO';

// Cuántos de los últimos puntos mostrar según el atajo elegido.
export function recortarRango<T>(puntos: T[], rango: RangoRapido): T[] {
  if (rango === 'TODO') return puntos;
  const n = rango === '3M' ? 3 : rango === '6M' ? 6 : 12;
  return puntos.slice(-n);
}
