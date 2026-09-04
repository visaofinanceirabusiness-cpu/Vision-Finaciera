'use client';

// GUARDIA DE SESIÓN — corta la sesión "en caliente"
//
// Cuando se borra una empresa (eliminar_empresa_completa) se lleva
// puesta la fila de `perfiles` de sus usuarios, pero no su cuenta de
// Supabase Auth. Un usuario que ya tenía la sesión abierta en el
// navegador en ese momento seguía operando con normalidad — la sesión
// de Supabase persiste sola en localStorage entre navegaciones, y
// ninguna pantalla individual vuelve a autenticar — hasta que cerraba
// sesión a mano. login/page.tsx ya bloquea el reingreso; esto cubre la
// sesión que ya estaba abierta: revisa cada un rato (y al volver a la
// pestaña) que la fila de `perfiles` siga existiendo, y si no, cierra
// la sesión y redirige al login con un aviso.
//
// Vive en el layout raíz (una sola instancia para toda la app) porque
// así el intervalo sobrevive a la navegación entre pantallas sin
// reiniciarse — el layout raíz no se desmonta en cada cambio de ruta.

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motivoSinPerfil } from '@/lib/estadoCuenta';

const RUTAS_PUBLICAS = ['/login', '/crear-cuenta'];
const INTERVALO_MS = 60_000;

export function GuardiaSesion() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (RUTAS_PUBLICAS.some((ruta) => pathname?.startsWith(ruta))) return;

    let cancelado = false;

    async function verificar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (cancelado || perfil) return;

      const motivo = await motivoSinPerfil(userData.user.id);
      const parametro =
        motivo === 'pendiente'
          ? 'solicitud_pendiente'
          : motivo === 'rechazada'
            ? 'solicitud_rechazada'
            : 'empresa_borrada';

      await supabase.auth.signOut();
      router.replace(`/login?motivo=${parametro}`);
    }

    function alVolverAPestana() {
      if (document.visibilityState === 'visible') verificar();
    }

    verificar();
    const intervalo = setInterval(verificar, INTERVALO_MS);
    document.addEventListener('visibilitychange', alVolverAPestana);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolverAPestana);
    };
  }, [pathname, router]);

  return null;
}
