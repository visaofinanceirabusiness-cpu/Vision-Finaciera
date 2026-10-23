// lib/visao3dCasaPlano.ts
//
// Visão 3D, "la casa": plano de cuartos según cuántos objetos hay en cada grupo. Lógica pura (sin three) y testeada.
//
// Reglas del dueño: máximo 5 objetos por cuarto; si no entran se agrega un cuarto AL LADO y, si ya hay uno al lado,
// se SUBE de piso. El Activo manda y crece hacia la izquierda de la cochera (y luego hacia arriba); el Pasivo crece con
// cuartos a la derecha y el Patrimonio va SIEMPRE debajo del Pasivo con el mismo ancho. Con pocas cuentas el plano es
// el de la casa base de 5 cuartos (mismas medidas que `familia/layout.ts`), así nada cambia para las familias chicas.
//
// Las medidas se repiten acá (y no se importan de `familia/layout.ts`) para que esta lógica siga siendo pura y reutilizable
// por los otros perfiles; el test comprueba que el plano base coincide con la casa dibujada.

import type { GrupoId } from './visao3d';

export const CAPACIDAD_CUARTO = 5;
export const ALTO_PISO = 3.75;
export const ANCHO_COCHERA = 5.9;
export const ANCHO_CUARTO = 6.3;
// Tope de columnas por piso antes de subir de piso (el Activo se ensancha hasta ahí; el lado Pasivo/Patrimonio, igual).
export const MAX_COLUMNAS_ACTIVO = 4;
export const MAX_COLUMNAS_DERECHA = 3;

// Mismas posiciones que la casa base (ver `familia/layout.ts`).
const X_COCHERA = -5.7; // límite cochera | living
const X_DER_BASE = 6.8;

export type Cuarto = {
  id: string; // 'garage' | 'living' | 'dormitorio' | 'oficina' | 'comedor' en la base; 'activo-4', 'pasivo-2', 'patrimonio-2'… los agregados
  grupo: GrupoId;
  orden: number; // posición dentro de su grupo en el orden de llenado
  col: number; // 0 = columna de la cochera, negativo a su izquierda, positivo a la derecha
  piso: number; // 0 = planta baja
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

export type PlanoCasa = {
  cuartos: Cuarto[];
  pisos: number;
  x0: number;
  x1: number;
  cuartosDe: (grupo: GrupoId) => Cuarto[];
};

export type ConteoObjetos = Record<GrupoId, number>;

const cuartosNecesarios = (n: number, minimo: number) => Math.max(minimo, Math.ceil(Math.max(0, n) / CAPACIDAD_CUARTO));

type Casilla = { col: number; piso: number };

// Orden de llenado del Activo: la base (cochera, living, dormitorio) y después cuartos al lado y hacia arriba.
function casillasActivo(cantidad: number): Casilla[] {
  const casillas: Casilla[] = [
    { col: 0, piso: 0 },
    { col: 1, piso: 0 },
    { col: 1, piso: 1 },
  ];
  // Completa la 2x2 base, después ensancha hacia la izquierda de a pares (planta baja + alta) y por último sube de piso.
  const extra: Casilla[] = [{ col: 0, piso: 1 }];
  for (let c = -1; c > -(MAX_COLUMNAS_ACTIVO - 1); c -= 1) extra.push({ col: c, piso: 0 }, { col: c, piso: 1 });
  const columnas = [0, 1, ...Array.from({ length: MAX_COLUMNAS_ACTIVO - 2 }, (_, i) => -(i + 1))];
  for (let piso = 2; extra.length + 3 < cantidad; piso += 1) columnas.forEach((col) => extra.push({ col, piso }));
  return [...casillas, ...extra].slice(0, Math.max(3, cantidad));
}

export function planificarCasa(conteo: ConteoObjetos): PlanoCasa {
  const nActivo = cuartosNecesarios(conteo.ACTIVO, 3);
  const nPasivo = cuartosNecesarios(conteo.PASIVO, 1);
  const nPatrimonio = cuartosNecesarios(conteo.PATRIMONIO, 1);
  const cuartos: Cuarto[] = [];

  const xDeColumna = (col: number): [number, number] => {
    if (col === 0) return [X_COCHERA - ANCHO_COCHERA, X_COCHERA];
    if (col < 0) return [X_COCHERA - ANCHO_COCHERA + col * ANCHO_CUARTO, X_COCHERA - ANCHO_COCHERA + (col + 1) * ANCHO_CUARTO];
    // col 1 = living/dormitorio, col 2.. = lado derecho
    const x0 = X_COCHERA + (col - 1) * ANCHO_CUARTO;
    return [x0, col === 1 ? 0.6 : x0 + ANCHO_CUARTO - 0.1];
  };

  const idActivo = ['garage', 'living', 'dormitorio'];
  casillasActivo(nActivo).forEach((c, i) => {
    const [x0, x1] = xDeColumna(c.col);
    cuartos.push({ id: idActivo[i] ?? `activo-${i + 1}`, grupo: 'ACTIVO', orden: i, col: c.col, piso: c.piso, x0, x1, y0: c.piso * ALTO_PISO, y1: c.piso * ALTO_PISO + 3.6 });
  });

  // Lado derecho: Pasivo y Patrimonio comparten ancho (el Patrimonio abajo, el Pasivo encima).
  const ancho = Math.min(MAX_COLUMNAS_DERECHA, Math.max(nPasivo, nPatrimonio));
  const filasPatrimonio = Math.ceil(nPatrimonio / ancho);
  const filasPasivo = Math.ceil(nPasivo / ancho);
  const colDerecha = (k: number): [number, number] => {
    // La primera columna derecha termina en X_DER_BASE; las demás se agregan hacia la derecha.
    const x0 = 0.6 + k * (X_DER_BASE - 0.6);
    return [x0, x0 + (X_DER_BASE - 0.6)];
  };
  const idPasivo = ['oficina'];
  const idPatrimonio = ['comedor'];
  const llenarDerecha = (grupo: GrupoId, filas: number, pisoInicial: number, ids: string[], prefijo: string) => {
    for (let f = 0; f < filas; f += 1) {
      for (let k = 0; k < ancho; k += 1) {
        const orden = f * ancho + k;
        const [x0, x1] = colDerecha(k);
        const piso = pisoInicial + f;
        cuartos.push({ id: ids[orden] ?? `${prefijo}-${orden + 1}`, grupo, orden, col: 2 + k, piso, x0, x1, y0: piso * ALTO_PISO, y1: piso * ALTO_PISO + 3.6 });
      }
    }
  };
  llenarDerecha('PATRIMONIO', filasPatrimonio, 0, idPatrimonio, 'patrimonio');
  llenarDerecha('PASIVO', filasPasivo, filasPatrimonio, idPasivo, 'pasivo');

  // El piso más alto de la base (dormitorio y oficina) está en el piso 1: con Patrimonio 1 fila + Pasivo 1 fila coincide.
  const pisos = Math.max(...cuartos.map((c) => c.piso)) + 1;
  return {
    cuartos,
    pisos,
    x0: Math.min(...cuartos.map((c) => c.x0)),
    x1: Math.max(...cuartos.map((c) => c.x1)),
    cuartosDe: (grupo) => cuartos.filter((c) => c.grupo === grupo).sort((a, b) => a.orden - b.orden),
  };
}
