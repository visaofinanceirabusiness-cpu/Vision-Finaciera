// lib/cajaMateriales.ts
//
// CAJA DE MATERIALES — inventario del sistema + reglas para mandar piezas a la caja.
//
// Una pieza "en la caja" deja de mostrarse a las empresas pero NO se borra: ni el código, ni las tablas, ni los
// datos. El estado (en caja o no) vive en la tabla `caja_materiales_estado`; este archivo es el inventario de
// todo lo que existe, con lo que cada pieza necesita y lo que pasa si se guarda. Toda herramienta, pantalla o
// pieza nueva se suma acá para que quede a la vista en Panel Maestro → Caja de materiales.
//
// `interruptor` dice si la caja ya puede esconder esa pieza:
//   - 'conectado': el código ya consulta la caja y la oculta.
//   - 'pendiente': está inventariada, pero para mandarla a la caja hay que conectar su interruptor (un cambio
//     chico en la pantalla correspondiente). La caja no deja mandar algo que todavía no se puede esconder.
//   - 'nucleo': sostiene a otras piezas (motor contable, lobby…): no se manda a la caja.

export type TipoPieza = 'HERRAMIENTA' | 'PANTALLA' | 'PIEZA_LOBBY' | 'PERFIL' | 'PANEL_MAESTRO';
export type Interruptor = 'conectado' | 'pendiente' | 'nucleo';

export type Pieza = {
  clave: string;
  tipo: TipoPieza;
  nombre: string;
  emoji: string;
  descripcion: string;
  ruta?: string;
  archivos?: string[];
  tablas?: string[];
  configuracion?: string[];
  // Piezas sin las que esta no funciona.
  necesita?: string[];
  interruptor: Interruptor;
  // Qué se esconde al mandarla a la caja.
  seOculta?: string[];
  // Qué NO se toca (datos y funciones que siguen vivos).
  seConserva?: string[];
  // Qué cambia para los clientes.
  consecuencias?: string[];
};

export const NOMBRE_TIPO: Record<TipoPieza, string> = {
  HERRAMIENTA: 'Herramientas',
  PANTALLA: 'Pantallas',
  PIEZA_LOBBY: 'Piezas del lobby',
  PERFIL: 'Perfiles de empresa',
  PANEL_MAESTRO: 'Panel Maestro',
};

export const INVENTARIO: Pieza[] = [
  // ---------------- Núcleo ----------------
  { clave: 'motor-contable', tipo: 'PANTALLA', nombre: 'Motor contable (partida doble)', emoji: '⚙️', descripcion: 'Registra operaciones, movimientos de stock y asientos automáticos. Lo usan todas las formas de cargar datos.', archivos: ['src/lib/motor.ts', 'src/lib/categorias.ts'], tablas: ['registro_operaciones', 'registros_automaticos', 'movimientos_stock', 'matriz_operaciones', 'reglas_contables'], interruptor: 'nucleo' },
  { clave: 'shell', tipo: 'PANTALLA', nombre: 'Nuevo diseño (barra superior + menú lateral)', emoji: '🧭', descripcion: 'Cascarón común: barra con «Mi negocio», Panel de Control, Mini-Juego y Sabio asistente; menú lateral fijo con las herramientas (con nombre o solo íconos) y zona central de borde a borde. Fase 1: solo Buenaventura, en Inicio y Contabilidad.', archivos: ['src/components/shell/AppShell.tsx', 'src/components/shell/ShellContext.tsx', 'src/lib/shell.ts', 'src/lib/herramientasMenu.ts'], configuracion: ['Empresas con el nuevo diseño: lib/shell.ts → EMPRESAS_CON_SHELL', 'Rutas migradas: lib/shell.ts → RUTAS_EN_SHELL', 'Preferencia del menú (solo íconos) guardada en el navegador'], necesita: ['lobby'], interruptor: 'nucleo' },
  { clave: 'lobby', tipo: 'PANTALLA', nombre: 'Lobby (inicio)', emoji: '🏠', descripcion: 'Pantalla de inicio de cada empresa: reúne las piezas del lobby y los accesos a las herramientas.', ruta: '/', archivos: ['src/app/page.tsx'], interruptor: 'nucleo' },

  // ---------------- Herramientas ----------------
  { clave: 'panel-de-control', tipo: 'HERRAMIENTA', nombre: 'Panel de Control', emoji: '📊', descripcion: 'Indicadores y gráficos de la empresa.', ruta: '/panel-de-control', archivos: ['src/app/panel-de-control/page.tsx'], interruptor: 'pendiente' },
  { clave: 'contabilidad', tipo: 'HERRAMIENTA', nombre: 'Contabilidad', emoji: '🧾', descripcion: 'Central de Lanzamientos, libro diario y registros.', ruta: '/contabilidad', archivos: ['src/app/contabilidad/page.tsx', 'src/components/contabilidad/CentralDeLanzamientosTab.tsx'], necesita: ['motor-contable'], interruptor: 'pendiente' },
  { clave: 'finanzas', tipo: 'HERRAMIENTA', nombre: 'Finanzas', emoji: '💼', descripcion: 'Flujo, compromisos, deudas y cuentas a cobrar/pagar.', ruta: '/finanzas', archivos: ['src/app/finanzas/page.tsx'], necesita: ['motor-contable'], interruptor: 'pendiente' },
  { clave: 'mercaderia', tipo: 'HERRAMIENTA', nombre: 'Mercadería', emoji: '📦', descripcion: 'Productos, saldo, costo promedio y movimientos de stock. Solo para empresas que manejan mercadería.', ruta: '/mercaderia', archivos: ['src/app/mercaderia/page.tsx', 'src/app/stock/page.tsx', 'src/app/movimientos-stock/page.tsx'], tablas: ['productos', 'saldo_stock', 'movimientos_stock'], necesita: ['motor-contable'], interruptor: 'pendiente' },
  { clave: 'mi-local', tipo: 'HERRAMIENTA', nombre: 'Mi Local', emoji: '🛍️', descripcion: 'Tienda pública de la empresa: catálogo, banners, pedidos y venta manual contra el motor.', ruta: '/mi-local', archivos: ['src/app/mi-local/page.tsx', 'src/app/loja/[slug]/page.tsx', 'src/lib/miLocal.ts', 'src/lib/miLocalDatos.ts'], tablas: ['mi_local_tiendas', 'mi_local_publicaciones', 'mi_local_pedidos', 'mi_local_pedido_items', 'mi_local_banners'], configuracion: ['La tienda pública vive en /loja/<slug> (sin login)', 'Alta automática de compradores en Clientes (RH)'], necesita: ['mercaderia', 'motor-contable'], interruptor: 'pendiente' },
  { clave: 'informes', tipo: 'HERRAMIENTA', nombre: 'Informes', emoji: '📈', descripcion: 'Balance, DRE, flujo de caja, mayor y sumas y saldos.', ruta: '/informes', archivos: ['src/app/informes/page.tsx'], necesita: ['motor-contable'], interruptor: 'pendiente' },
  { clave: 'visao-3d', tipo: 'HERRAMIENTA', nombre: 'Visão 3D', emoji: '🏢', descripcion: 'La empresa como edificio en 3D, con temas por perfil.', ruta: '/visao-3d', archivos: ['src/app/visao-3d/page.tsx', 'src/components/visao3d/'], configuracion: ['Apertura por perfil o empresa en Panel Maestro → Apertura de Visão 3D (tabla visao3d_apertura)'], interruptor: 'pendiente' },
  { clave: 'produccion', tipo: 'HERRAMIENTA', nombre: 'Producción', emoji: '🏭', descripcion: 'Recetas, órdenes de producción e insumos. Depende del módulo Producción de la empresa.', ruta: '/produccion', archivos: ['src/app/produccion/page.tsx'], necesita: ['mercaderia', 'motor-contable'], interruptor: 'pendiente' },
  { clave: 'recursos-humanos', tipo: 'HERRAMIENTA', nombre: 'Recursos Humanos', emoji: '👥', descripcion: 'Clientes, proveedores y personas.', ruta: '/recursos-humanos', archivos: ['src/app/recursos-humanos/page.tsx'], tablas: ['clientes', 'proveedores'], interruptor: 'pendiente' },
  { clave: 'plan-accion', tipo: 'HERRAMIENTA', nombre: 'Plan de Acción', emoji: '🎯', descripcion: 'Objetivos y acciones; hoy solo existe para Buenaventura y Ocaña.', ruta: '/plan-accion', archivos: ['src/app/plan-accion/page.tsx'], interruptor: 'pendiente' },
  { clave: 'nuestro-sueno', tipo: 'HERRAMIENTA', nombre: 'Nuestro Sueño', emoji: '💞', descripcion: 'El sueño compartido de la familia; hoy solo existe para Buenaventura y Ocaña.', ruta: '/nuestro-sueno', archivos: ['src/app/nuestro-sueno/page.tsx'], interruptor: 'pendiente' },
  { clave: 'mensajes', tipo: 'HERRAMIENTA', nombre: 'Mensajes', emoji: '✉️', descripcion: 'Mensajes financieros del Sabio.', ruta: '/mensajes', archivos: ['src/app/mensajes/page.tsx'], tablas: ['mensajes_financieros'], interruptor: 'pendiente' },
  { clave: 'configuracoes', tipo: 'HERRAMIENTA', nombre: 'Configurações', emoji: '⚙️', descripcion: 'Categorías, formas de pago, apariencia, logos y usuarios.', ruta: '/configuracoes', archivos: ['src/app/configuracoes/page.tsx'], interruptor: 'nucleo' },

  // ---------------- Pantallas ----------------
  {
    clave: 'lanzamiento-rapido', tipo: 'PANTALLA', nombre: 'Lanzamiento rápido', emoji: '⚡',
    descripcion: 'Tarjetas con las 10 operaciones más repetidas de los últimos 60 días: se toca una, se ajusta valor y fecha y se registra con el motor de siempre. Es una segunda forma de cargar, además de la Central de Lanzamientos.',
    ruta: '/lanzamiento-rapido',
    archivos: ['src/app/lanzamiento-rapido/page.tsx', 'src/components/panel/LanzamientoRapidoLobby.tsx', 'src/lib/lanzamientoRapido.ts', 'src/lib/lanzamientoRapidoDatos.ts', 'src/lib/lanzamientoRapidoEmpresas.ts'],
    tablas: ['operaciones_rapidas_fijadas (tarjetas fijadas por empresa)', 'registro_operaciones (lo que se cargó queda como cualquier operación)'],
    configuracion: ['Disponible para todas las empresas (nació como piloto de Buenaventura)', 'En la demo cuenta como parte de Contabilidad'],
    necesita: ['motor-contable'],
    interruptor: 'conectado',
    seOculta: ['El banner «Lanzamiento rápido» del lobby, en todas las empresas', 'La pantalla /lanzamiento-rapido: los clientes ven un aviso y vuelven al lobby (el administrador de plataforma todavía puede abrirla, con una cinta de aviso)'],
    seConserva: ['Todas las operaciones ya cargadas con esta pantalla: siguen en el libro diario, los informes y el stock', 'Las tarjetas fijadas de cada empresa', 'La Central de Lanzamientos (Contabilidad), el Mini-Juego y Sabio Bot: no dependen del Lanzamiento rápido', 'El código y las tablas'],
    consecuencias: ['Las empresas que usaban el Lanzamiento rápido tendrán que cargar por la Central de Lanzamientos', 'Los enlaces o marcadores directos a /lanzamiento-rapido mostrarán el aviso'],
  },
  { clave: 'libro-diario', tipo: 'PANTALLA', nombre: 'Libro diario y registros', emoji: '📒', descripcion: 'Asientos y operaciones registradas.', ruta: '/libro-diario', archivos: ['src/app/libro-diario/page.tsx', 'src/app/diario/page.tsx', 'src/app/registros/page.tsx'], necesita: ['contabilidad'], interruptor: 'pendiente' },
  { clave: 'sabio-bot', tipo: 'PANTALLA', nombre: 'Sabio Bot', emoji: '🤖', descripcion: 'Asistente que carga operaciones conversando.', ruta: '/sabio-bot', archivos: ['src/app/sabio-bot/page.tsx'], necesita: ['motor-contable'], interruptor: 'pendiente' },
  { clave: 'loja', tipo: 'PANTALLA', nombre: 'Tienda pública (loja)', emoji: '🌐', descripcion: 'Página pública de cada tienda, sin login: catálogo, carrito y pedido.', ruta: '/loja/<slug>', archivos: ['src/app/loja/[slug]/'], necesita: ['mi-local'], interruptor: 'pendiente' },
  { clave: 'demo', tipo: 'PANTALLA', nombre: 'Entrada a la demo', emoji: '🎓', descripcion: 'Acceso por QR o código para espectadores (solo lectura).', ruta: '/demo?c=<código>', archivos: ['src/app/demo/'], tablas: ['demo_accesos', 'espectadores', 'espectador_eventos'], configuracion: ['El código UNICESUSC no vence'], interruptor: 'pendiente' },

  // ---------------- Piezas del lobby ----------------
  { clave: 'lobby-panel-control', tipo: 'PIEZA_LOBBY', nombre: 'Tarjeta de Panel de Control', emoji: '📊', descripcion: 'Resumen del panel dentro del lobby.', archivos: ['src/components/panel/PanelControlLobby.tsx'], necesita: ['lobby'], interruptor: 'pendiente' },
  { clave: 'lobby-sabio-azar', tipo: 'PIEZA_LOBBY', nombre: 'Sabio del Azar / Mini-Juego', emoji: '🎲', descripcion: 'Banner del juego de cargar operaciones (simulado en la demo).', archivos: ['src/components/panel/SabioAzarLobby.tsx', 'src/components/panel/MiniJuego.tsx'], necesita: ['lobby'], interruptor: 'pendiente' },
  { clave: 'lobby-sabio-bot', tipo: 'PIEZA_LOBBY', nombre: 'Banner de Sabio Bot', emoji: '🤖', descripcion: 'Acceso a Sabio Bot desde el lobby.', archivos: ['src/components/panel/SabioBotLobby.tsx'], necesita: ['lobby', 'sabio-bot'], interruptor: 'pendiente' },
  { clave: 'lobby-trofeos', tipo: 'PIEZA_LOBBY', nombre: 'Vitrina de trofeos', emoji: '🏆', descripcion: 'Gamificación: niveles, medallas y trofeos.', archivos: ['src/components/panel/VitrinaTrofeos.tsx', 'src/lib/gamificacion.ts', 'src/lib/trofeos.ts'], necesita: ['lobby'], interruptor: 'pendiente' },
  { clave: 'lobby-cotizaciones', tipo: 'PIEZA_LOBBY', nombre: 'Cotizaciones y noticias', emoji: '💱', descripcion: 'Paneles de cotizaciones y noticias del día.', archivos: ['src/components/panel/PanelCotizaciones.tsx', 'src/components/panel/PanelNoticias.tsx'], necesita: ['lobby'], interruptor: 'pendiente' },
  { clave: 'lobby-calendario', tipo: 'PIEZA_LOBBY', nombre: 'Calendario organizador', emoji: '📅', descripcion: 'Calendario con vencimientos y recordatorios.', archivos: ['src/components/calendario/CalendarioOrganizador.tsx'], necesita: ['lobby'], interruptor: 'pendiente' },
  { clave: 'lobby-control-demo', tipo: 'PIEZA_LOBBY', nombre: 'Control de la demostración', emoji: '🎛️', descripcion: 'Tarjeta para quien presenta: habilita herramientas a los espectadores.', archivos: ['src/components/demo/ControlDemoLobby.tsx'], necesita: ['lobby', 'demo'], interruptor: 'pendiente' },

  // ---------------- Perfiles ----------------
  { clave: 'perfil-familiar', tipo: 'PERFIL', nombre: 'Perfil Familia', emoji: '👨‍👩‍👧', descripcion: 'Finanzas del hogar, con gamificación y trofeos.', configuracion: ['4 cuentas activas al 27/10/2026'], interruptor: 'nucleo' },
  { clave: 'perfil-comercial', tipo: 'PERFIL', nombre: 'Perfil Comercial', emoji: '🏪', descripcion: 'Comercio con mercadería.', configuracion: ['1 cuenta activa'], interruptor: 'nucleo' },
  { clave: 'perfil-servicios', tipo: 'PERFIL', nombre: 'Perfil Servicios', emoji: '🧑‍💼', descripcion: 'Negocios de servicios, sin stock.', configuracion: ['1 cuenta activa'], interruptor: 'nucleo' },
  { clave: 'perfil-mixto', tipo: 'PERFIL', nombre: 'Perfil Mixto', emoji: '🧩', descripcion: 'Productos y servicios (incluye la empresa demo).', configuracion: ['2 cuentas activas'], interruptor: 'nucleo' },
  { clave: 'perfil-produccion', tipo: 'PERFIL', nombre: 'Perfil Producción', emoji: '🏭', descripcion: 'Producción con insumos y productos terminados.', configuracion: ['1 cuenta activa'], interruptor: 'nucleo' },

  // ---------------- Panel Maestro ----------------
  { clave: 'pm-caja-materiales', tipo: 'PANEL_MAESTRO', nombre: 'Caja de materiales', emoji: '📦', descripcion: 'Este inventario: dónde se ve lo que existe y se guarda lo que ya no se usa.', ruta: '/panel-maestro/caja-de-materiales', archivos: ['src/app/panel-maestro/caja-de-materiales/page.tsx', 'src/lib/cajaMateriales.ts'], tablas: ['caja_materiales_estado'], interruptor: 'nucleo' },
  { clave: 'pm-seguranca', tipo: 'PANEL_MAESTRO', nombre: 'Segurança e Proteção de Dados', emoji: '🛡️', descripcion: 'Política y controles de datos.', ruta: '/panel-maestro/seguranca-dados', interruptor: 'pendiente' },
  { clave: 'pm-informe-v2', tipo: 'PANEL_MAESTRO', nombre: 'Informe V3.0 — Día 1', emoji: '📊', descripcion: 'Informe de cierre.', ruta: '/panel-maestro/informe-v2', interruptor: 'pendiente' },
  { clave: 'pm-auditoria', tipo: 'PANEL_MAESTRO', nombre: 'Auditoría de Actividad', emoji: '🕵️', descripcion: 'Eventos de actividad por usuario.', ruta: '/panel-maestro/auditoria', interruptor: 'pendiente' },
  { clave: 'pm-analisis-mensual', tipo: 'PANEL_MAESTRO', nombre: 'Análisis Mensual Automático', emoji: '📊', descripcion: 'Análisis mensual generado para las empresas.', ruta: '/panel-maestro/analisis-mensual', interruptor: 'pendiente' },
  { clave: 'pm-cuentas-sin-operacion', tipo: 'PANEL_MAESTRO', nombre: 'Cuentas sin operación', emoji: '🧾', descripcion: 'Auditoría de la regla dura: cuentas del plan sin ninguna operación.', ruta: '/panel-maestro/cuentas-sin-operacion', interruptor: 'pendiente' },
  { clave: 'pm-demo-en-vivo', tipo: 'PANEL_MAESTRO', nombre: 'Demo en vivo', emoji: '🎓', descripcion: 'Qué hacen los espectadores y qué herramientas están habilitadas.', ruta: '/panel-maestro/demo-en-vivo', necesita: ['demo'], interruptor: 'pendiente' },
  { clave: 'pm-apertura-visao-3d', tipo: 'PANEL_MAESTRO', nombre: 'Apertura de Visão 3D', emoji: '🏢', descripcion: 'Quién ve Visão 3D, por perfil o empresa.', ruta: '/panel-maestro/apertura-visao-3d', necesita: ['visao-3d'], interruptor: 'pendiente' },
  { clave: 'pm-probar-tutorial', tipo: 'PANEL_MAESTRO', nombre: 'Probar tutorial de empresas nuevas', emoji: '🧪', descripcion: 'Simula el tutorial de alta.', ruta: '/panel-maestro/probar-tutorial', interruptor: 'pendiente' },
  { clave: 'pm-notificacoes', tipo: 'PANEL_MAESTRO', nombre: 'Notificações', emoji: '🔔', descripcion: 'Solicitudes de alta y pendientes de validar.', ruta: '/panel-maestro/notificacoes', interruptor: 'pendiente' },
];

export function piezaPorClave(clave: string): Pieza | undefined {
  return INVENTARIO.find((p) => p.clave === clave);
}

// Piezas activas (no guardadas) que no funcionan sin `clave`.
export function dependientesActivos(clave: string, enCaja: ReadonlySet<string>): Pieza[] {
  return INVENTARIO.filter((p) => p.necesita?.includes(clave) && !enCaja.has(p.clave));
}

// Piezas de las que `clave` depende y que están guardadas: si se saca de la caja sin ellas, no va a funcionar.
export function necesidadesEnCaja(clave: string, enCaja: ReadonlySet<string>): Pieza[] {
  const p = piezaPorClave(clave);
  return (p?.necesita ?? []).map((c) => piezaPorClave(c)).filter((x): x is Pieza => Boolean(x) && enCaja.has((x as Pieza).clave));
}

export type EvaluacionEnvio = {
  permitido: boolean;
  // Por qué no se puede mandar a la caja.
  bloqueos: string[];
  // Avisos y consecuencias que hay que leer antes de confirmar.
  consecuencias: string[];
  seOculta: string[];
  seConserva: string[];
};

export function evaluarEnvioALaCaja(clave: string, enCaja: ReadonlySet<string>): EvaluacionEnvio {
  const pieza = piezaPorClave(clave);
  if (!pieza) return { permitido: false, bloqueos: ['La pieza no existe en el inventario.'], consecuencias: [], seOculta: [], seConserva: [] };

  const bloqueos: string[] = [];
  if (enCaja.has(clave)) bloqueos.push('Ya está en la caja.');
  if (pieza.interruptor === 'nucleo') bloqueos.push('Es parte del núcleo del sistema: otras piezas se apoyan en ella y no se guarda en la caja.');
  if (pieza.interruptor === 'pendiente') bloqueos.push('Todavía no tiene interruptor: hay que conectarla a la caja (un cambio chico en su pantalla) antes de poder esconderla.');
  for (const d of dependientesActivos(clave, enCaja)) bloqueos.push(`«${d.nombre}» sigue activa y la necesita para funcionar. Guardá primero esa pieza o mantené esta activa.`);

  const consecuencias = [...(pieza.consecuencias ?? [])];
  const faltantes = (pieza.necesita ?? []).map((c) => piezaPorClave(c)?.nombre).filter(Boolean);
  if (faltantes.length > 0) consecuencias.push(`Usa ${faltantes.join(', ')}: esas piezas no se tocan.`);

  return { permitido: bloqueos.length === 0, bloqueos, consecuencias, seOculta: pieza.seOculta ?? [], seConserva: pieza.seConserva ?? [] };
}

export function evaluarSalidaDeLaCaja(clave: string, enCaja: ReadonlySet<string>): { permitido: boolean; avisos: string[] } {
  const faltantes = necesidadesEnCaja(clave, enCaja);
  return {
    permitido: true,
    avisos: faltantes.map((f) => `«${f.nombre}» sigue en la caja y esta pieza la necesita: sacala también o no va a funcionar bien.`),
  };
}
