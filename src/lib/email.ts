// lib/email.ts
//
// Envío de email transaccional — hoy solo lo usa el resumen diario del
// Plan de Acción (ver api/plan-accion/resumen-diario), pero queda acá
// como punto único por si se suma otro correo automático más adelante.
// Usa Resend (RESEND_API_KEY + RESEND_FROM en variables de entorno).
// Si no están configuradas, no rompe al que la llama: devuelve
// { enviado: false } y deja loggeado el motivo — mismo criterio de
// "fallar en silencio" que ya usa notificarPush.ts para no tumbar el
// flujo que dispara la notificación.

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? 'Visão Financeira <onboarding@resend.dev>';

export async function enviarEmail(destino: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ enviado: boolean; motivo?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurada — se omite el envío de email.');
    return { enviado: false, motivo: 'RESEND_API_KEY no configurada' };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: destino.to,
      subject: destino.subject,
      html: destino.html,
    });

    if (error) {
      console.warn('Error enviando email:', error.message);
      return { enviado: false, motivo: error.message };
    }

    return { enviado: true };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : 'Error desconocido enviando email.';
    console.warn('Error enviando email:', motivo);
    return { enviado: false, motivo };
  }
}
