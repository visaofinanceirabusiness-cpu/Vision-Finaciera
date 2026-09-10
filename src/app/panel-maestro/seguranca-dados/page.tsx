'use client';

// PANEL MAESTRO → SEGURANÇA E PROTEÇÃO DE DADOS
//
// V3.0 — Día 1: Auditoría de Seguridad, Privacidad y Confianza.
//
// A diferencia del método "pantalla por pantalla" (entrar como
// usuario nuevo y sacar capturas), esta auditoría se hizo leyendo
// directo el código fuente y la base de datos real de producción —
// más rápido y sin conjeturas. Cada hallazgo de acá abajo se pudo
// verificar de una de estas dos formas:
//
//   1. Código: se buscó en todo el repositorio (ej. "¿existe algún
//      formulario de recuperación de contraseña?").
//   2. Base de datos: se consultó Postgres directo (políticas RLS,
//      definición de funciones, advisors de seguridad de Supabase).
//
// Es una fotografía de un momento — no se actualiza sola. Repetir
// esta auditoría después de cambios grandes de arquitectura.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  rojo: '#b91c1c',
  amarillo: '#92400e',
};

const FECHA_AUDITORIA = '10 de septiembre de 2026';

type Estado = 'verde' | 'amarillo' | 'rojo' | 'gris';

const ESTILO_ESTADO: Record<Estado, { emoji: string; color: string; fondo: string; etiqueta: string }> = {
  verde: { emoji: '🟢', color: '#166534', fondo: '#f0fdf4', etiqueta: 'Correcto' },
  amarillo: { emoji: '🟡', color: '#92400e', fondo: '#fffbeb', etiqueta: 'Mejorar' },
  rojo: { emoji: '🔴', color: '#b91c1c', fondo: '#fef2f2', etiqueta: 'Crítico' },
  gris: { emoji: '⚪', color: '#475569', fondo: '#f8fafc', etiqueta: 'No aplica / futuro' },
};

type Item = {
  estado: Estado;
  titulo: string;
  detalle: string;
};

type Seccion = {
  numero: string;
  titulo: string;
  emoji: string;
  intro?: string;
  items: Item[];
};

const RADAR: { area: string; estado: Estado }[] = [
  { area: '🌐 Web / marketing público', estado: 'gris' },
  { area: '📱 App / Cadastro', estado: 'amarillo' },
  { area: '🔐 Login y autenticación', estado: 'amarillo' },
  { area: '🗄️ Datos y privacidad (LGPD)', estado: 'rojo' },
  { area: '🛡️ Seguridad técnica (base de datos)', estado: 'verde' },
];

const SECCIONES: Seccion[] = [
  {
    numero: '1',
    emoji: '🌐',
    titulo: 'Auditoría de la web',
    intro:
      'Visão Financeira hoy no tiene un sitio de marketing separado de la aplicación: la "puerta de entrada" pública son directamente las pantallas de Login y Criar Conta dentro de la misma app. Si en algún momento se crea un sitio público aparte (landing page, blog, etc.), esta sección hay que rehacerla auditando ese sitio.',
    items: [
      {
        estado: 'gris',
        titulo: 'No existe un sitio web de marketing separado de la app',
        detalle:
          'Todo lo público vive en el mismo dominio de la aplicación. No hay nada que auditar acá todavía — queda como pendiente "a futuro" si se crea uno.',
      },
      {
        estado: 'rojo',
        titulo: 'No hay página de "Quiénes somos" / información de contacto de la empresa',
        detalle:
          'Un usuario nuevo no tiene forma de saber, dentro de la app, quién está detrás de Visão Financeira ni cómo contactarlos (fuera de lo que ya sepa por WhatsApp/redes).',
      },
      {
        estado: 'gris',
        titulo: 'Herramientas externas de analytics/publicidad',
        detalle:
          'Se revisó package.json y todo el código en busca de Google Analytics, Meta Pixel, Hotjar, etc. No se encontró ninguna. Ningún dato de navegación sale hacia un tercero de marketing.',
      },
    ],
  },
  {
    numero: '2',
    emoji: '📱',
    titulo: 'Auditoría de la app — Cadastro (alta de cuenta)',
    intro: 'Se revisó el formulario real de "Criar Conta" (src/app/crear-cuenta) campo por campo.',
    items: [
      {
        estado: 'verde',
        titulo: 'El formulario de alta pide el mínimo de datos necesario',
        detalle:
          'Campos pedidos: nombre, sexo (solo para elegir el avatar), email, contraseña, teléfono, nombre de la empresa, rubro, moneda y tipo de negocio. No se pide CPF/CNPJ, dirección ni fecha de nacimiento — dato que no se usa, no se pide.',
      },
      {
        estado: 'rojo',
        titulo: 'No existe Política de Privacidad ni Termos de Uso',
        detalle:
          'No hay ningún enlace, checkbox de consentimiento ni documento publicado. El usuario se registra sin que se le explique qué se hace con sus datos, ni acepta nada formalmente.',
      },
      {
        estado: 'rojo',
        titulo: 'No se menciona LGPD en ningún lado de la app',
        detalle: 'Ni en el alta, ni en la configuración de la cuenta, ni en ninguna pantalla.',
      },
      {
        estado: 'rojo',
        titulo: 'El usuario no puede eliminar su propia cuenta',
        detalle:
          'Solo un admin de plataforma puede borrar una empresa completa (Panel Maestro → 🗑️). No hay ningún botón de "Eliminar mi cuenta" ni "Solicitar eliminación de mis datos" pensado para el usuario mismo.',
      },
      {
        estado: 'rojo',
        titulo: 'El usuario no puede exportar/descargar sus propios datos',
        detalle: 'No hay una función de "Descargar mis datos" en ningún formato (CSV, PDF, JSON).',
      },
      {
        estado: 'amarillo',
        titulo: 'El usuario sí puede cambiar algunos de sus datos, pero no todos desde un solo lugar',
        detalle:
          'Nombre y logo de la empresa se editan en Configurações. El nombre/sexo/email de la persona no tiene una pantalla de "Mi perfil" dedicada hoy.',
      },
    ],
  },
  {
    numero: '3',
    emoji: '👤',
    titulo: 'Tabla de datos del cadastro',
    intro: 'Qué se pide, si es obligatorio, y para qué se usa realmente (no lo que "podríamos" usar).',
    items: [
      { estado: 'verde', titulo: 'Nombre (persona) — obligatorio', detalle: 'Se usa para identificarte en la app (saludo, quién cargó cada operación).' },
      { estado: 'verde', titulo: 'E-mail — obligatorio', detalle: 'Es el usuario de login (Supabase Auth) y el canal de recuperación futura.' },
      { estado: 'amarillo', titulo: 'Teléfono — obligatorio', detalle: 'Se usa para el WhatsApp de comprobantes (Sabio Bot / Central de Lançamentos) y contacto directo. Es razonable que sea obligatorio dado ese uso, pero no está explicado al usuario en el momento de pedirlo.' },
      { estado: 'verde', titulo: 'Sexo — obligatorio', detalle: 'Solo define qué avatar/ilustración por defecto se usa. No se usa para nada más.' },
      { estado: 'gris', titulo: 'CPF/CNPJ — NO se pide', detalle: 'No se recolecta en ningún formulario.' },
      { estado: 'gris', titulo: 'Fecha de nacimiento — NO se pide', detalle: 'No se recolecta en ningún formulario.' },
      { estado: 'gris', titulo: 'Dirección — NO se pide', detalle: 'No se recolecta en ningún formulario del usuario (algunas empresas pueden cargar la suya propia en Configurações, es opcional y de la empresa, no de la persona).' },
      { estado: 'verde', titulo: 'Datos financieros (ventas, gastos, saldos)', detalle: 'Es el corazón del producto — el usuario los carga a propósito para llevar su contabilidad. Quedan aislados por empresa vía RLS (ver sección 6).' },
    ],
  },
  {
    numero: '4',
    emoji: '🔐',
    titulo: 'Login y autenticación',
    intro: 'Verificado contra el código de src/app/login, src/app/crear-cuenta y la configuración de Supabase Auth.',
    items: [
      {
        estado: 'verde',
        titulo: 'Las contraseñas nunca se guardan en nuestra base',
        detalle: 'Las maneja Supabase Auth con hash seguro (bcrypt) — Visão Financeira nunca ve ni almacena la contraseña en texto plano.',
      },
      {
        estado: 'verde',
        titulo: 'Verificación de e-mail obligatoria',
        detalle: 'Si el email no está confirmado, el login lo bloquea con un mensaje específico ("errorEmailNoConfirmado").',
      },
      {
        estado: 'rojo',
        titulo: 'No existe recuperación de contraseña ("Olvidé mi contraseña")',
        detalle:
          'Se revisó login/page.tsx entero: no hay enlace de recuperación, ni se usa resetPasswordForEmail en ningún lado del código. Hoy, si alguien olvida su contraseña, no tiene ninguna forma de recuperarla por sí mismo.',
      },
      {
        estado: 'rojo',
        titulo: 'No existe 2FA / verificación en dos pasos',
        detalle: 'No se encontró ninguna implementación de MFA en el código ni configuración de Supabase Auth para exigirlo.',
      },
      {
        estado: 'amarillo',
        titulo: '"Protección contra contraseñas filtradas" está apagada',
        detalle:
          'Supabase Auth puede rechazar contraseñas que ya aparecieron en filtraciones conocidas (chequeo contra HaveIBeenPwned) — hoy esa opción está desactivada en el proyecto. Es un cambio de configuración, no de código.',
      },
      {
        estado: 'verde',
        titulo: 'Cierre de sesión disponible',
        detalle: 'Tanto en el lobby como en Panel Maestro hay un botón de "Cerrar sesión" que invalida la sesión real (supabase.auth.signOut()).',
      },
      {
        estado: 'gris',
        titulo: 'Bloqueo por intentos repetidos / sesiones activas visibles',
        detalle:
          'Supabase Auth aplica un límite general de intentos a nivel de infraestructura, pero no hay una pantalla propia de "tus sesiones activas" ni un bloqueo específico de cuenta configurado en la app.',
      },
    ],
  },
  {
    numero: '5',
    emoji: '👨‍👩‍👧',
    titulo: 'Auditoría del perfil Família (acceso compartido)',
    intro:
      'Se revisaron las políticas de seguridad reales (RLS) de la base de datos, no lo que se ve en la pantalla — esto es lo que Postgres deja hacer, más allá de cualquier botón.',
    items: [
      {
        estado: 'amarillo',
        titulo: 'Dentro de una misma empresa, todos los usuarios ven exactamente lo mismo',
        detalle:
          'Las políticas de acceso (RLS) aíslan por empresa (empresa_id), no por persona dentro de la empresa. Dos personas vinculadas a la misma cuenta familiar/comercial tienen acceso simétrico a TODA la información financiera de esa empresa — no hay un rol "invitado" con permisos limitados. Puede ser el diseño querido (una familia comparte sus finanzas), pero hoy no está documentado como una decisión consciente ni comunicado al usuario.',
      },
      {
        estado: 'rojo',
        titulo: 'El rol "Admin" al vincular un usuario da admin de TODA la plataforma, no de su empresa',
        detalle:
          'En Panel Maestro → "Vincular usuario a empresa" hay un selector Cliente/Admin. Elegir "Admin" pone es_admin_plataforma = true, lo que le da a esa persona acceso a TODAS las empresas del sistema (Panel Maestro completo, incluido borrar cualquier empresa) — no un simple "admin de su propia familia/negocio". Es una trampa de nomenclatura con riesgo real de uso accidental.',
      },
      {
        estado: 'gris',
        titulo: 'No hay sistema de invitaciones con aceptar/rechazar',
        detalle:
          'Vincular a alguien a una empresa lo hace directamente un admin de plataforma desde Panel Maestro (RPC vincular_usuario_a_empresa) — no hay un flujo de "invitación" que la otra persona acepte o rechace por su cuenta.',
      },
      {
        estado: 'gris',
        titulo: 'No hay historial de accesos visible para el usuario',
        detalle:
          'Se guarda el último acceso (auth.users.last_sign_in_at) y Panel Maestro lo muestra por empresa — pero solo lo ve el admin de plataforma, no cada usuario sobre su propia cuenta ni sobre quién más entró a su empresa.',
      },
    ],
  },
  {
    numero: '6',
    emoji: '🗄️',
    titulo: 'Mapa de datos',
    intro: 'Dónde vive cada tipo de información, verificado consultando directo el catálogo de la base de datos.',
    items: [
      {
        estado: 'verde',
        titulo: 'Identidad (auth.users) — gestionada por Supabase Auth',
        detalle: 'Email, hash de contraseña, fecha del último inicio de sesión. Fuera del alcance de nuestro código: Supabase la protege con su propia infraestructura.',
      },
      {
        estado: 'verde',
        titulo: 'perfiles — quién es quién',
        detalle: 'Nombre, rol, a qué empresa pertenece, y si es admin de plataforma. Aislado: cada usuario solo puede leer su propia fila.',
      },
      {
        estado: 'verde',
        titulo: 'empresas — datos del negocio/familia',
        detalle: 'Nombre, rubro, teléfono, email, moneda, logo. Aislado por empresa vía RLS.',
      },
      {
        estado: 'verde',
        titulo: 'clientes / proveedores / socios — contactos del negocio',
        detalle: 'Nombre y teléfono de las personas con las que opera cada empresa. Aislado por empresa vía RLS.',
      },
      {
        estado: 'verde',
        titulo: 'registro_operaciones / registros_automaticos / matriz_operaciones / plan_cuentas — el corazón financiero',
        detalle: 'Cada venta, cobro, pago, transferencia registrada. Aislado por empresa vía RLS (ver sección siguiente).',
      },
      {
        estado: 'gris',
        titulo: 'Logos e imágenes — Supabase Storage',
        detalle: 'Los logos de cada empresa y el avatar de Sabio viven en un bucket de almacenamiento de Supabase (fuera de las tablas de Postgres, pero mismo proveedor).',
      },
      {
        estado: 'gris',
        titulo: 'Suscripciones de notificaciones push',
        detalle: 'Se guardan las suscripciones del navegador para poder avisar recordatorios del Calendário — no contienen datos financieros, solo un identificador técnico del dispositivo/navegador.',
      },
    ],
  },
  {
    numero: '7',
    emoji: '🔑',
    titulo: 'Mapa de accesos internos',
    intro: 'Quién puede ver o modificar qué, verificado contra las políticas RLS reales y las funciones administrativas.',
    items: [
      {
        estado: 'verde',
        titulo: 'Usuario común: solo su propia empresa',
        detalle: 'Ve y opera exclusivamente los datos de la empresa a la que está vinculado su perfil. Esto lo hace cumplir la base de datos (RLS), no solo la pantalla — no alcanza con "no mostrar el botón".',
      },
      {
        estado: 'amarillo',
        titulo: 'Admin de plataforma: ve y puede borrar TODO',
        detalle: 'Cualquier perfil con es_admin_plataforma = true puede entrar a cualquier empresa desde Panel Maestro y borrarla por completo. Es un poder "todo o nada" — hoy no existe un nivel intermedio (ej. "soporte" que pueda ver pero no borrar).',
      },
      {
        estado: 'gris',
        titulo: 'No existen roles separados de "Soporte" o "Desarrollo"',
        detalle: 'Cualquiera que necesite ayudar a resolver un problema de un cliente hoy necesitaría el flag de admin de plataforma completo — no hay un nivel acotado ("mínimo privilegio necesario").',
      },
      {
        estado: 'verde',
        titulo: 'Las funciones administrativas sensibles se auto-protegen',
        detalle:
          'Se leyó el código real de las funciones eliminar_empresa_completa y vincular_usuario_a_empresa directo en la base: ambas verifican es_admin_plataforma puertas adentro antes de hacer nada, así que aunque alguien las llame directo por API (sin pasar por la pantalla), igual quedan bloqueadas si no es admin.',
      },
      {
        estado: 'amarillo',
        titulo: 'Una función menor no tiene ese chequeo (riesgo bajo)',
        detalle:
          'existe_nombre_empresa (usada para avisar "ese nombre ya existe" al crear una empresa) es invocable sin haber iniciado sesión. Solo devuelve verdadero/falso sobre si un nombre está tomado — no expone datos sensibles, pero técnicamente no debería ser pública.',
      },
    ],
  },
  {
    numero: '8',
    emoji: '🔄',
    titulo: 'Servicios externos conectados',
    items: [
      { estado: 'verde', titulo: 'Supabase — base de datos, autenticación y almacenamiento', detalle: 'Recibe y guarda todos los datos de la app (región us-east-2, EE.UU.). Es el único proveedor con acceso real a los datos crudos.' },
      { estado: 'verde', titulo: 'Vercel — hosting de la aplicación web', detalle: 'Sirve el código de la app. No almacena datos financieros de forma persistente.' },
      { estado: 'gris', titulo: 'Web Push — notificaciones del navegador', detalle: 'Protocolo estándar del navegador (no es una empresa de marketing) usado para avisar recordatorios del Calendário.' },
      { estado: 'verde', titulo: 'WhatsApp — solo enlaces wa.me', detalle: 'El envío de comprobantes abre WhatsApp en el dispositivo del usuario con un mensaje prearmado — no hay integración de servidor a servidor ni la API paga de WhatsApp Business todavía, así que Visão Financeira no le manda datos a Meta por este medio.' },
      { estado: 'gris', titulo: 'Ningún servicio de Inteligencia Artificial externo', detalle: 'El "Sabio Bot" es lógica propia (un árbol de decisiones escrito a mano) — no llama a ningún modelo de lenguaje de terceros, así que ningún dato financiero sale hacia una IA externa.' },
      { estado: 'gris', titulo: 'Sin pasarela de pagos integrada', detalle: 'Los pagos de suscripción hoy se registran a mano desde Panel Maestro (InfinitePay, Naranja X, "Otro") — no hay una pasarela de pagos conectada por API que reciba datos de tarjetas.' },
    ],
  },
  {
    numero: '9',
    emoji: '💾',
    titulo: 'Backups',
    items: [
      {
        estado: 'amarillo',
        titulo: 'Depende del plan de Supabase contratado — hay que confirmarlo',
        detalle:
          'No se pudo determinar desde acá si el proyecto tiene backups automáticos activos: eso depende del plan de facturación de Supabase (el plan gratuito no incluye backups automáticos; los planes pagos sí, con distinta retención). Revisar en el dashboard de Supabase → Settings → Backups.',
      },
      {
        estado: 'rojo',
        titulo: 'Hay una tabla de respaldo manual vieja mezclada en producción',
        detalle:
          'backup_matriz_operaciones_20260817 sigue existiendo en la base — un respaldo manual de una migración pasada que nunca se limpió. No es un riesgo grave por sí solo, pero es basura de datos que debería borrarse o archivarse fuera de la base productiva.',
      },
      {
        estado: 'gris',
        titulo: '¿Qué pasa con lo que un usuario borra? — sin definir',
        detalle:
          'No hay una política escrita sobre cuánto tiempo sobrevive en backups algo que un usuario eliminó de la app. Importante para la futura Política de Privacidad.',
      },
    ],
  },
  {
    numero: '10',
    emoji: '📋',
    titulo: 'Logs y auditoría',
    items: [
      {
        estado: 'amarillo',
        titulo: 'Solo se registra el último inicio de sesión, nada más',
        detalle:
          'Supabase Auth guarda automáticamente last_sign_in_at por usuario (lo que hoy usa Panel Maestro para mostrar "último acceso"). No hay un registro propio de qué cambió, quién lo cambió y cuándo dentro de los datos financieros.',
      },
      {
        estado: 'rojo',
        titulo: 'Si un usuario dice "alguien modificó mis datos", hoy no hay forma de saber qué pasó',
        detalle:
          'No existe una tabla de auditoría (quién editó qué registro y cuándo) para los datos financieros ni para cambios de configuración. Es un punto crítico según la propia metodología del Día 1.',
      },
      {
        estado: 'gris',
        titulo: 'No hay detección de actividad sospechosa',
        detalle: 'No hay alertas automáticas ante patrones raros (ej. muchos intentos de login fallidos, accesos desde ubicaciones nuevas, etc.).',
      },
    ],
  },
  {
    numero: '11',
    emoji: '🚨',
    titulo: 'Plan ante incidentes',
    items: [
      {
        estado: 'rojo',
        titulo: 'No existe un plan de respuesta a incidentes documentado',
        detalle:
          'Hoy no hay nada escrito sobre quién sería responsable, cómo se detectaría una filtración, cómo se investigaría, ni cómo se avisaría a los usuarios afectados. No hace falta construir el sistema todavía, pero sí documentar el procedimiento — es barato de escribir y valioso el día que haga falta.',
      },
      {
        estado: 'gris',
        titulo: 'Obligaciones legales ante un incidente — a validar con un abogado',
        detalle: 'La LGPD (Brasil) exige notificar a la autoridad y a los usuarios afectados en ciertos casos. Esto excede lo que se puede resolver desde el código.',
      },
    ],
  },
  {
    numero: '12',
    emoji: '🧹',
    titulo: 'Eliminación de datos',
    intro: 'Prueba real: ¿qué pasa hoy cuando un admin borra una empresa desde Panel Maestro?',
    items: [
      {
        estado: 'verde',
        titulo: 'El borrado de empresa SÍ es completo, no deja huérfanos',
        detalle:
          'Se leyó la función completa (eliminar_empresa_completa): borra, en orden, producción/recetas, stock, productos, operaciones registradas, matriz y reglas contables, categorías, formas de pago, clientes/proveedores/socios, objetivos, componentes, y finalmente los perfiles y la cuenta de Supabase Auth de cada persona vinculada (para que ese email/teléfono quede libre para registrarse de nuevo). Es un borrado real, bien pensado — no un "borrado lógico" que deja todo escondido pero presente.',
      },
      {
        estado: 'amarillo',
        titulo: 'Pero eso solo lo puede iniciar un admin de plataforma, nunca el usuario mismo',
        detalle: 'Repite el hallazgo de la sección 2: no hay forma de que el propio usuario dispare este borrado sobre su cuenta.',
      },
      {
        estado: 'gris',
        titulo: 'Qué pasa en los backups después de un borrado — sin definir',
        detalle: 'Mismo punto de la sección 9: los datos podrían seguir existiendo en un backup por un tiempo después de "eliminados" — hay que documentarlo.',
      },
    ],
  },
  {
    numero: '13',
    emoji: '📝',
    titulo: 'Documentación actual',
    items: [
      { estado: 'rojo', titulo: 'Política de Privacidad', detalle: 'No existe.' },
      { estado: 'rojo', titulo: 'Termos de Uso', detalle: 'No existe.' },
      { estado: 'rojo', titulo: 'Política de Cookies', detalle: 'No existe (aunque, al no haber trackers de terceros, el riesgo real es bajo — igual conviene tenerla).' },
      { estado: 'gris', titulo: 'Contratos / consentimientos formales', detalle: 'No aplican todavía al tamaño actual del negocio.' },
      { estado: 'gris', titulo: 'Documentación técnica / arquitectura', detalle: 'Vive como comentarios extensos dentro del propio código — útil para quien programa, no para mostrarle a un usuario o auditor externo.' },
    ],
  },
  {
    numero: '14',
    emoji: '🕵️',
    titulo: 'Prueba del "usuario desconfiado"',
    intro: 'Once preguntas que se haría cualquiera que no conoce Visão Financeira, respondidas con honestidad.',
    items: [
      { estado: 'rojo', titulo: '¿Quiénes son ustedes?', detalle: 'No hay ninguna pantalla que lo explique dentro de la app.' },
      { estado: 'amarillo', titulo: '¿Dónde están mis datos?', detalle: 'En Supabase (EE.UU.) — cierto, pero nunca se lo decimos al usuario.' },
      { estado: 'amarillo', titulo: '¿Quién puede verlos?', detalle: 'Vos y quien tenga el flag de admin de plataforma — cierto, pero no está comunicado.' },
      { estado: 'verde', titulo: '¿Venden mis datos?', detalle: 'No, no hay ninguna integración que los reciba con ese fin — pero tampoco lo decimos por escrito en ningún lado.' },
      { estado: 'verde', titulo: '¿Usan mis datos para publicidad?', detalle: 'No, no hay tracking ni publicidad en el código — mismo punto: falta decirlo.' },
      { estado: 'amarillo', titulo: '¿Pueden leer mis movimientos?', detalle: 'Técnicamente sí, un admin de plataforma puede. Hay que ser honestos sobre esto en la futura Política de Privacidad.' },
      { estado: 'rojo', titulo: '¿Qué pasa si cierro mi cuenta?', detalle: 'Hoy no hay forma de que lo hagas vos mismo/a.' },
      { estado: 'rojo', titulo: '¿Puedo recuperar mis datos?', detalle: 'No hay exportación de datos propios.' },
      { estado: 'rojo', titulo: '¿Qué pasa si hackean el sistema?', detalle: 'No hay plan de incidentes escrito todavía.' },
      { estado: 'gris', titulo: '¿Por qué el perfil personal/familiar es gratuito?', detalle: 'Pregunta de estrategia de negocio, no técnica — queda fuera de esta auditoría.' },
    ],
  },
];

// Lista final priorizada — se arma sola a partir de las secciones de
// arriba, para no mantener dos listas separadas que puedan
// desincronizarse. El orden importa: primero los críticos.
function accionesPriorizadas(): { estado: Estado; titulo: string }[] {
  const acciones: { estado: Estado; titulo: string }[] = [];
  for (const seccion of SECCIONES) {
    for (const item of seccion.items) {
      if (item.estado === 'rojo' || item.estado === 'amarillo') {
        acciones.push({ estado: item.estado, titulo: item.titulo });
      }
    }
  }
  return acciones.sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'rojo' ? -1 : 1));
}

export default function SegurancaDadosPage() {
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
          .item-hallazgo { break-inside: avoid; }
          .seccion { break-inside: avoid-page; }
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* CABECERA — no se imprime */}
        <div className="no-imprimir" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <Link href="/panel-maestro" style={{ color: COLORES.gris, fontSize: 13, textDecoration: 'none', fontWeight: 700 }}>
            ← Volver al Panel Maestro
          </Link>

          <button
            onClick={() => window.print()}
            style={{
              background: COLORES.verde,
              color: COLORES.blanco,
              border: 'none',
              borderRadius: 12,
              padding: '10px 18px',
              fontWeight: 800,
              fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(46,139,87,0.25)',
            }}
          >
            🖨️ Imprimir / Descargar como PDF
          </button>
        </div>

        {/* REPORTE */}
        <article
          className="reporte"
          style={{
            background: COLORES.blanco,
            borderRadius: 24,
            padding: '38px 40px',
            boxShadow: '0 18px 40px rgba(31,58,95,0.08)',
            color: '#1f2937',
            lineHeight: 1.55,
          }}
        >
          {/* PORTADA */}
          <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: `3px solid ${COLORES.azul}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: COLORES.verde, textTransform: 'uppercase', marginBottom: 8 }}>
              Visão Financeira · V3.0 · Día 1
            </div>
            <h1 style={{ margin: 0, fontSize: 28, color: COLORES.azul }}>
              🛡️ Mapa Maestro de Segurança e Confiança
            </h1>
            <p style={{ margin: '10px 0 0', fontSize: 14.5, color: COLORES.gris }}>
              Auditoría de Seguridad, Privacidad y Confianza — hecha leyendo directo el código y la base de
              datos de producción, no por inspección manual pantalla por pantalla.
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: COLORES.gris }}>
              Fecha de esta auditoría: <strong>{FECHA_AUDITORIA}</strong> · Es una fotografía de un momento —
              repetirla después de cambios grandes.
            </p>
          </div>

          {/* PREGUNTA GUÍA */}
          <div style={{ background: '#eef4f1', borderRadius: 16, padding: '18px 22px', marginBottom: 32 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontStyle: 'italic', color: COLORES.azul }}>
              "Si mañana entraran 100 usuarios nuevos a Visão Financeira, ¿qué información les estamos
              pidiendo, dónde termina esa información y quién podría acceder a ella? ¿Qué cosas podrían hacer
              que una persona desconfíe de nosotros?"
            </p>
          </div>

          {/* RADAR */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 18, color: COLORES.azul, marginBottom: 14 }}>📊 Radar general</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {RADAR.map((fila) => {
                const estilo = ESTILO_ESTADO[fila.estado];
                return (
                  <div
                    key={fila.area}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: estilo.fondo,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{fila.area}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: estilo.color }}>
                      {estilo.emoji} {estilo.etiqueta}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* LISTA PRIORIZADA */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 18, color: COLORES.azul, marginBottom: 14 }}>🎯 Lista priorizada de acciones</h2>
            <p style={{ fontSize: 13, color: COLORES.gris, marginTop: 0, marginBottom: 14 }}>
              Todos los puntos 🔴 y 🟡 encontrados en la auditoría, juntos en un solo lugar. Los 🔴 primero.
            </p>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accionesPriorizadas().map((accion, i) => {
                const estilo = ESTILO_ESTADO[accion.estado];
                return (
                  <li key={i} style={{ fontSize: 13.5 }}>
                    <span style={{ marginRight: 4 }}>{estilo.emoji}</span>
                    {accion.titulo}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* SECCIONES DETALLADAS */}
          {SECCIONES.map((seccion) => (
            <section key={seccion.numero} className="seccion" style={{ marginBottom: 34 }}>
              <h2 style={{ fontSize: 17, color: COLORES.azul, marginBottom: 6, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
                {seccion.emoji} {seccion.numero}. {seccion.titulo}
              </h2>

              {seccion.intro && (
                <p style={{ fontSize: 13, color: COLORES.gris, margin: '10px 0 14px' }}>{seccion.intro}</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {seccion.items.map((item, i) => {
                  const estilo = ESTILO_ESTADO[item.estado];
                  return (
                    <div
                      key={i}
                      className="item-hallazgo"
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: estilo.fondo,
                        borderLeft: `4px solid ${estilo.color}`,
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{estilo.emoji}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#1f2937' }}>{item.titulo}</div>
                        <div style={{ fontSize: 13, color: '#4b5563', marginTop: 3, lineHeight: 1.5 }}>{item.detalle}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* CIERRE */}
          <div style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid #e5e7eb', fontSize: 12, color: COLORES.gris }}>
            <p style={{ margin: 0 }}>
              <strong>Regla del Día 1:</strong> no se corrigió nada todavía, aunque se haya encontrado algo
              grave — primero descubrir, documentar y priorizar. Este documento es el punto de partida para el
              Día 2 (Arquitectura de Datos y Minimización) y para escribir la Política de Privacidad y los
              Termos de Uso.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
