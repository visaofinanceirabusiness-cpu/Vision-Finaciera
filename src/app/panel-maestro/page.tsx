'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Empresa = {
  id: string;
  nombre: string;
  rubro: string | null;
  logo_url: string | null;
};

export default function PanelMaestroPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      // Verificar que sea admin de plataforma
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('es_admin_plataforma')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.es_admin_plataforma) {
        router.push('/');
        return;
      }

      const { data: empresasData, error: errorEmpresas } = await supabase
        .from('empresas')
        .select('id, nombre, rubro, logo_url')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (errorEmpresas) {
        setError('No se pudieron cargar las empresas.');
        setCargando(false);
        return;
      }

      setEmpresas(empresasData ?? []);
      setCargando(false);
    }

    cargar();
  }, [router]);

  async function entrarAEmpresa(empresaId: string) {
    setCambiando(empresaId);
    setError('');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error: errorUpdate } = await supabase
      .from('perfiles')
      .update({ empresa_id: empresaId })
      .eq('id', userData.user.id);

    if (errorUpdate) {
      setError('No se pudo entrar a esa empresa.');
      setCambiando(null);
      return;
    }

    router.push('/');
  }

  if (cargando) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f7f9',
          color: COLORES_BASE.azul,
          fontWeight: 600,
        }}
      >
        Preparando tu reino...
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #edf4f1 0%, transparent 34%), #f5f7f9',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* HERO - MODO DIOS */}
        <section
          style={{
            background: `linear-gradient(125deg, ${COLORES_BASE.azul} 0%, ${COLORES_BASE.azul} 58%, ${COLORES_BASE.verde} 100%)`,
            color: COLORES_BASE.blanco,
            borderRadius: 28,
            padding: '34px 32px',
            marginBottom: 24,
            boxShadow: '0 18px 40px rgba(31,58,95,0.16)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              opacity: 0.75,
              marginBottom: 8,
            }}
          >
            PANEL MAESTRO · VISÃO FINANCEIRA
          </div>

          <h1 style={{ margin: 0, fontSize: 34, display: 'flex', alignItems: 'center', gap: 12 }}>
            🔱 Nivel ∞ · Dios Financiero
          </h1>

          <p style={{ margin: '10px 0 0', fontSize: 17, fontWeight: 600 }}>
            Controlás {empresas.length} {empresas.length === 1 ? 'universo empresarial' : 'universos empresariales'}. Elegí uno para descender a él.
          </p>

          <div
            style={{
              display: 'inline-block',
              marginTop: 14,
              padding: '8px 16px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.25)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ✨ Misión actual: mantener el equilibrio de todas las empresas
          </div>
        </section>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* LISTA DE EMPRESAS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          {empresas.map((empresa) => (
            <button
              key={empresa.id}
              onClick={() => entrarAEmpresa(empresa.id)}
              disabled={cambiando !== null}
              style={{
                background: COLORES_BASE.blanco,
                border: '1px solid #e5e7eb',
                borderRadius: 22,
                padding: 22,
                textAlign: 'left',
                cursor: cambiando ? 'wait' : 'pointer',
                boxShadow: '0 10px 24px rgba(31,58,95,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                opacity: cambiando && cambiando !== empresa.id ? 0.5 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: '#fbfcfd',
                    border: `2px solid ${COLORES_BASE.gris}33`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {empresa.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={empresa.logo_url}
                      alt={`Logo de ${empresa.nombre}`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                    />
                  ) : (
                    <span style={{ fontSize: 24, fontWeight: 800, color: COLORES_BASE.azul }}>
                      {empresa.nombre.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: COLORES_BASE.azul }}>
                    {empresa.nombre}
                  </div>
                  <div style={{ fontSize: 12, color: COLORES_BASE.gris, marginTop: 2 }}>
                    {empresa.rubro ?? 'Sin rubro definido'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  textAlign: 'center',
                  padding: '10px 0',
                  borderRadius: 12,
                  background: `${COLORES_BASE.verde}12`,
                  color: COLORES_BASE.verde,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {cambiando === empresa.id ? 'Entrando...' : 'Entrar a este universo →'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
