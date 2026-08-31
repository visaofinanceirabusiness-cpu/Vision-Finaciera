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

// Botón para que el admin active las notificaciones push en su celular.
// Al tocarlo: pide permiso al navegador, se suscribe y guarda la
// suscripción en Supabase para que el servidor le pueda avisar cuando
// haya algo pendiente de aprobar.
export function NotificacionesPush() {
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

  if (estado === 'activo') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: '#ffffff',
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.25)',
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

          <button
            onClick={enviarPrueba}
            disabled={probando}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 12,
              padding: '10px 14px',
              cursor: probando ? 'wait' : 'pointer',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 12,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {probando ? 'Enviando...' : 'Probar'}
          </button>
        </div>

        {resultadoPrueba && (
          <span style={{ fontSize: 11.5, color: '#ffffff', maxWidth: 260, textAlign: 'right' }}>
            {resultadoPrueba}
          </span>
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
