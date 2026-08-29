'use client';

// MERCADERÍA
//
// Es la puerta de entrada a las dos herramientas de stock del sistema:
// Movimientos de Stock y Saldo de Stock.
//
// No hace cálculos ni carga datos de stock propios: solo reparte hacia
// esas dos pantallas, igual que el Lobby reparte hacia las herramientas.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PieVisao } from '@/components/panel/PieVisao';

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Perfil = {
  nombre: string;
  empresa_id: string;
  rol: string;
  es_admin_plataforma: boolean;
};

type Empresa = {
  nombre: string;
  rubro: string | null;
  logo_url: string | null;
};

type ConfiguracionDashboard = {
  color_primario: string;
  color_secundario: string;
  color_acento: string;
};

export default function MercaderiaPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargarBase() {
      setError('');

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfilData, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('nombre, empresa_id, rol, es_admin_plataforma')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfilData?.empresa_id) {
        setError('No se pudo identificar la empresa del usuario.');
        setCargando(false);
        return;
      }

      setPerfil(perfilData);

      const { data: empresaData, error: errorEmpresa } = await supabase
        .from('empresas')
        .select('nombre, rubro, logo_url')
        .eq('id', perfilData.empresa_id)
        .maybeSingle();

      if (errorEmpresa) {
        setError(`No se pudo cargar la empresa: ${errorEmpresa.message}`);
        setCargando(false);
        return;
      }

      setEmpresa(empresaData);

      const { data: configData, error: errorConfig } = await supabase
        .from('configuracion_dashboard')
        .select('color_primario, color_secundario, color_acento')
        .eq('empresa_id', perfilData.empresa_id)
        .maybeSingle();

      if (errorConfig) {
        console.warn('No se pudo cargar configuracion_dashboard:', errorConfig);
      }

      setConfiguracion(
        configData ?? {
          color_primario: COLORES_BASE.azul,
          color_secundario: COLORES_BASE.verde,
          color_acento: COLORES_BASE.gris,
        }
      );

      setCargando(false);
    }

    cargarBase();
  }, [router]);

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
        Cargando mercadería...
      </div>
    );
  }

  const colores = {
    azul: configuracion?.color_primario ?? COLORES_BASE.azul,
    verde: configuracion?.color_secundario ?? COLORES_BASE.verde,
    acento: configuracion?.color_acento ?? COLORES_BASE.gris,
    blanco: COLORES_BASE.blanco,
  };

  const logoDisponible = Boolean(empresa?.logo_url?.trim());

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
        {/* =================================================
            CABECERA
        ================================================== */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 78,
                height: 78,
                borderRadius: 20,
                background: colores.blanco,
                border: `2px solid ${colores.acento}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 8px 20px rgba(31,58,95,0.10)',
                flexShrink: 0,
              }}
            >
              {logoDisponible ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={empresa!.logo_url!}
                  alt={`Logo de ${empresa?.nombre ?? 'empresa'}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    padding: 6,
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: colores.azul,
                  }}
                >
                  {(empresa?.nombre ?? 'M').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: colores.azul,
                }}
              >
                Mercadería
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: COLORES_BASE.gris,
                  marginTop: 3,
                }}
              >
                {empresa?.nombre ?? 'Mi Negocio'}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Link
              href="/"
              style={{
                background: colores.blanco,
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: '11px 16px',
                color: colores.azul,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              ← Inicio
            </Link>

            {perfil?.es_admin_plataforma && (
              <Link
                href="/panel-maestro"
                style={{
                  background: colores.azul,
                  border: 'none',
                  borderRadius: 12,
                  padding: '11px 16px',
                  cursor: 'pointer',
                  color: '#ffffff',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                🔱 Volver a mi Panel
              </Link>
            )}

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/login');
              }}
              style={{
                background: colores.blanco,
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: '11px 16px',
                cursor: 'pointer',
                color: colores.azul,
                fontWeight: 700,
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: 16,
              padding: '14px 18px',
              marginBottom: 20,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* =================================================
            HERRAMIENTAS DE STOCK
        ================================================== */}

        <section
          style={{
            background: colores.blanco,
            borderRadius: 24,
            padding: 24,
            marginBottom: 20,
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                marginBottom: 4,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.3,
                color: colores.verde,
              }}
            >
              MERCADERÍA
            </div>

            <h2
              style={{
                margin: 0,
                color: colores.azul,
                fontSize: 21,
              }}
            >
              Elegí qué querés hacer
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 12,
            }}
          >
            <BotonAcceso
              href="/movimientos-stock"
              titulo="Movimientos de Stock"
              principal
              colorPrincipal={colores.verde}
            />

            <BotonAcceso
              href="/stock"
              titulo="Saldo de Stock"
              colorPrincipal={colores.azul}
            />
          </div>
        </section>

        {/* =================================================
            PIE — Marca Visão Financeira
        ================================================== */}

        <PieVisao colores={colores} />
      </div>
    </main>
  );
}

function BotonAcceso({
  href,
  titulo,
  principal = false,
  destacado = false,
  colorPrincipal,
}: {
  href: string;
  titulo: string;
  principal?: boolean;
  destacado?: boolean;
  colorPrincipal: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        background: principal
          ? colorPrincipal
          : destacado
            ? `${colorPrincipal}18`
            : '#ffffff',
        color: principal ? '#ffffff' : colorPrincipal,
        border: principal || destacado ? 'none' : '1px solid #d1d5db',
        borderRadius: 16,
        padding: '17px 18px',
        textAlign: 'center',
        fontWeight: 700,
        boxShadow: principal ? `0 8px 20px ${colorPrincipal}33` : 'none',
      }}
    >
      {titulo}
    </Link>
  );
}
