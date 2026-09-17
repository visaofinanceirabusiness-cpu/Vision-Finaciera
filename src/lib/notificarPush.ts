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

// Le pide al servidor que avise a todos los usuarios de una empresa
// puntual (la usa Panel Maestro al validar una operación/movimiento
// pendiente). Solo funciona si quien llama es admin de plataforma —
// el servidor lo valida de nuevo por las dudas.
export async function notificarValidacionAEmpresa(
  empresaId: string,
  mensaje: { titulo: string; cuerpo: string; url?: string }
) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      return;
    }

    await fetch('/api/push/notificar-empresa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        empresaId,
        titulo: mensaje.titulo,
        cuerpo: mensaje.cuerpo,
        url: mensaje.url,
      }),
    });
  } catch (error) {
    console.warn('No se pudo notificar por push a la empresa:', error);
  }
}
