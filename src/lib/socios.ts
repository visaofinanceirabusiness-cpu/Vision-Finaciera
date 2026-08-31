// lib/socios.ts
//
// SOCIOS/AS DE LA EMPRESA — usados como "a quién" en Inversión
// (aporte), Extracción (retiro) y Pérdida. Antes esa lista salía de
// los usuarios reales con acceso al sistema (tabla perfiles), lo que
// dejaba afuera a cualquier socio/a que no tuviera su propio login.
// Esta tabla es independiente de los accesos: es solo una lista de
// nombres que el admin o el cliente cargan a mano.

import { supabase } from './supabase';

function generarCodigo(nombre: string, existentes: string[]): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');

  if (!existentes.includes(base)) {
    return base;
  }

  for (let sufijo = 2; sufijo < 100; sufijo += 1) {
    const candidato = `${base.slice(0, 2)}${sufijo}`;
    if (!existentes.includes(candidato)) {
      return candidato;
    }
  }

  return `${base}${Date.now()}`;
}

export async function crearSocio(empresaId: string, nombre: string) {
  const { data: existentes, error: errorExistentes } = await supabase
    .from('socios')
    .select('codigo')
    .eq('empresa_id', empresaId);

  if (errorExistentes) {
    throw errorExistentes;
  }

  const codigo = generarCodigo(nombre, (existentes ?? []).map((s) => s.codigo));

  const { error } = await supabase
    .from('socios')
    .insert({ empresa_id: empresaId, codigo, nombre: nombre.trim(), activo: true });

  if (error) {
    throw error;
  }
}

export async function cambiarActivoSocio(id: string, activo: boolean) {
  const { error } = await supabase.from('socios').update({ activo }).eq('id', id);

  if (error) {
    throw error;
  }
}

export async function eliminarSocio(id: string) {
  const { data: socio, error: errorSocio } = await supabase
    .from('socios')
    .select('empresa_id, nombre')
    .eq('id', id)
    .maybeSingle();

  if (errorSocio || !socio) {
    throw errorSocio ?? new Error('No se encontró el socio/a.');
  }

  const { count, error: errorMovimiento } = await supabase
    .from('registro_operaciones')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', socio.empresa_id)
    .eq('cliente_proveedor', socio.nombre);

  if (errorMovimiento) {
    throw errorMovimiento;
  }

  if (count && count > 0) {
    throw new Error(
      `No se puede eliminar a "${socio.nombre}" porque ya tiene operaciones registradas. Podés desactivarlo/a en vez de eliminarlo/a.`
    );
  }

  const { error } = await supabase.from('socios').delete().eq('id', id);

  if (error) {
    throw error;
  }
}
