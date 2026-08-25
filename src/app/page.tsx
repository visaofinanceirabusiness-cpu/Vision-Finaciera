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

// Logo actualizado de Encanto.
// Se usa como respaldo si la URL guardada en la base de datos está vacía o vencida.
const LOGO_ENCANTO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/Encanto.jpeg';

type Perfil = {
  nombre: string;
  empresa_id: string;
  rol: string;
};

type Empresa = {
  nombre: string;
  logo_url: string | null;
  perfil_empresa_id: string | null;
};

export default function MiNegocioPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [modulos, setModulos] = useState<string[]>([]);

  const [cargando, setCargando] = useState(true);
  const [usarLogoPredeterminado, setUsarLogoPredeterminado] = useState(false);
  const [logoNoDisponible, setLogoNoDisponible] = useState(false);

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      // ----------------------------------------------------------
      // PERFIL DEL USUARIO
      // ----------------------------------------------------------

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

      // ----------------------------------------------------------
      // EMPRESA
      // ----------------------------------------------------------

      const { data: empresaData, error: empresaError } = await supabase
        .from('empresas')
        .select('nombre, logo_url, perfil_empresa_id')
        .eq('id', perfilData.empresa_id)
        .single();

      if (empresaError) {
        console.error('Error cargando empresa:', empresaError);
      }

      setEmpresa(empresaData);

      // ----------------------------------------------------------
      // MÓDULOS ACTIVOS DEL PERFIL DE EMPRESA
      // ----------------------------------------------------------

      if (empresaData?.perfil_empresa_id) {
        const { data: modulosData, error: modulosError } = await supabase
          .from('perfil_modulos')
          .select('modulo')
          .eq('perfil_empresa_id', empresaData.perfil_empresa_id)
          .eq('activo', true);

        if (modulosError) {
          console.error('Error cargando módulos:', modulosError);
          setModulos([]);
        } else {
          setModulos(
            (modulosData ?? [])
              .map((modulo) => String(modulo.modulo).toUpperCase())
          );
        }
      } else {
        setModulos([]);
      }

      setUsarLogoPredeterminado(false);
      setLogoNoDisponible(false);
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

  const logoDesdeBase = obtenerUrlLogo(empresa?.logo_url ?? null);

  const logoClienteUrl =
    usarLogoPredeterminado || !logoDesdeBase
      ? LOGO_ENCANTO_URL
      : logoDesdeBase;

  const logoEsPredeterminado =
    usarLogoPredeterminado || !logoDesdeBase;

  // ----------------------------------------------------------
  // CONFIGURACIÓN DINÁMICA
  // ----------------------------------------------------------

  const tieneProduccion = modulos.includes('PRODUCCION');

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f7f9',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>

        {/* Barra superior */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: COLORES.azul }}>
              {empresa?.nombre || 'Mi Negocio'}
            </div>

            <div style={{ fontSize: 12, color: COLORES.gris }}>
              {perfil?.rol === 'admin' ? 'Administrador' : 'Cliente'}
            </div>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            style={{
              background: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: 12,
              padding: '10px 14px',
              cursor: 'pointer',
              color: COLORES.azul,
              fontWeight: 600,
            }}
          >
            Cerrar sesión
          </button>
        </div>

        {/* Logo del cliente */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 24,
              background: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            {!logoNoDisponible ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoClienteUrl}
                alt={`Logo de ${empresa?.nombre ?? 'la empresa'}`}
                onError={() => {
                  if (!logoEsPredeterminado) {
                    setUsarLogoPredeterminado(true);
                    return;
                  }

                  setLogoNoDisponible(true);
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <span style={{ fontSize: 48 }}>🏪</span>
            )}
          </div>
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

          <p
            style={{
              margin: '10px 0 0',
              opacity: 0.95,
            }}
          >
            Hola, {perfil?.nombre} 👋
          </p>

          <p
            style={{
              margin: '4px 0 0',
              opacity: 0.85,
            }}
          >
            {hoy}
          </p>
        </section>

        {/* Resumen */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <ResumenCard
            titulo="Ventas hoy"
            valor="R$ 0,00"
            color={COLORES.verde}
          />

          <ResumenCard
            titulo="Caja disponible"
            valor="R$ 0,00"
            color={COLORES.azul}
          />

          <ResumenCard
            titulo="Gastos del mes"
            valor="R$ 0,00"
            color="#c2410c"
          />

          <ResumenCard
            titulo="Stock bajo"
            valor="0 productos"
            color={COLORES.gris}
          />
        </div>

        {/* Accesos rápidos */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <BotonAcceso
            href="/lanzamientos"
            titulo="Central de Lanzamientos"
            principal
          />

          {/* PRODUCCIÓN DINÁMICA */}
          {tieneProduccion && (
            <BotonAcceso
              href="/produccion"
              titulo="Producción"
              principal
            />
          )}

          <BotonAcceso
            href="/stock"
            titulo="Ver stock"
          />

          <BotonAcceso
            href="/registros"
            titulo="Registro de Operaciones"
          />

          <BotonAcceso
            href="/movimientos-stock"
            titulo="Movimientos de Stock"
          />
          <BotonAcceso href="/diario" titulo="Libro Diario" />
        </div>
      </div>
    </main>
  );
}

function obtenerUrlLogo(logoUrl: string | null) {
  const url = logoUrl?.trim();

  if (!url) return null;

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const ruta = url.replace(/^\/?(Logos|logos)\//, '');

  const { data } = supabase.storage.from('Logos').getPublicUrl(ruta);

  return data.publicUrl;
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
      <span
        style={{
          color: COLORES.gris,
          fontSize: 14,
        }}
      >
        {titulo}
      </span>

      <strong
        style={{
          color,
          fontSize: 24,
        }}
      >
        {valor}
      </strong>
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
        background: principal
          ? COLORES.verde
          : COLORES.blanco,
        color: principal
          ? COLORES.blanco
          : COLORES.azul,
        border: principal
          ? 'none'
          : '1px solid #d1d5db',
        borderRadius: 18,
        padding: '18px 20px',
        textAlign: 'center',
        fontWeight: 700,
        boxShadow: principal
          ? '0 8px 20px rgba(46,139,87,0.18)'
          : 'none',
      }}
    >
      {titulo}
    </Link>
  );
}
