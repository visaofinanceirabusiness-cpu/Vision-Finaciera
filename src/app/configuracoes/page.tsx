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
import { inicializarEmpresaDesdePerfil } from '@/lib/perfiles';
import { generarMatrizOperaciones } from '@/lib/motor';
import {
  crearCategoriaProducto,
  crearCategoriaGasto,
  crearCategoriaIngreso,
  crearFormaPago,
  crearCuentaParaMedioPago,
  cambiarActivoCategoriaProducto,
  cambiarActivoCategoriaGasto,
  cambiarActivoCategoriaIngreso,
  cambiarActivoFormaPago,
  eliminarCategoriaProducto,
  eliminarCategoriaOperacion,
  eliminarFormaPago,
  eliminarCuentaPlan,
  renombrarCuentaPlan,
} from '@/lib/categorias';
import { crearSocio, cambiarActivoSocio, eliminarSocio } from '@/lib/socios';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { resumirSuscripcion, type ResumenSuscripcion } from '@/lib/suscripcion';
import { TarjetaEstadoSuscripcion } from '@/components/EstadoSuscripcion';
import {
  obtenerDefiniciones,
  crearObjetivo,
  actualizarObjetivo,
  cambiarActivoObjetivo,
  eliminarObjetivo,
  CATALOGO_INDICADORES,
  type CategoriaObjetivo,
  type IndicadorCodigo,
} from '@/lib/objetivos';

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

type Pestana = 'empresa' | 'categorias' | 'plan' | 'inicializacion' | 'objetivos' | 'facturacion';

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
  numero_cliente: number;
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/?vista=empresa" style={volver}>
              ← Volver a Mi Negocio
            </Link>

            <AccesosHerramientas />
          </div>

          <div style={eyebrow}>CONFIGURACIÓN</div>

          <h1 style={{ margin: 0, fontSize: 32 }}>Dejá tu empresa lista</h1>

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
              🏢 Datos de la Empresa
            </button>

            <button type="button" onClick={() => setPestana('categorias')} style={tabStyle(pestana === 'categorias')}>
              🗂️ Categorías y Formas de Pago
            </button>

            <button type="button" onClick={() => setPestana('plan')} style={tabStyle(pestana === 'plan')}>
              📒 Plan de Cuentas
            </button>

            <button type="button" onClick={() => setPestana('inicializacion')} style={tabStyle(pestana === 'inicializacion')}>
              🚀 Inicialización del Sistema
            </button>

            <button type="button" onClick={() => setPestana('objetivos')} style={tabStyle(pestana === 'objetivos')}>
              🎯 Objetivos
            </button>

            <button type="button" onClick={() => setPestana('facturacion')} style={tabStyle(pestana === 'facturacion')}>
              💳 Facturación
            </button>
          </div>

          {pestana === 'empresa' && <DadosDaEmpresaTab empresaId={empresaId} esAdmin={esAdmin} />}
          {pestana === 'categorias' && <CategoriasYFormasDePagoTab empresaId={empresaId} esAdmin={esAdmin} />}
          {pestana === 'plan' && <PlanDeCuentasTab empresaId={empresaId} esAdmin={esAdmin} />}
          {pestana === 'inicializacion' && <InicializacionTab empresaId={empresaId} esAdmin={esAdmin} />}
          {pestana === 'objetivos' && <ObjetivosTab empresaId={empresaId} esAdmin={esAdmin} />}
          {pestana === 'facturacion' && <FacturacionTab empresaId={empresaId} esAdmin={esAdmin} />}
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
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [componentesMixto, setComponentesMixto] = useState<string[]>([]);

  useEffect(() => {
    async function cargar() {
      const [
        { data: empresaData, error: errorEmpresa },
        { data: perfilesData },
        { count: cuentasCount },
        { data: componentesData },
      ] = await Promise.all([
        supabase
          .from('empresas')
          .select('id, nombre, rubro, telefono, email, direccion, identificacion_fiscal, moneda, idioma, logo_url, perfil_empresa_id, matriz_generada, numero_cliente')
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

        supabase.from('empresa_mixto_componentes').select('componente').eq('empresa_id', empresaId),
      ]);

      if (errorEmpresa || !empresaData) {
        setError('No se pudieron cargar los datos de la empresa.');
        setCargando(false);
        return;
      }

      setEmpresa(empresaData as DatosEmpresa);
      setPerfiles(perfilesData ?? []);
      setTieneEsqueleto(Boolean(cuentasCount && cuentasCount > 0));
      setComponentesMixto((componentesData ?? []).map((c) => c.componente));
      setCargando(false);
    }

    cargar();
  }, [empresaId]);

  function alternarComponenteMixto(componente: string) {
    setComponentesMixto((actual) =>
      actual.includes(componente) ? actual.filter((c) => c !== componente) : [...actual, componente]
    );
  }

  function actualizarCampo<K extends keyof DatosEmpresa>(campo: K, valor: DatosEmpresa[K]) {
    setEmpresa((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  }

  async function subirLogo(archivo: File) {
    const TAMANO_MAXIMO = 3 * 1024 * 1024; // 3 MB

    if (archivo.size > TAMANO_MAXIMO) {
      setError('El logo pesa demasiado — subí una imagen de hasta 3 MB.');
      return;
    }

    setSubiendoLogo(true);
    setError('');
    setMensaje('');

    const extension = archivo.name.split('.').pop() || 'png';
    const ruta = `empresas/${empresaId}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from('Logos')
      .upload(ruta, archivo, { upsert: true, cacheControl: '3600' });

    if (errorSubida) {
      setError('No se pudo subir el logo.');
      setSubiendoLogo(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('Logos').getPublicUrl(ruta);
    // Le agregamos la fecha como parámetro para que el navegador no
    // muestre el logo viejo desde caché al reemplazarlo.
    const urlConVersion = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: errorGuardar } = await supabase
      .from('empresas')
      .update({ logo_url: urlConVersion })
      .eq('id', empresaId);

    setSubiendoLogo(false);

    if (errorGuardar) {
      setError('El logo se subió pero no se pudo guardar en la empresa.');
      return;
    }

    actualizarCampo('logo_url', urlConVersion);
    setMensaje('Logo actualizado — ya se ve en el lobby.');
  }

  async function guardar() {
    if (!empresa) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    const asignandoPerfilPorPrimeraVez = Boolean(empresa.perfil_empresa_id) && !tieneEsqueleto;

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

    if (!errorGuardar && asignandoPerfilPorPrimeraVez && empresa.perfil_empresa_id) {
      try {
        await inicializarEmpresaDesdePerfil(empresaId, empresa.perfil_empresa_id, empresa.idioma, empresa.moneda);
        setTieneEsqueleto(true);
      } catch (errorInit) {
        setGuardando(false);
        setError(
          errorInit instanceof Error
            ? `Se guardó el perfil pero falló la inicialización: ${errorInit.message}`
            : 'Se guardó el perfil pero falló la inicialización del Plano de Contas.'
        );
        return;
      }
    }

    const perfilMixto = perfiles.find((p) => p.codigo === 'MIXTO');

    if (!errorGuardar && esAdmin && perfilMixto && empresa.perfil_empresa_id === perfilMixto.id) {
      await supabase.from('empresa_mixto_componentes').delete().eq('empresa_id', empresaId);

      if (componentesMixto.length > 0) {
        await supabase.from('empresa_mixto_componentes').insert(
          componentesMixto.map((componente) => ({ empresa_id: empresaId, componente }))
        );
      }
    }

    setGuardando(false);

    if (errorGuardar) {
      setError('No se pudieron guardar los cambios.');
      return;
    }

    setMensaje(
      asignandoPerfilPorPrimeraVez
        ? 'Datos guardados y Plano de Contas inicializado — ya podés cargar categorías en la pestaña siguiente.'
        : 'Datos guardados correctamente.'
    );
  }

  if (cargando) {
    return <div style={cargandoStyle}>Cargando datos de la empresa...</div>;
  }

  if (!empresa) {
    return <div style={errorStyle}>No se encontró la empresa.</div>;
  }

  return (
    <div>
      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={mensajeOkStyle}>{mensaje}</div>}

      <div
        style={{
          display: 'inline-block',
          marginBottom: 16,
          padding: '6px 14px',
          borderRadius: 999,
          background: '#f8fafc',
          border: '1px solid #e5e7eb',
          fontSize: 12,
          fontWeight: 700,
          color: COLORES.gris,
        }}
      >
        Cliente Nº {empresa.numero_cliente}
      </div>

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
          <label style={label}>Logo</label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {empresa.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={empresa.logo_url}
                alt="Logo actual"
                style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid #d6dee5' }}
              />
            )}

            <input
              type="file"
              accept="image/*"
              disabled={subiendoLogo}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) subirLogo(archivo);
              }}
              style={{ fontSize: 12 }}
            />
          </div>

          {subiendoLogo && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: COLORES.gris }}>Subiendo logo...</p>
          )}
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

          {esAdmin ? (
            <select
              style={inputFormulario}
              value={empresa.perfil_empresa_id ?? ''}
              onChange={(e) => actualizarCampo('perfil_empresa_id', e.target.value || null)}
            >
              <option value="">Sin definir</option>
              {perfiles.map((perfil) => (
                <option key={perfil.id} value={perfil.id}>
                  {perfil.nombre}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ ...inputFormulario, background: '#f3f4f6', color: COLORES.gris }}>
              {perfiles.find((p) => p.id === empresa.perfil_empresa_id)?.nombre ?? 'Sin definir'}
            </div>
          )}

          {esAdmin && tieneEsqueleto && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: COLORES.gris }}>
              Ya existe un Plan de Cuentas cargado — cambiarlo acá no lo regenera, solo actualiza la etiqueta.
            </p>
          )}

          {!esAdmin && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: COLORES.gris }}>
              El perfil lo define un administrador de la plataforma.
            </p>
          )}
        </div>
      </div>

      {esAdmin && perfiles.find((p) => p.codigo === 'MIXTO')?.id === empresa.perfil_empresa_id && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORES.azul, marginBottom: 4 }}>
            ¿Qué combina este negocio Mixto?
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: COLORES.gris }}>
            Elegí los componentes que aplican — determina qué categorías se ofrecen en la pestaña siguiente.
          </p>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {[
              { codigo: 'COMERCIAL', etiqueta: 'Comercial (compra/venta de mercadería)' },
              { codigo: 'SERVICIOS', etiqueta: 'Servicios (venta sin stock)' },
              { codigo: 'PRODUCCION', etiqueta: 'Producción (transforma insumos)' },
            ].map((opcion) => (
              <label key={opcion.codigo} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: COLORES.azul, fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={componentesMixto.includes(opcion.codigo)}
                  onChange={() => alternarComponenteMixto(opcion.codigo)}
                />
                {opcion.etiqueta}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" style={botonGuardar} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA 2 — CATEGORIAS E FORMAS DE PAGAMENTO
========================================================== */

type CategoriaProducto = { id: string; codigo: string; nombre: string; activo: boolean };
type CategoriaGasto = { id: string; codigo: string; nombre: string; activo: boolean };
type FormaPago = { id: string; codigo: string; nombre: string; activo: boolean };
type CuentaOpcion = { id: string; codigo: string; nombre: string };
type OperacionOpcion = { id: string; nombre: string };
type Socio = { id: string; codigo: string; nombre: string; activo: boolean };

const OPERACIONES_FORMA_PAGO = ['COMPRA', 'VENTA', 'PAGO', 'INVERSION', 'EXTRACCION', 'COBRO'];

function CategoriasYFormasDePagoTab({ empresaId, esAdmin }: { empresaId: string; esAdmin: boolean }) {
  const [categoriasProducto, setCategoriasProducto] = useState<CategoriaProducto[]>([]);
  const [categoriasServicio, setCategoriasServicio] = useState<CategoriaGasto[]>([]);
  const [categoriasGasto, setCategoriasGasto] = useState<CategoriaGasto[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [cuentas, setCuentas] = useState<CuentaOpcion[]>([]);
  const [operaciones, setOperaciones] = useState<OperacionOpcion[]>([]);
  const [tieneEsqueleto, setTieneEsqueleto] = useState(true);
  const [permiteProducto, setPermiteProducto] = useState(false);
  const [operacionServicio, setOperacionServicio] = useState<'VENTA' | 'COBRO' | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function recargar() {
    const [
      { data: cp },
      { data: cg },
      { data: fp },
      { data: soc },
      { data: pc },
      { data: op },
      { data: plantillas },
      { data: empresaData },
    ] = await Promise.all([
      supabase.from('categorias_productos').select('id, codigo, nombre, activo').eq('empresa_id', empresaId).order('nombre'),
      supabase.from('categorias_operacion').select('id, codigo, nombre, activo').eq('empresa_id', empresaId).eq('operacion', 'PAGO').order('nombre'),
      supabase.from('formas_pago').select('id, codigo, nombre, activo').eq('empresa_id', empresaId).order('nombre'),
      supabase.from('socios').select('id, codigo, nombre, activo').eq('empresa_id', empresaId).order('nombre'),
      supabase.from('plan_cuentas').select('id, codigo, nombre').eq('empresa_id', empresaId).eq('tipo_saldo', 'ACTIVO').eq('activo', true).order('codigo'),
      supabase.from('operaciones').select('id, nombre').eq('empresa_id', empresaId),
      supabase.from('reglas_contables').select('operacion, motor').eq('empresa_id', empresaId).is('categoria_codigo', null),
      supabase.from('empresas').select('perfil_empresa_id, perfiles_empresa(codigo)').eq('id', empresaId).maybeSingle(),
    ]);

    // Si el perfil es Mixto, lo que se ofrece depende de qué
    // componentes tildó el admin en "Datos de la Empresa" (no todo
    // Mixto vende productos Y servicios a la vez).
    const perfilCodigo = (empresaData as { perfiles_empresa?: { codigo: string } | null } | null)?.perfiles_empresa
      ?.codigo;

    let componentesMixto: string[] = [];
    if (perfilCodigo === 'MIXTO') {
      const { data: comp } = await supabase
        .from('empresa_mixto_componentes')
        .select('componente')
        .eq('empresa_id', empresaId);
      componentesMixto = (comp ?? []).map((c) => c.componente);
    }

    const esMixto = perfilCodigo === 'MIXTO';
    const mixtoHabilitaProducto = !esMixto || componentesMixto.includes('COMERCIAL') || componentesMixto.includes('PRODUCCION');
    const mixtoHabilitaServicio = !esMixto || componentesMixto.includes('SERVICIOS');

    const operacionServicioDetectada = mixtoHabilitaServicio
      ? (plantillas ?? []).find((p) => p.motor === 'SERVICIOS' || p.motor === 'INGRESOS')
      : undefined;

    setCategoriasProducto(cp ?? []);
    setCategoriasGasto(cg ?? []);
    setFormasPago(fp ?? []);
    setSocios(soc ?? []);
    setCuentas(pc ?? []);
    setOperaciones(op ?? []);
    setTieneEsqueleto((pc ?? []).length > 0);
    // Una empresa "vieja" (migrada a mano, sin pasar por un perfil)
    // puede no tener la plantilla de reglas, pero si ya tiene
    // categorías de producto cargadas obviamente sí las usa.
    setPermiteProducto(
      mixtoHabilitaProducto && ((plantillas ?? []).some((p) => p.motor === 'COMPRAS') || (cp ?? []).length > 0)
    );
    setOperacionServicio(operacionServicioDetectada ? (operacionServicioDetectada.operacion as 'VENTA' | 'COBRO') : null);

    if (operacionServicioDetectada) {
      const { data: cs } = await supabase
        .from('categorias_operacion')
        .select('id, codigo, nombre, activo')
        .eq('empresa_id', empresaId)
        .eq('operacion', operacionServicioDetectada.operacion)
        .order('nombre');

      setCategoriasServicio(cs ?? []);
    } else {
      setCategoriasServicio([]);
    }

    setCargando(false);
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function manejarAccion(accion: () => Promise<unknown>, mensajeExito: string) {
    setError('');
    setMensaje('');

    try {
      const resultado = await accion();
      const avisos = (resultado as { avisos?: string[] } | undefined)?.avisos ?? [];

      setMensaje(avisos.length > 0 ? `${mensajeExito} ${avisos.join(' ')}` : mensajeExito);
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  if (cargando) {
    return <div style={cargandoStyle}>Cargando categorías...</div>;
  }

  if (!tieneEsqueleto) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORES.gris }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORES.azul }}>
          Todavía no hay un Plano de Contas cargado
        </div>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          Asigná un perfil de empresa en la pestaña &quot;Datos de la Empresa&quot; para poder crear categorías acá.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={mensajeOkStyle}>{mensaje}</div>}

      {permiteProducto && (
        <BloqueCategoriaProducto
          categorias={categoriasProducto}
          esAdmin={esAdmin}
          onCrear={(nombre) =>
            manejarAccion(() => crearCategoriaProducto(empresaId, nombre), `Categoría "${nombre}" creada con sus cuentas.`)
          }
          onCambiarActivo={(id, activo) =>
            manejarAccion(() => cambiarActivoCategoriaProducto(id, activo), 'Categoría actualizada.')
          }
          onEliminar={(id, nombre) =>
            manejarAccion(() => eliminarCategoriaProducto(id), `Categoría "${nombre}" eliminada.`)
          }
        />
      )}

      {operacionServicio && (
        <BloqueCategoriaServicio
          titulo={operacionServicio === 'COBRO' ? '💰 Categorías de Ingreso' : '🧑‍💼 Categorías de Servicio'}
          subtitulo={
            operacionServicio === 'COBRO'
              ? 'Habilitan la operación Cobro (sueldo, otros ingresos). Cada una genera su propia cuenta de ingreso.'
              : 'Habilitan la venta de un servicio (sin stock). Cada una genera su propia cuenta de ingreso.'
          }
          categorias={categoriasServicio}
          esAdmin={esAdmin}
          onCrear={(nombre) =>
            manejarAccion(
              () => crearCategoriaIngreso(empresaId, nombre, operacionServicio),
              `Categoría "${nombre}" creada.`
            )
          }
          onCambiarActivo={(id, activo) =>
            manejarAccion(() => cambiarActivoCategoriaIngreso(id, activo), 'Categoría actualizada.')
          }
          onEliminar={(id, nombre) =>
            manejarAccion(() => eliminarCategoriaOperacion(id), `Categoría "${nombre}" eliminada.`)
          }
        />
      )}

      <BloqueCategoriaGasto
        categorias={categoriasGasto}
        esAdmin={esAdmin}
        onCrear={(nombre) =>
          manejarAccion(() => crearCategoriaGasto(empresaId, nombre), `Categoría de gasto "${nombre}" creada.`)
        }
        onCambiarActivo={(id, activo) =>
          manejarAccion(() => cambiarActivoCategoriaGasto(id, activo), 'Categoría actualizada.')
        }
        onEliminar={(id, nombre) =>
          manejarAccion(() => eliminarCategoriaOperacion(id), `Categoría "${nombre}" eliminada.`)
        }
      />

      <BloqueFormasDePago
        formasPago={formasPago}
        cuentas={cuentas}
        operaciones={operaciones}
        esAdmin={esAdmin}
        onCrear={(nombre, cuenta, operacionesElegidas) =>
          manejarAccion(async () => {
            const cuentaId =
              'id' in cuenta ? cuenta.id : await crearCuentaParaMedioPago(empresaId, cuenta.nombre, cuenta.tipoSaldo);

            await crearFormaPago(empresaId, nombre, cuentaId, operacionesElegidas);
          }, `Forma de pago "${nombre}" creada.`)
        }
        onCambiarActivo={(id, activo) => manejarAccion(() => cambiarActivoFormaPago(id, activo), 'Forma de pago actualizada.')}
        onEliminar={(id, nombre) => manejarAccion(() => eliminarFormaPago(id), `Forma de pago "${nombre}" eliminada.`)}
      />

      <BloqueSocios
        socios={socios}
        esAdmin={esAdmin}
        onCrear={(nombre) => manejarAccion(() => crearSocio(empresaId, nombre), `"${nombre}" agregado/a.`)}
        onCambiarActivo={(id, activo) => manejarAccion(() => cambiarActivoSocio(id, activo), 'Actualizado.')}
        onEliminar={(id, nombre) => manejarAccion(() => eliminarSocio(id), `"${nombre}" eliminado/a.`)}
      />
    </div>
  );
}

function BloqueSocios({
  socios,
  esAdmin,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  socios: Socio[];
  esAdmin: boolean;
  onCrear: (nombre: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const [nombreNuevo, setNombreNuevo] = useState('');

  return (
    <SeccionCategoria
      titulo="🤝 Socios/as"
      subtitulo="Quiénes pueden aparecer como 'a quién' en Inversión (aporte), Extracción (retiro) y Pérdida. No hace falta que tengan usuario propio para entrar al sistema."
    >
      <ListaConToggle items={socios} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} />

      {esAdmin && (
        <FormularioNuevo
          placeholder="Nombre del socio/a (ej. Ezequiel)"
          valor={nombreNuevo}
          onCambiar={setNombreNuevo}
          onAgregar={() => {
            if (!nombreNuevo.trim()) return;
            onCrear(nombreNuevo);
            setNombreNuevo('');
          }}
        />
      )}
    </SeccionCategoria>
  );
}

function BloqueCategoriaProducto({
  categorias,
  esAdmin,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  categorias: CategoriaProducto[];
  esAdmin: boolean;
  onCrear: (nombre: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const [nombreNuevo, setNombreNuevo] = useState('');

  return (
    <SeccionCategoria titulo="🛍️ Categorías de Producto" subtitulo="Habilitan Compra, Venta y Pérdida. Cada una genera su cuenta de Stock, Venta y Costo automáticamente.">
      <ListaConToggle items={categorias} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} />

      {esAdmin && (
        <FormularioNuevo
          placeholder="Nombre de la categoría (ej. Perfumería)"
          valor={nombreNuevo}
          onCambiar={setNombreNuevo}
          onAgregar={() => {
            if (!nombreNuevo.trim()) return;
            onCrear(nombreNuevo);
            setNombreNuevo('');
          }}
        />
      )}
    </SeccionCategoria>
  );
}

function BloqueCategoriaServicio({
  titulo,
  subtitulo,
  categorias,
  esAdmin,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  titulo: string;
  subtitulo: string;
  categorias: CategoriaGasto[];
  esAdmin: boolean;
  onCrear: (nombre: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const [nombreNuevo, setNombreNuevo] = useState('');

  return (
    <SeccionCategoria titulo={titulo} subtitulo={subtitulo}>
      <ListaConToggle items={categorias} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} />

      {esAdmin && (
        <FormularioNuevo
          placeholder="Nombre (ej. Sueldo, Consultoría)"
          valor={nombreNuevo}
          onCambiar={setNombreNuevo}
          onAgregar={() => {
            if (!nombreNuevo.trim()) return;
            onCrear(nombreNuevo);
            setNombreNuevo('');
          }}
        />
      )}
    </SeccionCategoria>
  );
}

function BloqueCategoriaGasto({
  categorias,
  esAdmin,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  categorias: CategoriaGasto[];
  esAdmin: boolean;
  onCrear: (nombre: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const [nombreNuevo, setNombreNuevo] = useState('');

  return (
    <SeccionCategoria titulo="🧾 Categorías de Gasto" subtitulo="Habilitan la operación Pago (si el nombre ya existe en el plan, se reutiliza esa cuenta en vez de duplicar).">
      <ListaConToggle items={categorias} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} />

      {esAdmin && (
        <FormularioNuevo
          placeholder="Nombre del gasto (ej. Alquiler del local)"
          valor={nombreNuevo}
          onCambiar={setNombreNuevo}
          onAgregar={() => {
            if (!nombreNuevo.trim()) return;
            onCrear(nombreNuevo);
            setNombreNuevo('');
          }}
        />
      )}
    </SeccionCategoria>
  );
}

const OPCION_CUENTA_NUEVA = '__nueva__';

function BloqueFormasDePago({
  formasPago,
  cuentas,
  operaciones,
  esAdmin,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  formasPago: FormaPago[];
  cuentas: CuentaOpcion[];
  operaciones: OperacionOpcion[];
  esAdmin: boolean;
  onCrear: (
    nombre: string,
    cuenta: { id: string } | { nueva: true; nombre: string; tipoSaldo: 'ACTIVO' | 'PASIVO' },
    operacionesElegidas: string[]
  ) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [cuentaElegida, setCuentaElegida] = useState('');
  const [nombreCuentaNueva, setNombreCuentaNueva] = useState('');
  const [tipoCuentaNueva, setTipoCuentaNueva] = useState<'ACTIVO' | 'PASIVO'>('ACTIVO');
  const [operacionesElegidas, setOperacionesElegidas] = useState<string[]>([]);

  const operacionesDisponibles = operaciones
    .map((o) => o.nombre)
    .filter((nombre) => OPERACIONES_FORMA_PAGO.includes(nombre));

  const esCuentaNueva = cuentaElegida === OPCION_CUENTA_NUEVA;

  function alternarOperacion(nombre: string) {
    setOperacionesElegidas((actual) =>
      actual.includes(nombre) ? actual.filter((n) => n !== nombre) : [...actual, nombre]
    );
  }

  return (
    <SeccionCategoria titulo="💳 Formas de Pago" subtitulo="Cada una se vincula a una cuenta contable existente (o nueva) y a las operaciones donde se puede usar.">
      <ListaConToggle items={formasPago} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} />

      {esAdmin && (
      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            style={{ ...inputFormulario, flex: '1 1 220px' }}
            placeholder="Nombre (ej. Mercado Pago)"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />

          <select
            style={{ ...inputFormulario, flex: '1 1 220px' }}
            value={cuentaElegida}
            onChange={(e) => setCuentaElegida(e.target.value)}
          >
            <option value="">Cuenta contable...</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.codigo} — {cuenta.nombre}
              </option>
            ))}
            <option value={OPCION_CUENTA_NUEVA}>➕ La cuenta no existe — crear una nueva</option>
          </select>
        </div>

        {esCuentaNueva && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: '#f8fafc', padding: 12, borderRadius: 10 }}>
            <input
              style={{ ...inputFormulario, flex: '1 1 220px' }}
              placeholder="Nombre de la cuenta nueva (ej. Billetera Mercado Pago)"
              value={nombreCuentaNueva}
              onChange={(e) => setNombreCuentaNueva(e.target.value)}
            />

            <select
              style={{ ...inputFormulario, flex: '0 1 180px' }}
              value={tipoCuentaNueva}
              onChange={(e) => setTipoCuentaNueva(e.target.value as 'ACTIVO' | 'PASIVO')}
            >
              <option value="ACTIVO">Activo (tengo esa plata)</option>
              <option value="PASIVO">Pasivo (debo esa plata)</option>
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {operacionesDisponibles.map((nombre) => (
            <label key={nombre} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORES.azul, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={operacionesElegidas.includes(nombre)}
                onChange={() => alternarOperacion(nombre)}
              />
              {nombre}
            </label>
          ))}
        </div>

        <div>
          <button
            type="button"
            style={botonGuardar}
            onClick={() => {
              if (!nombreNuevo.trim() || !cuentaElegida) return;
              if (esCuentaNueva && !nombreCuentaNueva.trim()) return;

              onCrear(
                nombreNuevo,
                esCuentaNueva
                  ? { nueva: true, nombre: nombreCuentaNueva, tipoSaldo: tipoCuentaNueva }
                  : { id: cuentaElegida },
                operacionesElegidas
              );

              setNombreNuevo('');
              setCuentaElegida('');
              setNombreCuentaNueva('');
              setOperacionesElegidas([]);
            }}
          >
            + Agregar forma de pago
          </button>
        </div>
      </div>
      )}
    </SeccionCategoria>
  );
}

function SeccionCategoria({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 30, paddingBottom: 24, borderBottom: '1px solid #eef2f6' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: COLORES.azul }}>{titulo}</div>
      <p style={{ margin: '4px 0 14px', fontSize: 12.5, color: COLORES.gris }}>{subtitulo}</p>
      {children}
    </div>
  );
}

function ListaConToggle<T extends { id: string; codigo: string; nombre: string; activo: boolean }>({
  items,
  onCambiarActivo,
  onEliminar,
  soloLectura = false,
}: {
  items: T[];
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar?: (id: string, nombre: string) => void;
  soloLectura?: boolean;
}) {
  if (items.length === 0) {
    return <p style={{ fontSize: 13, color: COLORES.gris, marginBottom: 12 }}>Todavía no hay ninguna cargada.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 12px',
            borderRadius: 10,
            background: item.activo ? '#f8fafc' : '#f3f4f6',
            border: '1px solid #e5e7eb',
          }}
        >
          <div>
            <span style={{ fontSize: 11, color: COLORES.gris, marginRight: 8 }}>{item.codigo}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: item.activo ? COLORES.azul : COLORES.gris }}>
              {item.nombre}
            </span>
          </div>

          {soloLectura ? (
            <span style={{ fontSize: 11.5, color: COLORES.gris, fontWeight: 700 }}>
              {item.activo ? 'Activa' : 'Inactiva'}
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORES.gris, cursor: 'pointer' }}>
                {item.activo ? 'Activa' : 'Inactiva'}
                <input
                  type="checkbox"
                  checked={item.activo}
                  onChange={(e) => onCambiarActivo(item.id, e.target.checked)}
                />
              </label>

              {onEliminar && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar "${item.nombre}"? Esto no borra la cuenta contable, solo la categoría/forma de pago y sus reglas.`)) {
                      onEliminar(item.id, item.nombre);
                    }
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#b91c1c',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: 0,
                  }}
                  title="Eliminar"
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FormularioNuevo({
  placeholder,
  valor,
  onCambiar,
  onAgregar,
}: {
  placeholder: string;
  valor: string;
  onCambiar: (valor: string) => void;
  onAgregar: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <input
        style={{ ...inputFormulario, flex: 1 }}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAgregar();
        }}
      />

      <button type="button" style={botonGuardar} onClick={onAgregar}>
        + Agregar
      </button>
    </div>
  );
}

/* ==========================================================
   PESTAÑA 3 — PLANO DE CONTAS
========================================================== */

type CuentaPlan = {
  id: string;
  codigo: string;
  nombre: string;
  cuenta_padre_id: string | null;
  naturaleza: string | null;
  tipo_saldo: string | null;
  rol_contable: string | null;
  activo: boolean;
};

type NodoCuenta = CuentaPlan & { hijos: NodoCuenta[] };

const NOMBRE_CONTENEDOR: Record<string, string> = {
  CONTENEDOR_STOCK: 'cuenta base de Stock',
  CONTENEDOR_INGRESO: 'cuenta base de Ingresos',
  CONTENEDOR_COSTO: 'cuenta base de Costos',
  CONTENEDOR_GASTO: 'cuenta base de Gastos',
  CONTENEDOR_PERDIDA: 'cuenta de Pérdida y Baja de Stock',
};

function armarArbol(cuentas: CuentaPlan[]): NodoCuenta[] {
  const nodos = new Map<string, NodoCuenta>(cuentas.map((c) => [c.id, { ...c, hijos: [] }]));
  const raices: NodoCuenta[] = [];

  for (const nodo of nodos.values()) {
    if (nodo.cuenta_padre_id && nodos.has(nodo.cuenta_padre_id)) {
      nodos.get(nodo.cuenta_padre_id)!.hijos.push(nodo);
    } else {
      raices.push(nodo);
    }
  }

  const ordenar = (lista: NodoCuenta[]) => {
    lista.sort((a, b) => a.codigo.localeCompare(b.codigo));
    lista.forEach((n) => ordenar(n.hijos));
  };

  ordenar(raices);
  return raices;
}

function PlanDeCuentasTab({ empresaId, esAdmin }: { empresaId: string; esAdmin: boolean }) {
  const [cuentas, setCuentas] = useState<CuentaPlan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [mostrarInactivas, setMostrarInactivas] = useState(false);

  async function recargar() {
    const { data, error: errorCuentas } = await supabase
      .from('plan_cuentas')
      .select('id, codigo, nombre, cuenta_padre_id, naturaleza, tipo_saldo, rol_contable, activo')
      .eq('empresa_id', empresaId);

    if (errorCuentas) {
      setError('No se pudo cargar el Plan de Cuentas.');
      setCargando(false);
      return;
    }

    setCuentas((data ?? []) as CuentaPlan[]);
    setCargando(false);
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function renombrar(id: string, nombreNuevo: string) {
    const nombreLimpio = nombreNuevo.trim();
    if (!nombreLimpio) return;

    try {
      await renombrarCuentaPlan(empresaId, id, nombreLimpio);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo renombrar la cuenta.');
      return;
    }

    setMensaje('Cuenta renombrada — se actualizó en todas las operaciones que ya la usaban.');
    await recargar();
  }

  async function cambiarActivo(id: string, activo: boolean) {
    const { error: errorUpdate } = await supabase.from('plan_cuentas').update({ activo }).eq('id', id);

    if (errorUpdate) {
      setError('No se pudo actualizar la cuenta.');
      return;
    }

    setMensaje('Cuenta actualizada.');
    await recargar();
  }

  async function eliminar(id: string) {
    setError('');
    setMensaje('');

    try {
      await eliminarCuentaPlan(empresaId, id);
      setMensaje('Cuenta eliminada.');
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.');
    }
  }

  if (cargando) {
    return <div style={cargandoStyle}>Cargando Plan de Cuentas...</div>;
  }

  if (cuentas.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORES.gris }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORES.azul }}>
          Todavía no hay Plan de Cuentas
        </div>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          Asigná un perfil de empresa en &quot;Datos de la Empresa&quot; para generarlo.
        </p>
      </div>
    );
  }

  const arbol = armarArbol(cuentas);

  return (
    <div>
      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={mensajeOkStyle}>{mensaje}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: COLORES.gris }}>
          <input type="checkbox" checked={mostrarInactivas} onChange={(e) => setMostrarInactivas(e.target.checked)} />
          Mostrar cuentas inactivas
        </label>
      </div>

      {!esAdmin && (
        <p style={{ fontSize: 12, color: COLORES.gris, marginBottom: 10 }}>
          Solo un administrador de plataforma puede renombrar o desactivar cuentas acá.
        </p>
      )}

      <div style={{ border: '1px solid #eef2f6', borderRadius: 14, overflow: 'hidden' }}>
        {arbol.map((nodo) => (
          <NodoPlanDeCuentas
            key={nodo.id}
            nodo={nodo}
            nivel={0}
            mostrarInactivas={mostrarInactivas}
            esAdmin={esAdmin}
            onRenombrar={renombrar}
            onCambiarActivo={cambiarActivo}
            onEliminar={eliminar}
          />
        ))}
      </div>
    </div>
  );
}

function NodoPlanDeCuentas({
  nodo,
  nivel,
  mostrarInactivas,
  esAdmin,
  onRenombrar,
  onCambiarActivo,
  onEliminar,
}: {
  nodo: NodoCuenta;
  nivel: number;
  mostrarInactivas: boolean;
  esAdmin: boolean;
  onRenombrar: (id: string, nombreNuevo: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(nodo.nombre);
  const esContenedor = Boolean(nodo.rol_contable);
  const tieneHijos = nodo.hijos.length > 0;

  if (!nodo.activo && !mostrarInactivas) {
    return null;
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 14px',
          paddingLeft: 14 + nivel * 22,
          borderTop: nivel === 0 ? 'none' : '1px solid #f3f4f6',
          background: nivel === 0 ? '#f8fafc' : COLORES.blanco,
          opacity: nodo.activo ? 1 : 0.55,
        }}
      >
        <span style={{ fontSize: 11, color: COLORES.gris, minWidth: 78 }}>{nodo.codigo}</span>

        {tieneHijos || !esAdmin ? (
          <span style={{ fontSize: 13, fontWeight: nivel === 0 ? 800 : 700, color: COLORES.azul, flex: 1 }}>
            {nodo.nombre}
          </span>
        ) : (
          <input
            style={{ ...inputFormulario, padding: '5px 8px', fontSize: 13, flex: 1, maxWidth: 320 }}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => nombre !== nodo.nombre && onRenombrar(nodo.id, nombre)}
          />
        )}

        {esContenedor && (
          <span style={{ fontSize: 11, color: COLORES.verde, fontWeight: 700 }}>
            🔒 {NOMBRE_CONTENEDOR[nodo.rol_contable as string] ?? 'cuenta especial'}
          </span>
        )}

        {!tieneHijos && !esContenedor && (
          esAdmin ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: COLORES.gris, cursor: 'pointer' }}>
                {nodo.activo ? 'Activa' : 'Inactiva'}
                <input
                  type="checkbox"
                  checked={nodo.activo}
                  onChange={(e) => onCambiarActivo(nodo.id, e.target.checked)}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Eliminar la cuenta "${nodo.nombre}"? Solo se puede si nunca tuvo movimiento.`)) {
                    onEliminar(nodo.id);
                  }
                }}
                style={{ border: 'none', background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontSize: 13, padding: 0 }}
                title="Eliminar cuenta"
              >
                🗑️
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: COLORES.gris }}>{nodo.activo ? 'Activa' : 'Inactiva'}</span>
          )
        )}
      </div>

      {nodo.hijos.map((hijo) => (
        <NodoPlanDeCuentas
          key={hijo.id}
          nodo={hijo}
          nivel={nivel + 1}
          mostrarInactivas={mostrarInactivas}
          esAdmin={esAdmin}
          onRenombrar={onRenombrar}
          onCambiarActivo={onCambiarActivo}
          onEliminar={onEliminar}
        />
      ))}
    </>
  );
}

/* ==========================================================
   PESTAÑA 4 — INICIALIZAÇÃO DO SISTEMA
========================================================== */

function InicializacionTab({ empresaId, esAdmin }: { empresaId: string; esAdmin: boolean }) {
  const [matrizGenerada, setMatrizGenerada] = useState(false);
  const [tieneEsqueleto, setTieneEsqueleto] = useState(false);
  const [cantidadCategorias, setCantidadCategorias] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ reglasGeneradas: number } | null>(null);

  async function recargar() {
    const [
      { data: empresaData },
      { count: cuentasCount },
      { count: categoriasCount },
    ] = await Promise.all([
      supabase.from('empresas').select('matriz_generada').eq('id', empresaId).maybeSingle(),
      supabase.from('plan_cuentas').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
      supabase
        .from('reglas_contables')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .not('categoria_codigo', 'is', null),
    ]);

    setMatrizGenerada(Boolean(empresaData?.matriz_generada));
    setTieneEsqueleto(Boolean(cuentasCount && cuentasCount > 0));
    setCantidadCategorias(categoriasCount ?? 0);
    setCargando(false);
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function generar() {
    setGenerando(true);
    setError('');
    setResultado(null);

    try {
      const resultadoGeneracion = await generarMatrizOperaciones(empresaId);

      const { error: errorMarcar } = await supabase
        .from('empresas')
        .update({ matriz_generada: true })
        .eq('id', empresaId);

      if (errorMarcar) {
        throw errorMarcar;
      }

      setResultado(resultadoGeneracion);
      setMatrizGenerada(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado al generar la matriz.');
    } finally {
      setGenerando(false);
    }
  }

  if (cargando) {
    return <div style={cargandoStyle}>Cargando...</div>;
  }

  if (!tieneEsqueleto) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORES.gris }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🚀</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORES.azul }}>Falta un paso antes</div>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          Asigná un perfil de empresa en &quot;Datos de la Empresa&quot; para poder generar la matriz.
        </p>
      </div>
    );
  }

  const bloqueado = matrizGenerada && !esAdmin;

  return (
    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
      {error && <div style={{ ...errorStyle, textAlign: 'left' }}>{error}</div>}

      {resultado && (
        <div style={{ ...mensajeOkStyle, textAlign: 'left' }}>
          Matriz generada correctamente: {resultado.reglasGeneradas} reglas de operación quedaron listas.
        </div>
      )}

      <div style={{ fontSize: 40, marginBottom: 10 }}>{matrizGenerada ? '✅' : '🚀'}</div>

      <h3 style={{ margin: '0 0 8px', color: COLORES.azul }}>
        {matrizGenerada ? 'El sistema ya está inicializado' : 'Generar la Matriz de Operaciones'}
      </h3>

      <p style={{ maxWidth: 480, margin: '0 auto 22px', fontSize: 13.5, color: COLORES.gris, lineHeight: 1.6 }}>
        {matrizGenerada
          ? bloqueado
            ? 'La matriz ya fue generada. Para volver a generarla hace falta un administrador de plataforma.'
            : 'La matriz ya fue generada. Como administrador podés volver a generarla si cambiaste categorías o formas de pago.'
          : `Esto arma la Matriz de Operaciones a partir de tus ${cantidadCategorias} categorías configuradas. Una vez generada, solo un administrador de plataforma podrá volver a generarla.`}
      </p>

      <button
        type="button"
        style={{
          ...botonGuardar,
          padding: '13px 26px',
          fontSize: 14,
          opacity: bloqueado || generando ? 0.6 : 1,
          cursor: bloqueado || generando ? 'not-allowed' : 'pointer',
        }}
        disabled={bloqueado || generando}
        onClick={generar}
      >
        {generando ? 'Generando...' : matrizGenerada ? '🔒 Regenerar Matriz de Operaciones' : 'Generar Matriz de Operaciones'}
      </button>
    </div>
  );
}

/* ==========================================================
   FIN DE PESTAÑAS
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

/* ==========================================================
   PESTAÑA 5 — OBJETIVOS
========================================================== */

type ObjetivoFila = {
  id: string;
  categoria: CategoriaObjetivo;
  indicador: IndicadorCodigo;
  nombre: string;
  objetivo: number;
  unidad: string;
  activo: boolean;
  orden: number;
};

const CATEGORIAS_OBJETIVO: { valor: CategoriaObjetivo; titulo: string; emoji: string }[] = [
  { valor: 'ACTIVIDAD', titulo: 'Primeros pasos', emoji: '🚀' },
  { valor: 'METAS', titulo: 'Metas familiares', emoji: '✈️' },
  { valor: 'CONTABLE', titulo: 'Contables', emoji: '📒' },
  { valor: 'MERCADERIA', titulo: 'Mercadería', emoji: '📦' },
  { valor: 'FINANCIERO', titulo: 'Financieros', emoji: '💹' },
  { valor: 'MARKETING', titulo: 'Marketing', emoji: '📣' },
];

function ObjetivosTab({ empresaId, esAdmin }: { empresaId: string; esAdmin: boolean }) {
  const [objetivos, setObjetivos] = useState<ObjetivoFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [editando, setEditando] = useState<ObjetivoFila | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState<CategoriaObjetivo | null>(null);

  async function recargar() {
    try {
      const data = await obtenerDefiniciones(empresaId);
      setObjetivos(data as ObjetivoFila[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los objetivos.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function manejarAccion(accion: () => Promise<unknown>, mensajeExito: string) {
    setError('');
    setMensaje('');

    try {
      await accion();
      setMensaje(mensajeExito);
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  if (cargando) {
    return <div style={cargandoStyle}>Cargando objetivos...</div>;
  }

  return (
    <div>
      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={mensajeOkStyle}>{mensaje}</div>}

      {!esAdmin && (
        <p style={{ fontSize: 12, color: COLORES.gris, marginBottom: 14 }}>
          Solo un administrador de plataforma puede crear, editar o borrar objetivos acá.
        </p>
      )}

      {CATEGORIAS_OBJETIVO.map(({ valor, titulo, emoji }) => {
        const deLaCategoria = objetivos.filter((o) => o.categoria === valor);

        return (
          <SeccionCategoria
            key={valor}
            titulo={`${emoji} ${titulo}`}
            subtitulo={
              valor === 'MARKETING'
                ? 'Todavía no hay indicadores conectables (Instagram/WhatsApp) — quedan como "Próximamente" en el Panel de Control.'
                : 'Se calculan solos contra la contabilidad real — no hace falta cargarlos a mano cada mes.'
            }
          >
            {deLaCategoria.length === 0 ? (
              <p style={{ fontSize: 13, color: COLORES.gris, marginBottom: 12 }}>Ninguno cargado todavía.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {deLaCategoria.map((obj) => (
                  <div
                    key={obj.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: 10,
                      background: obj.activo ? '#f8fafc' : '#f3f4f6',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: obj.activo ? COLORES.azul : COLORES.gris }}>
                        {obj.nombre}
                      </span>
                      <span style={{ fontSize: 11.5, color: COLORES.gris, marginLeft: 8 }}>
                        meta: {obj.objetivo} {obj.unidad}
                      </span>
                    </div>

                    {esAdmin ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setEditando(obj)}
                          style={{ border: 'none', background: 'transparent', color: COLORES.azul, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}
                        >
                          Editar
                        </button>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: COLORES.gris, cursor: 'pointer' }}>
                          {obj.activo ? 'Activo' : 'Inactivo'}
                          <input
                            type="checkbox"
                            checked={obj.activo}
                            onChange={(e) =>
                              manejarAccion(() => cambiarActivoObjetivo(obj.id, e.target.checked), 'Objetivo actualizado.')
                            }
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Eliminar el objetivo "${obj.nombre}"?`)) {
                              manejarAccion(() => eliminarObjetivo(obj.id), 'Objetivo eliminado.');
                            }
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontSize: 13, padding: 0 }}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11.5, color: COLORES.gris }}>{obj.activo ? 'Activo' : 'Inactivo'}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {esAdmin && creandoNuevo !== valor && (
              <button type="button" style={botonGuardar} onClick={() => setCreandoNuevo(valor)}>
                + Agregar objetivo
              </button>
            )}

            {esAdmin && creandoNuevo === valor && (
              <FormularioObjetivo
                categoria={valor}
                onCancelar={() => setCreandoNuevo(null)}
                onGuardar={(datos) =>
                  manejarAccion(async () => {
                    const orden = deLaCategoria.length + 1;
                    await crearObjetivo(empresaId, { ...datos, categoria: valor, orden });
                    setCreandoNuevo(null);
                  }, `Objetivo "${datos.nombre}" creado.`)
                }
              />
            )}
          </SeccionCategoria>
        );
      })}

      {editando && (
        <ModalEditarObjetivo
          objetivo={editando}
          onCancelar={() => setEditando(null)}
          onGuardar={(datos) =>
            manejarAccion(async () => {
              await actualizarObjetivo(editando.id, datos);
              setEditando(null);
            }, 'Objetivo actualizado.')
          }
        />
      )}
    </div>
  );
}

function FormularioObjetivo({
  categoria,
  onCancelar,
  onGuardar,
}: {
  categoria: CategoriaObjetivo;
  onCancelar: () => void;
  onGuardar: (datos: { indicador: IndicadorCodigo; nombre: string; objetivo: number; unidad: string }) => void;
}) {
  const opciones = (Object.keys(CATALOGO_INDICADORES) as IndicadorCodigo[]).filter(
    (codigo) => CATALOGO_INDICADORES[codigo].categoria === categoria
  );

  const [indicador, setIndicador] = useState<IndicadorCodigo>(opciones[0]);
  const [nombre, setNombre] = useState(CATALOGO_INDICADORES[opciones[0]]?.nombreDefault ?? '');
  const [meta, setMeta] = useState(String(CATALOGO_INDICADORES[opciones[0]]?.objetivoDefault ?? 0));
  const [unidad, setUnidad] = useState(CATALOGO_INDICADORES[opciones[0]]?.unidadDefault ?? '');

  if (opciones.length === 0) {
    return (
      <p style={{ fontSize: 12.5, color: COLORES.gris, marginTop: 10 }}>
        Todavía no hay indicadores disponibles para esta categoría.
      </p>
    );
  }

  function elegirIndicador(codigo: IndicadorCodigo) {
    setIndicador(codigo);
    setNombre(CATALOGO_INDICADORES[codigo].nombreDefault);
    setMeta(String(CATALOGO_INDICADORES[codigo].objetivoDefault));
    setUnidad(CATALOGO_INDICADORES[codigo].unidadDefault);
  }

  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 10, background: '#f8fafc', padding: 14, borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select
          style={{ ...inputFormulario, flex: '1 1 220px' }}
          value={indicador}
          onChange={(e) => elegirIndicador(e.target.value as IndicadorCodigo)}
        >
          {opciones.map((codigo) => (
            <option key={codigo} value={codigo}>
              {CATALOGO_INDICADORES[codigo].nombreDefault}
            </option>
          ))}
        </select>

        <input
          style={{ ...inputFormulario, flex: '1 1 220px' }}
          placeholder="Nombre a mostrar"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: COLORES.gris }}>{CATALOGO_INDICADORES[indicador].ayuda}</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="number"
          style={{ ...inputFormulario, flex: '1 1 140px' }}
          placeholder="Meta"
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
        />

        <input
          style={{ ...inputFormulario, flex: '1 1 140px' }}
          placeholder="Unidad"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" style={botonSecundario} onClick={onCancelar}>
          Cancelar
        </button>

        <button
          type="button"
          style={botonGuardar}
          onClick={() => {
            if (!nombre.trim() || !unidad.trim()) return;
            onGuardar({ indicador, nombre: nombre.trim(), objetivo: Number(meta) || 0, unidad: unidad.trim() });
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function ModalEditarObjetivo({
  objetivo,
  onCancelar,
  onGuardar,
}: {
  objetivo: ObjetivoFila;
  onCancelar: () => void;
  onGuardar: (datos: { nombre: string; objetivo: number; unidad: string }) => void;
}) {
  const [nombre, setNombre] = useState(objetivo.nombre);
  const [meta, setMeta] = useState(String(objetivo.objetivo));
  const [unidad, setUnidad] = useState(objetivo.unidad);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div style={{ background: COLORES.blanco, borderRadius: 16, padding: 22, width: '100%', maxWidth: 420 }}>
        <h3 style={{ margin: '0 0 4px', color: COLORES.azul, fontSize: 17 }}>Editar objetivo</h3>
        <p style={{ margin: '0 0 16px', fontSize: 11.5, color: COLORES.gris }}>{CATALOGO_INDICADORES[objetivo.indicador].ayuda}</p>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={campo}>
            <label style={label}>Nombre</label>
            <input style={inputFormulario} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ ...campo, flex: 1 }}>
              <label style={label}>Meta</label>
              <input type="number" style={inputFormulario} value={meta} onChange={(e) => setMeta(e.target.value)} />
            </div>

            <div style={{ ...campo, flex: 1 }}>
              <label style={label}>Unidad</label>
              <input style={inputFormulario} value={unidad} onChange={(e) => setUnidad(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" style={botonSecundario} onClick={onCancelar}>
            Cancelar
          </button>

          <button
            type="button"
            style={botonGuardar}
            onClick={() => {
              if (!nombre.trim() || !unidad.trim()) return;
              onGuardar({ nombre: nombre.trim(), objetivo: Number(meta) || 0, unidad: unidad.trim() });
            }}
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA 6 — FACTURAÇÃO (pagar la suscripción)
========================================================== */

// Links de pago fijos, generados desde el panel de comercio de cada
// plataforma (InfinitePay para Real, Naranja X para Peso argentino).
// Se completan acá una sola vez — no dependen de cada empresa, son
// del negocio (Visão Financeira) en sí.
const LINK_PAGO_INFINITEPAY: string | null = null;
const LINK_PAGO_NARANJA_X: string | null = null;

function FacturacionTab({ empresaId }: { empresaId: string; esAdmin: boolean }) {
  const [moneda, setMoneda] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenSuscripcion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from('empresas')
        .select('moneda, fecha_vencimiento_suscripcion')
        .eq('id', empresaId)
        .maybeSingle();

      setMoneda(data?.moneda ?? null);

      if (data?.fecha_vencimiento_suscripcion) {
        setResumen(resumirSuscripcion(data.fecha_vencimiento_suscripcion));
      }

      setCargando(false);
    }

    cargar();
  }, [empresaId]);

  if (cargando) {
    return <div style={cargandoStyle}>Cargando...</div>;
  }

  const link = moneda === 'BRL' ? LINK_PAGO_INFINITEPAY : moneda === 'ARS' ? LINK_PAGO_NARANJA_X : null;
  const plataforma = moneda === 'BRL' ? 'InfinitePay' : moneda === 'ARS' ? 'Naranja X' : null;

  return (
    <div>
      <p style={{ fontSize: 13, color: COLORES.gris, marginBottom: 18 }}>
        Pagá tu suscripción según la moneda configurada para tu empresa (Datos de la Empresa → Moneda).
      </p>

      {resumen && <TarjetaEstadoSuscripcion resumen={resumen} />}

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: 24,
          textAlign: 'center',
          background: '#f8fafc',
        }}
      >
        {!moneda || !plataforma ? (
          <p style={{ margin: 0, fontSize: 13.5, color: COLORES.gris }}>
            Definí primero la moneda de tu empresa (Real o Peso argentino) en la pestaña &quot;Datos de la
            Empresa&quot; para ver el medio de pago correspondiente.
          </p>
        ) : link ? (
          <>
            <p style={{ margin: '0 0 14px', fontSize: 14, color: COLORES.azul }}>
              Tu empresa paga en <strong>{moneda === 'BRL' ? 'Reales' : 'Pesos argentinos'}</strong>, a través de{' '}
              <strong>{plataforma}</strong>.
            </p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '13px 28px',
                borderRadius: 12,
                background: COLORES.verde,
                color: COLORES.blanco,
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
              }}
            >
              Pagar suscripción con {plataforma} →
            </a>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, color: COLORES.gris }}>
            🔒 Todavía no está configurado el link de pago de {plataforma}. Va a estar disponible próximamente.
          </p>
        )}
      </div>
    </div>
  );
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

const botonSecundario: React.CSSProperties = {
  background: COLORES.blanco,
  color: COLORES.azul,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '10px 16px',
  cursor: 'pointer',
  fontWeight: 700,
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
