'use client';

// Envuelve una pantalla cuya pieza puede ir a la caja de materiales. Si está guardada, las empresas ven un aviso y el
// administrador de plataforma sigue pudiendo abrirla (con una cinta de aviso) para revisarla.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { piezaPorClave } from '@/lib/cajaMateriales';
import { useCaja } from './useCaja';

export function GuardiaCaja({ clave, children }: { clave: string; children: React.ReactNode }) {
  const { cargada, estaEnCaja } = useCaja();
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const enCaja = cargada && estaEnCaja(clave);

  useEffect(() => {
    if (!enCaja) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return setEsAdmin(false);
      const { data } = await supabase.from('perfiles').select('es_admin_plataforma').eq('id', u.user.id).maybeSingle();
      setEsAdmin(Boolean(data?.es_admin_plataforma));
    })();
  }, [enCaja]);

  if (!enCaja) return <>{children}</>;

  const nombre = piezaPorClave(clave)?.nombre ?? 'Esta herramienta';

  if (esAdmin === null) return <div style={{ padding: 40, color: '#6e7781' }}>Cargando...</div>;

  if (esAdmin) {
    return (
      <>
        <div style={{ background: '#fef3c7', color: '#92400e', borderBottom: '1px solid #fcd34d', padding: '8px 16px', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
          📦 «{nombre}» está en la caja de materiales: las empresas no la ven. Solo vos podés abrirla.{' '}
          <Link href="/panel-maestro/caja-de-materiales" style={{ color: '#92400e' }}>Ver la caja</Link>
        </div>
        {children}
      </>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f4f7fb' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', maxWidth: 440, textAlign: 'center', boxShadow: '0 10px 30px rgba(31,58,95,0.10)' }}>
        <div style={{ fontSize: 44 }}>📦</div>
        <h1 style={{ color: '#1f3a5f', fontSize: 22, margin: '8px 0' }}>{nombre} ya no está disponible</h1>
        <p style={{ color: '#6e7781', lineHeight: 1.5 }}>Esta herramienta se guardó por ahora. Tus datos y operaciones siguen intactos; podés seguir cargando desde las demás herramientas.</p>
        <Link href="/" style={{ display: 'inline-block', marginTop: 8, background: '#2e8b57', color: '#fff', fontWeight: 700, padding: '11px 22px', borderRadius: 12, textDecoration: 'none' }}>Volver al inicio</Link>
      </div>
    </main>
  );
}
