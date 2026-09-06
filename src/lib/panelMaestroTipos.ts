// lib/panelMaestroTipos.ts
//
// Tipos compartidos entre las pantallas de administración (hoy Panel
// Maestro y Panel Maestro → Notificações). Viven acá, aparte, para
// que ambas páginas los importen del mismo lugar en vez de duplicar
// la forma de estos datos.

export type Empresa = {
  id: string;
  nombre: string;
  rubro: string | null;
  logo_url: string | null;
  numero_cliente: number;
  moneda: string | null;
  fecha_vencimiento_suscripcion: string;
  creado_en: string;
  perfiles_empresa: { nombre: string } | null;
  // Modo automático: si es true, las operaciones de esta empresa
  // entran directo como VALIDADO (no pasan por la cola de "Pendientes
  // de validar" acá). Pensado a futuro como diferenciador de plan.
  validacion_automatica: boolean;
};

export type PendienteRegistro = {
  tipo: 'registro';
  empresaId: string;
  idOperacion: string;
  fecha: string;
  operacion: string;
  categoria: string;
  total: number;
  historico: string | null;
};

export type PendienteMovimiento = {
  tipo: 'movimiento';
  empresaId: string;
  idOperacion: string;
  fecha: string;
  lineas: number;
  total: number;
};

export type Pendiente = PendienteRegistro | PendienteMovimiento;

export type SolicitudAlta = {
  id: string;
  user_id: string;
  email: string;
  nombre: string;
  sexo: string | null;
  telefono: string;
  nombre_empresa: string;
  rubro: string | null;
  moneda: string;
  idioma: string;
  perfil_empresa_id: string;
  componentes_mixto: string[];
  creado_en: string;
  perfiles_empresa: { nombre: string; codigo: string } | null;
};

export type SolicitudAltaResuelta = SolicitudAlta & {
  estado: 'APROBADA' | 'RECHAZADA';
  resuelto_en: string;
};
