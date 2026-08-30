'use client';

// CONFIGURAÇÕES
//
// Ventana estructural para dejar una empresa lista para operar:
// configurar → generar → sistema listo.
//
//   1. Dados da Empresa — datos comerciales, contacto, identificación
//      fiscal, moneda e idioma.
//   2. Categorias e Formas de Pagamento — próximamente.
//   3. Plano de Contas — próximamente.
//   4. Inicialização do Sistema — próximamente (botón "Gerar Matriz
//      de Operações", bloqueado después de usarse una vez salvo para
//      un administrador de plataforma).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

const MONEDAS = [
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
  { value: 'USD', label: 'USD — Dólar estadounidense' },
];

const IDIOMAS = [
  { value: 'ES', label: 'Español' },
  { value: 'PT', label: 'Português' },
];

type Pestana = 'empresa' | 'categorias' | 'plan' | 'inicializacion';

type PerfilEmpresa = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
};

type DatosEmpresa = {
  id: string;
  nombre: string;
  rubro: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  identificacion_fiscal: string | null;
  moneda: string;
  idioma: string;
  logo_url: string | null;
  perfil_empresa_id: string | null;
  matriz_generada: boolean;
};

export default function ConfiguracoesPage() {
  const router = useRouter();

  const [pestana, setPestana] = useState<Pestana>('empresa');
  const [esAdmin, setEsAdmin] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('empresa_id, es_admin_plataforma')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfil?.empresa_id) {
        setError('No se pudo identificar la empresa del usuario.');
        setCargando(false);
        return;
      }

      setEmpresaId(perfil.empresa_id);
      setEsAdmin(Boolean(perfil.es_admin_plataforma));
      setCargando(false);
    }

    cargar();
  }, [router]);

  if (cargando) {
    return <div style={cargandoStyle}>Preparando CONFIGURAÇÕES...</div>;
  }

  if (error || !empresaId) {
    return <div style={fondo}><div style={errorStyle}>{error || 'No se pudo cargar.'}</div></div>;
  }

  return (
    <div style={fondo}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={encabezado}>
          <Link href="/" style={volver}>
            ← Volver a Mi Negocio
          </Link>

          <div style={eyebrow}>CONFIGURAÇÕES</div>

          <h1 style={{ margin: 0, fontSize: 32 }}>Deixe sua empresa pronta</h1>

          <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
            Configurá → Generá → Tu sistema queda listo para operar.
          </p>
        </header>

        <main style={panel}>
          <div
            style={{
              display: 'flex',
              gap: 10,
              borderBottom: '1px solid #e5e7eb',
              marginBottom: 22,
              flexWrap: 'wrap',
            }}
          >
            <button type="button" onClick={() => setPestana('empresa')} style={tabStyle(pestana === 'empresa')}>
              🏢 Dados da Empresa
            </button>

            <button type="button" onClick={() => setPestana('categorias')} style={tabStyle(pestana === 'categorias')}>
              🗂️ Categorias e Formas de Pagamento
            </button>

            <button type="button" onClick={() => setPestana('plan')} style={tabStyle(pestana === 'plan')}>
              📒 Plano de Contas
            </button>

            <button type="button" onClick={() => setPestana('inicializacion')} style={tabStyle(pestana === 'inicializacion')}>
              🚀 Inicialização do Sistema
            </button>
          </div>

          {pestana === 'empresa' && <DadosDaEmpresaTab empresaId={empresaId} esAdmin={esAdmin} />}
          {pestana === 'categorias' && <ProximamenteTab titulo="Categorias e Formas de Pagamento" />}
          {pestana === 'plan' && <ProximamenteTab titulo="Plano de Contas" />}
          {pestana === 'inicializacion' && <ProximamenteTab titulo="Inicialização do Sistema" />}
        </main>
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA 1 — DADOS DA EMPRESA
========================================================== */

function DadosDaEmpresaTab({ empresaId, esAdmin }: { empresaId: string; esAdmin: boolean }) {
  const [empresa, setEmpresa] = useState<DatosEmpresa | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilEmpresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [tieneEsqueleto, setTieneEsqueleto] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    async function cargar() {
      const [
        { data: empresaData, error: errorEmpresa },
        { data: perfilesData },
        { count: cuentasCount },
      ] = await Promise.all([
        supabase
          .from('empresas')
          .select('id, nombre, rubro, telefono, email, direccion, identificacion_fiscal, moneda, idioma, logo_url, perfil_empresa_id, matriz_generada')
          .eq('id', empresaId)
          .maybeSingle(),

        supabase
          .from('perfiles_empresa')
          .select('id, codigo, nombre, descripcion')
          .eq('activo', true)
          .order('nombre', { ascending: true }),

        supabase
          .from('plan_cuentas')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId),
      ]);

      if (errorEmpresa || !empresaData) {
        setError('No se pudieron cargar los datos de la empresa.');
        setCargando(false);
        return;
      }

      setEmpresa(empresaData as DatosEmpresa);
      setPerfiles(perfilesData ?? []);
      setTieneEsqueleto(Boolean(cuentasCount && cuentasCount > 0));
      setCargando(false);
    }

    cargar();
  }, [empresaId]);

  function actualizarCampo<K extends keyof DatosEmpresa>(campo: K, valor: DatosEmpresa[K]) {
    setEmpresa((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  }

  async function guardar() {
    if (!empresa) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    const { error: errorGuardar } = await supabase
      .from('empresas')
      .update({
        nombre: empresa.nombre.trim(),
        rubro: empresa.rubro,
        telefono: empresa.telefono,
        email: empresa.email,
        direccion: empresa.direccion,
        identificacion_fiscal: empresa.identificacion_fiscal,
        moneda: empresa.moneda,
        idioma: empresa.idioma,
        logo_url: empresa.logo_url,
        perfil_empresa_id: empresa.perfil_empresa_id,
      })
      .eq('id', empresaId);

    setGuardando(false);

    if (errorGuardar) {
      setError('No se pudieron guardar los cambios.');
      return;
    }

    setMensaje('Datos guardados correctamente.');
  }

  if (cargando) {
    return <div style={cargandoStyle}>Cargando datos de la empresa...</div>;
  }

  if (!empresa) {
    return <div style={errorStyle}>No se encontró la empresa.</div>;
  }

  const perfilBloqueado = tieneEsqueleto && !esAdmin;

  return (
    <div>
      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={mensajeOkStyle}>{mensaje}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        <div style={campo}>
          <label style={label}>Nombre de la empresa *</label>
          <input
            style={inputFormulario}
            value={empresa.nombre}
            onChange={(e) => actualizarCampo('nombre', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>Rubro</label>
          <input
            style={inputFormulario}
            value={empresa.rubro ?? ''}
            onChange={(e) => actualizarCampo('rubro', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>Teléfono</label>
          <input
            style={inputFormulario}
            value={empresa.telefono ?? ''}
            onChange={(e) => actualizarCampo('telefono', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>Email</label>
          <input
            type="email"
            style={inputFormulario}
            value={empresa.email ?? ''}
            onChange={(e) => actualizarCampo('email', e.target.value)}
          />
        </div>

        <div style={{ ...campo, gridColumn: '1 / -1' }}>
          <label style={label}>Dirección</label>
          <input
            style={inputFormulario}
            value={empresa.direccion ?? ''}
            onChange={(e) => actualizarCampo('direccion', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>Identificación fiscal (CUIT / CNPJ / etc.)</label>
          <input
            style={inputFormulario}
            value={empresa.identificacion_fiscal ?? ''}
            onChange={(e) => actualizarCampo('identificacion_fiscal', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>Logo (URL)</label>
          <input
            style={inputFormulario}
            value={empresa.logo_url ?? ''}
            onChange={(e) => actualizarCampo('logo_url', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>Moneda</label>
          <select
            style={inputFormulario}
            value={empresa.moneda}
            onChange={(e) => actualizarCampo('moneda', e.target.value)}
          >
            {MONEDAS.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        </div>

        <div style={campo}>
          <label style={label}>Idioma de trabajo</label>
          <select
            style={inputFormulario}
            value={empresa.idioma}
            onChange={(e) => actualizarCampo('idioma', e.target.value)}
          >
            {IDIOMAS.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        </div>

        <div style={campo}>
          <label style={label}>Perfil de empresa</label>
          <select
            style={{ ...inputFormulario, opacity: perfilBloqueado ? 0.6 : 1 }}
            value={empresa.perfil_empresa_id ?? ''}
            disabled={perfilBloqueado}
            onChange={(e) => actualizarCampo('perfil_empresa_id', e.target.value || null)}
          >
            <option value="">Sin definir</option>
            {perfiles.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>
                {perfil.nombre}
              </option>
            ))}
          </select>

          {perfilBloqueado && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: COLORES.gris }}>
              Ya existe un Plano de Contas cargado — cambiar el perfil queda reservado a un administrador de plataforma.
            </p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" style={botonGuardar} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑAS PENDIENTES (2, 3 y 4 — se construyen en los
   próximos pasos)
========================================================== */

function ProximamenteTab({ titulo }: { titulo: string }) {
  return (
    <div
      style={{
        padding: '50px 20px',
        textAlign: 'center',
        color: COLORES.gris,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 10 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORES.azul }}>{titulo}</div>
      <p style={{ marginTop: 6, fontSize: 13 }}>Estamos por acá pronto.</p>
    </div>
  );
}

/* ==========================================================
   ESTILOS
========================================================== */

function tabStyle(activa: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    padding: '12px 18px',
    color: activa ? COLORES.verde : COLORES.gris,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    borderBottom: activa ? `3px solid ${COLORES.verde}` : '3px solid transparent',
    marginBottom: -1,
  };
}

const fondo: React.CSSProperties = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top left, #e7f1ed 0%, transparent 34%), #f4f7f8',
  padding: '28px 24px 48px',
};

const encabezado: React.CSSProperties = {
  background: 'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
  borderRadius: 24,
  padding: '28px 34px',
  color: COLORES.blanco,
  marginBottom: 24,
  boxShadow: '0 18px 40px rgba(20,42,71,0.16)',
};

const volver: React.CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: 18,
};

const eyebrow: React.CSSProperties = {
  color: '#86efac',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.4,
  marginBottom: 8,
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 26,
  boxShadow: '0 14px 36px rgba(31,58,95,0.10)',
  overflow: 'hidden',
};

const campo: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLORES.azul,
  marginBottom: 6,
};

const inputFormulario: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid #d6dee5',
  background: COLORES.blanco,
  color: COLORES.azul,
  fontSize: 13,
};

const botonGuardar: React.CSSProperties = {
  background: COLORES.azul,
  color: COLORES.blanco,
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  cursor: 'pointer',
  fontWeight: 800,
};

const errorStyle: React.CSSProperties = {
  background: '#fef2f2',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 12,
  padding: '11px 14px',
  marginBottom: 18,
  fontSize: 13,
};

const mensajeOkStyle: React.CSSProperties = {
  background: '#f0fdf4',
  color: '#166534',
  border: '1px solid #bbf7d0',
  borderRadius: 12,
  padding: '11px 14px',
  marginBottom: 18,
  fontSize: 13,
};

const cargandoStyle: React.CSSProperties = {
  padding: 30,
  textAlign: 'center',
  color: COLORES.gris,
};
