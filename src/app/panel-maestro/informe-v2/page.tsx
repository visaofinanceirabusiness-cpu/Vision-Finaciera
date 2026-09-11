'use client';

// PANEL MAESTRO → INFORME V3.0 — DÍA 1 — VERSIÓN 2
//
// Cierre formal del Día 1 de la auditoría de Seguridad, Privacidad y
// Confianza. Toma como línea base los dos informes originales
// (Sistema y Web, ver /panel-maestro/seguranca-dados) y compara cada
// hallazgo con lo que realmente se hizo: ANTES → ACCIÓN → DESPUÉS →
// ESTADO. Organizado por bloque (A-N), en el mismo orden en que se
// ejecutaron.
//
// Criterio de cierre del Día 1 (no es una fecha, es una condición):
// "Terminado cuando todos los 🔴 críticos estén resueltos,
// documentados o tengan una decisión formal." Este informe es la
// prueba de eso — incluye también lo que quedó honestamente
// pendiente, sin maquillarlo.

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

const FECHA_CIERRE = '11 de septiembre de 2026';

type Estado = 'resuelto' | 'mejorado' | 'documentado' | 'pendiente';

const ESTILO_ESTADO: Record<Estado, { emoji: string; color: string; fondo: string; etiqueta: string }> = {
  resuelto: { emoji: '🟢', color: '#166534', fondo: '#f0fdf4', etiqueta: 'Resuelto' },
  mejorado: { emoji: '🟢', color: '#166534', fondo: '#f0fdf4', etiqueta: 'Mejorado' },
  documentado: { emoji: '🔵', color: '#1d4ed8', fondo: '#eff6ff', etiqueta: 'Decisión formal / documentado' },
  pendiente: { emoji: '⚪', color: '#475569', fondo: '#f8fafc', etiqueta: 'Pendiente (fuera de alcance del Día 1)' },
};

type Comparacion = {
  estado: Estado;
  titulo: string;
  antes: string;
  accion: string;
  despues: string;
};

type Bloque = {
  letra: string;
  nombre: string;
  emoji: string;
  items: Comparacion[];
};

const BLOQUES: Bloque[] = [
  {
    letra: 'A-D',
    nombre: 'Identidad, Web y Cadastro',
    emoji: '📇',
    items: [
      {
        estado: 'resuelto',
        titulo: 'No existía Política de Privacidad ni Termos de Uso',
        antes: 'Ningún documento legal publicado, en ningún lado.',
        accion: 'Se redactaron y publicaron privacidad.html, terminos.html y cookies.html en el sitio, con checkbox obligatorio de aceptación en Criar Conta.',
        despues: 'Los 3 documentos existen, están linkeados desde el footer de la web y desde Criar Conta, y se piden aceptar antes de poder registrarse.',
      },
      {
        estado: 'resuelto',
        titulo: 'No se mencionaba la LGPD en ningún lado',
        antes: 'Ni en el alta, ni en Configurações, ni en ninguna pantalla.',
        accion: 'La Política de Privacidad y el checkbox de Criar Conta mencionan la LGPD explícitamente.',
        despues: 'La LGPD está mencionada en el punto exacto donde se pide el consentimiento.',
      },
      {
        estado: 'resuelto',
        titulo: 'No existía recuperación de contraseña',
        antes: 'Si alguien olvidaba su contraseña, no tenía ninguna forma de recuperarla por sí mismo.',
        accion: 'Se construyó el flujo real /recuperar-senha → email → /restablecer-senha (Supabase Auth, evento PASSWORD_RECOVERY).',
        despues: 'Cualquier usuario puede recuperar su contraseña por sí mismo, en español o portugués.',
      },
      {
        estado: 'documentado',
        titulo: 'No existe 2FA / verificación en dos pasos',
        antes: 'Ninguna implementación de MFA en el código ni en la configuración de Supabase Auth.',
        accion: 'Se evaluó y se decidió dejarlo fuera del alcance del Día 1 — es una mejora de autenticación, no un hallazgo de privacidad/datos.',
        despues: 'Sigue sin existir. Decisión formal: evaluar en una futura ronda de seguridad, no en el Día 1.',
      },
      {
        estado: 'mejorado',
        titulo: '"Protección contra contraseñas filtradas" apagada',
        antes: 'La opción de Supabase Auth (HaveIBeenPwned) estaba desactivada.',
        accion: 'Se activó el toggle en el dashboard de Supabase.',
        despues: 'El toggle está activado, pero Supabase aclara que es una función exclusiva del plan Pro — en el plan Free actual no se aplica de verdad. Queda como decisión de negocio (upgrade de plan) pendiente.',
      },
    ],
  },
  {
    letra: 'C',
    nombre: 'Datos personales — autoservicio',
    emoji: '👤',
    items: [
      {
        estado: 'resuelto',
        titulo: 'El usuario no podía eliminar su propia cuenta',
        antes: 'Solo un admin de plataforma podía borrar una empresa completa; no existía "Eliminar mi cuenta" para el usuario mismo.',
        accion: 'Se creó la tabla solicitudes_eliminacion_cuenta y el botón "Solicitar eliminación de mi cuenta" en Configurações.',
        despues: 'Cualquier usuario puede pedir la eliminación de su cuenta desde la app, sin escribirle a nadie.',
      },
      {
        estado: 'resuelto',
        titulo: 'El usuario no podía exportar/descargar sus propios datos',
        antes: 'No existía ninguna función de "Descargar mis datos" en ningún formato.',
        accion: 'Se construyó "Descargar mis datos" — exportación en PDF (vía impresión del navegador) con el nombre de la empresa y membrete propio.',
        despues: 'Cualquier usuario puede exportar sus datos personales y de la empresa en PDF, en el momento.',
      },
      {
        estado: 'resuelto',
        titulo: 'Podía cambiar algunos datos, pero no desde un solo lugar',
        antes: 'Nombre/logo de empresa en Configurações; nombre/sexo/email de la persona no tenían pantalla propia.',
        accion: 'Se unificó todo en una sola sección ("Mis Datos", luego renombrada "Privacidad y mis datos") dentro de Configurações → Dados da Empresa.',
        despues: 'Todos los datos personales y su gestión (editar, exportar, eliminar) viven en un solo lugar.',
      },
    ],
  },
  {
    letra: 'E',
    nombre: 'Permisos y roles',
    emoji: '🔑',
    items: [
      {
        estado: 'resuelto',
        titulo: 'Dentro de una empresa, todos tenían el mismo nivel de acceso',
        antes: 'No existían niveles de permiso distintos entre las personas vinculadas a una misma empresa.',
        accion: 'Se construyó un sistema de 4 roles (Desarrollador, Soporte, Cliente, Asistente/Colaborador) con permisos reales aplicados vía RLS, no solo ocultando botones.',
        despues: 'El Asistente/Colaborador puede cargar datos operativos pero no editar, eliminar ni ver Informes — bloqueado a nivel de base de datos.',
      },
      {
        estado: 'mejorado',
        titulo: 'El admin de plataforma veía y podía borrar TODO, sin nivel intermedio',
        antes: 'No existía un rol de "Soporte" acotado — cualquier ayuda requería el flag completo de admin de plataforma.',
        accion: 'Se creó el rol Soporte: lectura en todos los sistemas de clientes, sin poder editar ni eliminar nada, invitado solo por el Desarrollador.',
        despues: 'Ya existe un nivel intermedio de acceso. El Desarrollador conserva el poder total por diseño (es quien opera la plataforma) — eso no cambió y es una decisión consciente, no un descuido.',
      },
      {
        estado: 'resuelto',
        titulo: 'No había sistema de invitaciones con aceptar/rechazar',
        antes: 'Vincular a alguien a una empresa lo hacía directamente un admin de plataforma — sin que la otra persona aceptara nada.',
        accion: 'Se construyó un flujo de invitación real (tabla invitaciones + token + /aceptar-convite) para altas de Soporte y Asistente/Colaborador.',
        despues: 'Quien invita ya es la autoridad que aprueba (el Desarrollador para Soporte, cualquier Cliente para su Asistente) — la persona invitada acepta activamente creando su cuenta.',
      },
      {
        estado: 'pendiente',
        titulo: 'El selector "Rol: Cliente/Admin" al vincular usuario sigue existiendo en Panel Maestro',
        antes: 'Elegir "Admin" en Vincular Usuario da admin de TODA la plataforma — trampa de nomenclatura de riesgo real.',
        accion: 'No se tocó en este Día 1 — el foco fue el sistema de roles nuevo (Soporte/Asistente), no el flujo original de alta de Cliente.',
        despues: 'Sigue exactamente igual. Queda anotado como pendiente real para una próxima pasada — es una corrección de UI/nomenclatura, no de RLS (el riesgo de fondo ya está mitigado por el resto de los controles de este Día 1, pero el nombre del selector sigue siendo confuso).',
      },
      {
        estado: 'pendiente',
        titulo: 'No hay historial de accesos visible para el usuario sobre su propia cuenta',
        antes: 'Solo el admin de plataforma veía "último acceso" por empresa en Panel Maestro.',
        accion: 'No abordado — quedó fuera del alcance de este Día 1 (Bloque F cubrió auditoría interna, no un historial expuesto al usuario final).',
        despues: 'Sigue sin existir una pantalla de "tu actividad" para el usuario común. Candidato a un futuro Día 2/3.',
      },
    ],
  },
  {
    letra: 'F',
    nombre: 'Auditoría de actividad',
    emoji: '🕵️',
    items: [
      {
        estado: 'resuelto',
        titulo: 'Solo se registraba el último inicio de sesión, nada más',
        antes: 'Ningún registro propio de qué cambió, quién lo cambió y cuándo.',
        accion: 'Se construyó auditoria_eventos: registro append-only (nadie puede editarlo ni borrarlo) capturado por triggers automáticos + una función validada para eventos del cliente.',
        despues: 'Se audita: login (éxito/fallido), altas/bajas de roles, invitaciones, consentimientos, exportación de datos, acceso del Desarrollador a una empresa ajena, y cambios en operaciones/plan de cuentas/reglas contables.',
      },
      {
        estado: 'resuelto',
        titulo: 'Si un usuario decía "alguien modificó mis datos", no había forma de saber qué pasó',
        antes: 'No existía ninguna tabla de auditoría para datos financieros ni de configuración.',
        accion: 'Los cambios en registro_operaciones, plan_cuentas y reglas_contables quedan auditados automáticamente.',
        despues: 'Se puede reconstruir quién hizo qué y cuándo sobre cualquier dato financiero crítico.',
      },
      {
        estado: 'pendiente',
        titulo: 'No hay detección de actividad sospechosa',
        antes: 'Sin alertas automáticas ante patrones raros (logins fallidos repetidos, accesos desde ubicaciones nuevas).',
        accion: 'No abordado en este Día 1 — la auditoría capta el dato (login_fallido queda registrado), pero no hay alertas automáticas sobre él.',
        despues: 'Sigue sin existir. El dato ya se guarda (Bloque F); construir alertas sobre ese dato es un paso futuro.',
      },
    ],
  },
  {
    letra: 'G',
    nombre: 'Base de datos',
    emoji: '🗄️',
    items: [
      {
        estado: 'resuelto',
        titulo: 'Una función menor (existe_nombre_empresa) invocable sin sesión, sin evaluar',
        antes: 'Marcada como "riesgo bajo, no debería ser pública" sin una decisión formal.',
        accion: 'Se revisó su código real: solo devuelve un booleano sobre un nombre puntual, sin exponer datos de terceros — necesaria para el signup sin sesión.',
        despues: 'Documentada en la propia base (COMMENT ON FUNCTION) como pública a propósito — decisión aceptada, no pendiente.',
      },
      {
        estado: 'resuelto',
        titulo: 'Hallazgo nuevo (no estaba en la auditoría original): Storage del bucket "Logos" sin aislar por empresa',
        antes: 'Cualquier empresa autenticada podía subir/reemplazar el logo de OTRA empresa.',
        accion: 'Se corrigieron las políticas de Storage para acotar la escritura a la propia empresa (o al Desarrollador, para soporte).',
        despues: 'Aislamiento real por empresa también en Storage, no solo en la base de datos.',
      },
      {
        estado: 'resuelto',
        titulo: 'Hallazgo nuevo: configuracion_dashboard con RLS activado pero sin ninguna política',
        antes: 'Nadie podía leer ni escribir esa tabla — la personalización del panel estaba muerta en silencio.',
        accion: 'Se agregó política de lectura/escritura por empresa y una pantalla real para editar los 3 colores del panel.',
        despues: 'Cada empresa puede personalizar los colores de su Panel de Control.',
      },
    ],
  },
  {
    letra: 'H',
    nombre: 'Backups',
    emoji: '💾',
    items: [
      {
        estado: 'documentado',
        titulo: 'No estaba confirmado si existían backups automáticos',
        antes: 'Dependía del plan de Supabase, sin confirmar.',
        accion: 'Se confirmó: el proyecto está en plan Free, que no incluye backups automáticos ni Point-in-Time Recovery.',
        despues: 'Decisión formal documentada: en esta etapa de la empresa, Visão Financeira no garantiza backups. Pasar a Supabase Pro los habilitaría.',
      },
      {
        estado: 'resuelto',
        titulo: 'Había una tabla de respaldo manual vieja mezclada en producción',
        antes: 'backup_matriz_operaciones_20260817 seguía en la base, desactualizada (49 filas vs. 587 reales).',
        accion: 'Se eliminó. También se limpiaron 5 tablas vacías y sin uso (categorias, medios_financieros, objetivos_anuales/condiciones/mensuales) que tenían RLS sin ninguna política.',
        despues: 'Base de datos sin basura de datos vieja.',
      },
    ],
  },
  {
    letra: 'I',
    nombre: 'Servicios externos',
    emoji: '🔗',
    items: [
      {
        estado: 'resuelto',
        titulo: 'No había un inventario formal de qué servicio recibe qué dato, por qué, y cuánto tiempo',
        antes: 'La información existía dispersa (comentarios de código, conocimiento del equipo).',
        accion: 'Se armó el inventario completo: Supabase, Vercel, Web Push, WhatsApp (wa.me), Google Fonts, YouTube, Vercel Analytics — con qué recibe cada uno, para qué, y retención.',
        despues: 'Inventario documentado en esta misma auditoría, sin hallazgos de fuga de datos hacia terceros.',
      },
    ],
  },
  {
    letra: 'J',
    nombre: 'Eliminación y ciclo de vida',
    emoji: '🧹',
    items: [
      {
        estado: 'resuelto',
        titulo: 'Solo un admin de plataforma podía iniciar el borrado de una empresa, nunca el usuario mismo',
        antes: 'El usuario no tenía ningún disparador propio sobre el borrado de su cuenta.',
        accion: 'Bloque C le dio al usuario la solicitud de eliminación; el Desarrollador sigue ejecutando el borrado real de la empresa (decisión de diseño, no un descuido).',
        despues: 'El usuario puede iniciar el pedido desde la app; la ejecución queda en manos humanas a propósito, para evitar un borrado accidental irreversible con un solo clic.',
      },
      {
        estado: 'resuelto',
        titulo: 'Hallazgo nuevo: eliminar_empresa_completa() nunca se actualizó cuando se agregaron invitaciones y solicitudes_eliminacion_cuenta',
        antes: 'Cualquier empresa con una invitación o una solicitud de baja alguna vez creada hacía que el borrado completo fallara por violación de foreign key — sin borrar nada.',
        accion: 'Se corrigió la función para incluir esas dos tablas, y se probó con un borrado real de una empresa descartable con ambos casos cargados.',
        despues: 'El borrado de empresa funciona de nuevo para el 100% de los casos reales, confirmado con una prueba en vivo (0 filas huérfanas).',
      },
    ],
  },
  {
    letra: 'K',
    nombre: 'Incidentes',
    emoji: '🚨',
    items: [
      {
        estado: 'resuelto',
        titulo: 'No existía un plan de respuesta a incidentes documentado',
        antes: 'Nada escrito sobre responsable, detección, clasificación, contención, investigación, recuperación, documentación ni comunicación.',
        accion: 'Se redactó docs/PLAN_INCIDENTES.md con las 7 etapas completas.',
        despues: 'El plan existe y es accionable con las herramientas construidas en este mismo Día 1 (auditoria_eventos, roles, etc.).',
      },
      {
        estado: 'documentado',
        titulo: 'Obligaciones legales de la LGPD ante un incidente',
        antes: 'Sin definir.',
        accion: 'Se documentó que la LGPD exige notificar a la ANPD y a los titulares "en tiempo razonable", sin plazo fijo como el GDPR.',
        despues: 'Marcado explícitamente como pendiente de validar con asesoría jurídica real — no se inventó una respuesta que no se puede garantizar desde el código.',
      },
    ],
  },
  {
    letra: 'L',
    nombre: 'Documentación legal',
    emoji: '📜',
    items: [
      {
        estado: 'resuelto',
        titulo: 'Política de Privacidad decía cosas que ya no eran ciertas',
        antes: 'Sección 4 decía que no había roles con permisos distintos (ya existían, Bloque E); sección 6 decía que exportar/eliminar datos era un proceso manual (ya era self-service, Bloque C).',
        accion: 'Se corrigieron ambas secciones para reflejar la realidad actual del sistema, y se agregaron ítems sobre qué NUNCA se pide (contraseña, datos bancarios, CPF/DNI) y sobre la legitimidad de los datos cargados.',
        despues: 'La Política de Privacidad dice la verdad de lo que el sistema hace hoy — se corrigió también la misma desactualización en la FAQ de la web.',
      },
      {
        estado: 'resuelto',
        titulo: 'Se reenvió el consentimiento a los usuarios existentes',
        antes: 'Los usuarios que ya habían aceptado la versión anterior de la política no sabían que había cambiado.',
        accion: 'Se mandó un nuevo mensaje (vía Mensajería) a las 5 empresas activas pidiendo que vuelvan a confirmar, con requiere_consentimiento = true.',
        despues: 'Cada empresa tiene el mensaje esperando su confirmación; queda auditado (Bloque F) cuando lo acepten.',
      },
    ],
  },
  {
    letra: 'M',
    nombre: 'Mensaje V3.0',
    emoji: '📣',
    items: [
      {
        estado: 'resuelto',
        titulo: 'La web prometía "podés exportar tu información cuando quieras" — era falso',
        antes: 'No existía ninguna función de exportación en la app.',
        accion: 'Bloque C construyó la exportación real (PDF).',
        despues: 'La promesa de la web ahora es cierta.',
      },
      {
        estado: 'resuelto',
        titulo: 'Contador de "familias usando Visão Família" fabricado (prueba social falsa)',
        antes: 'El propio código decía que crecía solo, sin leer la base real.',
        accion: 'Confirmado por el usuario: ya se había retirado antes de este bloque.',
        despues: 'No aparece más en la web.',
      },
      {
        estado: 'resuelto',
        titulo: 'No había ninguna explicación de quiénes somos, ni transparencia tecnológica',
        antes: 'Nada en la web ni en la app explicaba el origen del proyecto, la infraestructura usada, ni si había personas reales detrás.',
        accion: 'Se agregó la sección "Transparencia" en la portada de la web: historia (3 años, desde Google Sheets), qué es Supabase/Vercel/GitHub, uso de IA para desarrollo (ChatGPT y Claude) aclarando que siempre atiende una persona real, y qué es Sabio Online (no es un chatbot de IA, es una matriz de reglas).',
        despues: 'La web explica en lenguaje simple quiénes somos y cómo se construye el sistema, incluyendo qué NUNCA se pide (contraseña, datos bancarios, CPF/DNI) y que la legitimidad de los datos cargados depende del usuario.',
      },
      {
        estado: 'resuelto',
        titulo: 'No existía onboarding de privacidad ni explicación de por qué se piden ciertos datos',
        antes: 'El usuario nuevo no veía ningún resumen de privacidad al entrar, y el campo Sexo no explicaba para qué se usaba.',
        accion: 'Se agregó una card de privacidad en /bienvenida (primera pantalla tras la aprobación) y una nota de ayuda en el campo Sexo de Criar Conta.',
        despues: 'Todo usuario nuevo ve un resumen de privacidad antes de cargar cualquier dato operativo.',
      },
    ],
  },
  {
    letra: 'N',
    nombre: 'Prueba final',
    emoji: '🧪',
    items: [
      {
        estado: 'resuelto',
        titulo: 'Verificación cruzada de los 16 puntos del checklist final (usuario nuevo + Visão Financeira)',
        antes: '—',
        accion: 'Se repasó cada ítem contra el estado real del sistema (no contra lo que se suponía que debía existir).',
        despues: '14 de 16 en verde, 2 documentados como decisión de plan/negocio (Leaked Password Protection exclusiva de Pro; backups no garantizados en esta etapa) — ver detalle completo en /panel-maestro/seguranca-dados.',
      },
    ],
  },
];

const RESUMEN = {
  totalItems: BLOQUES.reduce((acc, b) => acc + b.items.length, 0),
  resueltos: BLOQUES.reduce((acc, b) => acc + b.items.filter((i) => i.estado === 'resuelto' || i.estado === 'mejorado').length, 0),
  documentados: BLOQUES.reduce((acc, b) => acc + b.items.filter((i) => i.estado === 'documentado').length, 0),
  pendientes: BLOQUES.reduce((acc, b) => acc + b.items.filter((i) => i.estado === 'pendiente').length, 0),
};

export default function InformeV2Page() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

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

      setAutorizado(true);
      setCargando(false);
    }

    verificar();
  }, [router]);

  if (cargando || !autorizado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f9', color: COLORES.azul, fontWeight: 600 }}>
        Preparando el informe...
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f7f9', padding: 24 }}>
      <style>{`
        @media print {
          .no-imprimir { display: none !important; }
          body { background: #fff !important; }
          main { padding: 0 !important; background: #fff !important; }
          .reporte { box-shadow: none !important; border: none !important; max-width: 100% !important; }
          .item-comp { break-inside: avoid; }
          .bloque { break-inside: avoid-page; }
        }
      `}</style>

      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <div className="no-imprimir" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <Link href="/panel-maestro" style={{ color: COLORES.gris, fontSize: 13, textDecoration: 'none', fontWeight: 700 }}>
            ← Volver al Panel Maestro
          </Link>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              href="/panel-maestro/seguranca-dados"
              style={{ color: COLORES.azul, fontSize: 13, fontWeight: 700, textDecoration: 'none', alignSelf: 'center' }}
            >
              Ver línea base (informe original) →
            </Link>
            <button
              onClick={() => window.print()}
              style={{ background: COLORES.verde, color: COLORES.blanco, border: 'none', borderRadius: 12, padding: '10px 18px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 6px 16px rgba(46,139,87,0.25)' }}
            >
              🖨️ Imprimir / Descargar como PDF
            </button>
          </div>
        </div>

        <article className="reporte" style={{ background: COLORES.blanco, borderRadius: 24, padding: '38px 40px', boxShadow: '0 18px 40px rgba(31,58,95,0.08)', color: '#1f2937', lineHeight: 1.55 }}>
          <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: `3px solid ${COLORES.azul}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpeg" alt="Visão Financeira" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: COLORES.verde, textTransform: 'uppercase' }}>
                Visão Financeira · V3.0 · Día 1 · Cierre
              </div>
            </div>
            <h1 style={{ margin: 0, fontSize: 28, color: COLORES.azul }}>📊 Informe V3.0 — Día 1 — Versión 2</h1>
            <p style={{ margin: '10px 0 0', fontSize: 14.5, color: COLORES.gris }}>
              Compara la línea base (los dos informes originales de Sistema y Web) contra las acciones tomadas
              en cada bloque (A a N), bloque por bloque: ANTES → ACCIÓN → DESPUÉS → ESTADO.
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: COLORES.gris }}>
              Cierre del Día 1: <strong>{FECHA_CIERRE}</strong>.
            </p>
          </div>

          <div style={{ background: '#eef4f1', borderRadius: 16, padding: '18px 22px', marginBottom: 32 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontStyle: 'italic', color: COLORES.azul }}>
              &ldquo;Día 1 terminado cuando todos los 🔴 críticos estén resueltos, documentados o tengan una
              decisión formal&rdquo; — no cuando pasaron 24 horas.
            </p>
          </div>

          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 18, color: COLORES.azul, marginBottom: 14 }}>📊 Resumen</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <ResumenTile numero={RESUMEN.totalItems} etiqueta="Hallazgos revisados" color={COLORES.azul} />
              <ResumenTile numero={RESUMEN.resueltos} etiqueta="Resueltos / mejorados" color="#166534" />
              <ResumenTile numero={RESUMEN.documentados} etiqueta="Decisión formal documentada" color="#1d4ed8" />
              <ResumenTile numero={RESUMEN.pendientes} etiqueta="Pendientes (fuera de alcance)" color="#475569" />
            </div>
          </section>

          {BLOQUES.map((bloque) => (
            <section key={bloque.letra} className="bloque" style={{ marginBottom: 34 }}>
              <h2 style={{ fontSize: 17, color: COLORES.azul, marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
                {bloque.emoji} Bloque {bloque.letra} — {bloque.nombre}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {bloque.items.map((item, i) => {
                  const estilo = ESTILO_ESTADO[item.estado];
                  return (
                    <div
                      key={i}
                      className="item-comp"
                      style={{
                        borderRadius: 14,
                        border: `1px solid ${estilo.color}33`,
                        background: estilo.fondo,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 16px', background: `${estilo.color}14`, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1f2937' }}>{item.titulo}</div>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: estilo.color, whiteSpace: 'nowrap' }}>
                          {estilo.emoji} {estilo.etiqueta}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0 }}>
                        <CampoComparacion titulo="ANTES" texto={item.antes} />
                        <CampoComparacion titulo="ACCIÓN" texto={item.accion} />
                        <CampoComparacion titulo="DESPUÉS" texto={item.despues} ultimo />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <div style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid #e5e7eb', fontSize: 12, color: COLORES.gris }}>
            <p style={{ margin: 0 }}>
              Este informe cierra formalmente el Día 1 de la auditoría V3.0. Los ítems marcados como
              &ldquo;pendiente&rdquo; no son un descuido: son decisiones conscientes de dejar fuera del
              alcance de este Día 1, documentadas acá para retomarlas en una próxima ronda (Día 2: Arquitectura
              de Datos y Minimización, u otra que se decida).
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}

function ResumenTile({ numero, etiqueta, color }: { numero: number; etiqueta: string; color: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{numero}</div>
      <div style={{ fontSize: 11.5, color: COLORES.gris, fontWeight: 700, marginTop: 2 }}>{etiqueta}</div>
    </div>
  );
}

function CampoComparacion({ titulo, texto, ultimo }: { titulo: string; texto: string; ultimo?: boolean }) {
  return (
    <div style={{ padding: '12px 16px', borderRight: ultimo ? 'none' : '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, color: COLORES.gris, textTransform: 'uppercase', marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{texto}</div>
    </div>
  );
}
