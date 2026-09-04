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
import { resetearSistema } from '@/lib/reset';
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
  ayudaIndicador,
  type CategoriaObjetivo,
  type IndicadorCodigo,
} from '@/lib/objetivos';
import { crearTraductor } from '@/lib/i18n';
import { empresaTieneOnboardingCompleto } from '@/lib/onboarding';
import { SabioWidget } from '@/components/panel/SabioWidget';
import {
  diccionarioConfiguracoes,
  type ClaveConfiguracoes,
  msgCategoriaCreada,
  msgCategoriaActualizada,
  msgCategoriaEliminada,
  msgFormaPagoCreada,
  msgFormaPagoActualizada,
  msgFormaPagoEliminada,
  msgSocioAgregado,
  msgSocioActualizado,
  msgSocioEliminado,
  confirmEliminarItem,
  confirmEliminarCuenta,
  msgMatrizGeneradaExito,
  msgMatrizExplicacion,
  confirmEliminarObjetivo,
  msgObjetivoCreado,
  msgPagarSuscripcionCon,
  msgLinkNoConfigurado,
  nombreOperacionDisplay,
  nombreCuentaDisplay,
  frasesSabioConfiguracoes,
  msgResetClaveIncorrecta,
  msgResetTextoNoCoincide,
  msgResetExito,
  msgResetErrorParcial,
} from './i18n';

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

type Pestana = 'empresa' | 'categorias' | 'plan' | 'inicializacion' | 'objetivos' | 'facturacion' | 'reset' | 'matriz';

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
  const [idioma, setIdioma] = useState('ES');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const t = crearTraductor(diccionarioConfiguracoes, idioma);

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
        setError(t('errorNoSeIdentificoEmpresa'));
        setCargando(false);
        return;
      }

      if (!(await empresaTieneOnboardingCompleto(perfil.empresa_id))) {
        router.push('/bienvenida');
        return;
      }

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('idioma')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      setEmpresaId(perfil.empresa_id);
      setEsAdmin(Boolean(perfil.es_admin_plataforma));
      setIdioma(empresaData?.idioma ?? 'ES');
      setCargando(false);
    }

    cargar();
  }, [router]);

  if (cargando) {
    return <div style={cargandoStyle}>{t('preparando')}</div>;
  }

  if (error || !empresaId) {
    return <div style={fondo}><div style={errorStyle}>{error || t('noSePudoCargar')}</div></div>;
  }

  return (
    <div style={fondo}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={encabezado}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <Link href="/?vista=empresa" style={volver}>
                {t('volver')}
              </Link>

              <div style={eyebrow}>{t('eyebrow')}</div>

              <h1 style={{ margin: 0, fontSize: 32 }}>{t('titulo')}</h1>

              <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
                {t('subtitulo')}
              </p>
            </div>

            {/* SABIO — permanente, con tips propios de Configurações.
                Vive en el mismo panel del encabezado, entre el título y
                los accesos rápidos. */}
            <SabioWidget
              colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
              idioma={idioma}
              frases={frasesSabioConfiguracoes(idioma)}
            />

            <AccesosHerramientas />
          </div>
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
              {t('tabEmpresa')}
            </button>

            <button type="button" onClick={() => setPestana('categorias')} style={tabStyle(pestana === 'categorias')}>
              {t('tabCategorias')}
            </button>

            <button type="button" onClick={() => setPestana('plan')} style={tabStyle(pestana === 'plan')}>
              {t('tabPlan')}
            </button>

            <button type="button" onClick={() => setPestana('inicializacion')} style={tabStyle(pestana === 'inicializacion')}>
              {t('tabInicializacion')}
            </button>

            <button type="button" onClick={() => setPestana('objetivos')} style={tabStyle(pestana === 'objetivos')}>
              {t('tabObjetivos')}
            </button>

            <button type="button" onClick={() => setPestana('facturacion')} style={tabStyle(pestana === 'facturacion')}>
              {t('tabFacturacion')}
            </button>

            <button type="button" onClick={() => setPestana('reset')} style={tabStyle(pestana === 'reset')}>
              {t('tabReset')}
            </button>

            {esAdmin && (
              <button type="button" onClick={() => setPestana('matriz')} style={tabStyle(pestana === 'matriz')}>
                {t('tabMatriz')}
              </button>
            )}
          </div>

          {pestana === 'empresa' && <DadosDaEmpresaTab empresaId={empresaId} esAdmin={esAdmin} idioma={idioma} />}
          {pestana === 'categorias' && <CategoriasYFormasDePagoTab empresaId={empresaId} esAdmin={esAdmin} idioma={idioma} />}
          {pestana === 'plan' && <PlanDeCuentasTab empresaId={empresaId} esAdmin={esAdmin} idioma={idioma} />}
          {pestana === 'inicializacion' && <InicializacionTab empresaId={empresaId} esAdmin={esAdmin} idioma={idioma} />}
          {pestana === 'objetivos' && <ObjetivosTab empresaId={empresaId} esAdmin={esAdmin} idioma={idioma} />}
          {pestana === 'facturacion' && <FacturacionTab empresaId={empresaId} esAdmin={esAdmin} idioma={idioma} />}
          {pestana === 'reset' && <ResetearSistemaTab empresaId={empresaId} esAdmin={esAdmin} idioma={idioma} />}
          {pestana === 'matriz' && esAdmin && <MatrizYPlanMaestroTab empresaId={empresaId} idioma={idioma} />}
        </main>
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA 1 — DADOS DA EMPRESA
========================================================== */

function DadosDaEmpresaTab({ empresaId, esAdmin, idioma }: { empresaId: string; esAdmin: boolean; idioma: string }) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
      setError(t('errorLogoPesado'));
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
      setError(t('errorSubidaLogo'));
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
      setError(t('errorLogoNoGuardado'));
      return;
    }

    actualizarCampo('logo_url', urlConVersion);
    setMensaje(t('mensajeLogoActualizado'));
  }

  async function guardar() {
    if (!empresa) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    const { data: existeNombre, error: errorNombreDuplicado } = await supabase.rpc('existe_nombre_empresa', {
      p_nombre: empresa.nombre.trim(),
      p_excluir_empresa_id: empresaId,
    });

    if (errorNombreDuplicado) {
      setError(errorNombreDuplicado.message);
      setGuardando(false);
      return;
    }

    if (existeNombre) {
      setError(t('errorNombreEmpresaDuplicado'));
      setGuardando(false);
      return;
    }

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
      setError(t('errorGuardarCambios'));
      return;
    }

    setMensaje(
      asignandoPerfilPorPrimeraVez
        ? t('mensajeGuardadoConInicializacion')
        : t('mensajeGuardadoOk')
    );
  }

  if (cargando) {
    return <div style={cargandoStyle}>{t('cargandoDatosEmpresa')}</div>;
  }

  if (!empresa) {
    return <div style={errorStyle}>{t('noSeEncontroEmpresa')}</div>;
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
        {t('clienteNumero')} {empresa.numero_cliente}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        <div style={campo}>
          <label style={label}>{t('campoNombreEmpresa')}</label>
          <input
            style={inputFormulario}
            value={empresa.nombre}
            onChange={(e) => actualizarCampo('nombre', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>{t('campoRubro')}</label>
          <input
            style={inputFormulario}
            value={empresa.rubro ?? ''}
            onChange={(e) => actualizarCampo('rubro', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>{t('campoTelefono')}</label>
          <input
            style={inputFormulario}
            value={empresa.telefono ?? ''}
            onChange={(e) => actualizarCampo('telefono', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>{t('campoEmail')}</label>
          <input
            type="email"
            style={inputFormulario}
            value={empresa.email ?? ''}
            onChange={(e) => actualizarCampo('email', e.target.value)}
          />
        </div>

        <div style={{ ...campo, gridColumn: '1 / -1' }}>
          <label style={label}>{t('campoDireccion')}</label>
          <input
            style={inputFormulario}
            value={empresa.direccion ?? ''}
            onChange={(e) => actualizarCampo('direccion', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>{t('campoIdentificacionFiscal')}</label>
          <input
            style={inputFormulario}
            value={empresa.identificacion_fiscal ?? ''}
            onChange={(e) => actualizarCampo('identificacion_fiscal', e.target.value)}
          />
        </div>

        <div style={campo}>
          <label style={label}>{t('campoLogo')}</label>

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
            <p style={{ margin: '6px 0 0', fontSize: 12, color: COLORES.gris }}>{t('subiendoLogo')}</p>
          )}
        </div>

        <div style={campo}>
          <label style={label}>{t('campoMoneda')}</label>
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
          <label style={label}>{t('campoIdioma')}</label>
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
          <label style={label}>{t('campoPerfilEmpresa')}</label>

          {esAdmin ? (
            <select
              style={inputFormulario}
              value={empresa.perfil_empresa_id ?? ''}
              onChange={(e) => actualizarCampo('perfil_empresa_id', e.target.value || null)}
            >
              <option value="">{t('sinDefinir')}</option>
              {perfiles.map((perfil) => (
                <option key={perfil.id} value={perfil.id}>
                  {perfil.nombre}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ ...inputFormulario, background: '#f3f4f6', color: COLORES.gris }}>
              {perfiles.find((p) => p.id === empresa.perfil_empresa_id)?.nombre ?? t('sinDefinir')}
            </div>
          )}

          {esAdmin && tieneEsqueleto && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: COLORES.gris }}>
              {t('avisoPerfilYaInicializado')}
            </p>
          )}

          {!esAdmin && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: COLORES.gris }}>
              {t('avisoPerfilLoDefineAdmin')}
            </p>
          )}
        </div>
      </div>

      {esAdmin && perfiles.find((p) => p.codigo === 'MIXTO')?.id === empresa.perfil_empresa_id && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORES.azul, marginBottom: 4 }}>
            {t('preguntaMixto')}
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: COLORES.gris }}>
            {t('ayudaMixto')}
          </p>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {[
              { codigo: 'COMERCIAL', etiqueta: t('mixtoComercial') },
              { codigo: 'SERVICIOS', etiqueta: t('mixtoServicios') },
              { codigo: 'PRODUCCION', etiqueta: t('mixtoProduccion') },
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
          {guardando ? t('guardando') : t('guardarCambios')}
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

function CategoriasYFormasDePagoTab({ empresaId, esAdmin, idioma }: { empresaId: string; esAdmin: boolean; idioma: string }) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
      setError(err instanceof Error ? err.message : t('errorInesperado'));
    }
  }

  if (cargando) {
    return <div style={cargandoStyle}>{t('cargandoCategorias')}</div>;
  }

  if (!tieneEsqueleto) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORES.gris }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORES.azul }}>
          {t('sinPlanCuentasTitulo')}
        </div>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          {t('sinPlanCuentasAyuda')}
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
          idioma={idioma}
          onCrear={(nombre) =>
            manejarAccion(async () => {
              await crearCategoriaProducto(empresaId, nombre);
              // Mismo motivo que en BloqueCategoriaServicio: sin esto la
              // categoría queda creada pero no aparece en la Central de
              // Lançamentos hasta que un admin regenere la matriz a mano.
              await generarMatrizOperaciones(empresaId);
            }, msgCategoriaCreada(idioma, nombre))
          }
          onCambiarActivo={(id, activo) =>
            manejarAccion(() => cambiarActivoCategoriaProducto(id, activo), msgCategoriaActualizada(idioma))
          }
          onEliminar={(id, nombre) =>
            manejarAccion(() => eliminarCategoriaProducto(id), msgCategoriaEliminada(idioma, nombre))
          }
        />
      )}

      {operacionServicio && (
        <BloqueCategoriaServicio
          titulo={operacionServicio === 'COBRO' ? t('tituloCategoriasIngreso') : t('tituloCategoriasServicio')}
          subtitulo={
            operacionServicio === 'COBRO'
              ? t('subtituloCategoriasCobro')
              : t('subtituloCategoriasVentaServicio')
          }
          categorias={categoriasServicio}
          esAdmin={esAdmin}
          idioma={idioma}
          onCrear={(nombre) =>
            manejarAccion(async () => {
              await crearCategoriaIngreso(empresaId, nombre, operacionServicio);
              // Regenera la matriz enseguida — así la categoría queda
              // usable ya mismo en la Central de Lançamentos, sin
              // depender de que un admin la regenere a mano después
              // (eso solo lo puede hacer un admin una vez que ya está
              // generada, ver InicializacionTab).
              await generarMatrizOperaciones(empresaId);
            }, msgCategoriaCreada(idioma, nombre))
          }
          onCambiarActivo={(id, activo) =>
            manejarAccion(() => cambiarActivoCategoriaIngreso(id, activo), msgCategoriaActualizada(idioma))
          }
          onEliminar={(id, nombre) =>
            manejarAccion(() => eliminarCategoriaOperacion(id), msgCategoriaEliminada(idioma, nombre))
          }
        />
      )}

      <BloqueCategoriaGasto
        categorias={categoriasGasto}
        esAdmin={esAdmin}
        idioma={idioma}
        onCrear={(nombre) =>
          manejarAccion(() => crearCategoriaGasto(empresaId, nombre), msgCategoriaCreada(idioma, nombre))
        }
        onCambiarActivo={(id, activo) =>
          manejarAccion(() => cambiarActivoCategoriaGasto(id, activo), msgCategoriaActualizada(idioma))
        }
        onEliminar={(id, nombre) =>
          manejarAccion(() => eliminarCategoriaOperacion(id), msgCategoriaEliminada(idioma, nombre))
        }
      />

      <BloqueFormasDePago
        formasPago={formasPago}
        cuentas={cuentas}
        operaciones={operaciones}
        esAdmin={esAdmin}
        idioma={idioma}
        onCrear={(nombre, cuenta, operacionesElegidas) =>
          manejarAccion(async () => {
            const cuentaId =
              'id' in cuenta ? cuenta.id : await crearCuentaParaMedioPago(empresaId, cuenta.nombre, cuenta.tipoSaldo);

            await crearFormaPago(empresaId, nombre, cuentaId, operacionesElegidas);
          }, msgFormaPagoCreada(idioma, nombre))
        }
        onCambiarActivo={(id, activo) => manejarAccion(() => cambiarActivoFormaPago(id, activo), msgFormaPagoActualizada(idioma))}
        onEliminar={(id, nombre) => manejarAccion(() => eliminarFormaPago(id), msgFormaPagoEliminada(idioma, nombre))}
      />

      <BloqueSocios
        socios={socios}
        esAdmin={esAdmin}
        idioma={idioma}
        onCrear={(nombre) => manejarAccion(() => crearSocio(empresaId, nombre), msgSocioAgregado(idioma, nombre))}
        onCambiarActivo={(id, activo) => manejarAccion(() => cambiarActivoSocio(id, activo), msgSocioActualizado(idioma))}
        onEliminar={(id, nombre) => manejarAccion(() => eliminarSocio(id), msgSocioEliminado(idioma, nombre))}
      />
    </div>
  );
}

function BloqueSocios({
  socios,
  esAdmin,
  idioma,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  socios: Socio[];
  esAdmin: boolean;
  idioma: string;
  onCrear: (nombre: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
  const [nombreNuevo, setNombreNuevo] = useState('');

  return (
    <SeccionCategoria titulo={t('tituloSocios')} subtitulo={t('subtituloSocios')}>
      <ListaConToggle items={socios} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} idioma={idioma} />

      {esAdmin && (
        <FormularioNuevo
          placeholder={t('placeholderSocio')}
          valor={nombreNuevo}
          idioma={idioma}
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
  idioma,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  categorias: CategoriaProducto[];
  esAdmin: boolean;
  idioma: string;
  onCrear: (nombre: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
  const [nombreNuevo, setNombreNuevo] = useState('');

  return (
    <SeccionCategoria titulo={t('tituloCategoriaProducto')} subtitulo={t('subtituloCategoriaProducto')}>
      <ListaConToggle items={categorias} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} idioma={idioma} />

      <FormularioNuevo
        placeholder={t('placeholderCategoriaProducto')}
        valor={nombreNuevo}
        idioma={idioma}
        onCambiar={setNombreNuevo}
        onAgregar={() => {
          if (!nombreNuevo.trim()) return;
          onCrear(nombreNuevo);
          setNombreNuevo('');
        }}
      />
    </SeccionCategoria>
  );
}

function BloqueCategoriaServicio({
  titulo,
  subtitulo,
  categorias,
  esAdmin,
  idioma,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  titulo: string;
  subtitulo: string;
  categorias: CategoriaGasto[];
  esAdmin: boolean;
  idioma: string;
  onCrear: (nombre: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
  const [nombreNuevo, setNombreNuevo] = useState('');

  return (
    <SeccionCategoria titulo={titulo} subtitulo={subtitulo}>
      <ListaConToggle items={categorias} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} idioma={idioma} />

      {/* Crear categoría de ingreso queda abierto a cualquier usuario
          (no solo admin) — así el cliente no depende de un admin para
          sumar de dónde le entra plata. Editar el nombre, activar/
          desactivar o eliminar sigue siendo exclusivo de admin (ver
          soloLectura arriba). */}
      <FormularioNuevo
        placeholder={t('placeholderCategoriaServicio')}
        valor={nombreNuevo}
        idioma={idioma}
        onCambiar={setNombreNuevo}
        onAgregar={() => {
          if (!nombreNuevo.trim()) return;
          onCrear(nombreNuevo);
          setNombreNuevo('');
        }}
      />
    </SeccionCategoria>
  );
}

function BloqueCategoriaGasto({
  categorias,
  esAdmin,
  idioma,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  categorias: CategoriaGasto[];
  esAdmin: boolean;
  idioma: string;
  onCrear: (nombre: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
  const [nombreNuevo, setNombreNuevo] = useState('');

  return (
    <SeccionCategoria titulo={t('tituloCategoriaGasto')} subtitulo={t('subtituloCategoriaGasto')}>
      <ListaConToggle items={categorias} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} idioma={idioma} />

      {esAdmin && (
        <FormularioNuevo
          placeholder={t('placeholderCategoriaGasto')}
          valor={nombreNuevo}
          idioma={idioma}
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
  idioma,
  onCrear,
  onCambiarActivo,
  onEliminar,
}: {
  formasPago: FormaPago[];
  cuentas: CuentaOpcion[];
  operaciones: OperacionOpcion[];
  esAdmin: boolean;
  idioma: string;
  onCrear: (
    nombre: string,
    cuenta: { id: string } | { nueva: true; nombre: string; tipoSaldo: 'ACTIVO' | 'PASIVO' },
    operacionesElegidas: string[]
  ) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string, nombre: string) => void;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
    <SeccionCategoria titulo={t('tituloFormasPago')} subtitulo={t('subtituloFormasPago')}>
      <ListaConToggle items={formasPago} onCambiarActivo={onCambiarActivo} onEliminar={onEliminar} soloLectura={!esAdmin} idioma={idioma} />

      {esAdmin && (
      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            style={{ ...inputFormulario, flex: '1 1 220px' }}
            placeholder={t('placeholderFormaPago')}
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />

          <select
            style={{ ...inputFormulario, flex: '1 1 220px' }}
            value={cuentaElegida}
            onChange={(e) => setCuentaElegida(e.target.value)}
          >
            <option value="">{t('opcionCuentaContable')}</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.codigo} — {cuenta.nombre}
              </option>
            ))}
            <option value={OPCION_CUENTA_NUEVA}>{t('opcionCuentaNueva')}</option>
          </select>
        </div>

        {esCuentaNueva && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: '#f8fafc', padding: 12, borderRadius: 10 }}>
            <input
              style={{ ...inputFormulario, flex: '1 1 220px' }}
              placeholder={t('placeholderCuentaNueva')}
              value={nombreCuentaNueva}
              onChange={(e) => setNombreCuentaNueva(e.target.value)}
            />

            <select
              style={{ ...inputFormulario, flex: '0 1 180px' }}
              value={tipoCuentaNueva}
              onChange={(e) => setTipoCuentaNueva(e.target.value as 'ACTIVO' | 'PASIVO')}
            >
              <option value="ACTIVO">{t('opcionActivo')}</option>
              <option value="PASIVO">{t('opcionPasivo')}</option>
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
              {nombreOperacionDisplay(idioma, nombre)}
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
            {t('botonAgregarFormaPago')}
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
  idioma,
}: {
  items: T[];
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar?: (id: string, nombre: string) => void;
  soloLectura?: boolean;
  idioma: string;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);

  if (items.length === 0) {
    return <p style={{ fontSize: 13, color: COLORES.gris, marginBottom: 12 }}>{t('sinItems')}</p>;
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
              {item.activo ? t('activa') : t('inactiva')}
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORES.gris, cursor: 'pointer' }}>
                {item.activo ? t('activa') : t('inactiva')}
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
                    if (window.confirm(confirmEliminarItem(idioma, item.nombre))) {
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
                  title={t('eliminarTitulo')}
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
  idioma,
  onCambiar,
  onAgregar,
}: {
  placeholder: string;
  valor: string;
  idioma: string;
  onCambiar: (valor: string) => void;
  onAgregar: () => void;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);

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
        {t('botonAgregar')}
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

function nombreContenedor(t: (clave: ClaveConfiguracoes) => string, rolContable: string | null): string {
  const porRol: Record<string, ClaveConfiguracoes> = {
    CONTENEDOR_STOCK: 'contenedorStock',
    CONTENEDOR_INGRESO: 'contenedorIngreso',
    CONTENEDOR_COSTO: 'contenedorCosto',
    CONTENEDOR_GASTO: 'contenedorGasto',
    CONTENEDOR_PERDIDA: 'contenedorPerdida',
  };

  const clave = rolContable ? porRol[rolContable] : undefined;
  return clave ? t(clave) : t('cuentaEspecial');
}

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

function PlanDeCuentasTab({ empresaId, esAdmin, idioma }: { empresaId: string; esAdmin: boolean; idioma: string }) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
      setError(t('errorCargarPlanCuentas'));
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
      setError(err instanceof Error ? err.message : t('errorRenombrarCuenta'));
      return;
    }

    setMensaje(t('mensajeCuentaRenombrada'));
    await recargar();
  }

  async function cambiarActivo(id: string, activo: boolean) {
    const { error: errorUpdate } = await supabase.from('plan_cuentas').update({ activo }).eq('id', id);

    if (errorUpdate) {
      setError(t('errorActualizarCuenta'));
      return;
    }

    setMensaje(t('mensajeCuentaActualizada'));
    await recargar();
  }

  async function eliminar(id: string) {
    setError('');
    setMensaje('');

    try {
      await eliminarCuentaPlan(empresaId, id);
      setMensaje(t('mensajeCuentaEliminada'));
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorEliminarCuenta'));
    }
  }

  if (cargando) {
    return <div style={cargandoStyle}>{t('cargandoPlanCuentas')}</div>;
  }

  if (cuentas.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORES.gris }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORES.azul }}>
          {t('sinPlanCuentasTitulo2')}
        </div>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          {t('sinPlanCuentasAyuda2')}
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
          {t('mostrarInactivas')}
        </label>
      </div>

      {!esAdmin && (
        <p style={{ fontSize: 12, color: COLORES.gris, marginBottom: 10 }}>
          {t('soloAdminRenombraCuentas')}
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
            idioma={idioma}
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
  idioma,
  onRenombrar,
  onCambiarActivo,
  onEliminar,
}: {
  nodo: NodoCuenta;
  nivel: number;
  mostrarInactivas: boolean;
  esAdmin: boolean;
  idioma: string;
  onRenombrar: (id: string, nombreNuevo: string) => void;
  onCambiarActivo: (id: string, activo: boolean) => void;
  onEliminar: (id: string) => void;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
            {nombreCuentaDisplay(idioma, nodo.nombre)}
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
            🔒 {nombreContenedor(t, nodo.rol_contable)}
          </span>
        )}

        {!tieneHijos && !esContenedor && (
          esAdmin ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: COLORES.gris, cursor: 'pointer' }}>
                {nodo.activo ? t('activa') : t('inactiva')}
                <input
                  type="checkbox"
                  checked={nodo.activo}
                  onChange={(e) => onCambiarActivo(nodo.id, e.target.checked)}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm(confirmEliminarCuenta(idioma, nodo.nombre))) {
                    onEliminar(nodo.id);
                  }
                }}
                style={{ border: 'none', background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontSize: 13, padding: 0 }}
                title={t('eliminarCuentaTitulo')}
              >
                🗑️
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: COLORES.gris }}>{nodo.activo ? t('activa') : t('inactiva')}</span>
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
          idioma={idioma}
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

function InicializacionTab({ empresaId, esAdmin, idioma }: { empresaId: string; esAdmin: boolean; idioma: string }) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
      setError(err instanceof Error ? err.message : t('errorGenerarMatriz'));
    } finally {
      setGenerando(false);
    }
  }

  if (cargando) {
    return <div style={cargandoStyle}>{t('cargandoGenerico')}</div>;
  }

  if (!tieneEsqueleto) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORES.gris }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🚀</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORES.azul }}>{t('faltaPasoAntes')}</div>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          {t('ayudaFaltaPasoMatriz')}
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
          {msgMatrizGeneradaExito(idioma, resultado.reglasGeneradas)}
        </div>
      )}

      <div style={{ fontSize: 40, marginBottom: 10 }}>{matrizGenerada ? '✅' : '🚀'}</div>

      <h3 style={{ margin: '0 0 8px', color: COLORES.azul }}>
        {matrizGenerada ? t('sistemaInicializado') : t('generarMatrizTitulo')}
      </h3>

      <p style={{ maxWidth: 480, margin: '0 auto 22px', fontSize: 13.5, color: COLORES.gris, lineHeight: 1.6 }}>
        {matrizGenerada
          ? bloqueado
            ? t('matrizBloqueada')
            : t('matrizAdminPuedeRegenerar')
          : msgMatrizExplicacion(idioma, cantidadCategorias)}
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
        {generando ? t('botonGenerando') : matrizGenerada ? t('botonRegenerarMatriz') : t('botonGenerarMatriz')}
      </button>
    </div>
  );
}

/* ==========================================================
   PESTAÑA 7 — RESETEAR SISTEMA
========================================================== */

const PALABRA_CONFIRMACION = 'RESETEAR';

function ResetearSistemaTab({ empresaId, esAdmin, idioma }: { empresaId: string; esAdmin: boolean; idioma: string }) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
  const [emailUsuario, setEmailUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [reseteando, setReseteando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ errores: string[] } | null>(null);

  useEffect(() => {
    async function cargarEmail() {
      const { data } = await supabase.auth.getUser();
      setEmailUsuario(data.user?.email ?? '');
    }

    cargarEmail();
  }, []);

  const textoConfirmado = textoConfirmacion.trim().toUpperCase() === PALABRA_CONFIRMACION;
  const puedeConfirmar = textoConfirmado && (esAdmin || clave.length > 0);

  async function confirmarReset() {
    setError('');
    setResultado(null);

    if (!textoConfirmado) {
      setError(msgResetTextoNoCoincide(idioma));
      return;
    }

    setReseteando(true);

    try {
      if (!esAdmin) {
        const { error: errorClave } = await supabase.auth.signInWithPassword({
          email: emailUsuario,
          password: clave,
        });

        if (errorClave) {
          setError(msgResetClaveIncorrecta(idioma));
          setReseteando(false);
          return;
        }
      }

      const { tablasLimpias, errores } = await resetearSistema(empresaId);

      if (errores.length > 0) {
        console.error('Reset con errores parciales:', errores, 'tablas limpias:', tablasLimpias);
      }

      setResultado({ errores });
      setClave('');
      setTextoConfirmacion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resetErrorInesperado'));
    } finally {
      setReseteando(false);
    }
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '10px 4px' }}>
      {error && <div style={errorStyle}>{error}</div>}

      {resultado && (
        <div style={resultado.errores.length > 0 ? errorStyle : mensajeOkStyle}>
          {resultado.errores.length > 0 ? msgResetErrorParcial(idioma, resultado.errores) : msgResetExito(idioma)}
        </div>
      )}

      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 16,
          padding: '22px 24px',
        }}
      >
        <div style={{ fontSize: 30, marginBottom: 8 }}>⚠️</div>

        <h3 style={{ margin: '0 0 8px', color: '#991b1b' }}>{t('resetTitulo')}</h3>

        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#7f1d1d', lineHeight: 1.6 }}>
          {t('resetExplicacion')}
        </p>

        <ul style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 13.5, color: '#7f1d1d', lineHeight: 1.8 }}>
          <li>{t('resetItemOperaciones')}</li>
          <li>{t('resetItemProductos')}</li>
          <li>{t('resetItemProveedores')}</li>
          <li>{t('resetItemClientes')}</li>
        </ul>

        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#7f1d1d', fontStyle: 'italic' }}>
          {t('resetSeMantiene')}
        </p>

        <div style={{ ...campo, marginBottom: 14 }}>
          <label style={label}>{t('resetEtiquetaConfirmacion').replace('{palabra}', PALABRA_CONFIRMACION)}</label>
          <input
            type="text"
            value={textoConfirmacion}
            onChange={(e) => setTextoConfirmacion(e.target.value)}
            placeholder={PALABRA_CONFIRMACION}
            style={inputFormulario}
          />
        </div>

        {!esAdmin && (
          <div style={{ ...campo, marginBottom: 14 }}>
            <label style={label}>{t('resetEtiquetaClave')}</label>
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              style={inputFormulario}
            />
          </div>
        )}

        <button
          type="button"
          onClick={confirmarReset}
          disabled={!puedeConfirmar || reseteando}
          style={{
            background: '#dc2626',
            color: COLORES.blanco,
            border: 'none',
            borderRadius: 10,
            padding: '12px 20px',
            fontWeight: 800,
            width: '100%',
            opacity: !puedeConfirmar || reseteando ? 0.5 : 1,
            cursor: !puedeConfirmar || reseteando ? 'not-allowed' : 'pointer',
          }}
        >
          {reseteando ? t('resetBotonEnCurso') : t('resetBoton')}
        </button>
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA 8 — MATRIZ DE OPERAÇÕES E PLANO MAESTRO (solo admin)
========================================================== */

type FilaMatriz = {
  id: string;
  operacion: string;
  categoria: string;
  forma_pago: string;
  cuenta_debito: string;
  cuenta_credito: string;
  stock: string;
  libro: string;
  cmv: string;
  motor: string;
};

type FilaPlanMaestro = {
  id: string;
  codigo: string;
  nombre: string;
  cuenta_padre_codigo: string | null;
  naturaleza: string | null;
  tipo_saldo: string | null;
  clasificacion: string | null;
  flujo_caja: string | null;
  rol_contable: string | null;
};

const PAISES_PLAN_MAESTRO = ['AR', 'BR'];

function MatrizYPlanMaestroTab({ empresaId, idioma }: { empresaId: string; idioma: string }) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
  const [subvista, setSubvista] = useState<'empresa' | 'maestro'>('empresa');

  const [matriz, setMatriz] = useState<FilaMatriz[]>([]);
  const [cargandoMatriz, setCargandoMatriz] = useState(true);
  const [filtroOperacion, setFiltroOperacion] = useState('TODAS');
  const [busquedaMatriz, setBusquedaMatriz] = useState('');

  const [perfiles, setPerfiles] = useState<PerfilEmpresa[]>([]);
  const [perfilElegido, setPerfilElegido] = useState('');
  const [paisElegido, setPaisElegido] = useState('AR');
  const [planMaestro, setPlanMaestro] = useState<FilaPlanMaestro[]>([]);
  const [cargandoPlanMaestro, setCargandoPlanMaestro] = useState(false);

  useEffect(() => {
    async function cargarMatriz() {
      const { data } = await supabase
        .from('matriz_operaciones')
        .select('id, operacion, categoria, forma_pago, cuenta_debito, cuenta_credito, stock, libro, cmv, motor')
        .eq('empresa_id', empresaId)
        .order('operacion')
        .order('categoria');

      setMatriz(data ?? []);
      setCargandoMatriz(false);
    }

    cargarMatriz();
  }, [empresaId]);

  useEffect(() => {
    async function cargarPerfiles() {
      const { data } = await supabase.from('perfiles_empresa').select('id, codigo, nombre, descripcion').order('nombre');
      setPerfiles(data ?? []);
      if (data && data.length > 0) {
        setPerfilElegido(data[0].id);
      }
    }

    cargarPerfiles();
  }, []);

  useEffect(() => {
    async function cargarPlanMaestro() {
      if (!perfilElegido) return;

      setCargandoPlanMaestro(true);

      const { data } = await supabase
        .from('perfil_plan_cuentas_maestro')
        .select('id, codigo, nombre, cuenta_padre_codigo, naturaleza, tipo_saldo, clasificacion, flujo_caja, rol_contable')
        .eq('perfil_empresa_id', perfilElegido)
        .eq('pais', paisElegido)
        .order('codigo');

      setPlanMaestro(data ?? []);
      setCargandoPlanMaestro(false);
    }

    cargarPlanMaestro();
  }, [perfilElegido, paisElegido]);

  const operacionesDisponibles = Array.from(new Set(matriz.map((fila) => fila.operacion))).sort();

  const matrizFiltrada = matriz.filter((fila) => {
    if (filtroOperacion !== 'TODAS' && fila.operacion !== filtroOperacion) return false;
    if (!busquedaMatriz.trim()) return true;
    const texto = busquedaMatriz.trim().toLowerCase();
    return (
      fila.categoria.toLowerCase().includes(texto) ||
      fila.cuenta_debito.toLowerCase().includes(texto) ||
      fila.cuenta_credito.toLowerCase().includes(texto)
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setSubvista('empresa')}
          style={{ ...botonSecundario, ...(subvista === 'empresa' ? { background: COLORES.azul, color: COLORES.blanco } : {}) }}
        >
          {t('matrizSubvistaEmpresa')}
        </button>
        <button
          type="button"
          onClick={() => setSubvista('maestro')}
          style={{ ...botonSecundario, ...(subvista === 'maestro' ? { background: COLORES.azul, color: COLORES.blanco } : {}) }}
        >
          {t('matrizSubvistaMaestro')}
        </button>
      </div>

      {subvista === 'empresa' ? (
        cargandoMatriz ? (
          <div style={cargandoStyle}>{t('cargandoGenerico')}</div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: COLORES.gris, marginBottom: 14 }}>
              {t('matrizContador').replace('{cantidad}', String(matriz.length))}
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setFiltroOperacion('TODAS')}
                style={{ ...botonSecundario, padding: '7px 14px', fontSize: 12.5, ...(filtroOperacion === 'TODAS' ? { background: COLORES.verde, color: COLORES.blanco, borderColor: COLORES.verde } : {}) }}
              >
                {t('matrizTodasOperaciones')}
              </button>
              {operacionesDisponibles.map((operacion) => (
                <button
                  key={operacion}
                  type="button"
                  onClick={() => setFiltroOperacion(operacion)}
                  style={{ ...botonSecundario, padding: '7px 14px', fontSize: 12.5, ...(filtroOperacion === operacion ? { background: COLORES.verde, color: COLORES.blanco, borderColor: COLORES.verde } : {}) }}
                >
                  {nombreOperacionDisplay(idioma, operacion)}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={busquedaMatriz}
              onChange={(e) => setBusquedaMatriz(e.target.value)}
              placeholder={t('matrizBuscarPlaceholder')}
              style={{ ...inputFormulario, marginBottom: 14, maxWidth: 340 }}
            />

            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <Th>{t('matrizColOperacion')}</Th>
                    <Th>{t('matrizColCategoria')}</Th>
                    <Th>{t('matrizColFormaPago')}</Th>
                    <Th>{t('matrizColCuentaDebito')}</Th>
                    <Th>{t('matrizColCuentaCredito')}</Th>
                    <Th align="right">{t('matrizColStock')}</Th>
                    <Th align="right">{t('matrizColLibro')}</Th>
                    <Th align="right">{t('matrizColCmv')}</Th>
                    <Th>{t('matrizColMotor')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {matrizFiltrada.map((fila) => (
                    <tr key={fila.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                      <Td>{nombreOperacionDisplay(idioma, fila.operacion)}</Td>
                      <Td>{fila.categoria}</Td>
                      <Td>{fila.forma_pago}</Td>
                      <Td>{nombreCuentaDisplay(idioma, fila.cuenta_debito)}</Td>
                      <Td>{nombreCuentaDisplay(idioma, fila.cuenta_credito)}</Td>
                      <Td align="right">{fila.stock}</Td>
                      <Td align="right">{fila.libro}</Td>
                      <Td align="right">{fila.cmv}</Td>
                      <Td>{fila.motor}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {matrizFiltrada.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>{t('matrizSinFilas')}</div>
              )}
            </div>
          </div>
        )
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ ...campo, minWidth: 220 }}>
              <label style={label}>{t('matrizSelectorPerfil')}</label>
              <select style={inputFormulario} value={perfilElegido} onChange={(e) => setPerfilElegido(e.target.value)}>
                {perfiles.map((perfil) => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...campo, minWidth: 140 }}>
              <label style={label}>{t('matrizSelectorPais')}</label>
              <select style={inputFormulario} value={paisElegido} onChange={(e) => setPaisElegido(e.target.value)}>
                {PAISES_PLAN_MAESTRO.map((pais) => (
                  <option key={pais} value={pais}>
                    {pais}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {cargandoPlanMaestro ? (
            <div style={cargandoStyle}>{t('cargandoGenerico')}</div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <Th>{t('matrizColCodigo')}</Th>
                    <Th>{t('matrizColNombreCuenta')}</Th>
                    <Th>{t('matrizColCuentaPadre')}</Th>
                    <Th>{t('matrizColNaturaleza')}</Th>
                    <Th>{t('matrizColTipoSaldo')}</Th>
                    <Th>{t('matrizColClasificacion')}</Th>
                    <Th>{t('matrizColFlujoCaja')}</Th>
                    <Th>{t('matrizColRolContable')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {planMaestro.map((fila) => (
                    <tr key={fila.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                      <Td>{fila.codigo}</Td>
                      <Td>{fila.nombre}</Td>
                      <Td>{fila.cuenta_padre_codigo ?? '—'}</Td>
                      <Td>{fila.naturaleza ?? '—'}</Td>
                      <Td>{fila.tipo_saldo ?? '—'}</Td>
                      <Td>{fila.clasificacion ?? '—'}</Td>
                      <Td>{fila.flujo_caja ?? '—'}</Td>
                      <Td>{fila.rol_contable ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {planMaestro.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>{t('matrizSinFilas')}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{ padding: '10px 12px', color: '#374151', fontSize: 11.5, textAlign: align, whiteSpace: 'nowrap', fontWeight: 800 }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '10px 12px', fontSize: 12.5, textAlign: align, whiteSpace: 'nowrap' }}>{children}</td>
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

function categoriasObjetivo(t: (clave: ClaveConfiguracoes) => string): { valor: CategoriaObjetivo; titulo: string; emoji: string }[] {
  return [
    { valor: 'ACTIVIDAD', titulo: t('categoriaPrimerosPasos'), emoji: '🚀' },
    { valor: 'METAS', titulo: t('categoriaMetasFamiliares'), emoji: '✈️' },
    { valor: 'CONTABLE', titulo: t('categoriaContables'), emoji: '📒' },
    { valor: 'MERCADERIA', titulo: t('categoriaMercaderia'), emoji: '📦' },
    { valor: 'FINANCIERO', titulo: t('categoriaFinancieros'), emoji: '💹' },
    { valor: 'MARKETING', titulo: t('categoriaMarketing'), emoji: '📣' },
  ];
}

function ObjetivosTab({ empresaId, esAdmin, idioma }: { empresaId: string; esAdmin: boolean; idioma: string }) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
      setError(err instanceof Error ? err.message : t('errorCargarObjetivos'));
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
      setError(err instanceof Error ? err.message : t('errorInesperado'));
    }
  }

  if (cargando) {
    return <div style={cargandoStyle}>{t('cargandoObjetivos')}</div>;
  }

  return (
    <div>
      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={mensajeOkStyle}>{mensaje}</div>}

      {!esAdmin && (
        <p style={{ fontSize: 12, color: COLORES.gris, marginBottom: 14 }}>
          {t('soloAdminObjetivos')}
        </p>
      )}

      {categoriasObjetivo(t).map(({ valor, titulo, emoji }) => {
        const deLaCategoria = objetivos.filter((o) => o.categoria === valor);

        return (
          <SeccionCategoria
            key={valor}
            titulo={`${emoji} ${titulo}`}
            subtitulo={
              valor === 'MARKETING'
                ? t('subtituloMarketing')
                : t('subtituloObjetivosGenerico')
            }
          >
            {deLaCategoria.length === 0 ? (
              <p style={{ fontSize: 13, color: COLORES.gris, marginBottom: 12 }}>{t('ningunoTodavia')}</p>
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
                        {t('metaLabel')} {obj.objetivo} {obj.unidad}
                      </span>
                    </div>

                    {esAdmin ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setEditando(obj)}
                          style={{ border: 'none', background: 'transparent', color: COLORES.azul, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}
                        >
                          {t('editar')}
                        </button>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: COLORES.gris, cursor: 'pointer' }}>
                          {obj.activo ? t('objetivoActivo') : t('objetivoInactivo')}
                          <input
                            type="checkbox"
                            checked={obj.activo}
                            onChange={(e) =>
                              manejarAccion(() => cambiarActivoObjetivo(obj.id, e.target.checked), t('mensajeObjetivoActualizado'))
                            }
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(confirmEliminarObjetivo(idioma, obj.nombre))) {
                              manejarAccion(() => eliminarObjetivo(obj.id), t('mensajeObjetivoEliminado'));
                            }
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontSize: 13, padding: 0 }}
                          title={t('eliminarTitulo')}
                        >
                          🗑️
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11.5, color: COLORES.gris }}>{obj.activo ? t('objetivoActivo') : t('objetivoInactivo')}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {esAdmin && creandoNuevo !== valor && (
              <button type="button" style={botonGuardar} onClick={() => setCreandoNuevo(valor)}>
                {t('botonAgregarObjetivo')}
              </button>
            )}

            {esAdmin && creandoNuevo === valor && (
              <FormularioObjetivo
                categoria={valor}
                idioma={idioma}
                onCancelar={() => setCreandoNuevo(null)}
                onGuardar={(datos) =>
                  manejarAccion(async () => {
                    const orden = deLaCategoria.length + 1;
                    await crearObjetivo(empresaId, { ...datos, categoria: valor, orden });
                    setCreandoNuevo(null);
                  }, msgObjetivoCreado(idioma, datos.nombre))
                }
              />
            )}
          </SeccionCategoria>
        );
      })}

      {editando && (
        <ModalEditarObjetivo
          objetivo={editando}
          idioma={idioma}
          onCancelar={() => setEditando(null)}
          onGuardar={(datos) =>
            manejarAccion(async () => {
              await actualizarObjetivo(editando.id, datos);
              setEditando(null);
            }, t('mensajeObjetivoActualizado'))
          }
        />
      )}
    </div>
  );
}

function FormularioObjetivo({
  categoria,
  idioma,
  onCancelar,
  onGuardar,
}: {
  categoria: CategoriaObjetivo;
  idioma: string;
  onCancelar: () => void;
  onGuardar: (datos: { indicador: IndicadorCodigo; nombre: string; objetivo: number; unidad: string }) => void;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
        {t('sinIndicadoresCategoria')}
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
          placeholder={t('placeholderNombreAMostrar')}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: COLORES.gris }}>{ayudaIndicador(indicador, idioma)}</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="number"
          style={{ ...inputFormulario, flex: '1 1 140px' }}
          placeholder={t('placeholderMeta')}
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
        />

        <input
          style={{ ...inputFormulario, flex: '1 1 140px' }}
          placeholder={t('placeholderUnidad')}
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" style={botonSecundario} onClick={onCancelar}>
          {t('cancelar')}
        </button>

        <button
          type="button"
          style={botonGuardar}
          onClick={() => {
            if (!nombre.trim() || !unidad.trim()) return;
            onGuardar({ indicador, nombre: nombre.trim(), objetivo: Number(meta) || 0, unidad: unidad.trim() });
          }}
        >
          {t('guardar')}
        </button>
      </div>
    </div>
  );
}

function ModalEditarObjetivo({
  objetivo,
  idioma,
  onCancelar,
  onGuardar,
}: {
  objetivo: ObjetivoFila;
  idioma: string;
  onCancelar: () => void;
  onGuardar: (datos: { nombre: string; objetivo: number; unidad: string }) => void;
}) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
        <h3 style={{ margin: '0 0 4px', color: COLORES.azul, fontSize: 17 }}>{t('editarObjetivoTitulo')}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 11.5, color: COLORES.gris }}>{ayudaIndicador(objetivo.indicador, idioma)}</p>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={campo}>
            <label style={label}>{t('campoNombre')}</label>
            <input style={inputFormulario} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ ...campo, flex: 1 }}>
              <label style={label}>{t('campoMeta')}</label>
              <input type="number" style={inputFormulario} value={meta} onChange={(e) => setMeta(e.target.value)} />
            </div>

            <div style={{ ...campo, flex: 1 }}>
              <label style={label}>{t('campoUnidad')}</label>
              <input style={inputFormulario} value={unidad} onChange={(e) => setUnidad(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" style={botonSecundario} onClick={onCancelar}>
            {t('cancelar')}
          </button>

          <button
            type="button"
            style={botonGuardar}
            onClick={() => {
              if (!nombre.trim() || !unidad.trim()) return;
              onGuardar({ nombre: nombre.trim(), objetivo: Number(meta) || 0, unidad: unidad.trim() });
            }}
          >
            {t('guardarCambios')}
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

function FacturacionTab({ empresaId, idioma }: { empresaId: string; esAdmin: boolean; idioma: string }) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);
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
    return <div style={cargandoStyle}>{t('cargandoGenerico')}</div>;
  }

  const link = moneda === 'BRL' ? LINK_PAGO_INFINITEPAY : moneda === 'ARS' ? LINK_PAGO_NARANJA_X : null;
  const plataforma = moneda === 'BRL' ? 'InfinitePay' : moneda === 'ARS' ? 'Naranja X' : null;

  return (
    <div>
      <p style={{ fontSize: 13, color: COLORES.gris, marginBottom: 18 }}>
        {t('pagaSegunMoneda')}
      </p>

      {resumen && <TarjetaEstadoSuscripcion resumen={resumen} idioma={idioma} />}

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
            {t('definiMonedaPrimero')}
          </p>
        ) : link ? (
          <>
            <p style={{ margin: '0 0 14px', fontSize: 14, color: COLORES.azul }}>
              {t('facturacionPagaEnPrefijo')} <strong>{moneda === 'BRL' ? t('reales') : t('pesosArgentinos')}</strong>, {t('facturacionPagaEnSufijo')}{' '}
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
              {msgPagarSuscripcionCon(idioma, plataforma)}
            </a>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, color: COLORES.gris }}>
            {msgLinkNoConfigurado(idioma, plataforma)}
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
