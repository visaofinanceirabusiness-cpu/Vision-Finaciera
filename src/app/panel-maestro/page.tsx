'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { obtenerProgresoGamificacion, type ProgresoGamificacion } from '@/lib/gamificacion';
import { inicializarEmpresaDesdePerfil } from '@/lib/perfiles';
import { avatarPorDefecto } from '@/lib/avatares';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { NotificacionesPush } from '@/components/panel/NotificacionesPush';
import { resumirSuscripcion, marcarPagoRecibido, restarDiasDeTest } from '@/lib/suscripcion';
import { BadgeEstadoSuscripcion } from '@/components/EstadoSuscripcion';
import type { Empresa, Pendiente, PendienteMovimiento, SolicitudAlta } from '@/lib/panelMaestroTipos';
import {
  crearInvitacionSoporte,
  listarInvitacionesPendientes,
  listarPerfilesPorTipo,
  revocarInvitacion,
  cambiarActivoPerfil,
  urlInvitacion,
  type Invitacion,
  type PerfilConRol,
} from '@/lib/invitaciones';

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

export default function PanelMaestroPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nivelesPorEmpresa, setNivelesPorEmpresa] = useState<Record<string, ProgresoGamificacion>>({});
  const [ultimoAccesoPorEmpresa, setUltimoAccesoPorEmpresa] = useState<Record<string, string | null>>({});
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudAlta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [eliminandoEmpresa, setEliminandoEmpresa] = useState<string | null>(null);
  const [alternandoAutomatico, setAlternandoAutomatico] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function cargarPendientes() {
    const [{ data: registros, error: errorRegistros }, { data: movimientos, error: errorMovimientos }] =
      await Promise.all([
        supabase
          .from('registro_operaciones')
          .select('empresa_id, id_operacion, fecha, operacion, categoria, total, historico, estado')
          .or('estado.is.null,estado.neq.VALIDADO')
          .order('fecha', { ascending: false }),

        supabase
          .from('movimientos_stock')
          .select('empresa_id, id_operacion, fecha, cantidad, costo_unitario, estado')
          .or('estado.is.null,estado.neq.VALIDADO')
          .order('fecha', { ascending: false }),
      ]);

    if (errorRegistros) console.warn('No se pudieron cargar registros pendientes:', errorRegistros);
    if (errorMovimientos) console.warn('No se pudieron cargar movimientos pendientes:', errorMovimientos);

    const registrosPendientes: Pendiente[] = (registros ?? []).map((r) => ({
      tipo: 'registro',
      empresaId: r.empresa_id,
      idOperacion: r.id_operacion,
      fecha: r.fecha,
      operacion: r.operacion,
      categoria: r.categoria,
      total: Number(r.total ?? 0),
      historico: r.historico,
    }));

    // Un "movimiento de mercadería" pendiente puede tener varias
    // líneas (varios productos en la misma operación) — se agrupan
    // por id_operacion porque se validan todas juntas de un clic.
    const movimientosAgrupados = new Map<string, PendienteMovimiento>();

    for (const m of movimientos ?? []) {
      const clave = `${m.empresa_id}|${m.id_operacion}`;
      const actual = movimientosAgrupados.get(clave);

      if (actual) {
        actual.lineas += 1;
        actual.total += Number(m.cantidad ?? 0) * Number(m.costo_unitario ?? 0);
      } else {
        movimientosAgrupados.set(clave, {
          tipo: 'movimiento',
          empresaId: m.empresa_id,
          idOperacion: m.id_operacion,
          fecha: m.fecha,
          lineas: 1,
          total: Number(m.cantidad ?? 0) * Number(m.costo_unitario ?? 0),
        });
      }
    }

    setPendientes([...registrosPendientes, ...movimientosAgrupados.values()]);
  }

  async function cargarEmpresas() {
    const { data: empresasData, error: errorEmpresas } = await supabase
      .from('empresas')
      .select(
        'id, nombre, rubro, logo_url, numero_cliente, moneda, fecha_vencimiento_suscripcion, creado_en, validacion_automatica, perfiles_empresa(nombre)'
      )
      .eq('activo', true)
      .order('numero_cliente', { ascending: true });

    if (errorEmpresas) {
      setError('No se pudieron cargar las empresas.');
      return;
    }

    setEmpresas((empresasData ?? []) as unknown as Empresa[]);

    const resultados = await Promise.all(
      (empresasData ?? []).map(async (empresa) => {
        try {
          const progreso = await obtenerProgresoGamificacion(empresa.id);
          return [empresa.id, progreso] as const;
        } catch (errorGamificacion) {
          console.warn(`No se pudo calcular el nivel de ${empresa.nombre}:`, errorGamificacion);
          return null;
        }
      })
    );

    setNivelesPorEmpresa(
      Object.fromEntries(resultados.filter((r): r is readonly [string, ProgresoGamificacion] => r !== null))
    );

    // Último acceso de cada cliente — Supabase Auth ya lo guarda solo
    // (auth.users.last_sign_in_at), este RPC solo lo entrega agrupado
    // por empresa (ver migración rpc_ultimo_acceso_por_empresa).
    const { data: accesos, error: errorAccesos } = await supabase.rpc('obtener_ultimo_acceso_por_empresa');

    if (errorAccesos) {
      console.warn('No se pudo cargar el último acceso de las empresas:', errorAccesos);
    } else {
      setUltimoAccesoPorEmpresa(
        Object.fromEntries(
          (accesos ?? []).map((fila: { empresa_id: string; ultimo_acceso: string | null }) => [
            fila.empresa_id,
            fila.ultimo_acceso,
          ])
        )
      );
    }
  }

  async function cargarSolicitudes() {
    const { data, error: errorSolicitudes } = await supabase
      .from('solicitudes_alta')
      .select('id, user_id, email, nombre, sexo, telefono, nombre_empresa, rubro, moneda, idioma, perfil_empresa_id, componentes_mixto, creado_en, perfiles_empresa(nombre, codigo)')
      .eq('estado', 'PENDIENTE')
      .order('creado_en', { ascending: true });

    if (errorSolicitudes) {
      console.warn('No se pudieron cargar las solicitudes de alta:', errorSolicitudes);
      return;
    }

    setSolicitudes((data ?? []) as unknown as SolicitudAlta[]);
  }

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

      await cargarEmpresas();
      await cargarPendientes();
      await cargarSolicitudes();
      setCargando(false);
    }

    cargar();
  }, [router]);

  const [actualizando, setActualizando] = useState(false);

  async function actualizarTodo() {
    setActualizando(true);
    setError('');
    setMensaje('');
    await Promise.all([cargarEmpresas(), cargarPendientes(), cargarSolicitudes()]);
    setActualizando(false);
  }

  // Modo Automático vs Manual, por empresa. Automático: las
  // operaciones que carga esa empresa entran directo como VALIDADO,
  // sin pasar por la cola de "Pendientes de validar" acá — pensado a
  // futuro como diferenciador de plan (Automático = Pro, informes al
  // instante; Manual = Básico, con la demora de esta validación).
  async function alternarValidacionAutomatica(empresa: Empresa) {
    setError('');
    setMensaje('');
    setAlternandoAutomatico(empresa.id);

    const nuevoValor = !empresa.validacion_automatica;

    const { error: errorAlternar } = await supabase
      .from('empresas')
      .update({ validacion_automatica: nuevoValor })
      .eq('id', empresa.id);

    if (errorAlternar) {
      setError(`No se pudo cambiar el modo de ${empresa.nombre}: ${errorAlternar.message}`);
    } else {
      setMensaje(`${empresa.nombre} quedó en modo ${nuevoValor ? 'Automático' : 'Manual'}.`);
      await cargarEmpresas();
    }

    setAlternandoAutomatico(null);
  }

  // Borra la empresa entera y TODO lo que cuelga de ella (plan de
  // cuentas, categorías, operaciones, socios, productos, etc.) — la
  // misma limpieza que hasta ahora se hacía a mano por SQL cuando se
  // descartaba una empresa de prueba. Pide escribir el nombre exacto
  // para confirmar, porque no hay forma de deshacerlo.
  async function eliminarEmpresa(empresa: Empresa) {
    const confirmacion = window.prompt(
      `Esto borra "${empresa.nombre}" y absolutamente todo lo conectado (plan de cuentas, operaciones, productos, socios, usuarios vinculados...). No se puede deshacer.\n\nEscribí el nombre exacto de la empresa para confirmar:`
    );

    if (confirmacion !== empresa.nombre) {
      if (confirmacion !== null) {
        setError('El nombre no coincide — no se borró nada.');
      }
      return;
    }

    setError('');
    setMensaje('');
    setEliminandoEmpresa(empresa.id);

    const { error: errorEliminar } = await supabase.rpc('eliminar_empresa_completa', {
      p_empresa_id: empresa.id,
    });

    if (errorEliminar) {
      setError(`No se pudo borrar "${empresa.nombre}": ${errorEliminar.message}`);
    } else {
      setMensaje(`"${empresa.nombre}" se borró por completo.`);
      await cargarEmpresas();
      await cargarPendientes();
    }

    setEliminandoEmpresa(null);
  }

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

    // Auditoría (Bloque F): el Desarrollador entrando a la empresa de
    // un cliente es el acceso más sensible que existe en la app —
    // queda registrado siempre, sin excepción.
    await supabase.rpc('registrar_evento_auditoria', {
      p_tipo_evento: 'panel_maestro_acceso_empresa',
      p_empresa_id: empresaId,
    });

    router.push('/?vista=empresa');
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
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                opacity: 0.75,
              }}
            >
              PANEL MAESTRO · VISÃO FINANCEIRA
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NotificacionesPush />
              <button
                onClick={actualizarTodo}
                disabled={actualizando}
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: COLORES_BASE.blanco,
                  borderRadius: 999,
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: actualizando ? 'default' : 'pointer',
                  opacity: actualizando ? 0.7 : 1,
                }}
              >
                {actualizando ? '↻ Actualizando...' : '↻ Actualizar'}
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/login');
                }}
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: COLORES_BASE.blanco,
                  borderRadius: 999,
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cerrar sesión
              </button>
            </div>
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

        {mensaje && (
          <div
            style={{
              background: '#f0fdf4',
              color: '#166534',
              padding: '12px 16px',
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {mensaje}
          </div>
        )}

        {/* =================================================
            NOTIFICAÇÕES — antes acá vivían las listas completas de
            Solicitudes de alta y Pendientes de validar, pero al
            resolverlas desaparecían sin dejar rastro. Ahora el lobby
            solo muestra un resumen con contadores; la lista completa
            (Pendientes + Historial) se mudó a su propia pantalla, que
            va a ir sumando más funciones de administración con el
            tiempo.
        ================================================== */}

        <Link
          href="/panel-maestro/notificacoes"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            background: COLORES_BASE.blanco,
            border: '1px solid #bfdbfe',
            borderRadius: 20,
            padding: '18px 22px',
            marginBottom: 24,
            boxShadow: '0 10px 24px rgba(37,99,235,0.08)',
            textDecoration: 'none',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800, color: COLORES_BASE.azul }}>
            🔔 Notificações
            {solicitudes.length > 0 && (
              <span
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {solicitudes.length} solicitud{solicitudes.length === 1 ? '' : 'es'}
              </span>
            )}
            {pendientes.length > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#ffffff',
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'} de validar
              </span>
            )}
            {solicitudes.length === 0 && pendientes.length === 0 && (
              <span style={{ color: COLORES_BASE.gris, fontSize: 13, fontWeight: 600 }}>
                nada pendiente por ahora
              </span>
            )}
          </span>

          <span style={{ color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Ver todo →</span>
        </Link>

        {/* =================================================
            SEGURANÇA E PROTEÇÃO DE DADOS — auditoría V3.0
        ================================================== */}

        <Link
          href="/panel-maestro/seguranca-dados"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            background: COLORES_BASE.blanco,
            border: '1px solid #fde68a',
            borderRadius: 20,
            padding: '18px 22px',
            marginBottom: 24,
            boxShadow: '0 10px 24px rgba(217,119,6,0.08)',
            textDecoration: 'none',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800, color: COLORES_BASE.azul }}>
            🛡️ Segurança e Proteção de Dados
          </span>

          <span style={{ color: '#d97706', fontSize: 13, fontWeight: 700 }}>Ver informe →</span>
        </Link>

        {/* =================================================
            AUDITORÍA DE ACTIVIDAD — Bloque F del Día 1 de seguridad
        ================================================== */}

        <Link
          href="/panel-maestro/auditoria"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            background: COLORES_BASE.blanco,
            border: '1px solid #ddd6fe',
            borderRadius: 20,
            padding: '18px 22px',
            marginBottom: 24,
            boxShadow: '0 10px 24px rgba(124,58,237,0.08)',
            textDecoration: 'none',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800, color: COLORES_BASE.azul }}>
            🕵️ Auditoría de Actividad
          </span>

          <span style={{ color: '#7c3aed', fontSize: 13, fontWeight: 700 }}>Ver registro →</span>
        </Link>

        {/* =================================================
            ALTA DE CLIENTES — vincular un usuario ya creado
            en Supabase Auth a una empresa (existente o nueva)
        ================================================== */}

        <VincularUsuario
          empresas={empresas}
          onCreado={(mensajeExito) => {
            setMensaje(mensajeExito);
            setError('');
            cargarEmpresas();
          }}
          onError={(mensajeError) => {
            setError(mensajeError);
            setMensaje('');
          }}
        />

        {/* =================================================
            EQUIPE DE SOPORTE — Bloque E1 del Día 1 de seguridad.
            Solo el Desarrollador invita Soporte (lectura en todo,
            sin poder editar nada — eso se termina de blindar en la
            pasada de RLS de E3).
        ================================================== */}

        <GestionSoporte />

        {/* =================================================
            PROBAR FORMULARIO DE BIENVENIDA — acceso directo para
            testear /bienvenida con cualquier perfil, sin tener que
            crear una cuenta real y aprobarla cada vez.
        ================================================== */}

        <ProbarFormularioBienvenida
          onError={(mensajeError) => {
            setError(mensajeError);
            setMensaje('');
          }}
        />

        {/* LISTA DE EMPRESAS — agrupadas por perfil, para poder ver de
            un vistazo cuántas empresas hay de cada tipo. */}
        {Array.from(
          empresas.reduce((grupos, empresa) => {
            const nombrePerfil = empresa.perfiles_empresa?.nombre ?? 'Sin perfil';
            grupos.set(nombrePerfil, [...(grupos.get(nombrePerfil) ?? []), empresa]);
            return grupos;
          }, new Map<string, Empresa[]>())
        )
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([nombrePerfil, empresasDelGrupo]) => (
            <div key={nombrePerfil} style={{ marginBottom: 28 }}>
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  color: COLORES_BASE.azul,
                  textTransform: 'uppercase',
                  margin: '0 0 12px',
                }}
              >
                {nombrePerfil} · {empresasDelGrupo.length}
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 18,
                }}
              >
                {empresasDelGrupo.map((empresa) => (
                  <div
                    key={empresa.id}
                    onClick={() => cambiando === null && entrarAEmpresa(empresa.id)}
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
                      position: 'relative',
                    }}
                  >
                    <button
                      type="button"
                      title={`Eliminar ${empresa.nombre} y todo lo conectado`}
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarEmpresa(empresa);
                      }}
                      disabled={eliminandoEmpresa !== null}
                      style={{
                        position: 'absolute',
                        top: 14,
                        right: 14,
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {eliminandoEmpresa === empresa.id ? '...' : '🗑️'}
                    </button>

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
                          {empresa.nombre}{' '}
                          <span style={{ fontSize: 12, fontWeight: 700, color: COLORES_BASE.gris }}>
                            · Cliente #{empresa.numero_cliente}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: COLORES_BASE.gris, marginTop: 2 }}>
                          {empresa.rubro ?? 'Sin rubro definido'}
                        </div>
                        <div
                          style={{
                            display: 'inline-block',
                            fontSize: 10.5,
                            fontWeight: 700,
                            marginTop: 3,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: `${COLORES_BASE.azul}14`,
                            color: COLORES_BASE.azul,
                          }}
                        >
                          {empresa.perfiles_empresa?.nombre ?? 'Sin perfil'}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            alternarValidacionAutomatica(empresa);
                          }}
                          disabled={alternandoAutomatico === empresa.id}
                          title="Automático: sus operaciones se validan solas. Manual: quedan pendientes hasta que un admin las valide."
                          style={{
                            display: 'inline-block',
                            fontSize: 10.5,
                            fontWeight: 700,
                            marginTop: 3,
                            marginLeft: 6,
                            padding: '2px 8px',
                            borderRadius: 999,
                            border: 'none',
                            cursor: alternandoAutomatico === empresa.id ? 'wait' : 'pointer',
                            background: empresa.validacion_automatica ? `${COLORES_BASE.verde}18` : '#fef3c7',
                            color: empresa.validacion_automatica ? COLORES_BASE.verde : '#92400e',
                          }}
                        >
                          {alternandoAutomatico === empresa.id
                            ? '...'
                            : empresa.validacion_automatica
                              ? '⚡ Automático'
                              : '🕒 Manual'}
                        </button>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            marginTop: 3,
                            color: ultimoAccesoPorEmpresa[empresa.id] ? '#16a34a' : '#b91c1c',
                          }}
                        >
                          {ultimoAccesoPorEmpresa[empresa.id] === undefined
                            ? 'Último acceso: cargando...'
                            : formatearUltimoAcceso(ultimoAccesoPorEmpresa[empresa.id])}
                        </div>
                      </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <BloqueSuscripcionEmpresa
                        empresaId={empresa.id}
                        fechaVencimiento={empresa.fecha_vencimiento_suscripcion}
                        fechaAlta={empresa.creado_en}
                        onActualizado={cargarEmpresas}
                      />
                    </div>

                    {nivelesPorEmpresa[empresa.id] && (
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e5e7eb',
                          borderRadius: 14,
                          padding: '12px 14px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: COLORES_BASE.azul,
                            marginBottom: 8,
                          }}
                        >
                          <span>
                            {nivelesPorEmpresa[empresa.id].emoji} Nivel {nivelesPorEmpresa[empresa.id].nivel} ·{' '}
                            {nivelesPorEmpresa[empresa.id].nombre}
                          </span>
                          <span style={{ color: COLORES_BASE.gris, fontWeight: 600 }}>
                            {nivelesPorEmpresa[empresa.id].operaciones} op.
                          </span>
                        </div>

                        <div style={{ height: 7, borderRadius: 999, background: '#e7edf1', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${nivelesPorEmpresa[empresa.id].progreso}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: COLORES_BASE.verde,
                            }}
                          />
                        </div>

                        <div style={{ marginTop: 6, fontSize: 11, color: COLORES_BASE.gris }}>
                          {nivelesPorEmpresa[empresa.id].operacionesMax === null
                            ? 'Nivel máximo alcanzado'
                            : `Faltan ${nivelesPorEmpresa[empresa.id].faltan} operaciones para el próximo nivel`}
                        </div>
                      </div>
                    )}

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
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </main>
  );
}

/* ==========================================================
   SUSCRIPCIÓN — semáforo + control manual de pago (por ahora no
   bloquea el acceso, solo informa)
========================================================== */

const MEDIOS_PAGO = ['InfinitePay', 'Naranja X', 'Otro'];

// Último acceso — el dato sale de auth.users.last_sign_in_at (ver RPC
// obtener_ultimo_acceso_por_empresa). null significa que esa empresa
// nunca inició sesión desde que se dio de alta.
function formatearUltimoAcceso(fecha: string | null | undefined): string {
  if (!fecha) {
    return 'Nunca inició sesión';
  }

  return `Último acceso: ${new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function diasEnSistema(fechaAlta: string): number {
  const msPorDia = 1000 * 60 * 60 * 24;
  const alta = new Date(fechaAlta).getTime();
  const hoy = new Date().getTime();
  return Math.max(0, Math.floor((hoy - alta) / msPorDia));
}

function BloqueSuscripcionEmpresa({
  empresaId,
  fechaVencimiento,
  fechaAlta,
  onActualizado,
}: {
  empresaId: string;
  fechaVencimiento: string;
  fechaAlta: string;
  onActualizado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [medio, setMedio] = useState(MEDIOS_PAGO[0]);
  const [monto, setMonto] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const resumen = resumirSuscripcion(fechaVencimiento);
  const dias = diasEnSistema(fechaAlta);

  async function confirmarPago() {
    setProcesando(true);
    setError('');

    try {
      await marcarPagoRecibido(empresaId, {
        medio,
        monto: monto.trim() ? Number(monto) : null,
      });
      setMonto('');
      setAbierto(false);
      onActualizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setProcesando(false);
    }
  }

  async function ajustarDiasDeTest(dias: number) {
    setProcesando(true);
    setError('');

    try {
      await restarDiasDeTest(empresaId, dias);
      onActualizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar el ajuste de prueba.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 12,
        background: '#fbfcfd',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <BadgeEstadoSuscripcion resumen={resumen} />
          <span style={{ fontSize: 11, color: COLORES_BASE.gris, fontWeight: 600 }}>
            📅 {dias} día{dias === 1 ? '' : 's'} en el sistema
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          disabled={procesando}
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: COLORES_BASE.verde,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {abierto ? 'Cerrar' : 'Marcar pago recibido'}
        </button>
      </div>

      {abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && <div style={{ fontSize: 11.5, color: '#b91c1c' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={medio}
              onChange={(e) => setMedio(e.target.value)}
              style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #d7dde3' }}
            >
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Monto (opcional)"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              style={{ width: 110, fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #d7dde3' }}
            />
          </div>

          <button
            type="button"
            onClick={confirmarPago}
            disabled={procesando}
            style={{
              padding: '8px 0',
              borderRadius: 8,
              border: 'none',
              background: COLORES_BASE.verde,
              color: COLORES_BASE.blanco,
              fontWeight: 700,
              fontSize: 12,
              cursor: procesando ? 'wait' : 'pointer',
            }}
          >
            {procesando ? 'Guardando...' : `Confirmar pago (+${30} días)`}
          </button>

          <button
            type="button"
            onClick={() => ajustarDiasDeTest(30)}
            disabled={procesando}
            title="Solo para pruebas: adelanta el vencimiento 30 días, sin grabar ningún pago"
            style={{
              padding: '6px 0',
              borderRadius: 8,
              border: '1px dashed #d7dde3',
              background: 'transparent',
              color: COLORES_BASE.gris,
              fontWeight: 600,
              fontSize: 11,
              cursor: procesando ? 'wait' : 'pointer',
            }}
          >
            🧪 Restar 30 días
          </button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   VINCULAR USUARIO A EMPRESA — alta de clientes nuevos
========================================================== */

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #d7dde3',
  fontSize: 14,
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLORES_BASE.gris,
  marginBottom: 4,
  display: 'block',
};

function GestionSoporte() {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ultimoLink, setUltimoLink] = useState('');

  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [soportes, setSoportes] = useState<PerfilConRol[]>([]);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);

  async function cargar() {
    const [{ data: inv }, { data: sop }] = await Promise.all([
      listarInvitacionesPendientes('SOPORTE'),
      listarPerfilesPorTipo('SOPORTE'),
    ]);
    setInvitaciones((inv ?? []) as Invitacion[]);
    setSoportes((sop ?? []) as PerfilConRol[]);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function invitar() {
    if (!email.trim() || !nombre.trim()) {
      setError('Completá el email y el nombre de la persona.');
      return;
    }

    setError('');
    setMensaje('');
    setEnviando(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error: errorCrear } = await crearInvitacionSoporte(email, nombre, userData.user.id);

    setEnviando(false);

    if (errorCrear || !data) {
      setError(`No se pudo crear la invitación: ${errorCrear?.message ?? 'error desconocido'}.`);
      return;
    }

    const link = urlInvitacion(data.token);
    setUltimoLink(link);
    setMensaje(`Invitación creada para ${nombre.trim()}. Copiá el link de abajo y mandaselo por WhatsApp o email.`);
    setEmail('');
    setNombre('');
    await cargar();
  }

  async function revocar(id: string) {
    setCambiandoId(id);
    await revocarInvitacion(id);
    await cargar();
    setCambiandoId(null);
  }

  async function cambiarActivo(perfilId: string, activo: boolean) {
    setCambiandoId(perfilId);
    await cambiarActivoPerfil(perfilId, activo);
    await cargar();
    setCambiandoId(null);
  }

  return (
    <div
      style={{
        background: COLORES_BASE.blanco,
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: 22,
        marginBottom: 24,
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 16, color: COLORES_BASE.azul }}>👥 Equipe de Soporte</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: COLORES_BASE.gris }}>
        Solo lectura en todos los sistemas de clientes, sin poder editar nada. Se invita una vez, desde acá.
      </p>

      {error && <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 13px', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {mensaje && <div style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 10, padding: '9px 13px', marginBottom: 12, fontSize: 13 }}>{mensaje}</div>}
      {ultimoLink && (
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 13px', marginBottom: 12, fontSize: 12, wordBreak: 'break-all', color: COLORES_BASE.azul }}>
          {ultimoLink}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@email.com" />
        </div>
        <div>
          <label style={labelStyle}>Nombre</label>
          <input style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Marina" />
        </div>
      </div>

      <button
        type="button"
        disabled={enviando}
        onClick={invitar}
        style={{ background: COLORES_BASE.azul, color: COLORES_BASE.blanco, border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: enviando ? 'wait' : 'pointer' }}
      >
        {enviando ? 'Invitando...' : 'Invitar como Soporte'}
      </button>

      {invitaciones.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: COLORES_BASE.gris, textTransform: 'uppercase', marginBottom: 8 }}>Invitaciones pendientes</div>
          {invitaciones.map((inv) => (
            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb', marginBottom: 6, fontSize: 12.5 }}>
              <span>{inv.nombre} · {inv.email}</span>
              <button type="button" disabled={cambiandoId === inv.id} onClick={() => revocar(inv.id)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', color: COLORES_BASE.gris }}>
                Revocar
              </button>
            </div>
          ))}
        </div>
      )}

      {soportes.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: COLORES_BASE.gris, textTransform: 'uppercase', marginBottom: 8 }}>Soporte activo</div>
          {soportes.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: s.activo ? '#f0fdf4' : '#fef2f2', border: `1px solid ${s.activo ? '#bbf7d0' : '#fecaca'}`, marginBottom: 6, fontSize: 12.5 }}>
              <span>{s.nombre} — {s.activo ? 'activo' : 'dado de baja'}</span>
              <button
                type="button"
                disabled={cambiandoId === s.id}
                onClick={() => cambiarActivo(s.id, !s.activo)}
                style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', color: s.activo ? '#b91c1c' : '#166534' }}
              >
                {s.activo ? 'Dar de baja' : 'Reactivar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VincularUsuario({
  empresas,
  onCreado,
  onError,
}: {
  empresas: Empresa[];
  onCreado: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<'Cliente' | 'Admin'>('Cliente');
  const [empresaId, setEmpresaId] = useState<string>('__nueva__');
  const [nombreNuevaEmpresa, setNombreNuevaEmpresa] = useState('');
  const [rubroNuevaEmpresa, setRubroNuevaEmpresa] = useState('');
  const [enviando, setEnviando] = useState(false);

  function limpiar() {
    setEmail('');
    setNombre('');
    setRol('Cliente');
    setEmpresaId('__nueva__');
    setNombreNuevaEmpresa('');
    setRubroNuevaEmpresa('');
  }

  async function vincular() {
    if (!email.trim() || !nombre.trim()) {
      onError('Completá el email y el nombre de la persona.');
      return;
    }

    if (empresaId === '__nueva__' && !nombreNuevaEmpresa.trim()) {
      onError('Ponele un nombre a la empresa nueva.');
      return;
    }

    setEnviando(true);

    let empresaDestinoId = empresaId;
    let numeroClienteNuevo: number | null = null;

    if (empresaId === '__nueva__') {
      const { data: existeNombre, error: errorNombreDuplicado } = await supabase.rpc('existe_nombre_empresa', {
        p_nombre: nombreNuevaEmpresa.trim(),
      });

      if (errorNombreDuplicado) {
        onError(`No se pudo validar el nombre: ${errorNombreDuplicado.message}`);
        setEnviando(false);
        return;
      }

      if (existeNombre) {
        onError(`Ya existe una empresa con el nombre "${nombreNuevaEmpresa.trim()}". Elegí un nombre distinto.`);
        setEnviando(false);
        return;
      }

      const { data: nuevaEmpresa, error: errorEmpresa } = await supabase
        .from('empresas')
        .insert({ nombre: nombreNuevaEmpresa.trim(), rubro: rubroNuevaEmpresa.trim() || null })
        .select('id, numero_cliente')
        .single();

      if (errorEmpresa || !nuevaEmpresa) {
        onError(`No se pudo crear la empresa: ${errorEmpresa?.message ?? 'error desconocido'}.`);
        setEnviando(false);
        return;
      }

      empresaDestinoId = nuevaEmpresa.id;
      numeroClienteNuevo = nuevaEmpresa.numero_cliente;
    }

    const { error: errorVincular } = await supabase.rpc('vincular_usuario_a_empresa', {
      p_email: email.trim(),
      p_empresa_id: empresaDestinoId,
      p_rol: rol,
      p_nombre: nombre.trim(),
    });

    if (errorVincular) {
      onError(`No se pudo vincular: ${errorVincular.message}`);
      setEnviando(false);
      return;
    }

    onCreado(
      numeroClienteNuevo !== null
        ? `${nombre.trim()} quedó vinculado/a correctamente a la empresa nueva (Cliente #${numeroClienteNuevo}).`
        : `${nombre.trim()} quedó vinculado/a correctamente.`
    );
    limpiar();
    setEnviando(false);
  }

  return (
    <div
      style={{
        background: COLORES_BASE.blanco,
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: 22,
        marginBottom: 24,
        boxShadow: '0 10px 24px rgba(31,58,95,0.06)',
      }}
    >
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 800, color: COLORES_BASE.azul }}>
          👤 Vincular usuario a empresa
        </span>
        <span style={{ color: COLORES_BASE.gris, fontSize: 13 }}>{abierta ? '▾ ocultar' : '▸ mostrar'}</span>
      </button>

      {abierta && (
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: 13, color: COLORES_BASE.gris, marginTop: 0, marginBottom: 16 }}>
            Primero creá el usuario en Supabase Auth con su email y contraseña. Después pegá ese mismo email
            acá y elegí a qué empresa pertenece — si la empresa todavía no existe, la creás desde el mismo
            formulario.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Email (el mismo del usuario en Supabase Auth)</label>
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>

            <div>
              <label style={labelStyle}>Nombre de la persona</label>
              <input
                style={inputStyle}
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Brenda"
              />
            </div>

            <div>
              <label style={labelStyle}>Rol</label>
              <select style={inputStyle} value={rol} onChange={(e) => setRol(e.target.value as 'Cliente' | 'Admin')}>
                <option value="Cliente">Cliente</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Empresa</label>
              <select style={inputStyle} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                <option value="__nueva__">+ Crear empresa nueva</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre} (#{empresa.numero_cliente})
                  </option>
                ))}
              </select>
            </div>

            {empresaId === '__nueva__' && (
              <>
                <div>
                  <label style={labelStyle}>Nombre de la empresa nueva</label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={nombreNuevaEmpresa}
                    onChange={(e) => setNombreNuevaEmpresa(e.target.value)}
                    placeholder="Ej: Mi Nuevo Cliente"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Rubro (opcional)</label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={rubroNuevaEmpresa}
                    onChange={(e) => setRubroNuevaEmpresa(e.target.value)}
                    placeholder="Ej: Venta de ropa"
                  />
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            disabled={enviando}
            onClick={vincular}
            style={{
              marginTop: 18,
              padding: '11px 22px',
              borderRadius: 10,
              border: 'none',
              background: COLORES_BASE.verde,
              color: COLORES_BASE.blanco,
              fontWeight: 700,
              fontSize: 14,
              cursor: enviando ? 'wait' : 'pointer',
              opacity: enviando ? 0.7 : 1,
            }}
          >
            {enviando ? 'Vinculando...' : 'Vincular'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   PROBAR FORMULARIO DE BIENVENIDA — crea una empresa de prueba con
   el perfil elegido (el formulario de /bienvenida cambia según el
   perfil: categoría de producto vs. de servicio, si pide Productos,
   las etiquetas de Clientes/Proveedores, etc.) y entra directo a
   ella, sin tener que pasar por todo el flujo de Crear conta +
   aprobar solicitud cada vez que se quiere probar un caso.
========================================================== */

const OPCIONES_COMPONENTES_MIXTO = [
  { valor: 'COMERCIAL', etiqueta: 'Comercial' },
  { valor: 'SERVICIOS', etiqueta: 'Servicios' },
  { valor: 'PRODUCCION', etiqueta: 'Producción' },
];

function ProbarFormularioBienvenida({ onError }: { onError: (mensaje: string) => void }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [perfiles, setPerfiles] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [perfilElegido, setPerfilElegido] = useState('');
  const [componentesMixto, setComponentesMixto] = useState<string[]>([]);
  const [idioma, setIdioma] = useState<'ES' | 'PT'>('ES');
  const [moneda, setMoneda] = useState('ARS');
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!abierta || perfiles.length > 0) return;

    supabase
      .from('perfiles_empresa')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .order('nombre', { ascending: true })
      .then(({ data }) => {
        setPerfiles(data ?? []);
        if (data && data.length > 0) setPerfilElegido((actual) => actual || data[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  function alternarComponente(valor: string) {
    setComponentesMixto((actual) =>
      actual.includes(valor) ? actual.filter((c) => c !== valor) : [...actual, valor]
    );
  }

  const perfilCodigo = perfiles.find((p) => p.id === perfilElegido)?.codigo;
  const esMixto = perfilCodigo === 'MIXTO';

  async function crearYEntrar() {
    if (!perfilElegido) {
      onError('Elegí un perfil.');
      return;
    }

    if (esMixto && componentesMixto.length === 0) {
      onError('Elegí al menos un componente de Mixto.');
      return;
    }

    if (!sexo) {
      onError('Elegí el sexo (define el avatar por defecto de la empresa de prueba).');
      return;
    }

    setCreando(true);

    const perfilNombre = perfiles.find((p) => p.id === perfilElegido)?.nombre ?? perfilCodigo ?? 'Prueba';
    const nombreEmpresa = `Prueba — ${perfilNombre} (${new Date().toLocaleString('es-AR')})`;

    try {
      const { data: existeNombre, error: errorNombreDuplicado } = await supabase.rpc('existe_nombre_empresa', {
        p_nombre: nombreEmpresa,
      });

      if (errorNombreDuplicado) {
        throw new Error(errorNombreDuplicado.message);
      }

      if (existeNombre) {
        throw new Error('Ya existe una empresa con ese nombre justo ahora — probá de nuevo en un segundo.');
      }

      const { data: nuevaEmpresa, error: errorEmpresa } = await supabase
        .from('empresas')
        .insert({
          nombre: nombreEmpresa,
          rubro: 'Empresa de prueba',
          moneda,
          idioma,
          logo_url: avatarPorDefecto(sexo),
          onboarding_completado: false,
        })
        .select('id')
        .single();

      if (errorEmpresa || !nuevaEmpresa) {
        throw new Error(errorEmpresa?.message ?? 'No se pudo crear la empresa de prueba.');
      }

      const { error: errorPerfilEmpresa } = await supabase
        .from('empresas')
        .update({ perfil_empresa_id: perfilElegido })
        .eq('id', nuevaEmpresa.id);

      if (errorPerfilEmpresa) {
        throw new Error(errorPerfilEmpresa.message);
      }

      if (esMixto && componentesMixto.length > 0) {
        const { error: errorComponentes } = await supabase
          .from('empresa_mixto_componentes')
          .insert(componentesMixto.map((componente) => ({ empresa_id: nuevaEmpresa.id, componente })));

        if (errorComponentes) {
          throw new Error(errorComponentes.message);
        }
      }

      await inicializarEmpresaDesdePerfil(nuevaEmpresa.id, perfilElegido, idioma, moneda);

      // Mismo mecanismo que "descender a un universo" en el hero de
      // esta pantalla: el admin no tiene una empresa propia fija,
      // así que entrar a una es simplemente apuntar su perfil ahí.
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        throw new Error('No se pudo identificar tu usuario.');
      }

      const { error: errorEntrar } = await supabase
        .from('perfiles')
        .update({ empresa_id: nuevaEmpresa.id })
        .eq('id', userData.user.id);

      if (errorEntrar) {
        throw new Error('La empresa de prueba se creó, pero no se pudo entrar automáticamente — buscala en "Empresas activas" y entrá a mano.');
      }

      router.push('/');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo crear la empresa de prueba.');
      setCreando(false);
    }
  }

  return (
    <div
      style={{
        background: COLORES_BASE.blanco,
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: 22,
        marginBottom: 24,
        boxShadow: '0 10px 24px rgba(31,58,95,0.06)',
      }}
    >
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 800, color: COLORES_BASE.azul }}>
          🧪 Probar formulario de bienvenida
        </span>
        <span style={{ color: COLORES_BASE.gris, fontSize: 13 }}>{abierta ? '▾ ocultar' : '▸ mostrar'}</span>
      </button>

      {abierta && (
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: 13, color: COLORES_BASE.gris, marginTop: 0, marginBottom: 16 }}>
            Crea una empresa de prueba (nombrada "Prueba — ...") con el perfil que elijas acá abajo, con su
            plan de cuentas ya armado, y te entra directo al formulario de Configuração inicial tal como lo
            vería un cliente nuevo con ese perfil — sin tener que pasar por Criar conta y aprobar una
            solicitud. Cuando termines de probar, borrala desde "Empresas activas" (🗑️) como cualquier otra.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Perfil</label>
              <select style={inputStyle} value={perfilElegido} onChange={(e) => setPerfilElegido(e.target.value)}>
                {perfiles.length === 0 && <option value="">Cargando...</option>}
                {perfiles.map((perfil) => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Idioma</label>
              <select style={inputStyle} value={idioma} onChange={(e) => setIdioma(e.target.value as 'ES' | 'PT')}>
                <option value="ES">Español</option>
                <option value="PT">Português</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Moneda (define AR/BR en el plan de cuentas)</label>
              <select style={inputStyle} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                <option value="ARS">Peso argentino (ARS)</option>
                <option value="BRL">Real brasileño (BRL)</option>
                <option value="USD">Dólar (USD)</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Sexo (define el avatar por defecto)</label>
              <select style={inputStyle} value={sexo} onChange={(e) => setSexo(e.target.value as 'M' | 'F' | '')}>
                <option value="">Seleccionar...</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </select>
            </div>

            {esMixto && (
              <div>
                <label style={labelStyle}>Componentes de Mixto</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 8 }}>
                  {OPCIONES_COMPONENTES_MIXTO.map((opcion) => (
                    <label key={opcion.valor} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={componentesMixto.includes(opcion.valor)}
                        onChange={() => alternarComponente(opcion.valor)}
                      />
                      {opcion.etiqueta}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={creando}
            onClick={crearYEntrar}
            style={{
              marginTop: 18,
              padding: '11px 22px',
              borderRadius: 10,
              border: 'none',
              background: COLORES_BASE.verde,
              color: COLORES_BASE.blanco,
              fontWeight: 700,
              fontSize: 14,
              cursor: creando ? 'wait' : 'pointer',
              opacity: creando ? 0.7 : 1,
            }}
          >
            {creando ? 'Creando...' : 'Crear y entrar'}
          </button>
        </div>
      )}
    </div>
  );
}

