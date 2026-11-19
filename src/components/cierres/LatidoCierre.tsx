'use client';

import { useEffect } from 'react';
import { EVENTO_PERIODO_CAMBIO, bloquearAlSalir, latidoPeriodos } from '@/lib/cierres';
import { supabase } from '@/lib/supabase';

// Mantiene abierto un mes habilitado mientras la app siga abierta. Si se cierra la pestaña se vuelve a bloquear al instante (sendBeacon);
// si ni eso llega (celular sin batería, red caída), el habilitado vence solo a los 3 minutos sin latido.
export function LatidoCierre() {
  useEffect(() => {
    let reloj: ReturnType<typeof setInterval> | null = null;
    let vivo = true;

    const detener = () => {
      if (reloj) clearInterval(reloj);
      reloj = null;
    };
    const latir = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const r = await latidoPeriodos().catch(() => null);
      if (!vivo || !r) return;
      if (Number(r.json.abiertos ?? 0) > 0) {
        if (!reloj) reloj = setInterval(() => void latir(), 45000);
      } else {
        detener();
      }
    };

    void latir();
    const alCambiar = () => void latir();
    const alSalir = () => {
      if (reloj) void bloquearAlSalir();
    };
    window.addEventListener(EVENTO_PERIODO_CAMBIO, alCambiar);
    window.addEventListener('pagehide', alSalir);
    return () => {
      vivo = false;
      detener();
      window.removeEventListener(EVENTO_PERIODO_CAMBIO, alCambiar);
      window.removeEventListener('pagehide', alSalir);
    };
  }, []);

  return null;
}
