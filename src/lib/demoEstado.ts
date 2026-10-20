// lib/demoEstado.ts
//
// Lo que quien presenta tiene habilitado para los espectadores (demo_accesos.habilitadas), leído
// por ProveedorEspectador cada pocos segundos y compartido con las pantallas.

import { useSyncExternalStore } from 'react';

export type EstadoDemo = { habilitadas: string[]; activo: boolean; cargado: boolean; empresa: string | null };

let estado: EstadoDemo = { habilitadas: [], activo: true, cargado: false, empresa: null };
const oyentes = new Set<() => void>();

export function fijarEstadoDemo(cambios: Partial<EstadoDemo>): void {
  const siguiente = { ...estado, ...cambios };
  const igual =
    siguiente.activo === estado.activo &&
    siguiente.cargado === estado.cargado &&
    siguiente.empresa === estado.empresa &&
    siguiente.habilitadas.length === estado.habilitadas.length &&
    siguiente.habilitadas.every((h, i) => h === estado.habilitadas[i]);

  if (igual) return;
  estado = siguiente;
  oyentes.forEach((oyente) => oyente());
}

export function useEstadoDemo(): EstadoDemo {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    () => estado,
    () => estado
  );
}
