'use client';

// MIS DATOS (Bloque C del Día 1 de seguridad) — datos PERSONALES, no
// los de la empresa. Editable por cualquier usuario, sea admin de la
// empresa o no — es su propio dato, no algo que dependa de esAdmin.
//
// Extraído de app/configuracoes/page.tsx (antes vivía ahí mezclado con
// el resto de las pestañas) — mismo comportamiento, solo en su propio
// archivo.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioConfiguracoes } from '@/app/configuracoes/i18n';
import { COLORES, campo, label, inputFormulario, botonGuardar, botonSecundario, errorStyle, mensajeOkStyle, cargandoStyle } from './estilosCompartidos';

type DatosPersonales = { nombre: string; telefono: string | null; sexo: string | null };

export function MisDatosSeccion({ empresaId, idioma }: { empresaId: string; idioma: string }) {
  const t = crearTraductor(diccionarioConfiguracoes, idioma);

  const [cargando, setCargando] = useState(true);
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [datos, setDatos] = useState<DatosPersonales>({ nombre: '', telefono: '', sexo: '' });
  const [empresaExport, setEmpresaExport] = useState<{ nombre: string; rubro: string | null; moneda: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [solicitudEliminacion, setSolicitudEliminacion] = useState<{ estado: string; creado_en: string } | null>(null);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const [{ data: perfilData }, { data: empresaData }, { data: solicitudData }] = await Promise.all([
        supabase.from('perfiles').select('nombre, telefono, sexo').eq('id', userData.user.id).maybeSingle(),
        supabase.from('empresas').select('nombre, rubro, moneda').eq('id', empresaId).maybeSingle(),
        supabase
          .from('solicitudes_eliminacion_cuenta')
          .select('estado, creado_en')
          .eq('perfil_id', userData.user.id)
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setPerfilId(userData.user.id);
      setEmail(userData.user.email ?? '');
      setDatos({
        nombre: perfilData?.nombre ?? '',
        telefono: perfilData?.telefono ?? '',
        sexo: perfilData?.sexo ?? '',
      });
      setEmpresaExport(empresaData ?? null);
      setSolicitudEliminacion(solicitudData ?? null);
      setCargando(false);
    }

    cargar();
  }, [empresaId]);

  async function guardar() {
    if (!perfilId) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    const { error: errorGuardar } = await supabase
      .from('perfiles')
      .update({ nombre: datos.nombre.trim(), telefono: datos.telefono, sexo: datos.sexo })
      .eq('id', perfilId);

    setGuardando(false);

    if (errorGuardar) {
      setError(t('errorGuardarDatosPersonales'));
      return;
    }

    setMensaje(t('mensajeDatosPersonalesGuardados'));
  }

  async function descargarMisDatos() {
    const esPt = idioma === 'PT';

    // El logo se embebe como data URI (no como <img src="/logo.jpeg">)
    // para que el archivo se vea bien incluso abierto sin conexión,
    // fuera del dominio de la app.
    let logoDataUri = '';
    try {
      const respuestaLogo = await fetch('/logo.jpeg');
      const blobLogo = await respuestaLogo.blob();
      logoDataUri = await new Promise<string>((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result as string);
        lector.onerror = reject;
        lector.readAsDataURL(blobLogo);
      });
    } catch {
      logoDataUri = '';
    }

    const fecha = new Date().toLocaleString(esPt ? 'pt-BR' : 'es-AR', { dateStyle: 'long', timeStyle: 'short' });
    const sexoTexto = datos.sexo === 'F' ? (esPt ? 'Feminino' : 'Femenino') : datos.sexo === 'M' ? 'Masculino' : '—';

    const t2 = {
      titulo: esPt ? 'Meus Dados' : 'Mis Datos',
      subtitulo: esPt ? 'Exportação pessoal gerada pela própria pessoa usuária' : 'Exportación personal generada por la propia persona usuaria',
      generadoEl: esPt ? 'Gerado em' : 'Generado el',
      seccionPersonal: esPt ? '👤 Dados pessoais' : '👤 Datos personales',
      seccionEmpresa: esPt ? '🏢 Dados da empresa' : '🏢 Datos de la empresa',
      nombre: esPt ? 'Nome' : 'Nombre',
      telefono: esPt ? 'Telefone' : 'Teléfono',
      sexo: 'Sexo',
      correo: 'Email',
      nombreEmpresa: esPt ? 'Nome' : 'Nombre',
      rubro: esPt ? 'Ramo' : 'Rubro',
      moneda: esPt ? 'Moeda' : 'Moneda',
      notaAlcance: esPt
        ? 'Hoje este documento inclui apenas os dados de contato. No futuro vai incluir também a informação do seu Painel de Controle e Relatórios.'
        : 'Hoy este documento incluye solo los datos de contacto. En el futuro va a incluir también la información de tu Panel de Control e Informes.',
      disclaimerTitulo: esPt ? '⚠️ Aviso importante' : '⚠️ Aviso importante',
      disclaimer: esPt
        ? 'Este documento reflete exatamente a informação que você mesmo(a) carregou no sistema. A Visão Financeira não pode garantir que esses dados sejam verdadeiros ou estejam atualizados — só você sabe se essa informação é correta.'
        : 'Este documento refleja exactamente la información que vos mismo/a cargaste en el sistema. Visão Financeira no puede garantizar que esos datos sean verdaderos ni que estén actualizados — solo vos sabés si esa información es correcta.',
      pie: esPt
        ? 'Visão Financeira · Documento gerado a pedido da própria pessoa usuária'
        : 'Visão Financeira · Documento generado a pedido de la propia persona usuaria',
    };

    const nombreEmpresaDoc = empresaExport?.nombre?.trim() || (esPt ? 'minha empresa' : 'mi empresa');
    const tituloDocumento = `${t2.titulo} — ${nombreEmpresaDoc}`;

    const html = `<!DOCTYPE html>
<html lang="${esPt ? 'pt-BR' : 'es'}">
<head>
<meta charset="UTF-8">
<title>${tituloDocumento}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; background: #f5f7f9; margin: 0; padding: 32px 16px; color: #1f2937; }
  .hoja { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 40px; box-shadow: 0 10px 30px rgba(31,58,95,0.08); }
  .encabezado { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #1f3a5f; padding-bottom: 20px; margin-bottom: 24px; }
  .encabezado img { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; }
  .encabezado h1 { margin: 0; font-size: 22px; color: #1f3a5f; }
  .encabezado p { margin: 4px 0 0; font-size: 13px; color: #6e7781; }
  .meta { font-size: 12.5px; color: #6e7781; margin-bottom: 28px; }
  h2 { font-size: 15px; color: #1f3a5f; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin: 28px 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 0; font-size: 14px; }
  td.campo { color: #6e7781; width: 40%; font-weight: 600; }
  td.valor { color: #1f2937; }
  .aviso { margin-top: 32px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 16px 20px; }
  .aviso strong { color: #92400e; font-size: 13.5px; display: block; margin-bottom: 6px; }
  .aviso p { margin: 0; font-size: 12.5px; color: #78350f; line-height: 1.6; }
  .alcance { margin-top: 14px; font-size: 12px; color: #6e7781; font-style: italic; }
  .pie { margin-top: 32px; text-align: center; font-size: 11px; color: #9ca3af; }
  .no-imprimir { text-align: center; margin-bottom: 20px; }
  .no-imprimir button {
    background: #2e8b57; color: #fff; border: none; border-radius: 12px; padding: 10px 20px;
    font-weight: 700; font-size: 13.5px; cursor: pointer;
  }
  @media print {
    .no-imprimir { display: none !important; }
    body { background: #fff; padding: 0; }
    .hoja { box-shadow: none; border-radius: 0; max-width: 100%; }
  }
</style>
</head>
<body>
  <div class="no-imprimir">
    <button onclick="window.print()">🖨️ ${esPt ? 'Salvar como PDF' : 'Guardar como PDF'}</button>
  </div>

  <div class="hoja">
    <div class="encabezado">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="${nombreEmpresaDoc}">` : ''}
      <div>
        <h1>${t2.titulo} — ${nombreEmpresaDoc}</h1>
        <p>${t2.subtitulo}</p>
      </div>
    </div>

    <div class="meta">${t2.generadoEl}: ${fecha}</div>

    <h2>${t2.seccionPersonal}</h2>
    <table>
      <tr><td class="campo">${t2.nombre}</td><td class="valor">${datos.nombre || '—'}</td></tr>
      <tr><td class="campo">${t2.telefono}</td><td class="valor">${datos.telefono || '—'}</td></tr>
      <tr><td class="campo">${t2.sexo}</td><td class="valor">${sexoTexto}</td></tr>
      <tr><td class="campo">${t2.correo}</td><td class="valor">${email || '—'}</td></tr>
    </table>

    <h2>${t2.seccionEmpresa}</h2>
    <table>
      <tr><td class="campo">${t2.nombreEmpresa}</td><td class="valor">${empresaExport?.nombre || '—'}</td></tr>
      <tr><td class="campo">${t2.rubro}</td><td class="valor">${empresaExport?.rubro || '—'}</td></tr>
      <tr><td class="campo">${t2.moneda}</td><td class="valor">${empresaExport?.moneda || '—'}</td></tr>
    </table>

    <p class="alcance">${t2.notaAlcance}</p>

    <div class="aviso">
      <strong>${t2.disclaimerTitulo}</strong>
      <p>${t2.disclaimer}</p>
    </div>

    <div class="pie">${t2.pie}</div>
  </div>
</body>
</html>`;

    // Se abre en una pestaña nueva y se imprime desde ahí (mismo
    // mecanismo que el informe de Segurança e Proteção de Dados) en
    // vez de descargar un archivo: así la persona elige "Guardar como
    // PDF" desde el propio diálogo de impresión del navegador, con el
    // nombre de la empresa ya puesto como título del documento.
    const ventana = window.open('', '_blank');
    if (!ventana) {
      setError(
        esPt
          ? 'O navegador bloqueou a nova janela. Permita pop-ups para este site e tente de novo.'
          : 'El navegador bloqueó la ventana nueva. Permití ventanas emergentes para este sitio e intentá de nuevo.'
      );
      return;
    }

    // Auditoría (Bloque F): que alguien exportó sus propios datos
    // también queda registrado — no cambia lo que puede hacer, pero
    // completa el rastro de qué pasó con la información de esa cuenta.
    await supabase.rpc('registrar_evento_auditoria', {
      p_tipo_evento: 'exportacion_datos_personales',
      p_empresa_id: empresaId,
    });

    ventana.document.write(html);
    ventana.document.close();
  }

  async function solicitarEliminacion() {
    if (!perfilId) return;
    if (!window.confirm(t('confirmarSolicitarEliminacion'))) return;

    setEnviandoSolicitud(true);
    setError('');

    const { error: errorSolicitar } = await supabase
      .from('solicitudes_eliminacion_cuenta')
      .insert({ perfil_id: perfilId, empresa_id: empresaId });

    setEnviandoSolicitud(false);

    if (errorSolicitar) {
      setError(errorSolicitar.message);
      return;
    }

    setSolicitudEliminacion({ estado: 'PENDIENTE', creado_en: new Date().toISOString() });
    setMensaje(t('solicitudEliminacionEnviada'));
  }

  if (cargando) {
    return <div style={cargandoStyle}>{t('cargandoDatosPersonales')}</div>;
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 17, color: COLORES.azul }}>{t('tabPersonal')}</h2>

      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={mensajeOkStyle}>{mensaje}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 26 }}>
        <div style={campo}>
          <label style={label}>{t('campoTuNombre')}</label>
          <input
            style={inputFormulario}
            value={datos.nombre}
            onChange={(e) => setDatos((actual) => ({ ...actual, nombre: e.target.value }))}
          />
        </div>

        <div style={campo}>
          <label style={label}>{t('campoTuTelefono')}</label>
          <input
            style={inputFormulario}
            value={datos.telefono ?? ''}
            onChange={(e) => setDatos((actual) => ({ ...actual, telefono: e.target.value }))}
          />
        </div>

        <div style={campo}>
          <label style={label}>{t('campoTuSexo')}</label>
          <select
            style={inputFormulario}
            value={datos.sexo ?? ''}
            onChange={(e) => setDatos((actual) => ({ ...actual, sexo: e.target.value }))}
          >
            <option value="">{t('sinDefinir')}</option>
            <option value="F">{idioma === 'PT' ? 'Feminino' : 'Femenino'}</option>
            <option value="M">Masculino</option>
          </select>
        </div>

        <div style={campo}>
          <label style={label}>{t('campoTuEmail')}</label>
          <div style={{ ...inputFormulario, background: '#f3f4f6', color: COLORES.gris }}>{email}</div>
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: COLORES.gris }}>{t('notaEmailNoEditable')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 30 }}>
        <button type="button" style={botonGuardar} onClick={guardar} disabled={guardando}>
          {guardando ? t('guardando') : t('guardarDatosPersonales')}
        </button>
      </div>

      <div style={{ padding: 18, borderRadius: 14, background: '#f8fafc', border: '1px solid #e5e7eb', marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: COLORES.azul, marginBottom: 4 }}>{t('tituloMisDatos')}</div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: COLORES.gris }}>{t('subtituloMisDatos')}</p>
        <button type="button" style={botonSecundario} onClick={descargarMisDatos}>
          {t('botonDescargarMisDatos')}
        </button>
      </div>

      <div style={{ padding: 18, borderRadius: 14, background: '#fef2f2', border: '1px solid #fecaca' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#b91c1c', marginBottom: 4 }}>{t('tituloEliminarCuenta')}</div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: COLORES.gris }}>{t('subtituloEliminarCuenta')}</p>

        {solicitudEliminacion ? (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
            {t('solicitudEliminacionPendienteDesde')}{' '}
            {new Date(solicitudEliminacion.creado_en).toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR')}
          </p>
        ) : (
          <button
            type="button"
            onClick={solicitarEliminacion}
            disabled={enviandoSolicitud}
            style={{ background: '#b91c1c', color: COLORES.blanco, border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 700 }}
          >
            {enviandoSolicitud ? t('enviandoSolicitud') : t('botonSolicitarEliminacion')}
          </button>
        )}
      </div>
    </div>
  );
}
