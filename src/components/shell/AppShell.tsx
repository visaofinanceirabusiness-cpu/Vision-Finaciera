'use client';

// APP SHELL — nuevo diseño (fase 1, piloto Buenaventura)
//
// Barra superior fija ("Mi negocio" + Panel de Control, Mini-Juego y Sabio asistente), menú lateral fijo con las herramientas
// (con nombre o solo íconos) y, a la derecha, la zona central donde se ve el lobby o la herramienta elegida, de borde a borde.
// Vive en el layout raíz y no cambia la estructura del árbol de las pantallas: si la empresa no usa el nuevo diseño, o la
// ruta todavía no se migró, deja pasar a `children` tal cual (display: contents) y nada se reinicia.

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TODAS_LAS_HERRAMIENTAS, herramientaDisponible, type Herramienta } from '@/lib/herramientasMenu';
import { empresaManejaMercaderia, empresaTieneModulo } from '@/lib/perfilCapacidades';
import { cargarAperturaVisao3D } from '@/lib/visao3dApertura';
import { empresaUsaShell, herramientaDeRuta, rutaEnShell } from '@/lib/shell';
import { simboloMoneda } from '@/lib/moneda';
import { SABIO_LUDICO_URL } from '@/lib/iconosJuego';
import { SABIO_URL } from '@/components/panel/SabioWidget';
import { SabioBotChat } from '@/components/panel/SabioBotChat';
import { SabioWidget } from '@/components/panel/SabioWidget';
import { NivelCompacto } from './NivelCompacto';
import { obtenerProgresoGamificacion, type ProgresoGamificacion } from '@/lib/gamificacion';
import { frasesSabioDeRuta } from '@/lib/sabioPorRuta';
import { MiniJuego } from '@/components/panel/MiniJuego';
import { NotificacionesPush } from '@/components/panel/NotificacionesPush';
import { useCaja } from '@/components/caja/useCaja';
import { ShellProveedor } from './ShellContext';

const COLORES = {
  azul: 'var(--color-primario, #1f3a5f)',
  verde: 'var(--color-secundario, #2e8b57)',
  acento: 'var(--color-acento, #6e7781)',
  gris: '#6e7781',
  blanco: '#ffffff',
};

const CLAVE_ACTIVO = 'shell:activo';
const CLAVE_COMPACTO = 'shell:menu-compacto';

type Datos = {
  empresaId: string;
  nombre: string;
  rubro: string | null;
  logoUrl: string | null;
  idioma: 'ES' | 'PT';
  moneda: string | null;
  esFamiliar: boolean;
  esAdminPlataforma: boolean;
  menu: Herramienta[];
  mensajesSinLeer: number;
  saludo: string;
  subtitulo: string | null;
  gamificacion: ProgresoGamificacion | null;
};

// Isomórfico: en el servidor useLayoutEffect avisa; así se evita sin perder la lectura previa al primer dibujo.
const useEfectoTempranoDelCliente = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento: el diseño igual funciona */
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { estaEnCaja } = useCaja();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [previoActivo, setPrevioActivo] = useState(false);
  const [compacto, setCompacto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sabioAbierto, setSabioAbierto] = useState(false);
  const [juegoAbierto, setJuegoAbierto] = useState(false);

  useEfectoTempranoDelCliente(() => {
    setPrevioActivo(leer(CLAVE_ACTIVO) === '1');
    setCompacto(leer(CLAVE_COMPACTO) === '1');
  }, []);

  const cargar = useCallback(async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setDatos(null);
        setPrevioActivo(false);
        guardar(CLAVE_ACTIVO, null);
        return;
      }
      const { data: perfil } = await supabase.from('perfiles').select('empresa_id, tipo_usuario, es_admin_plataforma').eq('id', u.user.id).maybeSingle();
      if (!perfil?.empresa_id || !empresaUsaShell(perfil.empresa_id)) {
        setDatos(null);
        setPrevioActivo(false);
        guardar(CLAVE_ACTIVO, null);
        return;
      }
      const empresaId = perfil.empresa_id as string;
      const { data: emp } = await supabase.from('empresas').select('nombre, rubro, logo_url, idioma, moneda, perfiles_empresa(codigo)').eq('id', empresaId).maybeSingle();
      const rel = emp?.perfiles_empresa as { codigo: string }[] | { codigo: string } | null | undefined;
      const perfilCodigo = (Array.isArray(rel) ? rel[0]?.codigo : rel?.codigo) ?? null;

      const idiomaEmpresa = emp?.idioma === 'PT' ? 'PT' : 'ES';
      const [{ data: config }, { data: yo }] = await Promise.all([
        supabase.from('configuracion_dashboard').select('mensaje_bienvenida, subtitulo_dashboard, mostrar_gamificacion').eq('empresa_id', empresaId).maybeSingle(),
        supabase.from('perfiles').select('nombre').eq('id', u.user.id).maybeSingle(),
      ]);
      let gamificacion: ProgresoGamificacion | null = null;
      if (config?.mostrar_gamificacion !== false) gamificacion = await obtenerProgresoGamificacion(empresaId).catch(() => null);
      const saludo = (config?.mensaje_bienvenida as string | null) ?? `${idiomaEmpresa === 'PT' ? 'Olá' : 'Hola'}, ${(yo?.nombre as string | null) ?? ''} 👋`;

      const [manejaMercaderia, tieneProduccion, aperturaVisao3D, { count }] = await Promise.all([
        empresaManejaMercaderia(empresaId).catch(() => true),
        empresaTieneModulo(empresaId, 'PRODUCCION').catch(() => false),
        cargarAperturaVisao3D(),
        supabase.from('mensajes_financieros').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('leido', false),
      ]);

      const contexto = { empresaId, perfilCodigo, tipoUsuario: (perfil.tipo_usuario as string | null) ?? null, manejaMercaderia, tieneProduccion, aperturaVisao3D };
      setDatos({
        empresaId,
        nombre: (emp?.nombre as string) ?? '',
        rubro: (emp?.rubro as string | null) ?? null,
        logoUrl: (emp?.logo_url as string | null) ?? null,
        idioma: emp?.idioma === 'PT' ? 'PT' : 'ES',
        moneda: (emp?.moneda as string | null) ?? null,
        esFamiliar: perfilCodigo === 'FAMILIAR',
        esAdminPlataforma: Boolean(perfil.es_admin_plataforma),
        // Panel de Control va solo en la barra superior.
        menu: TODAS_LAS_HERRAMIENTAS.filter((h) => h.href !== '/panel-de-control' && herramientaDisponible(h.href, contexto)),
        mensajesSinLeer: count ?? 0,
        saludo,
        subtitulo: (config?.subtitulo_dashboard as string | null) ?? null,
        gamificacion,
      });
      guardar(CLAVE_ACTIVO, '1');
    } catch (e) {
      console.warn('No se pudo preparar el nuevo diseño:', e);
      setDatos(null);
      setPrevioActivo(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') void cargar();
    });
    return () => suscripcion.subscription.unsubscribe();
  }, [cargar]);

  // Cada cambio de pantalla cierra los paneles abiertos (menú en celular, Sabio).
  useEffect(() => {
    setMenuAbierto(false);
    setSabioAbierto(false);
  }, [pathname]);

  const menu = useMemo(() => (datos?.menu ?? []).filter((h) => !estaEnCaja(h.href.replace('/', ''))), [datos, estaEnCaja]);

  // Mientras se carga la empresa se usa el recuerdo de la última vez para no mostrar un destello del diseño anterior.
  const encendido = rutaEnShell(pathname) && (datos !== null || previoActivo);

  function alternarCompacto() {
    setCompacto((c) => {
      guardar(CLAVE_COMPACTO, c ? null : '1');
      return !c;
    });
  }

  const resaltada = herramientaDeRuta(pathname, ['/', ...menu.map((h) => h.href)]);
  const es = datos?.idioma === 'PT';
  const hoyTexto = new Date().toLocaleDateString(es ? 'pt-BR' : 'es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const t = (esTxt: string, ptTxt: string) => (es ? ptTxt : esTxt);

  return (
    <ShellProveedor value={encendido}>
      <div className={encendido ? 'shell-activo' : 'shell-apagado'}>
        {encendido && (
          <style>{`
            .shell-activo { display: grid; grid-template-columns: ${compacto ? '68px' : '256px'} minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); height: 100vh; overflow: hidden; background: var(--fondo-app, #f5f7f9); }
            .shell-barra { grid-column: 1 / -1; }
            .shell-logo { width: 100px; height: 100px; }
            .shell-menu { overflow-y: auto; }
            .shell-centro { overflow-y: auto; min-width: 0; position: relative; }
            /* Pantallas a pantalla completa (Visão 3D): ocupan la zona central, no toda la ventana. */
            .shell-activo .shell-centro main[style*="position: fixed"], .shell-activo .shell-centro main[style*="position:fixed"] { position: absolute !important; inset: 0 !important; z-index: 1 !important; }
            .shell-burger { display: none; }
            /* Las herramientas se dibujaban con su propio encabezado, fondo y márgenes: acá ocupan toda la zona central. */
            .shell-activo .shell-centro > * > header,
            .shell-activo .shell-centro > * > * > header,
            .shell-activo .shell-centro > * > * > * > header { display: none !important; }
            .shell-activo .shell-centro > div { min-height: 0 !important; padding: 0 !important; background: transparent !important; }
            .shell-activo .shell-centro > div > div:first-child { max-width: none !important; margin: 0 !important; }
            .shell-activo .shell-centro a[href="/"], .shell-activo .shell-centro a[href="/?vista=empresa"] { display: none !important; }
            .shell-activo .shell-centro main { border-radius: 0 !important; box-shadow: none !important; }
            @media (max-width: 1600px) { .shell-boton-texto { display: none; } }
            @media (max-width: 1280px) { .shell-sabio { display: none !important; } }
            @media (max-width: 1060px) { .shell-nivel { display: none; } }
            @media (max-width: 960px) { .shell-logo { width: 72px; height: 72px; } .shell-nombre { font-size: 21px !important; } }
            @media (max-width: 760px) {
              .shell-activo { grid-template-columns: minmax(0, 1fr); }
              .shell-menu { position: fixed; top: 84px; bottom: 0; left: 0; width: 262px; z-index: 40; transform: translateX(-100%); transition: transform 0.2s; box-shadow: 4px 0 20px rgba(0,0,0,0.2); }
              .shell-menu.abierto { transform: translateX(0); }
              .shell-burger { display: inline-flex; }
              .shell-texto-ancho { display: none; }
              .shell-boton-texto { display: none; }
              .shell-logo { width: 52px; height: 52px; }
              .shell-nombre { font-size: 17px !important; }
              .shell-nivel { display: none; }
            }
          `}</style>
        )}
        {!encendido ? null : (
          <header className="shell-barra" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px 22px', padding: '16px 22px', background: `linear-gradient(125deg, ${COLORES.azul} 0%, ${COLORES.azul} 58%, ${COLORES.verde} 100%)`, color: COLORES.blanco, minWidth: 0, boxShadow: '0 10px 28px rgba(31,58,95,0.16)', zIndex: 5 }}>
            <button type="button" className="shell-burger" aria-label={t('Abrir menú', 'Abrir menu')} onClick={() => setMenuAbierto((a) => !a)} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 26, cursor: 'pointer', alignItems: 'center' }}>☰</button>

            {/* MI NEGOCIO — el banner del lobby, fusionado con la barra: logo, nombre, saludo y fecha. */}
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 18, textDecoration: 'none', color: 'inherit', minWidth: 0, flex: '0 1 auto' }}>
              <span className="shell-logo" style={{ borderRadius: 24, border: '2px solid rgba(255,255,255,0.55)', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 18px rgba(0,0,0,0.22)' }}>
                {datos?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={datos.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontWeight: 800, fontSize: 44, color: COLORES.azul }}>{(datos?.nombre || 'M').charAt(0).toUpperCase()}</span>
                )}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="shell-texto-ancho" style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.75, marginBottom: 4 }}>{t('Mi negocio', 'Meu negócio')}</span>
                <span className="shell-nombre" style={{ display: 'block', fontWeight: 800, fontSize: 30, lineHeight: 1.1 }}>{datos?.nombre || t('Mi negocio', 'Meu negócio')}</span>
                {datos && <span className="shell-texto-ancho" style={{ display: 'block', fontSize: 17, fontWeight: 600, marginTop: 6 }}>{datos.saludo}</span>}
                <span className="shell-texto-ancho" style={{ display: 'block', fontSize: 12, opacity: 0.7, marginTop: 4 }}>{hoyTexto}</span>
              </span>
            </Link>

            {datos?.gamificacion && (
              <div className="shell-nivel">
                <NivelCompacto g={datos.gamificacion} idioma={datos.idioma} />
              </div>
            )}

            <div style={{ flex: '1 1 0', minWidth: 0 }} />

            {/* El Sabio de siempre (con los tips de la herramienta que se está viendo) y, al lado, el chat. */}
            <div className="shell-sabio" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <SabioWidget
                key={`${pathname}-${datos?.idioma ?? 'ES'}`}
                compacto
                colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
                idioma={datos?.idioma ?? 'ES'}
                frases={frasesSabioDeRuta(pathname, datos?.idioma ?? 'ES')}
              />
              <button type="button" onClick={() => setSabioAbierto(true)} title={t('Chatear con Sabio', 'Conversar com o Sábio')} aria-label={t('Chatear con Sabio', 'Conversar com o Sábio')} style={{ border: '1px solid rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.16)', color: '#fff', borderRadius: 12, padding: '8px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer', lineHeight: 1.25 }}>
                💬<br />{t('Chat', 'Chat')}
              </button>
            </div>

            <nav aria-label={t('Accesos rápidos', 'Acessos rápidos')} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <BotonImagen href="/panel-de-control" imagen="/sabio/sabio-panel-control.png" texto={t('Panel de Control', 'Painel de Controle')} />
              <BotonImagen onClick={() => setJuegoAbierto(true)} imagen={SABIO_LUDICO_URL} texto="Mini-Juego" />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {datos?.esAdminPlataforma && (
                  <Link href="/panel-maestro" title="Panel Maestro" className="shell-texto-ancho" style={{ color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none', opacity: 0.9 }}>⚙️ Panel Maestro</Link>
                )}
                <button
                  type="button"
                  title={t('Cerrar sesión', 'Sair')}
                  aria-label={t('Cerrar sesión', 'Sair')}
                  onClick={async () => {
                    guardar(CLAVE_ACTIVO, null);
                    await supabase.auth.signOut();
                    router.push('/login');
                  }}
                  style={{ border: '1px solid rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.14)', borderRadius: 10, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff' }}
                >
                  ⎋ {t('Salir', 'Sair')}
                </button>
              </div>
            </nav>
          </header>
        )}

        {!encendido ? null : (
          <nav className={`shell-menu${menuAbierto ? ' abierto' : ''}`} aria-label={t('Herramientas', 'Ferramentas')} style={{ background: '#f8fafc', borderRight: '1px solid #e5e7eb', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ItemMenu href="/" emoji="🏠" nombre={t('Inicio', 'Início')} color={COLORES.azul} activa={resaltada === '/'} compacto={compacto} />
            {menu.map((h) => (
              <ItemMenu
                key={h.href}
                href={h.href}
                emoji={h.emoji}
                nombre={es ? h.corto.pt : h.titulo}
                color={h.color}
                activa={resaltada === h.href}
                compacto={compacto}
                insignia={h.href === '/mensajes' ? datos?.mensajesSinLeer : 0}
              />
            ))}
            <div style={{ flex: 1 }} />
            {!compacto && (
              <div style={{ padding: '4px 4px 8px' }}>
                <NotificacionesPush variante="claro" mostrarPrueba={false} />
              </div>
            )}
            <button
              type="button"
              onClick={alternarCompacto}
              aria-pressed={compacto}
              title={compacto ? t('Mostrar nombres', 'Mostrar nomes') : t('Ocultar nombres', 'Ocultar nomes')}
              style={{ border: '1px dashed #cbd5e1', background: 'transparent', borderRadius: 10, padding: '9px 10px', cursor: 'pointer', color: COLORES.gris, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: compacto ? 'center' : 'flex-start', gap: 8 }}
            >
              <span aria-hidden>{compacto ? '»' : '«'}</span>
              {!compacto && <span>{t('Ocultar nombres', 'Ocultar nomes')}</span>}
            </button>
          </nav>
        )}

        <div className="shell-centro" style={encendido ? undefined : { display: 'contents' }}>
          {children}
        </div>

        {encendido && menuAbierto && <div onClick={() => setMenuAbierto(false)} style={{ position: 'fixed', inset: '84px 0 0 0', background: 'rgba(15,23,42,0.35)', zIndex: 30 }} />}

        {encendido && sabioAbierto && datos && (
          <>
            <div onClick={() => setSabioAbierto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 60 }} />
            <aside role="dialog" aria-label={t('Sabio asistente', 'Sábio assistente')} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100%)', background: COLORES.blanco, zIndex: 61, padding: 18, boxShadow: '-8px 0 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: COLORES.azul, fontSize: 17 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={SABIO_URL} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
                  {t('Sabio, tu asistente financiero', 'Sábio, seu assistente financeiro')}
                </span>
                <button type="button" onClick={() => setSabioAbierto(false)} style={{ border: '1px solid #d1d5db', background: COLORES.blanco, borderRadius: 10, padding: '6px 12px', fontWeight: 700, cursor: 'pointer', color: COLORES.azul }}>{t('Cerrar', 'Fechar')}</button>
              </div>
              <SabioBotChat empresaId={datos.empresaId} colores={{ azul: COLORES.azul, verde: COLORES.verde, gris: COLORES.acento, blanco: COLORES.blanco }} altura="calc(100vh - 120px)" />
            </aside>
          </>
        )}

        {encendido && juegoAbierto && datos && (
          <MiniJuego
            empresaId={datos.empresaId}
            idioma={datos.idioma}
            esFamiliar={datos.esFamiliar}
            simbolo={simboloMoneda(datos.moneda)}
            colores={{ azul: COLORES.azul, verde: COLORES.verde, acento: COLORES.acento, blanco: COLORES.blanco }}
            simulacion={undefined}
            onCerrar={() => setJuegoAbierto(false)}
          />
        )}
      </div>
    </ShellProveedor>
  );
}

function BotonImagen({ href, onClick, imagen, texto }: { href?: string; onClick?: () => void; imagen: string; texto: string }) {
  const contenido = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imagen} alt="" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
      <span className="shell-boton-texto" style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{texto}</span>
    </>
  );
  const estilo: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 6px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.14)', cursor: 'pointer', textDecoration: 'none' };
  return href ? (
    <Link href={href} title={texto} aria-label={texto} style={estilo}>{contenido}</Link>
  ) : (
    <button type="button" onClick={onClick} title={texto} aria-label={texto} style={estilo}>{contenido}</button>
  );
}

function ItemMenu({ href, emoji, nombre, color, activa, compacto, insignia = 0 }: { href: string; emoji: string; nombre: string; color: string; activa: boolean; compacto: boolean; insignia?: number }) {
  return (
    <Link
      href={href}
      title={nombre}
      aria-current={activa ? 'page' : undefined}
      style={{ display: 'flex', alignItems: 'center', justifyContent: compacto ? 'center' : 'flex-start', gap: 12, padding: compacto ? '11px 6px' : '11px 12px', borderRadius: 12, textDecoration: 'none', fontWeight: activa ? 800 : 600, fontSize: 14, color: activa ? '#fff' : COLORES.azul, background: activa ? color : 'transparent', position: 'relative' }}
    >
      <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
      {!compacto && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>}
      {insignia > 0 && (
        <span style={{ position: compacto ? 'absolute' : 'static', top: 4, right: 6, background: '#dc2626', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 800, padding: '1px 7px' }}>{insignia}</span>
      )}
    </Link>
  );
}
