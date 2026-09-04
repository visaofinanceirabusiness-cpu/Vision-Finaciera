import { supabase } from './supabase';

// Por qué un usuario logueado no tiene fila en `perfiles` — puede ser
// porque todavía no lo aprobaron (recién se registró y su solicitud
// sigue PENDIENTE/fue RECHAZADA), o porque su empresa fue borrada
// (eliminar_empresa_completa se lleva puesto el perfil junto con todo
// lo demás). login/page.tsx y GuardiaSesion necesitan distinguir estos
// casos para no mostrarle "tu empresa fue borrada" a alguien que
// simplemente está esperando que lo aprueben.
export type MotivoSinPerfil = 'pendiente' | 'rechazada' | 'sin_empresa';

export async function motivoSinPerfil(userId: string): Promise<MotivoSinPerfil> {
  const { data: solicitud } = await supabase
    .from('solicitudes_alta')
    .select('estado')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (solicitud?.estado === 'PENDIENTE') return 'pendiente';
  if (solicitud?.estado === 'RECHAZADA') return 'rechazada';
  return 'sin_empresa';
}
