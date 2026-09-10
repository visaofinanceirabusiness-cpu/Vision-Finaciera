// lib/invitaciones.ts
//
// Alta y baja de los roles SOPORTE y ASISTENTE (Bloque E1 del Día 1
// de seguridad). El alta pasa por una invitación privada (tabla
// invitaciones): quien invita carga email+nombre, se genera un link
// con un token, y la persona invitada lo usa en /aceptar-convite para
// crear su cuenta y quedar vinculada — sin pasar por la cola de
// aprobación de solicitudes_alta, porque quien invita YA es la
// autoridad que la aprueba (el Desarrollador para Soporte, cualquier
// Cliente de la empresa para un Asistente propio).
//
// La baja es simétrica: no se borra nada, se apaga `perfiles.activo`
// — la persona pierde el acceso al toque (ver GuardiaSesion) pero
// queda el rastro. Reactivar es el camino inverso.

import { supabase } from './supabase';

export type TipoUsuario = 'DESARROLLADOR' | 'SOPORTE' | 'CLIENTE' | 'ASISTENTE';

export type Invitacion = {
  id: string;
  email: string;
  nombre: string;
  tipo_usuario: 'SOPORTE' | 'ASISTENTE';
  empresa_id: string | null;
  token: string;
  estado: 'PENDIENTE' | 'ACEPTADA' | 'REVOCADA' | 'EXPIRADA';
  creado_en: string;
  expira_en: string;
};

export type PerfilConRol = {
  id: string;
  nombre: string;
  tipo_usuario: TipoUsuario;
  activo: boolean;
  creado_en: string;
};

export function urlInvitacion(token: string): string {
  return `https://vision-finaciera.vercel.app/aceptar-convite?token=${token}`;
}

export async function crearInvitacionSoporte(email: string, nombre: string, invitadoPorId: string) {
  return supabase.from('invitaciones').insert({
    email: email.trim().toLowerCase(),
    nombre: nombre.trim(),
    tipo_usuario: 'SOPORTE',
    empresa_id: null,
    invitado_por: invitadoPorId,
  }).select('id, token').single();
}

export async function crearInvitacionAsistente(email: string, nombre: string, empresaId: string, invitadoPorId: string) {
  return supabase.from('invitaciones').insert({
    email: email.trim().toLowerCase(),
    nombre: nombre.trim(),
    tipo_usuario: 'ASISTENTE',
    empresa_id: empresaId,
    invitado_por: invitadoPorId,
  }).select('id, token').single();
}

export async function listarInvitacionesPendientes(tipoUsuario: 'SOPORTE' | 'ASISTENTE', empresaId?: string) {
  let query = supabase
    .from('invitaciones')
    .select('id, email, nombre, tipo_usuario, empresa_id, token, estado, creado_en, expira_en')
    .eq('tipo_usuario', tipoUsuario)
    .eq('estado', 'PENDIENTE')
    .order('creado_en', { ascending: false });

  if (empresaId) query = query.eq('empresa_id', empresaId);

  return query;
}

export async function revocarInvitacion(id: string) {
  return supabase.from('invitaciones').update({ estado: 'REVOCADA' }).eq('id', id);
}

export async function listarPerfilesPorTipo(tipoUsuario: 'SOPORTE' | 'ASISTENTE', empresaId?: string) {
  let query = supabase
    .from('perfiles')
    .select('id, nombre, tipo_usuario, activo, creado_en')
    .eq('tipo_usuario', tipoUsuario)
    .order('creado_en', { ascending: false });

  if (empresaId) query = query.eq('empresa_id', empresaId);

  return query;
}

export async function cambiarActivoPerfil(perfilId: string, activo: boolean) {
  return supabase.from('perfiles').update({ activo }).eq('id', perfilId);
}
