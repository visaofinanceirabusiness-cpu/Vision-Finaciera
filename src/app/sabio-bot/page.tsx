'use client';
// SABIO BOT — SIMULADOR INTERNO
//
// Prueba del motor de conversación (lib/sabioBot.ts) sin depender de
// una cuenta de WhatsApp real todavía. La ventana de chat en sí vive
// en components/panel/SabioBotChat.tsx — se reutiliza igual en el
// lobby (ver SabioBotLobby.tsx), esta pantalla es solo el envoltorio
// de página completa.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SabioBotChat } from '@/components/panel/SabioBotChat';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  fondo: '#f5f7f9',
};

export default function SabioBotPage() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function iniciar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (perfil?.empresa_id) {
        setEmpresaId(perfil.empresa_id);
      }

      setCargando(false);
    }

    iniciar();
  }, [router]);

  return (
    <main style={{ minHeight: '100vh', background: COLORES.fondo, padding: 24 }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Link
          href="/?vista=empresa"
          style={{ color: COLORES.gris, fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}
        >
          ← Volver
        </Link>

        <h1 style={{ margin: '0 0 4px', fontSize: 22, color: COLORES.azul }}>🦉 Sabio</h1>

        <p style={{ fontSize: 12.5, color: COLORES.gris, marginTop: 0, marginBottom: 16 }}>
          Simulador interno — probá cómo respondería Sabio antes de conectarlo a un WhatsApp real.
        </p>

        {cargando ? (
          <p style={{ color: COLORES.gris, fontSize: 13 }}>Cargando...</p>
        ) : empresaId ? (
          <SabioBotChat empresaId={empresaId} colores={COLORES} />
        ) : (
          <p style={{ color: '#dc2626', fontSize: 13 }}>No se pudo identificar la empresa.</p>
        )}
      </div>
    </main>
  );
}
