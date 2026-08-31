import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Envía una notificación push a todos los administradores de la
// plataforma (perfiles.es_admin_plataforma = true). Lo llaman las
// pantallas de los emprendedores cuando registran una operación nueva
// que queda pendiente de aprobación.
//
// Usa la service role key porque necesita leer las suscripciones de
// TODOS los admins, no solo las del usuario que dispara la llamada —
// por eso valida el token de sesión a mano en vez de confiar en RLS.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:visaofinanceirabusiness@gmail.com';

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Notificaciones push no configuradas en el servidor.' }, { status: 501 });
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: usuario, error: errorUsuario } = await supabaseAdmin.auth.getUser(token);

  if (errorUsuario || !usuario.user) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }

  const { titulo, cuerpo, url } = await request.json();

  const { data: admins, error: errorAdmins } = await supabaseAdmin
    .from('perfiles')
    .select('id')
    .eq('es_admin_plataforma', true);

  if (errorAdmins) {
    console.error('Error consultando admins:', errorAdmins);
  }

  const idsAdmin = (admins ?? []).map((admin) => admin.id);

  if (idsAdmin.length === 0) {
    return NextResponse.json({
      enviadas: 0,
      totalSuscripciones: 0,
      fallidas: [],
      debug: {
        paso: 'buscar_admins',
        adminsEncontrados: admins?.length ?? 0,
        errorAdmins: errorAdmins?.message ?? null,
      },
    });
  }

  const { data: suscripciones, error: errorSuscripciones } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .in('user_id', idsAdmin);

  if (errorSuscripciones) {
    console.error('Error consultando suscripciones:', errorSuscripciones);

    return NextResponse.json({
      enviadas: 0,
      totalSuscripciones: 0,
      fallidas: [],
      debug: { paso: 'buscar_suscripciones', errorSuscripciones: errorSuscripciones.message },
    });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const payload = JSON.stringify({
    title: titulo || 'Visão Financeira',
    body: cuerpo || '',
    url: url || '/panel-maestro',
  });

  let enviadas = 0;
  const fallidas: { endpoint: string; statusCode?: number; body?: string }[] = [];

  await Promise.all(
    (suscripciones ?? []).map(async (suscripcion) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: suscripcion.endpoint,
            keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth_key },
          },
          payload
        );
        enviadas += 1;
      } catch (errorEnvio) {
        const detalle = errorEnvio as { statusCode?: number; body?: string; message?: string };

        console.error('Error enviando push a', suscripcion.endpoint, detalle);

        fallidas.push({
          endpoint: suscripcion.endpoint,
          statusCode: detalle?.statusCode,
          body: detalle?.body ?? detalle?.message,
        });

        // Suscripción vencida o revocada por el navegador: se borra para
        // no seguir intentando enviarle en vano.
        if (detalle?.statusCode === 404 || detalle?.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', suscripcion.id);
        }
      }
    })
  );

  return NextResponse.json({ enviadas, totalSuscripciones: (suscripciones ?? []).length, fallidas });
}
