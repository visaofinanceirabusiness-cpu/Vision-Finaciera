'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Convierte la clave pública VAPID (base64url) al formato Uint8Array que
// pide la Push API del navegador.
function convertirClave(claveBase64: string): Uint8Array {
  const relleno = '='.repeat((4 - (claveBase64.length % 4)) % 4);
  const base64 = (claveBase64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const salida = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    salida[i] = raw.charCodeAt(i);
  }

  return salida;
}

// Botón para activar las notificaciones push en el celular. Al tocarlo:
// pide permiso al navegador, se suscribe y guarda la suscripción en
// Supabase (push_subscriptions, por user_id) — el mismo mecanismo sirve
// tanto para el admin (avisos de operaciones pendientes de aprobar,
// vía /api/push/notificar) como para cualquier cliente (recordatorios
// del Calendário Organizador de su propia empresa, vía el cron
// /api/calendario/verificar-recordatorios), no hay nada específico de
// admin en la suscripción en sí.
//
// `variante` adapta los colores al fondo donde vive (oscuro en el
// header de Panel Maestro, claro en el lobby de los clientes).
// `mostrarPrueba` oculta el botón "Probar", que llama a
// /api/push/notificar — ese endpoint solo le avisa a los admins de
// plataforma, así que en el lobby de un cliente no serviría de nada
// (y confundiría, porque no le llegaría nada a él).
export function NotificacionesPush({
  variante = 'oscuro',
  mostrarPrueba = true,
}: {
  variante?: 'oscuro' | 'claro';
  mostrarPrueba?: boolean;
}) {
  const [estado, setEstado] = useState<'inactivo' | 'activo' | 'no_disponible'>('inactivo');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [probando, setProbando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState('');

  useEffect(() => {
    async function verificarEstado() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) {
        setEstado('no_disponible');
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();

      setEstado(suscripcion ? 'activo' : 'inactivo');
    }

    verificarEstado().catch(() => setEstado('no_disponible'));
  }, []);

  async function activarNotificaciones() {
    setError('');
    setCargando(true);

    try {
      if (!VAPID_PUBLIC_KEY) {
        throw new Error('Las notificaciones todavía no están configuradas.');
      }

      const permiso = await Notification.requestPermission();

      if (permiso !== 'granted') {
        throw new Error('No diste permiso para recibir notificaciones.');
      }

      const registro = await navigator.serviceWorker.ready;

      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertirClave(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        throw new Error('Sesión no encontrada.');
      }

      const suscripcionJson = suscripcion.toJSON();

      const { error: errorGuardar } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userData.user.id,
          endpoint: suscripcionJson.endpoint,
          p256dh: suscripcionJson.keys?.p256dh,
          auth_key: suscripcionJson.keys?.auth,
        },
        { onConflict: 'endpoint' }
      );

      if (errorGuardar) {
        throw errorGuardar;
      }

      setEstado('activo');
    } catch (errorActivar) {
      console.error('Error activando notificaciones push:', errorActivar);

      let detalle = 'No se pudieron activar las notificaciones.';

      if (errorActivar instanceof Error) {
        detalle = errorActivar.message;
      } else if (
        errorActivar &&
        typeof errorActivar === 'object' &&
        'message' in errorActivar &&
        typeof (errorActivar as { message?: unknown }).message === 'string'
      ) {
        detalle = (errorActivar as { message: string }).message;
      }

      setError(detalle);
    } finally {
      setCargando(false);
    }
  }

  if (estado === 'no_disponible') {
    return null;
  }

  // Da de baja la suscripción: la cancela en el navegador y borra la
  // fila en push_subscriptions (si no se borra, el servidor le sigue
  // intentando mandar pushes a un endpoint que el browser ya no honra
  // hasta que falle y se autolimpie solo, en vez de al toque).
  async function desactivarNotificaciones() {
    setError('');
    setCargando(true);

    try {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();

      if (suscripcion) {
        const endpoint = suscripcion.endpoint;
        await suscripcion.unsubscribe();

        const { error: errorBorrar } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);

        if (errorBorrar) {
          throw errorBorrar;
        }
      }

      setEstado('inactivo');
      setResultadoPrueba('');
    } catch (errorDesactivar) {
      console.error('Error desactivando notificaciones push:', errorDesactivar);
      setError(
        errorDesactivar instanceof Error
          ? errorDesactivar.message
          : 'No se pudieron desactivar las notificaciones.'
      );
    } finally {
      setCargando(false);
    }
  }

  async function enviarPrueba() {
    setResultadoPrueba('');
    setProbando(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error('Sesión no encontrada.');
      }

      const respuesta = await fetch('/api/push/notificar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: 'Prueba de notificación',
          cuerpo: 'Si ves esto, las notificaciones push están funcionando.',
        }),
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(resultado?.error ?? `Error del servidor (${respuesta.status})`);
      }

      if (resultado.enviadas > 0) {
        setResultadoPrueba(`✅ Enviada (${resultado.enviadas}/${resultado.totalSuscripciones}). Si no te llegó, revisá los permisos de notificaciones de Chrome para esta app en el celular.`);
      } else if (resultado.fallidas?.length > 0) {
        setResultadoPrueba(`❌ Falló: ${resultado.fallidas[0].statusCode ?? ''} ${resultado.fallidas[0].body ?? ''}`.trim());
      } else if (resultado.debug) {
        setResultadoPrueba(`⚠️ Diagnóstico: ${JSON.stringify(resultado.debug)}`);
      } else {
        setResultadoPrueba('⚠️ No hay ninguna suscripción activa en el servidor.');
      }
    } catch (errorPrueba) {
      setResultadoPrueba(
        errorPrueba instanceof Error ? `❌ ${errorPrueba.message}` : '❌ No se pudo enviar la prueba.'
      );
    } finally {
      setProbando(false);
    }
  }

  const esClaro = variante === 'claro';

  if (estado === 'activo') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: esClaro ? '#166534' : '#ffffff',
              background: esClaro ? '#f0fdf4' : 'rgba(255,255,255,0.14)',
              border: esClaro ? '1px solid #bbf7d0' : '1px solid rgba(255,255,255,0.25)',
              borderRadius: 12,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            🔔 Notificaciones activadas
          </div>

          {mostrarPrueba && (
            <button
              onClick={enviarPrueba}
              disabled={probando}
              style={{
                background: 'transparent',
                border: esClaro ? '1px solid #94a3b8' : '1px solid rgba(255,255,255,0.4)',
                borderRadius: 12,
                padding: '10px 14px',
                cursor: probando ? 'wait' : 'pointer',
                color: esClaro ? '#475569' : '#ffffff',
                fontWeight: 700,
                fontSize: 12,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {probando ? 'Enviando...' : 'Probar'}
            </button>
          )}

          <button
            onClick={desactivarNotificaciones}
            disabled={cargando}
            style={{
              background: 'transparent',
              border: esClaro ? '1px solid #fca5a5' : '1px solid rgba(255,255,255,0.4)',
              borderRadius: 12,
              padding: '10px 14px',
              cursor: cargando ? 'wait' : 'pointer',
              color: esClaro ? '#b91c1c' : '#ffffff',
              fontWeight: 700,
              fontSize: 12,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {cargando ? 'Desactivando...' : 'Desactivar'}
          </button>
        </div>

        {mostrarPrueba && resultadoPrueba && (
          <span style={{ fontSize: 11.5, color: esClaro ? '#475569' : '#ffffff', maxWidth: 260, textAlign: 'right' }}>
            {resultadoPrueba}
          </span>
        )}

        {error && (
          <span style={{ fontSize: 11.5, color: '#dc2626', maxWidth: 260, textAlign: 'right' }}>{error}</span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
        flexShrink: 0,
      }}
    >
      <button
        onClick={activarNotificaciones}
        disabled={cargando}
        style={{
          background: '#1f3a5f',
          border: 'none',
          borderRadius: 12,
          padding: '10px 16px',
          cursor: cargando ? 'wait' : 'pointer',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 13,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {cargando ? 'Activando...' : '🔔 Activar notificaciones'}
      </button>

      {error && (
        <span style={{ fontSize: 11.5, color: '#dc2626', maxWidth: 220, textAlign: 'right' }}>
          {error}
        </span>
      )}
    </div>
  );
}
