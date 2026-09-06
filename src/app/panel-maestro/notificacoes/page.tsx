'use client';

// PANEL MAESTRO → NOTIFICAÇÕES
//
// El Panel Maestro (lobby del admin) mudó acá todo lo que antes vivía
// ahí resolviendo cosas puntuales — Solicitudes de alta y Pendientes
// de validar — porque una vez resueltas, desaparecían sin dejar
// rastro. Acá quedan dos pestañas: "Pendientes" (lo mismo de siempre,
// accionable) e "Historial" (lo que ya se resolvió, para no perder
// el registro de lo que se fue haciendo).
//
// Primera pantalla de administración fuera del lobby — la idea es
// que el Panel Maestro vaya sumando más accesos como este con el
// tiempo, en vez de acumular todo en una sola pantalla.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { avatarPorDefecto } from '@/lib/avatares';
import { inicializarEmpresaDesdePerfil } from '@/lib/perfiles';
import { eliminarOperacion } from '@/lib/motor';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import type { Empresa, Pendiente, PendienteRegistro, PendienteMovimiento, SolicitudAlta, SolicitudAltaResuelta } from '@/lib/panelMaestroTipos';
import { SolicitudesAlta } from '@/components/panel-maestro/SolicitudesAlta';
import { NotificacionesPendientes } from '@/components/panel-maestro/NotificacionesPendientes';

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type OperacionValidada = {
  tipo: 'registro' | 'movimiento';
  empresaId: string;
  idOperacion: string;
  detalle: string;
  total: number;
  creadoEn: string;
};

type Tab = 'pendientes' | 'historial';

export default function NotificacoesPage() {
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<Tab>('pendientes');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudAlta[]>([]);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [solicitudesHistorial, setSolicitudesHistorial] = useState<SolicitudAltaResuelta[]>([]);
  const [operacionesHistorial, setOperacionesHistorial] = useState<OperacionValidada[]>([]);

  const [resolviendoSolicitud, setResolviendoSolicitud] = useState<string | null>(null);
  const [validando, setValidando] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);

  async function cargarEmpresas() {
    const { data } = await supabase
      .from('empresas')
      .select(
        'id, nombre, rubro, logo_url, numero_cliente, moneda, fecha_vencimiento_suscripcion, creado_en, validacion_automatica, perfiles_empresa(nombre)'
      )
      .eq('activo', true)
      .order('numero_cliente', { ascending: true });

    setEmpresas((data ?? []) as unknown as Empresa[]);
  }

  async function cargarSolicitudesPendientes() {
    const { data, error: errorSolicitudes } = await supabase
      .from('solicitudes_alta')
      .select(
        'id, user_id, email, nombre, sexo, telefono, nombre_empresa, rubro, moneda, idioma, perfil_empresa_id, componentes_mixto, creado_en, perfiles_empresa(nombre, codigo)'
      )
      .eq('estado', 'PENDIENTE')
      .order('creado_en', { ascending: true });

    if (errorSolicitudes) {
      console.warn('No se pudieron cargar las solicitudes de alta:', errorSolicitudes);
      return;
    }

    setSolicitudes((data ?? []) as unknown as SolicitudAlta[]);
  }

  async function cargarSolicitudesHistorial() {
    const { data, error: errorHistorial } = await supabase
      .from('solicitudes_alta')
      .select(
        'id, user_id, email, nombre, sexo, telefono, nombre_empresa, rubro, moneda, idioma, perfil_empresa_id, componentes_mixto, creado_en, estado, resuelto_en, perfiles_empresa(nombre, codigo)'
      )
      .neq('estado', 'PENDIENTE')
      .order('resuelto_en', { ascending: false })
      .limit(50);

    if (errorHistorial) {
      console.warn('No se pudo cargar el historial de solicitudes:', errorHistorial);
      return;
    }

    setSolicitudesHistorial((data ?? []) as unknown as SolicitudAltaResuelta[]);
  }

  async function cargarPendientesOperaciones() {
    const [{ data: registros, error: errorRegistros }, { data: movimientos, error: errorMovimientos }] = await Promise.all([
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

  // "Historial" de operaciones: no hay una columna que diga cuándo se
  // validó (solo `creado_en`, que es cuándo se cargó), así que esto
  // muestra las últimas operaciones que HOY están en estado VALIDADO
  // — una aproximación razonable, no un log exacto de validaciones.
  // Un rechazo, en cambio, borra la operación por completo (ver
  // rechazarRegistro/rechazarMovimiento) y no deja rastro posible acá.
  async function cargarOperacionesHistorial() {
    const [{ data: registros, error: errorRegistros }, { data: movimientos, error: errorMovimientos }] = await Promise.all([
      supabase
        .from('registro_operaciones')
        .select('empresa_id, id_operacion, operacion, categoria, total, historico, creado_en')
        .eq('estado', 'VALIDADO')
        .order('creado_en', { ascending: false })
        .limit(50),

      supabase
        .from('movimientos_stock')
        .select('empresa_id, id_operacion, cantidad, costo_unitario, creado_en')
        .eq('estado', 'VALIDADO')
        .order('creado_en', { ascending: false })
        .limit(50),
    ]);

    if (errorRegistros) console.warn('No se pudo cargar el historial de registros:', errorRegistros);
    if (errorMovimientos) console.warn('No se pudo cargar el historial de movimientos:', errorMovimientos);

    const deRegistros: OperacionValidada[] = (registros ?? []).map((r) => ({
      tipo: 'registro',
      empresaId: r.empresa_id,
      idOperacion: r.id_operacion,
      detalle: `${r.operacion} · ${r.categoria}${r.historico ? ` · ${r.historico}` : ''}`,
      total: Number(r.total ?? 0),
      creadoEn: r.creado_en,
    }));

    const movimientosAgrupados = new Map<string, OperacionValidada>();

    for (const m of movimientos ?? []) {
      const clave = `${m.empresa_id}|${m.id_operacion}`;
      const actual = movimientosAgrupados.get(clave);
      const importe = Number(m.cantidad ?? 0) * Number(m.costo_unitario ?? 0);

      if (actual) {
        actual.total += importe;
      } else {
        movimientosAgrupados.set(clave, {
          tipo: 'movimiento',
          empresaId: m.empresa_id,
          idOperacion: m.id_operacion,
          detalle: 'Movimiento de mercadería',
          total: importe,
          creadoEn: m.creado_en,
        });
      }
    }

    setOperacionesHistorial(
      [...deRegistros, ...movimientosAgrupados.values()]
        .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))
        .slice(0, 50)
    );
  }

  async function cargarTodo() {
    await Promise.all([
      cargarEmpresas(),
      cargarSolicitudesPendientes(),
      cargarSolicitudesHistorial(),
      cargarPendientesOperaciones(),
      cargarOperacionesHistorial(),
    ]);
  }

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('es_admin_plataforma')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.es_admin_plataforma) {
        router.push('/');
        return;
      }

      await cargarTodo();
      setCargando(false);
    }

    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function aprobarSolicitud(solicitud: SolicitudAlta, modoAutomatico: boolean) {
    setError('');
    setMensaje('');
    setResolviendoSolicitud(solicitud.id);

    try {
      const { data: existeNombre, error: errorNombreDuplicado } = await supabase.rpc('existe_nombre_empresa', {
        p_nombre: solicitud.nombre_empresa,
        p_excluir_solicitud_id: solicitud.id,
      });

      if (errorNombreDuplicado) {
        throw new Error(errorNombreDuplicado.message);
      }

      if (existeNombre) {
        throw new Error(
          `Ya existe una empresa (u otra solicitud pendiente) con el nombre "${solicitud.nombre_empresa}". Rechazá esta solicitud y pedile al interesado que la reenvíe con un nombre distinto.`
        );
      }

      const { data: nuevaEmpresa, error: errorEmpresa } = await supabase
        .from('empresas')
        .insert({
          nombre: solicitud.nombre_empresa,
          rubro: solicitud.rubro,
          telefono: solicitud.telefono,
          email: solicitud.email,
          moneda: solicitud.moneda,
          idioma: solicitud.idioma,
          logo_url: avatarPorDefecto(solicitud.sexo),
          onboarding_completado: false,
          validacion_automatica: modoAutomatico,
        })
        .select('id, numero_cliente')
        .single();

      if (errorEmpresa || !nuevaEmpresa) {
        throw new Error(errorEmpresa?.message ?? 'No se pudo crear la empresa.');
      }

      const { error: errorPerfilEmpresa } = await supabase
        .from('empresas')
        .update({ perfil_empresa_id: solicitud.perfil_empresa_id })
        .eq('id', nuevaEmpresa.id);

      if (errorPerfilEmpresa) {
        throw new Error(errorPerfilEmpresa.message);
      }

      if (solicitud.componentes_mixto.length > 0) {
        const { error: errorComponentes } = await supabase
          .from('empresa_mixto_componentes')
          .insert(solicitud.componentes_mixto.map((componente) => ({ empresa_id: nuevaEmpresa.id, componente })));

        if (errorComponentes) {
          throw new Error(errorComponentes.message);
        }
      }

      await inicializarEmpresaDesdePerfil(nuevaEmpresa.id, solicitud.perfil_empresa_id, solicitud.idioma, solicitud.moneda);

      const { error: errorVincular } = await supabase.rpc('vincular_usuario_a_empresa', {
        p_email: solicitud.email,
        p_empresa_id: nuevaEmpresa.id,
        p_rol: 'Cliente',
        p_nombre: solicitud.nombre,
      });

      if (errorVincular) {
        throw new Error(errorVincular.message);
      }

      const { error: errorCerrarSolicitud } = await supabase
        .from('solicitudes_alta')
        .update({ estado: 'APROBADA', empresa_id: nuevaEmpresa.id, resuelto_en: new Date().toISOString() })
        .eq('id', solicitud.id);

      if (errorCerrarSolicitud) {
        throw new Error(errorCerrarSolicitud.message);
      }

      setMensaje(
        `${solicitud.nombre_empresa} quedó dado de alta como Cliente #${nuevaEmpresa.numero_cliente} (modo ${
          modoAutomatico ? 'Automático' : 'Manual'
        }), con su plan de cuentas listo.`
      );
      await cargarEmpresas();
      await cargarSolicitudesPendientes();
      await cargarSolicitudesHistorial();
    } catch (errorAprobar) {
      setError(
        `No se pudo aprobar la solicitud de ${solicitud.nombre_empresa}: ${
          errorAprobar instanceof Error ? errorAprobar.message : 'error desconocido'
        }`
      );
    }

    setResolviendoSolicitud(null);
  }

  async function rechazarSolicitud(solicitud: SolicitudAlta) {
    setError('');
    setMensaje('');
    setResolviendoSolicitud(solicitud.id);

    const { error: errorRechazar } = await supabase
      .from('solicitudes_alta')
      .update({ estado: 'RECHAZADA', resuelto_en: new Date().toISOString() })
      .eq('id', solicitud.id);

    if (errorRechazar) {
      setError(`No se pudo rechazar la solicitud: ${errorRechazar.message}`);
    } else {
      setMensaje(`Solicitud de ${solicitud.nombre_empresa} rechazada.`);
      await cargarSolicitudesPendientes();
      await cargarSolicitudesHistorial();
    }

    setResolviendoSolicitud(null);
  }

  async function validarRegistro(pendiente: PendienteRegistro) {
    setError('');
    setMensaje('');
    setValidando(`registro-${pendiente.idOperacion}`);

    const { error: errorValidar } = await supabase
      .from('registro_operaciones')
      .update({ estado: 'VALIDADO' })
      .eq('empresa_id', pendiente.empresaId)
      .eq('id_operacion', pendiente.idOperacion);

    if (errorValidar) {
      setError(`No se pudo validar ${pendiente.idOperacion}.`);
    } else {
      setMensaje(`${pendiente.idOperacion} validada.`);
      await cargarPendientesOperaciones();
      await cargarOperacionesHistorial();
    }

    setValidando(null);
  }

  async function validarMovimiento(pendiente: PendienteMovimiento) {
    setError('');
    setMensaje('');
    setValidando(`movimiento-${pendiente.idOperacion}`);

    const [{ error: errorMovimiento }, { error: errorAutomatico }] = await Promise.all([
      supabase
        .from('movimientos_stock')
        .update({ estado: 'VALIDADO' })
        .eq('empresa_id', pendiente.empresaId)
        .eq('id_operacion', pendiente.idOperacion),

      supabase
        .from('registros_automaticos')
        .update({ estado: 'VALIDADO' })
        .eq('empresa_id', pendiente.empresaId)
        .eq('id_operacion', pendiente.idOperacion),
    ]);

    if (errorMovimiento || errorAutomatico) {
      setError(`No se pudo validar el movimiento ${pendiente.idOperacion}.`);
    } else {
      setMensaje(`Movimiento ${pendiente.idOperacion} validado.`);
      await cargarPendientesOperaciones();
      await cargarOperacionesHistorial();
    }

    setValidando(null);
  }

  async function rechazarRegistro(pendiente: PendienteRegistro) {
    if (!window.confirm(`¿Rechazar y borrar por completo la operación ${pendiente.idOperacion}? No se puede deshacer.`)) {
      return;
    }

    setError('');
    setMensaje('');
    setRechazando(`registro-${pendiente.idOperacion}`);

    try {
      await eliminarOperacion(pendiente.empresaId, pendiente.idOperacion);
      setMensaje(`${pendiente.idOperacion} rechazada y borrada.`);
      await cargarPendientesOperaciones();
    } catch (errorRechazar) {
      setError(errorRechazar instanceof Error ? errorRechazar.message : `No se pudo rechazar ${pendiente.idOperacion}.`);
    }

    setRechazando(null);
  }

  async function rechazarMovimiento(pendiente: PendienteMovimiento) {
    if (!window.confirm(`¿Rechazar y borrar por completo el movimiento ${pendiente.idOperacion}? No se puede deshacer.`)) {
      return;
    }

    setError('');
    setMensaje('');
    setRechazando(`movimiento-${pendiente.idOperacion}`);

    try {
      await eliminarOperacion(pendiente.empresaId, pendiente.idOperacion);
      setMensaje(`Movimiento ${pendiente.idOperacion} rechazado y borrado.`);
      await cargarPendientesOperaciones();
    } catch (errorRechazar) {
      setError(
        errorRechazar instanceof Error ? errorRechazar.message : `No se pudo rechazar el movimiento ${pendiente.idOperacion}.`
      );
    }

    setRechazando(null);
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORES_BASE.gris }}>
        Cargando notificações...
      </div>
    );
  }

  const nombrePorEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));
  const simboloPorEmpresa = new Map(empresas.map((e) => [e.id, simboloMoneda(e.moneda)]));

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px 20px 60px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <Link href="/panel-maestro" style={{ color: COLORES_BASE.gris, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          ← Voltar para o Panel Maestro
        </Link>

        <h1 style={{ margin: '10px 0 4px', color: COLORES_BASE.azul, fontSize: 28 }}>🔔 Notificações</h1>
        <p style={{ margin: '0 0 24px', color: COLORES_BASE.gris, fontSize: 14 }}>
          Solicitudes de alta y operaciones pendientes de validar, de todas las empresas — con historial de lo ya resuelto.
        </p>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: 12,
              padding: '12px 16px',
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
              border: '1px solid #bbf7d0',
              color: '#166534',
              padding: '10px 16px',
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {mensaje}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(
            [
              { valor: 'pendientes' as const, etiqueta: `Pendientes (${solicitudes.length + pendientes.length})` },
              { valor: 'historial' as const, etiqueta: 'Historial' },
            ]
          ).map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => setTab(opcion.valor)}
              style={{
                padding: '9px 18px',
                borderRadius: 999,
                border: tab === opcion.valor ? 'none' : '1px solid #e5e7eb',
                background: tab === opcion.valor ? COLORES_BASE.azul : COLORES_BASE.blanco,
                color: tab === opcion.valor ? COLORES_BASE.blanco : COLORES_BASE.gris,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>

        {tab === 'pendientes' ? (
          <>
            <SolicitudesAlta
              solicitudes={solicitudes}
              resolviendo={resolviendoSolicitud}
              onAprobar={aprobarSolicitud}
              onRechazar={rechazarSolicitud}
            />

            <NotificacionesPendientes
              pendientes={pendientes}
              empresas={empresas}
              validando={validando}
              rechazando={rechazando}
              onValidarRegistro={validarRegistro}
              onValidarMovimiento={validarMovimiento}
              onRechazarRegistro={rechazarRegistro}
              onRechazarMovimiento={rechazarMovimiento}
            />
          </>
        ) : (
          <>
            <div
              style={{
                background: COLORES_BASE.blanco,
                border: '1px solid #e5e7eb',
                borderRadius: 20,
                padding: 22,
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORES_BASE.azul, marginBottom: 14 }}>
                📥 Solicitudes de alta resueltas
              </div>

              {solicitudesHistorial.length === 0 ? (
                <p style={{ color: COLORES_BASE.gris, fontSize: 13.5 }}>Todavía no se resolvió ninguna.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {solicitudesHistorial.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: '#f8fafc',
                        border: '1px solid #e5e7eb',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ fontSize: 13, color: COLORES_BASE.azul }}>
                        <strong>{s.nombre_empresa}</strong>{' '}
                        <span style={{ color: COLORES_BASE.gris }}>
                          · {s.nombre} · {s.email} ·{' '}
                          {new Date(s.resuelto_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: s.estado === 'APROBADA' ? '#f0fdf4' : '#fef2f2',
                          color: s.estado === 'APROBADA' ? '#166534' : '#b91c1c',
                        }}
                      >
                        {s.estado === 'APROBADA' ? 'Aprobada ✓' : 'Rechazada ✗'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                background: COLORES_BASE.blanco,
                border: '1px solid #e5e7eb',
                borderRadius: 20,
                padding: 22,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORES_BASE.azul, marginBottom: 4 }}>
                🧾 Últimas operaciones validadas
              </div>
              <p style={{ margin: '0 0 14px', color: COLORES_BASE.gris, fontSize: 12.5 }}>
                Las rechazadas no dejan rastro acá — se borran por completo al rechazarlas.
              </p>

              {operacionesHistorial.length === 0 ? (
                <p style={{ color: COLORES_BASE.gris, fontSize: 13.5 }}>Todavía no se validó ninguna.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {operacionesHistorial.map((o) => (
                    <div
                      key={`${o.tipo}-${o.empresaId}-${o.idOperacion}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: '#f8fafc',
                        border: '1px solid #e5e7eb',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ fontSize: 13, color: COLORES_BASE.azul }}>
                        <strong>{nombrePorEmpresa.get(o.empresaId) ?? 'Empresa'}</strong>{' '}
                        <span style={{ color: COLORES_BASE.gris }}>
                          · {o.idOperacion} · {o.detalle}
                        </span>
                        {' — '}
                        <span style={{ fontWeight: 700 }}>
                          {simboloPorEmpresa.get(o.empresaId) ?? 'R$'} {formatearNumeroEntero(o.total)}
                        </span>
                      </div>

                      <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: '#f0fdf4', color: '#166534' }}>
                        Validado ✓
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
