// lib/escalonesVistos.ts
//
// Registro (por dispositivo) de los festejos de Objetivos Escalonados que ya
// se vieron. Lo comparten el lobby y la sección Objetivos del Panel: si el
// festejo se vio en uno, no se repite en el otro. Es solo visual (ver
// components/panel/ObjetivosEscalonados.tsx): el progreso de los escalones
// vuelve a cero en cada nivel, no vale una tabla en la base.

import type { ObjetivoEscalonado, TipoEscalonado } from './objetivosEscalonados';

export function claveEscalonVisto(empresaId: string, nivel: number, tipo: TipoEscalonado, indice: number): string {
  return `escalon_visto_${empresaId}_${nivel}_${tipo}_${indice}`;
}

export function escalonYaVisto(clave: string): boolean {
  try {
    return window.localStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
}

export function marcarEscalonVisto(clave: string) {
  try {
    window.localStorage.setItem(clave, '1');
  } catch {
    // localStorage bloqueado (modo privado, etc.): el festejo puede repetirse
    // en la próxima visita, no es grave.
  }
}

// Primer escalón cumplido que todavía no se festejó, del más chico al más
// grande: si se cumplieron varios de una vez, se encadenan.
export function siguienteEscalonPendiente(
  objetivos: Pick<ObjetivoEscalonado, 'tipo' | 'checkpointsCumplidos'>[],
  fueVisto: (tipo: TipoEscalonado, indice: number) => boolean
): { tipo: TipoEscalonado; indice: number } | null {
  for (const objetivo of objetivos) {
    for (let indice = 0; indice < objetivo.checkpointsCumplidos; indice++) {
      if (!fueVisto(objetivo.tipo, indice)) {
        return { tipo: objetivo.tipo, indice };
      }
    }
  }

  return null;
}
