'use client';

// LOBBY / INICIO
//
// Es la puerta de entrada de la plataforma: lo primero que ve el cliente
// (y también el administrador) al iniciar sesión.
//
// Su trabajo es dar la bienvenida y repartir hacia el resto del sistema.
// NO hace análisis: los indicadores, gráficos y objetivos viven ahora en
// el Panel de Control, que es una pantalla más dentro de las herramientas.
//
// Por eso esta pantalla solo carga lo mínimo (empresa, configuración y
// nivel), y es mucho más liviana que el panel.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { obtenerProgresoGamificacion } from '@/lib/gamificacion';
import { empresaManejaMercaderia } from '@/lib/perfilCapacidades';
import { SabioHero } from '@/components/panel/SabioHero';
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
  perfil_empresa_id: string | null;
};

type ConfiguracionDashboard = {
  color_primario: string;
  color_secundario: string;
  color_acento: string;
  mensaje_bienvenida: string | null;
  subtitulo_dashboard: string | null;
  mostrar_gamificacion: boolean;
  mostrar_objetivos: boolean;
  mostrar_graficos: boolean;
};

type ProgresoGamificacion = {
  operaciones: number;
  nivel: number;
  nombre: string;
  emoji: string;
  operacionesMin: number;
  operacionesMax: number | null;
  mision: string;
  mensaje: string;
  progreso: number;
  faltan: number;
};

type ObjetivoResumen = {
  nombre: string;
  porcentaje: number;
};

const NOMBRES_INDICADOR: Record<string, string> = {
  'VENTAS DEL MES': 'Ventas del mes',
  'COMPRAS DEL MES': 'Compras del mes',
  'OPERACIONES REGISTRADAS': 'Operaciones registradas',
  'VALOR DEL INVENTARIO': 'Valor del inventario',
  PUBLICACIONES: 'Publicaciones',
  HISTORIAS: 'Historias',
  'NUEVOS SEGUIDORES': 'Nuevos seguidores',
  MENSAJES: 'Mensajes',
};

export default function InicioPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionDashboard | null>(null);
  const [gamificacion, setGamificacion] = useState<ProgresoGamificacion | null>(null);
  const [objetivos, setObjetivos] = useState<ObjetivoResumen[]>([]);
  const [modulos, setModulos] = useState<string[]>([]);
  const [manejaMercaderia, setManejaMercaderia] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [estadoSolicitud, setEstadoSolicitud] = useState<'PENDIENTE' | 'RECHAZADA' | null>(null);

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
        // Todavía no tiene un perfil asignado — probablemente está
        // esperando que un admin apruebe su solicitud de alta.
        const { data: solicitud } = await supabase
          .from('solicitudes_alta')
          .select('estado')
          .eq('user_id', userData.user.id)
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (solicitud?.estado === 'PENDIENTE' || solicitud?.estado === 'RECHAZADA') {
          setEstadoSolicitud(solicitud.estado);
        } else {
          setError('No se pudo identificar la empresa del usuario.');
        }

        setCargando(false);
        return;
      }

      // El admin de la plataforma entra directo a su panel maestro — el
      // lobby de "mi negocio" es para los emprendedores.
      if (perfilData.es_admin_plataforma) {
        router.push('/panel-maestro');
        return;
      }

      setPerfil(perfilData);

      const { data: empresaData, error: errorEmpresa } = await supabase
        .from('empresas')
        .select('nombre, rubro, logo_url, perfil_empresa_id')
        .eq('id', perfilData.empresa_id)
        .maybeSingle();

      if (errorEmpresa) {
        setError(`No se pudo cargar la empresa: ${errorEmpresa.message}`);
        setCargando(false);
        return;
      }

      setEmpresa(empresaData);

      // Módulos habilitados según el PERFIL de la empresa (comercial,
      // servicios, producción, mixto). Es lo que hace que una herramienta
      // como Producción aparezca solo en las empresas que producen, sin
      // tener que nombrar clientes dentro del código.
      if (empresaData?.perfil_empresa_id) {
        const { data: modulosData, error: errorModulos } = await supabase
          .from('perfil_modulos')
          .select('modulo')
          .eq('perfil_empresa_id', empresaData.perfil_empresa_id)
          .eq('activo', true);

        if (errorModulos) {
          console.warn('No se pudieron cargar los módulos del perfil:', errorModulos);
        }

        setModulos((modulosData ?? []).map((fila) => String(fila.modulo)));
      } else {
        setModulos([]);
      }

      try {
        setManejaMercaderia(await empresaManejaMercaderia(perfilData.empresa_id));
      } catch (errorMercaderia) {
        console.warn('No se pudo determinar si la empresa maneja mercadería:', errorMercaderia);
      }

      const { data: configData, error: errorConfig } = await supabase
        .from('configuracion_dashboard')
        .select(`
          color_primario,
          color_secundario,
          color_acento,
          mensaje_bienvenida,
          subtitulo_dashboard,
          mostrar_gamificacion,
          mostrar_objetivos,
          mostrar_graficos
        `)
        .eq('empresa_id', perfilData.empresa_id)
        .maybeSingle();

      if (errorConfig) {
        console.warn('No se pudo cargar configuracion_dashboard:', errorConfig);
      }

      const configFinal =
        configData ?? {
          color_primario: COLORES_BASE.azul,
          color_secundario: COLORES_BASE.verde,
          color_acento: COLORES_BASE.gris,
          mensaje_bienvenida: null,
          subtitulo_dashboard: null,
          mostrar_gamificacion: true,
          mostrar_objetivos: true,
          mostrar_graficos: true,
        };

      setConfiguracion(configFinal);

      let progresoActual: ProgresoGamificacion | null = null;

      try {
        progresoActual = await obtenerProgresoGamificacion(perfilData.empresa_id);
        setGamificacion(progresoActual);
      } catch (errorGamificacion) {
        console.warn('No se pudo calcular la gamificación:', errorGamificacion);
        setGamificacion(null);
      }

      // Mismo criterio que usa Panel de Control: objetivos del mes en
      // curso, activos. Acá solo mostramos un resumen mini (nombre + %).
      const fechaActual = new Date();
      const periodoActual = `${fechaActual.getFullYear()}-${String(
        fechaActual.getMonth() + 1
      ).padStart(2, '0')}-01`;

      const { data: objetivosData, error: errorObjetivos } = await supabase
        .from('objetivos_empresa')
        .select('indicador, objetivo, unidad')
        .eq('empresa_id', perfilData.empresa_id)
        .eq('periodo', periodoActual)
        .eq('activo', true);

      if (errorObjetivos) {
        console.warn('No se pudieron cargar los objetivos:', errorObjetivos);
      }

      const objetivosResumen: ObjetivoResumen[] = (objetivosData ?? []).map((objetivo) => {
        const indicador = String(objetivo.indicador ?? '').trim().toUpperCase();

        const resultado =
          indicador === 'OPERACIONES REGISTRADAS' && progresoActual
            ? progresoActual.operaciones
            : 0;

        const meta = Number(objetivo.objetivo ?? 0);

        const porcentaje = meta > 0 ? Math.min(100, Math.max(0, (resultado / meta) * 100)) : 0;

        return {
          nombre: NOMBRES_INDICADOR[indicador] ?? String(objetivo.indicador ?? ''),
          porcentaje: Number(porcentaje.toFixed(0)),
        };
      });

      setObjetivos(objetivosResumen);

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
        Cargando tu negocio...
      </div>
    );
  }

  if (estadoSolicitud) {
    const pendiente = estadoSolicitud === 'PENDIENTE';

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f7f9',
          padding: 24,
        }}
      >
        <div
          style={{
            background: COLORES_BASE.blanco,
            borderRadius: 24,
            padding: '36px 32px',
            maxWidth: 440,
            textAlign: 'center',
            boxShadow: '0 18px 40px rgba(31,58,95,0.10)',
          }}
        >
          <div style={{ fontSize: 42, marginBottom: 10 }}>{pendiente ? '⏳' : '🚫'}</div>
          <h1 style={{ color: COLORES_BASE.azul, fontSize: 21, margin: '0 0 10px' }}>
            {pendiente ? 'Tu cuenta está esperando aprobación' : 'Tu solicitud fue rechazada'}
          </h1>
          <p style={{ color: COLORES_BASE.gris, fontSize: 14, lineHeight: 1.6 }}>
            {pendiente
              ? 'Un administrador todavía tiene que revisar tu solicitud de alta. En cuanto la apruebe, vas a poder entrar acá mismo con tu email y contraseña.'
              : 'Ponete en contacto con el administrador si creés que esto es un error.'}
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            style={{
              marginTop: 16,
              background: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: 12,
              padding: '10px 18px',
              cursor: 'pointer',
              color: COLORES_BASE.azul,
              fontWeight: 700,
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const colores = {
    azul: configuracion?.color_primario ?? COLORES_BASE.azul,
    verde: configuracion?.color_secundario ?? COLORES_BASE.verde,
    acento: configuracion?.color_acento ?? COLORES_BASE.gris,
    blanco: COLORES_BASE.blanco,
  };

  const hoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const logoDisponible = Boolean(empresa?.logo_url?.trim());

  const tieneModulo = (modulo: string) => modulos.includes(modulo);

  const mensajeBienvenida =
    configuracion?.mensaje_bienvenida ?? `Hola, ${perfil?.nombre ?? ''} 👋`;

  const subtitulo =
    configuracion?.subtitulo_dashboard ??
    'Tu negocio, tus números y tus próximos objetivos.';

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
                {empresa?.nombre ?? 'Mi Negocio'}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: COLORES_BASE.gris,
                  marginTop: 3,
                }}
              >
                {empresa?.rubro ?? 'Gestión financiera'}
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
            HERO (con Sabio interactivo y el nivel)
        ================================================== */}

        <SabioHero
          colores={colores}
          nombreEmpresa={empresa?.nombre}
          mensajeBienvenida={mensajeBienvenida}
          subtitulo={subtitulo}
          hoy={hoy}
          gamificacion={
            configuracion?.mostrar_gamificacion ? gamificacion : null
          }
          objetivos={objetivos}
        />

        {/* =================================================
            HERRAMIENTAS
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
              GESTIÓN
            </div>

            <h2
              style={{
                margin: 0,
                color: colores.azul,
                fontSize: 21,
              }}
            >
              Tus herramientas
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
              href="/panel-de-control"
              titulo="📊 Panel de Control"
              colorPrincipal={colores.verde}
              destacado
            />

            <BotonAcceso
              href="/contabilidad"
              titulo="🧾 Contabilidad"
              colorPrincipal="#7c3aed"
              destacado
            />

            {manejaMercaderia && (
              <BotonAcceso
                href="/mercaderia"
                titulo="📦 Mercadería"
                colorPrincipal="#ea580c"
                destacado
              />
            )}

            <BotonAcceso
              href="/informes"
              titulo="📈 Informes"
              colorPrincipal="#0891b2"
              destacado
            />

            {/* Solo para empresas de producción (perfil PRODUCCION) */}
            {tieneModulo('PRODUCCION') && (
              <BotonAcceso
                href="/produccion"
                titulo="🏭 Producción"
                colorPrincipal="#65a30d"
                destacado
              />
            )}

            <BotonAcceso
              href="/recursos-humanos"
              titulo="👥 Recursos Humanos"
              colorPrincipal="#db2777"
              destacado
            />

            <BotonAcceso
              href="/configuracoes"
              titulo="⚙️ Configurações"
              colorPrincipal="#475569"
              destacado
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
