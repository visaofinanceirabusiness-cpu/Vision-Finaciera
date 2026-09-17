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
// puntual — funciona como un comprobante ("quedó validada"). La usa
// Panel Maestro al validar una operación/movimiento pendiente a mano,
// y registrarOperacion (lib/motor.ts) cuando la empresa tiene
// validación automática (ahí no hay ningún admin de por medio, así
// que la propia empresa se autonotifica). El servidor exige que quien
// llama sea admin de plataforma o pertenezca a esa misma empresa.
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
