import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Lo dispara un Vercel Cron Job (ver vercel.json) cada cierta cantidad
// de minutos. Busca eventos del Calendário Organizador con recordatorio
// pendiente cuya hora de aviso (fecha+hora - antelación) ya llegó, y
// les manda push a TODOS los usuarios de esa empresa — reutiliza la
// misma infraestructura de web-push + push_subscriptions que
// /api/push/notificar, pero acá el destinatario es "toda la empresa
// dueña del evento", no los admins de plataforma.
//
// Protegido con CRON_SECRET (patrón estándar de Vercel Cron): Vercel
// manda automáticamente `Authorization: Bearer <CRON_SECRET>` cuando
// invoca el cron si la env var está configurada.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:visaofinanceirabusiness@gmail.com';
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Notificaciones push no configuradas en el servidor.' }, { status: 501 });
  }

  if (CRON_SECRET) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const ahora = new Date();

  // Ventana acotada: eventos de hoy, ayer o mañana con recordatorio
  // pendiente — de ahí se filtra en memoria por el instante exacto
  // (evita traer toda la tabla, y cubre la antelación máxima de 1 día).
  const desde = new Date(ahora);
  desde.setDate(desde.getDate() - 1);
  const hasta = new Date(ahora);
  hasta.setDate(hasta.getDate() + 1);

  const aFecha = (d: Date) => d.toISOString().slice(0, 10);

  const { data: candidatos, error: errorCandidatos } = await admin
    .from('eventos_calendario')
    .select('id, empresa_id, titulo, categoria, fecha, hora, antelacion_minutos')
    .eq('notificar', true)
    .eq('notificado', false)
    .not('hora', 'is', null)
    .gte('fecha', aFecha(desde))
    .lte('fecha', aFecha(hasta));

  if (errorCandidatos) {
    return NextResponse.json({ error: errorCandidatos.message }, { status: 500 });
  }

  const listos = (candidatos ?? []).filter((ev) => {
    const momentoEvento = new Date(`${ev.fecha}T${ev.hora}`);
    const momentoAviso = new Date(momentoEvento.getTime() - ev.antelacion_minutos * 60_000);
    return momentoAviso <= ahora;
  });

  if (listos.length === 0) {
    return NextResponse.json({ revisados: candidatos?.length ?? 0, notificados: 0 });
  }

  const empresaIds = Array.from(new Set(listos.map((ev) => ev.empresa_id)));

  const { data: perfilesEmpresas } = await admin
    .from('perfiles')
    .select('id, empresa_id')
    .in('empresa_id', empresaIds);

  const usuariosPorEmpresa = new Map<string, string[]>();
  for (const p of perfilesEmpresas ?? []) {
    const lista = usuariosPorEmpresa.get(p.empresa_id) ?? [];
    lista.push(p.id);
    usuariosPorEmpresa.set(p.empresa_id, lista);
  }

  const todosLosUsuarios = Array.from(new Set((perfilesEmpresas ?? []).map((p) => p.id)));

  type Suscripcion = { id: string; user_id: string; endpoint: string; p256dh: string; auth_key: string };

  const { data: suscripciones } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_key')
    .in('user_id', todosLosUsuarios.length > 0 ? todosLosUsuarios : ['00000000-0000-0000-0000-000000000000']);

  const suscripcionesPorUsuario = new Map<string, Suscripcion[]>();
  for (const s of (suscripciones ?? []) as Suscripcion[]) {
    const lista = suscripcionesPorUsuario.get(s.user_id) ?? [];
    lista.push(s);
    suscripcionesPorUsuario.set(s.user_id, lista);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let notificados = 0;
  const idsAMarcar: string[] = [];

  for (const ev of listos) {
    const usuarios = usuariosPorEmpresa.get(ev.empresa_id) ?? [];
    const payload = JSON.stringify({
      title: `📅 ${ev.titulo}`,
      body: ev.hora ? `Hoje às ${String(ev.hora).slice(0, 5)}` : '',
      url: '/',
    });

    let algunEnviado = false;

    await Promise.all(
      usuarios.flatMap((userId) =>
        (suscripcionesPorUsuario.get(userId) ?? []).map(async (suscripcion) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: suscripcion.endpoint,
                keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth_key },
              },
              payload
            );
            algunEnviado = true;
          } catch (errorEnvio) {
            const detalle = errorEnvio as { statusCode?: number };
            if (detalle?.statusCode === 404 || detalle?.statusCode === 410) {
              await admin.from('push_subscriptions').delete().eq('id', suscripcion.id);
            }
          }
        })
      )
    );

    if (algunEnviado) notificados += 1;
    idsAMarcar.push(ev.id);
  }

  // Se marca como notificado incluso si no había ninguna suscripción
  // activa (el usuario no aceptó push) — para no reintentar para
  // siempre un evento cuyo horario ya pasó.
  if (idsAMarcar.length > 0) {
    await admin.from('eventos_calendario').update({ notificado: true }).in('id', idsAMarcar);
  }

  return NextResponse.json({ revisados: candidatos?.length ?? 0, notificados, procesados: idsAMarcar.length });
}
