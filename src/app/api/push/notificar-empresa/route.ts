import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Envía una notificación push a TODOS los usuarios de una empresa
// puntual — funciona como un comprobante ("quedó validada"). Dos
// disparadores:
//   1. Panel Maestro, justo después de que un admin valida a mano una
//      operación/movimiento pendiente.
//   2. registrarOperacion (lib/motor.ts), cuando la empresa tiene
//      validación automática — ahí no hay ningún admin de por medio,
//      así que la propia empresa se autonotifica.
//
// Por eso quien llama tiene que ser admin de plataforma (caso 1) O
// pertenecer a esa misma empresa (caso 2) — nunca un usuario de OTRA
// empresa.
//
// Reutiliza la misma infraestructura de web-push + push_subscriptions
// que /api/push/notificar (avisos a admins) y el cron de recordatorios
// del Calendário (avisos a toda una empresa).

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

  const { data: perfilLlamante } = await supabaseAdmin
    .from('perfiles')
    .select('empresa_id, es_admin_plataforma')
    .eq('id', usuario.user.id)
    .maybeSingle();

  const { empresaId, titulo, cuerpo, url } = await request.json();

  if (!empresaId) {
    return NextResponse.json({ error: 'Falta empresaId.' }, { status: 400 });
  }

  const puedeNotificar = perfilLlamante?.es_admin_plataforma || perfilLlamante?.empresa_id === empresaId;

  if (!puedeNotificar) {
    return NextResponse.json(
      { error: 'Solo un admin de plataforma o un usuario de esa misma empresa puede notificarla.' },
      { status: 403 }
    );
  }

  const { data: perfilesEmpresa, error: errorPerfiles } = await supabaseAdmin
    .from('perfiles')
    .select('id')
    .eq('empresa_id', empresaId);

  if (errorPerfiles) {
    console.error('Error consultando perfiles de la empresa:', errorPerfiles);
    return NextResponse.json({ error: errorPerfiles.message }, { status: 500 });
  }

  const idsUsuarios = (perfilesEmpresa ?? []).map((p) => p.id);

  if (idsUsuarios.length === 0) {
    return NextResponse.json({ enviadas: 0, totalSuscripciones: 0, fallidas: [] });
  }

  const { data: suscripciones, error: errorSuscripciones } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .in('user_id', idsUsuarios);

  if (errorSuscripciones) {
    console.error('Error consultando suscripciones:', errorSuscripciones);
    return NextResponse.json({ error: errorSuscripciones.message }, { status: 500 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const payload = JSON.stringify({
    title: titulo || 'Visão Financeira',
    body: cuerpo || '',
    url: url || '/',
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

        if (detalle?.statusCode === 404 || detalle?.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', suscripcion.id);
        }
      }
    })
  );

  return NextResponse.json({ enviadas, totalSuscripciones: (suscripciones ?? []).length, fallidas });
}
