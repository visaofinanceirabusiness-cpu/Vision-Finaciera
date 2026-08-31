import { supabase } from '@/lib/supabase';

// Le pide al servidor que avise por notificación push a los admins de
// la plataforma. Si algo falla (sin permiso, sin conexión, notificaciones
// no configuradas todavía) no debe romper el flujo principal de la
// operación que la disparó — por eso nunca lanza el error hacia arriba.
export async function notificarPendienteAlAdmin(mensaje: {
  titulo: string;
  cuerpo: string;
  url?: string;
}) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      return;
    }

    await fetch('/api/push/notificar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        titulo: mensaje.titulo,
        cuerpo: mensaje.cuerpo,
        url: mensaje.url,
      }),
    });
  } catch (error) {
    console.warn('No se pudo notificar por push:', error);
  }
}
