'use client';

import { useEffect } from 'react';

// Registra el service worker una sola vez, en toda la app, para que la
// PWA sea instalable y pueda recibir notificaciones push incluso con la
// app cerrada.
export function RegistrarServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('No se pudo registrar el service worker:', error);
      });
    }
  }, []);

  return null;
}
