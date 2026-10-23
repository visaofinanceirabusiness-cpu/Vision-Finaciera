// lib/visao3dApertura.ts
//
// Lee la apertura de Visão 3D desde la tabla `visao3d_apertura` (la edita Panel Maestro → Apertura de Visão 3D). Devuelve null si no
// se puede leer: ahí `empresaTieneVisao3D` usa el respaldo del código (visao3dEmpresas.ts), para que un error no cierre el acceso.

import { supabase } from './supabase';
import type { FilaApertura } from './visao3dEmpresas';

export async function cargarAperturaVisao3D(): Promise<FilaApertura[] | null> {
  try {
    const { data, error } = await supabase.from('visao3d_apertura').select('tipo, clave, abierto');
    if (error || !data) return null;
    return data as FilaApertura[];
  } catch {
    return null;
  }
}
