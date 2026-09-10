'use client';

// PANEL MAESTRO → AUDITORÍA DE ACTIVIDAD (Bloque F, Día 1 de seguridad)
//
// Registro append-only de eventos sensibles: sesiones, altas/bajas de
// roles, invitaciones, consentimientos, solicitudes de eliminación de
// cuenta, exportaciones de datos, accesos del Desarrollador a una
// empresa ajena, y cambios en datos financieros críticos (operaciones,
// plan de cuentas, reglas contables). La captura es automática (ver
// migración bloque_f_auditoria_de_actividad) — esta pantalla solo lee.
//
// Exclusivo del Desarrollador (es_admin_plataforma). No hay una
// versión de esto para el Cliente: si un cliente pide su historial,
// el Desarrollador lo genera acá (filtrando por su empresa), lo
// exporta en PDF y se lo entrega personalmente.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type EventoAuditoria = {
  id: string;
  actor_id: string | null;
  empresa_id: string | null;
  tipo_evento: string;
  detalle: Record<string, unknown>;
  creado_en: string;
};

const ETIQUETAS_TIPO: Record<string, string> = {
  login_exitoso: '🔓 Login exitoso',
  login_fallido: '⛔ Login fallido',
  cuenta_desactivada_intento: '🚫 Intento con cuenta desactivada',
  cambio_tipo_usuario: '🔁 Cambio de tipo de usuario',
  baja_perfil: '📤 Baja de perfil',
  reactivacion_perfil: '📥 Reactivación de perfil',
  invitacion_creada: '✉️ Invitación creada',
  invitacion_aceptada: '✅ Invitación aceptada',
  invitacion_revocada: '🗑️ Invitación revocada',
  invitacion_cambio_estado: '✉️ Invitación — cambio de estado',
  consentimiento_aceptado: '📜 Consentimiento legal aceptado',
  solicitud_eliminacion_cuenta: '🧹 Solicitud de eliminación de cuenta',
  exportacion_datos_personales: '📄 Exportación de datos personales',
  panel_maestro_acceso_empresa: '🔱 Acceso del Desarrollador a una empresa',
  operacion_creada: '💰 Operación creada',
  operacion_editada: '✏️ Operación editada',
  operacion_eliminada: '🗑️ Operación eliminada',
  cuenta_creada: '📒 Cuenta del plan creada',
  cuenta_editada: '📒 Cuenta del plan editada',
  cuenta_eliminada: '📒 Cuenta del plan eliminada',
  regla_contable_creada: '⚙️ Regla contable creada',
  regla_contable_editada: '⚙️ Regla contable editada',
  regla_contable_eliminada: '⚙️ Regla contable eliminada',
};

function etiquetaTipo(tipo: string): string {
  return ETIQUETAS_TIPO[tipo] ?? tipo;
}

function resumenDetalle(evento: EventoAuditoria): string {
  const d = evento.detalle ?? {};
  switch (evento.tipo_evento) {
    case 'login_fallido':
      return `email: ${d.email ?? '—'}`;
    case 'cambio_tipo_usuario':
      return `${d.de ?? '?'} → ${d.a ?? '?'}`;
    case 'invitacion_creada':
    case 'invitacion_aceptada':
    case 'invitacion_revocada':
    case 'invitacion_cambio_estado':
      return `${d.tipo_usuario ?? ''} · ${d.email ?? ''}`;
    case 'operacion_creada':
    case 'operacion_editada':
    case 'operacion_eliminada':
      return `${d.id_operacion ?? ''} · ${d.operacion ?? ''} · ${d.total ?? ''}`;
    case 'cuenta_creada':
    case 'cuenta_editada':
    case 'cuenta_eliminada':
      return `${d.codigo ?? ''} · ${d.nombre ?? ''}`;
    case 'regla_contable_creada':
    case 'regla_contable_editada':
    case 'regla_contable_eliminada':
      return `${d.operacion ?? ''} · ${d.categoria_nombre ?? ''}`;
    case 'solicitud_eliminacion_cuenta':
      return d.motivo ? String(d.motivo) : '—';
    default:
      return Object.keys(d).length > 0 ? JSON.stringify(d) : '—';
  }
}

export default function AuditoriaPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([]);
  const [perfiles, setPerfiles] = useState<{ id: string; nombre: string }[]>([]);
  const [error, setError] = useState('');

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEmpresaId, setFiltroEmpresaId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const empresaPorId = useMemo(() => Object.fromEntries(empresas.map((e) => [e.id, e.nombre])), [empresas]);
  const perfilPorId = useMemo(() => Object.fromEntries(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);

  async function cargarEventos() {
    let query = supabase
      .from('auditoria_eventos')
      .select('id, actor_id, empresa_id, tipo_evento, detalle, creado_en')
      .order('creado_en', { ascending: false })
      .limit(500);

    if (filtroTipo) query = query.eq('tipo_evento', filtroTipo);
    if (filtroEmpresaId) query = query.eq('empresa_id', filtroEmpresaId);
    if (desde) query = query.gte('creado_en', `${desde}T00:00:00`);
    if (hasta) query = query.lte('creado_en', `${hasta}T23:59:59`);

    const { data, error: errorEventos } = await query;

    if (errorEventos) {
      setError(`No se pudieron cargar los eventos: ${errorEventos.message}`);
      return;
    }

    setEventos((data ?? []) as EventoAuditoria[]);
  }

  useEffect(() => {
    async function verificar() {
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

      const [{ data: empresasData }, { data: perfilesData }] = await Promise.all([
        supabase.from('empresas').select('id, nombre').order('nombre'),
        supabase.from('perfiles').select('id, nombre'),
      ]);

      setEmpresas(empresasData ?? []);
      setPerfiles(perfilesData ?? []);
      setAutorizado(true);
      setCargando(false);
    }

    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (autorizado) cargarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizado, filtroTipo, filtroEmpresaId, desde, hasta]);

  const logoImgTagUrl = `<img src="${typeof window !== 'undefined' ? window.location.origin : ''}/logo.jpeg" alt="Visão Financeira" />`;

  function exportarPdf() {
    const nombreEmpresaFiltro = filtroEmpresaId ? empresaPorId[filtroEmpresaId] : '';
    const titulo = nombreEmpresaFiltro
      ? `Auditoría de Actividad — ${nombreEmpresaFiltro}`
      : 'Auditoría de Actividad — Visão Financeira';

    const filasHtml = eventos
      .map(
        (ev) => `
        <tr>
          <td>${new Date(ev.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
          <td>${etiquetaTipo(ev.tipo_evento)}</td>
          <td>${ev.actor_id ? (perfilPorId[ev.actor_id] ?? '—') : '—'}</td>
          <td>${ev.empresa_id ? (empresaPorId[ev.empresa_id] ?? '—') : '—'}</td>
          <td>${resumenDetalle(ev).replace(/</g, '&lt;')}</td>
        </tr>`
      )
      .join('');

    const rangoTexto = desde || hasta ? `Rango: ${desde || '...'} a ${hasta || '...'}` : 'Todos los registros disponibles (últimos 500)';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; background: #f5f7f9; margin: 0; padding: 32px 16px; color: #1f2937; }
  .hoja { max-width: 960px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 40px; box-shadow: 0 10px 30px rgba(31,58,95,0.08); }
  .encabezado { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #1f3a5f; padding-bottom: 20px; margin-bottom: 20px; }
  .encabezado img { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; }
  .encabezado h1 { margin: 0; font-size: 20px; color: #1f3a5f; }
  .encabezado p { margin: 4px 0 0; font-size: 12.5px; color: #6e7781; }
  .meta { font-size: 12px; color: #6e7781; margin-bottom: 22px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th { text-align: left; background: #f8fafc; padding: 8px 10px; color: #1f3a5f; border-bottom: 2px solid #e5e7eb; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .pie { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; }
  .no-imprimir { text-align: center; margin-bottom: 20px; }
  .no-imprimir button { background: #2e8b57; color: white; border: none; border-radius: 10px; padding: 10px 20px; font-weight: 700; font-size: 14px; cursor: pointer; }
  @media print {
    .no-imprimir { display: none !important; }
    body { background: #fff; padding: 0; }
    .hoja { box-shadow: none; border-radius: 0; max-width: 100%; }
  }
</style>
</head>
<body>
  <div class="no-imprimir"><button onclick="window.print()">🖨️ Guardar como PDF</button></div>
  <div class="hoja">
    <div class="encabezado">
      ${logoImgTagUrl}
      <div>
        <h1>${titulo}</h1>
        <p>Documento confidencial de uso interno — generado por el Desarrollador de Visão Financeira</p>
      </div>
    </div>
    <div class="meta">Generado el ${new Date().toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })} · ${rangoTexto} · ${eventos.length} evento${eventos.length === 1 ? '' : 's'}</div>
    <table>
      <thead><tr><th>Fecha</th><th>Evento</th><th>Actor</th><th>Empresa</th><th>Detalle</th></tr></thead>
      <tbody>${filasHtml}</tbody>
    </table>
    <div class="pie">Visão Financeira · Auditoría de Actividad — no distribuir fuera de la persona/empresa involucrada</div>
  </div>
</body>
</html>`;

    const ventana = window.open('', '_blank');
    if (!ventana) {
      setError('El navegador bloqueó la ventana nueva. Permití ventanas emergentes para este sitio e intentá de nuevo.');
      return;
    }
    ventana.document.write(html);
    ventana.document.close();
  }

  if (cargando || !autorizado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f9', color: COLORES.azul, fontWeight: 600 }}>
        Cargando auditoría...
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f7f9', padding: 24 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <Link href="/panel-maestro" style={{ color: COLORES.gris, fontSize: 13, textDecoration: 'none', fontWeight: 700 }}>
            ← Volver al Panel Maestro
          </Link>
          <button
            onClick={exportarPdf}
            style={{ background: COLORES.verde, color: COLORES.blanco, border: 'none', borderRadius: 12, padding: '10px 18px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}
          >
            🖨️ Exportar como PDF
          </button>
        </div>

        <h1 style={{ fontSize: 24, color: COLORES.azul, marginBottom: 4 }}>🕵️ Auditoría de Actividad</h1>
        <p style={{ fontSize: 13, color: COLORES.gris, marginTop: 0, marginBottom: 20 }}>
          Registro de eventos sensibles (sesiones, roles, invitaciones, consentimientos, exportaciones y cambios
          financieros críticos). Solo vos lo ves — si un cliente pide su historial, filtrá por su empresa,
          exportalo en PDF y entregáselo directamente.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ background: COLORES.blanco, border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: COLORES.gris, display: 'block', marginBottom: 4 }}>Tipo de evento</label>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={selectStyle}>
              <option value="">Todos</option>
              {Object.entries(ETIQUETAS_TIPO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: COLORES.gris, display: 'block', marginBottom: 4 }}>Empresa</label>
            <select value={filtroEmpresaId} onChange={(e) => setFiltroEmpresaId(e.target.value)} style={selectStyle}>
              <option value="">Todas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: COLORES.gris, display: 'block', marginBottom: 4 }}>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={selectStyle} />
          </div>

          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: COLORES.gris, display: 'block', marginBottom: 4 }}>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={selectStyle} />
          </div>
        </div>

        <div style={{ background: COLORES.blanco, border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Evento</th>
                  <th style={thStyle}>Actor</th>
                  <th style={thStyle}>Empresa</th>
                  <th style={thStyle}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={tdStyle}>{new Date(ev.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={tdStyle}>{etiquetaTipo(ev.tipo_evento)}</td>
                    <td style={tdStyle}>{ev.actor_id ? (perfilPorId[ev.actor_id] ?? '—') : '—'}</td>
                    <td style={tdStyle}>{ev.empresa_id ? (empresaPorId[ev.empresa_id] ?? '—') : '—'}</td>
                    <td style={{ ...tdStyle, color: '#6e7781' }}>{resumenDetalle(ev)}</td>
                  </tr>
                ))}
                {eventos.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: COLORES.gris, padding: 24 }}>
                      No hay eventos con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ fontSize: 11.5, color: COLORES.gris, marginTop: 10 }}>
          Se muestran hasta 500 eventos por consulta, más recientes primero. Usá los filtros para acotar.
        </p>
      </div>
    </main>
  );
}

const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d7dde3', fontSize: 13, boxSizing: 'border-box' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: '#1f3a5f', fontWeight: 800, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.3 };
const tdStyle: React.CSSProperties = { padding: '8px 12px', color: '#1f2937' };
