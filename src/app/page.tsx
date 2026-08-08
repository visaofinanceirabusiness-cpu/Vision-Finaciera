'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Branding oficial Visão Financeira
const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Perfil = {
  nombre: string;
  empresa_id: string;
  rol: string;
};

type Empresa = {
  nombre: string;
  logo_url: string | null;
};

export default function MiNegocioPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('nombre, empresa_id, rol')
        .eq('id', userData.user.id)
        .single();

      if (!perfilData) {
        router.push('/login');
        return;
      }

      setPerfil(perfilData);

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nombre, logo_url')
        .eq('id', perfilData.empresa_id)
        .single();

      setEmpresa(empresaData);
      setCargando(false);
    }

    cargar();
  }, [router]);

  if (cargando) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        Cargando tu negocio...
      </div>
    );
  }

  const hoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f7f9',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Logo centrado */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          {empresa?.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={empresa.nombre}
              style={{
                width: 120,
                height: 120,
                objectFit: 'contain',
                borderRadius: 24,
                background: COLORES.blanco,
                padding: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 24,
                background: COLORES.blanco,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: 42,
              }}
            >
              🏪
            </div>
          )}
        </div>

        {/* Encabezado */}
        <section
          style={{
            background: COLORES.azul,
            color: COLORES.blanco,
            borderRadius: 24,
            padding: 28,
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 34 }}>Mi Negocio</h1>

          <p
            style={{
              margin: '8px 0 0',
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            {empresa?.nombre}
          </p>

          <p style={{ margin: '10px 0 0', opacity: 0.95 }}>
            Hola, {perfil?.nombre} 👋
          </p>

          <p style={{ margin: '4px 0 0', opacity: 0.85 }}>
            {hoy}
          </p>
        </section>

        {/* Tarjetas resumen */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <ResumenCard titulo="Ventas hoy" valor="R$ 0,00" color={COLORES.verde} />
          <ResumenCard titulo="Caja disponible" valor="R$ 0,00" color={COLORES.azul} />
          <ResumenCard titulo="Gastos del mes" valor="R$ 0,00" color="#c0392b" />
          <ResumenCard titulo="Stock bajo" valor="0 productos" color={COLORES.gris} />
        </section>

        {/* Accesos rápidos */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <BotonAcceso href="/lanzamientos" titulo="Registrar venta" principal />
          <BotonAcceso href="/lanzamientos" titulo="Registrar gasto" />
          <BotonAcceso href="/stock" titulo="Ver stock" />
          <BotonAcceso href="/movimientos" titulo="Movimientos" />
        </section>

        {/* Actividad */}
        <section
          style={{
            background: COLORES.blanco,
            borderRadius: 20,
            padding: 20,
            border: '1px solid #e5e7eb',
          }}
        >
          <h2 style={{ marginTop: 0, color: COLORES.azul }}>
            Lo importante de hoy
          </h2>

          <div
            style={{
              border: '1px dashed #cbd5e1',
              borderRadius: 14,
              padding: 16,
              color: COLORES.gris,
              textAlign: 'center',
            }}
          >
            Todavía no registraste operaciones hoy.
          </div>
        </section>
      </div>
    </main>
  );
}

function ResumenCard({
  titulo,
  valor,
  color,
}: {
  titulo: string;
  valor: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: COLORES.blanco,
        borderRadius: 20,
        padding: 20,
        border: '1px solid #e5e7eb',
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ color: COLORES.gris, fontSize: 14 }}>{titulo}</span>
      <strong style={{ color, fontSize: 24 }}>{valor}</strong>
    </div>
  );
}

function BotonAcceso({
  href,
  titulo,
  principal = false,
}: {
  href: string;
  titulo: string;
  principal?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        background: principal ? COLORES.verde : COLORES.blanco,
        color: principal ? COLORES.blanco : COLORES.azul,
        border: principal ? 'none' : '1px solid #d1d5db',
        borderRadius: 18,
        padding: '18px 20px',
        textAlign: 'center',
        fontWeight: 700,
        boxShadow: principal ? '0 8px 20px rgba(46,139,87,0.18)' : 'none',
      }}
    >
      {titulo}
    </Link>
  );
}
