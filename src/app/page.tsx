'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [nombre, setNombre] = useState<string | null>(null);

  useEffect(() => {
    async function verificarSesion() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push('/login');
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('nombre')
        .eq('id', data.user.id)
        .maybeSingle();

      setNombre(perfil?.nombre ?? data.user.email ?? 'bienvenido');
    }

    verificarSesion();
  }, [router]);

  if (!nombre) {
    return <p style={{ padding: 24 }}>Cargando...</p>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>🦉 Hola, {nombre}</h1>
      <p>Sabio está listo para ayudarte.</p>
      <a
        href="/lanzamientos"
        style={{
          display: 'inline-block',
          marginTop: 16,
          padding: '12px 20px',
          borderRadius: 8,
          background: '#2e8b57',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Ir a Central de Lanzamientos →
      </a>
    </div>
  );
}
