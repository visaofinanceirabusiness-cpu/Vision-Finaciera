// lib/visao3dLayout.ts
//
// Geometría del edificio (lógica pura, testeada): qué hijos se muestran y cómo se reparten los pisos.
// El tamaño de cada piso sigue el valor, pero acotado para que lo chico siga siendo visible y lo
// grande no aplaste al resto (ver alturasProporcionales). La escena 3D solo dibuja lo que sale de acá.

import { alturasProporcionales, buscarNodo, caminoHasta, type GrupoId, type NodoEdificio } from './visao3d';

export const MAX_PISOS = 12;
export const ALTURA_EDIFICIO = 6;
// Cada piso necesita lugar para el objeto de su cuenta (auto, mesa, billetes…).
const MINIMO_PISO = 0.9;
const MINIMO_VOLUMEN = 1.4;

export const COLOR_GRUPO: Record<GrupoId, string> = { ACTIVO: '#2f7df6', PASIVO: '#f08a24', PATRIMONIO: '#a259e6' };

export type Piso = {
  id: string;
  nodo: NodoEdificio;
  // Centro del piso dentro del volumen (el volumen está apoyado en y = 0, centrado en x/z).
  y: number;
  altura: number;
  // Cuentas que se agruparon en un "Otras" para no crear cientos de objetos.
  agrupado: boolean;
};

export type Volumen = {
  id: string;
  nodo: NodoEdificio;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  profundidad: number;
  pisos: Piso[];
};

// Hijos que se muestran: sin los saldos en cero (salvo que se pida), y con un tope. Lo que excede
// el tope se agrupa en un nodo "Otras" que SUMA esos saldos (no se pierde ni se duplica nada).
export function hijosVisibles(nodo: NodoEdificio, mostrarCeros: boolean, etiquetaOtras: string, maxPisos = MAX_PISOS): { visibles: NodoEdificio[]; ocultosEnCero: number } {
  const conSaldo = mostrarCeros ? nodo.hijos : nodo.hijos.filter((h) => Math.round(h.saldo) !== 0);
  const ocultosEnCero = nodo.hijos.length - conSaldo.length;
  if (conSaldo.length <= maxPisos) return { visibles: conSaldo, ocultosEnCero };

  const ordenados = conSaldo.slice().sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  const principales = ordenados.slice(0, maxPisos - 1);
  const resto = ordenados.slice(maxPisos - 1);
  const saldo = Math.round(resto.reduce((s, h) => s + h.saldo, 0) * 100) / 100;
  const anteriores = resto.map((h) => h.saldoAnterior);
  const saldoAnterior = anteriores.some((s) => s === null) ? null : Math.round(anteriores.reduce<number>((s, v) => s + (v ?? 0), 0) * 100) / 100;
  const variacion = saldoAnterior === null ? null : Math.round((saldo - saldoAnterior) * 100) / 100;

  const otras: NodoEdificio = {
    id: `otras:${nodo.id}`,
    codigo: null,
    nombre: `${etiquetaOtras} (${resto.length})`,
    grupo: nodo.grupo,
    nivel: nodo.nivel + 1,
    saldo,
    saldoAnterior,
    variacion,
    variacionPct: variacion === null || !saldoAnterior ? null : Math.round((variacion / Math.abs(saldoAnterior)) * 10000) / 100,
    participacion: nodo.saldo > 0 ? Math.round((saldo / nodo.saldo) * 10000) / 100 : null,
    hijos: resto,
    esHoja: false,
    sintetico: true,
    cuentasDependientes: resto.reduce((s, h) => s + (h.esHoja ? 1 : h.cuentasDependientes), 0),
    cuentaNombre: null,
  };

  const porCodigo = principales.sort((a, b) => (a.codigo ?? '~').localeCompare(b.codigo ?? '~', undefined, { numeric: true }));
  return { visibles: [...porCodigo, otras], ocultosEnCero };
}

function apilar(nodo: NodoEdificio, hijos: NodoEdificio[], alto: number, minimo: number): Piso[] {
  const alturas = alturasProporcionales(hijos.map((h) => h.saldo), alto, minimo);
  let base = 0;
  return hijos.map((h, i) => {
    const piso: Piso = { id: h.id, nodo: h, y: base + alturas[i] / 2, altura: alturas[i], agrupado: h.id.startsWith('otras:') };
    base += alturas[i];
    return piso;
  });
}

// Altura de un volumen según su valor, en la MISMA escala para todo el edificio: la referencia es el
// Activo total de la empresa (= 6). Así el Pasivo, el Patrimonio y cada rubro se ven más bajos o más altos
// según lo que valen, no todos del mismo tamaño. `pisosMinimos` evita que un volumen chico con muchos
// pisos quede aplastado.
export function alturaPorValor(saldo: number, referencia: number, pisosMinimos = 0, minimoVolumen = MINIMO_VOLUMEN): number {
  const proporcion = referencia > 0 ? Math.abs(saldo) / referencia : 1;
  const minimo = Math.max(minimoVolumen, pisosMinimos * MINIMO_PISO + 0.25);
  return Math.min(ALTURA_EDIFICIO, Math.max(minimo, ALTURA_EDIFICIO * proporcion));
}

// Con la empresa completa: el Activo a la izquierda y, a la derecha, el Pasivo sobre el Patrimonio. La altura
// exterior es siempre la misma (la ecuación Activo = Pasivo + Patrimonio: el techo queda parejo); lo que
// cambia con los valores es cómo se reparte la columna de la derecha entre Pasivo y Patrimonio, con un
// mínimo para que ninguno desaparezca ni se pueda leer su nombre. Con cualquier otro nodo: su volumen
// (más o menos alto según su valor) con sus hijos como pisos. `referencia` = Activo total de la empresa.
export function disenarVolumenes(foco: NodoEdificio, mostrarCeros: boolean, etiquetaOtras: string, referencia?: number): { volumenes: Volumen[]; ocultosEnCero: number } {
  if (foco.nivel === 0) {
    const [activo, pasivo, patrimonio] = foco.hijos;
    const [altoPasivo, altoPatrimonio] = alturasProporcionales([pasivo.saldo, patrimonio.saldo], ALTURA_EDIFICIO, 0.9);
    const ancho = 4.4;
    const profundidad = 4;
    const armar = (nodo: NodoEdificio, x: number, y: number, alto: number): Volumen => {
      const visibles = hijosVisibles(nodo, mostrarCeros, etiquetaOtras, 12).visibles;
      return { id: nodo.id, nodo, x, y, ancho, alto, profundidad, pisos: apilar(nodo, visibles, alto, Math.min(0.22, alto / Math.max(visibles.length, 1))) };
    };

    return {
      volumenes: [armar(activo, -2.5, 0, ALTURA_EDIFICIO), armar(patrimonio, 2.5, 0, altoPatrimonio), armar(pasivo, 2.5, altoPatrimonio, altoPasivo)],
      ocultosEnCero: 0,
    };
  }

  const { visibles, ocultosEnCero } = hijosVisibles(foco, mostrarCeros, etiquetaOtras);
  const alto = alturaPorValor(foco.saldo, referencia ?? foco.saldo, visibles.length);
  return {
    volumenes: [{ id: foco.id, nodo: foco, x: 0, y: 0, ancho: 6.4, alto, profundidad: 4.6, pisos: apilar(foco, visibles, alto, MINIMO_PISO) }],
    ocultosEnCero,
  };
}

// Resuelve un id a su nodo, incluyendo los "Otras" que arma hijosVisibles (que no están en el árbol).
export function resolverNodo(raiz: NodoEdificio, id: string, mostrarCeros: boolean, etiquetaOtras: string): NodoEdificio | null {
  if (id.startsWith('otras:')) {
    const padre = buscarNodo(raiz, id.slice('otras:'.length));
    return padre ? hijosVisibles(padre, mostrarCeros, etiquetaOtras).visibles.find((h) => h.id === id) ?? null : null;
  }
  return buscarNodo(raiz, id);
}

// Camino desde la empresa; si el último tramo es un "Otras", cuelga de su padre.
export function caminoResuelto(raiz: NodoEdificio, id: string, mostrarCeros: boolean, etiquetaOtras: string): NodoEdificio[] {
  if (id.startsWith('otras:')) {
    const otras = resolverNodo(raiz, id, mostrarCeros, etiquetaOtras);
    const padre = caminoHasta(raiz, id.slice('otras:'.length));
    return otras && padre.length ? [...padre, otras] : [];
  }
  return caminoHasta(raiz, id);
}
