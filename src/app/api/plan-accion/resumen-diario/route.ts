import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { enviarEmail } from '@/lib/email';
import { EMPRESAS_CON_PLAN_ACCION } from '@/lib/planAccionEmpresas';

// Lo dispara un Vercel Cron Job (ver vercel.json), una vez por día.
// Para cada empresa con Plan de Acción de 30 Días (hoy solo
// Buenaventura, ver EMPRESAS_CON_PLAN_ACCION), busca el día
// DISPONIBLE, arma un resumen de cuántas tareas lleva completadas y
// lo manda por dos canales: push (misma infraestructura de
// web-push + push_subscriptions que ya usa
// /api/calendario/verificar-recordatorios) y email (vía
// lib/email.ts). Si un canal no está configurado o falla, no frena
// al otro — cada empresa se procesa de forma independiente.
//
// Protegido con CRON_SECRET (patrón estándar de Vercel Cron).
//
// force-dynamic: sin esto, Next.js detecta un GET sin uso obligatorio
// de request/cookies y lo trata como contenido estático — lo ejecuta
// UNA sola vez en el build y sirve esa misma respuesta cacheada para
// siempre (confirmado en los logs de producción: cache=PRERENDER en
// cada invocación del cron). Con force-dynamic corre de nuevo en cada
// llamada, como corresponde a un cron que lee la base de datos.
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:visaofinanceirabusiness@gmail.com';
const CRON_SECRET = process.env.CRON_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
// Mientras no haya un dominio propio verificado en Resend, el
// remitente de pruebas (onboarding@resend.dev) solo puede mandar a la
// casilla dueña de la cuenta de Resend — no a la de cada empresa. Esta
// variable, si está definida, redirige TODOS los emails de este cron
// a esa casilla de prueba en vez del email real de la empresa. Sacarla
// (o dejarla vacía) apenas se verifique un dominio propio.
const EMAIL_DESTINO_PRUEBA = process.env.RESEND_TEST_TO;

type Tarea = { turno: 'EJECUCION' | 'CIERRE'; completada: boolean };

function armarResumen(dia: {
  dia_numero: number;
  fase: number;
  objetivo: string;
}, tareas: Tarea[]) {
  const ejecucion = tareas.filter((t) => t.turno === 'EJECUCION');
  const cierre = tareas.filter((t) => t.turno === 'CIERRE');
  const ejecucionHechas = ejecucion.filter((t) => t.completada).length;
  const cierreHechas = cierre.filter((t) => t.completada).length;
  const total = tareas.length;
  const hechas = ejecucionHechas + cierreHechas;

  let linea: string;
  if (total > 0 && hechas === total) {
    linea = `¡Completaste las ${total} tareas de hoy! Entrá a cerrar el día y desbloquear el siguiente.`;
  } else if (hechas === 0) {
    linea = `Tenés ${total} tareas para hoy (turno mañana: ${ejecucion.length} · turno noche: ${cierre.length}).`;
  } else {
    linea = `Vas ${hechas}/${total} tareas de hoy (mañana ${ejecucionHechas}/${ejecucion.length} · noche ${cierreHechas}/${cierre.length}).`;
  }

  const titulo = `📋 Plan de Acción — Día ${dia.dia_numero}`;
  const cuerpo = `${dia.objetivo}. ${linea}`;

  const enlace = SITE_URL ? `${SITE_URL}/plan-accion` : null;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p style="font-size: 12px; color: #6e7781; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Fase ${dia.fase}</p>
      <h2 style="color: #1f3a5f; margin: 0 0 12px;">Día ${dia.dia_numero}: ${dia.objetivo}</h2>
      <p style="font-size: 15px; color: #1f2937;">${linea}</p>
      ${enlace ? `<p style="margin-top: 20px;"><a href="${enlace}" style="background: #2e8b57; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">Ver mi Plan de Acción</a></p>` : ''}
    </div>
  `;

  return { titulo, cuerpo, subject: titulo, html };
}

export async function GET(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase no configurado en el servidor.' }, { status: 501 });
  }

  if (CRON_SECRET) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const puedeMandarPush = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  if (puedeMandarPush) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY as string, VAPID_PRIVATE_KEY as string);
  }

  const resultados: Record<string, string> = {};

  for (const empresaId of EMPRESAS_CON_PLAN_ACCION) {
    const { data: dia, error: errorDia } = await admin
      .from('plan_accion_dias')
      .select('id, dia_numero, fase, objetivo')
      .eq('empresa_id', empresaId)
      .eq('estado', 'DISPONIBLE')
      .maybeSingle();

    if (errorDia) {
      resultados[empresaId] = `error consultando plan_accion_dias: ${errorDia.message}`;
      continue;
    }

    if (!dia) {
      resultados[empresaId] = 'sin día disponible (ciclo no iniciado o ya completado)';
      continue;
    }

    const { data: tareas } = await admin
      .from('plan_accion_tareas')
      .select('turno, completada')
      .eq('dia_id', dia.id);

    const resumen = armarResumen(dia, (tareas ?? []) as Tarea[]);

    // --- Push a todos los usuarios de la empresa ---
    let pushEnviados = 0;
    if (puedeMandarPush) {
      const { data: perfiles } = await admin.from('perfiles').select('id').eq('empresa_id', empresaId);
      const usuarioIds = (perfiles ?? []).map((p) => p.id);

      type Suscripcion = { id: string; endpoint: string; p256dh: string; auth_key: string };
      const { data: suscripciones } = await admin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth_key')
        .in('user_id', usuarioIds.length > 0 ? usuarioIds : ['00000000-0000-0000-0000-000000000000']);

      const payload = JSON.stringify({ title: resumen.titulo, body: resumen.cuerpo, url: '/plan-accion' });

      await Promise.all(
        ((suscripciones ?? []) as Suscripcion[]).map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
              payload
            );
            pushEnviados += 1;
          } catch (errorEnvio) {
            const detalle = errorEnvio as { statusCode?: number };
            if (detalle?.statusCode === 404 || detalle?.statusCode === 410) {
              await admin.from('push_subscriptions').delete().eq('id', s.id);
            }
          }
        })
      );
    }

    // --- Email a la empresa (o a la casilla de prueba, ver EMAIL_DESTINO_PRUEBA) ---
    const { data: empresa } = await admin.from('empresas').select('email').eq('id', empresaId).maybeSingle();
    const destinoEmail = EMAIL_DESTINO_PRUEBA || empresa?.email;
    let emailEnviado = false;
    if (destinoEmail) {
      const envio = await enviarEmail({ to: destinoEmail, subject: resumen.subject, html: resumen.html });
      emailEnviado = envio.enviado;
    }

    resultados[empresaId] = `día ${dia.dia_numero} — push: ${pushEnviados} · email: ${emailEnviado ? 'sí' : 'no'}`;
  }

  return NextResponse.json({ resultados });
}
