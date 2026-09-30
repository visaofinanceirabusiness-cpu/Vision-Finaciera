'use client';

// TEMA GLOBAL — aplica los colores y el fondo elegidos por la empresa
// (CONFIGURAÇÕES → Apariencia) a TODA la app, no solo al lobby.
//
// Vive en el layout raíz (una sola instancia) para no repetir esta
// consulta en cada pantalla — ver lib/apariencia.ts para el mecanismo
// (variables CSS con fallback al color/fondo de siempre).

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { aplicarTemaGlobal, RUTAS_SIN_TEMA_EMPRESA } from '@/lib/apariencia';

export function TemaGlobal() {
  const pathname = usePathname();

  useEffect(() => {
    if (RUTAS_SIN_TEMA_EMPRESA.some((ruta) => pathname?.startsWith(ruta))) return;

    let cancelado = false;

    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || cancelado) return;

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id || cancelado) return;

      const { data: config } = await supabase
        .from('configuracion_dashboard')
        .select('color_primario, color_secundario, color_acento, fondo_imagen')
        .eq('empresa_id', perfil.empresa_id)
        .maybeSingle();

      if (cancelado) return;
      aplicarTemaGlobal(config ?? null);
    }

    cargar();

    return () => {
      cancelado = true;
    };
  }, [pathname]);

  return null;
}
