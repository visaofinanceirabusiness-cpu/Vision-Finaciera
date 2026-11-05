// lib/tiempoAgotado.ts
//
// TIEMPO AGOTADO — control de la suscripción
// =====================================================
// Si el Panel Maestro activó el «control de tiempo» de una empresa
// (empresas.control_tiempo_activo, apagado por defecto) y su suscripción
// venció (empresas.fecha_vencimiento_suscripcion), la empresa:
//   - NO puede cargar operaciones nuevas (el motor, en registrarOperacion, frena
//     con ErrorTiempoAgotado), pero sigue pudiendo mirar todo;
//   - ve un cartel de «se agotó el tiempo» en cada cambio de pantalla, con el QR
//     de Pix y las instrucciones para mandar el comprobante (components/AvisoTiempoAgotado).
// Se renueva marcando el pago recibido en el Panel Maestro (lib/suscripcion.ts).
// Quedan fuera: la demo (espectadores), el admin de la plataforma y las empresas
// con el control apagado. Una empresa no puede tocar su propio interruptor ni su
// fecha: lo impide un trigger en la base (proteger_tiempo_empresa).

import { supabase } from './supabase';

// WhatsApp al que se manda el comprobante del pago (el mismo del QR de Pix).
export const TELEFONO_PAGO = '+55 48 99609-4127';
export const WHATSAPP_PAGO = '5548996094127';

export const EVENTO_TIEMPO_AGOTADO = 'visao:tiempo-agotado';

const ZONA = 'America/Argentina/Buenos_Aires';

// Misma zona horaria que usa el resto del sistema para el «día»: no se corta unas horas antes por culpa del UTC.
export function hoyLocal(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString('en-CA', { timeZone: ZONA });
}

// El último día de la suscripción todavía vale: se corta al día siguiente.
export function estaSinTiempo(v: { controlActivo: boolean; fechaVencimiento: string | null }, hoy: string = hoyLocal()): boolean {
  return v.controlActivo && Boolean(v.fechaVencimiento) && (v.fechaVencimiento as string) < hoy;
}

export class ErrorTiempoAgotado extends Error {
  constructor(idioma: string | null = 'ES') {
    super(
      idioma === 'PT'
        ? 'Seu tempo acabou. Para continuar lançando operações, pague e envie o comprovante.'
        : 'Se agotó tu tiempo. Para seguir cargando operaciones, pagá y enviá el comprobante.'
    );
    this.name = 'ErrorTiempoAgotado';
  }
}

export type EstadoTiempo = { sinTiempo: boolean; vencimiento: string | null; idioma: 'ES' | 'PT'; moneda: string | null; empresaId: string | null; controlActivo: boolean; diasRestantes: number | null };

const SIN_PROBLEMA: EstadoTiempo = { sinTiempo: false, vencimiento: null, idioma: 'ES', moneda: null, empresaId: null, controlActivo: false, diasRestantes: null };

// Días que faltan para el último día de la suscripción (0 = vence hoy, negativo = ya venció).
export function diasHastaVencer(fechaVencimiento: string, hoy: string = hoyLocal()): number {
  const ms = (f: string) => new Date(`${f}T12:00:00Z`).getTime();
  return Math.round((ms(fechaVencimiento) - ms(hoy)) / 86_400_000);
}

export type NivelAviso = 7 | 2;

// Avisos suaves antes de vencer: uno cuando faltan 7 días o menos y otro cuando faltan 2 o menos (incluido el último día).
// Si la persona no entró en el medio, se muestra solo el más urgente que corresponda.
export function nivelDeAviso(diasRestantes: number | null): NivelAviso | null {
  if (diasRestantes === null || diasRestantes < 0) return null;
  if (diasRestantes <= 2) return 2;
  if (diasRestantes <= 7) return 7;
  return null;
}

// Por ahora el único QR de cobro es un Pix, así que solo se muestra a empresas de Brasil (moneda BRL).
export function mostrarQrPix(moneda: string | null | undefined): boolean {
  return moneda === 'BRL';
}
const VIGENCIA_MS = 60_000;
let cache: { empresaId: string; leidoEn: number; estado: EstadoTiempo } | null = null;

export function olvidarEstadoTiempo() {
  cache = null;
}

// `empresaId` nulo = la empresa de quien está conectado. Sin sesión, o siendo demo/admin de plataforma, nunca se bloquea.
export async function leerEstadoTiempo(empresaId?: string): Promise<EstadoTiempo> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return SIN_PROBLEMA;

    const { data: perfil } = await supabase.from('perfiles').select('empresa_id, tipo_usuario, es_admin_plataforma').eq('id', u.user.id).maybeSingle();
    if (!perfil || perfil.es_admin_plataforma || perfil.tipo_usuario === 'ESPECTADOR') return SIN_PROBLEMA;

    const objetivo = empresaId ?? (perfil.empresa_id as string | null);
    if (!objetivo) return SIN_PROBLEMA;
    if (cache && cache.empresaId === objetivo && Date.now() - cache.leidoEn < VIGENCIA_MS) return cache.estado;

    const { data: empresa } = await supabase.from('empresas').select('control_tiempo_activo, fecha_vencimiento_suscripcion, idioma, moneda').eq('id', objetivo).maybeSingle();
    if (!empresa) return SIN_PROBLEMA;

    const estado: EstadoTiempo = {
      sinTiempo: estaSinTiempo({ controlActivo: Boolean(empresa.control_tiempo_activo), fechaVencimiento: (empresa.fecha_vencimiento_suscripcion as string | null) ?? null }),
      vencimiento: (empresa.fecha_vencimiento_suscripcion as string | null) ?? null,
      idioma: empresa.idioma === 'PT' ? 'PT' : 'ES',
      moneda: (empresa.moneda as string | null) ?? null,
      empresaId: objetivo,
      controlActivo: Boolean(empresa.control_tiempo_activo),
      diasRestantes: empresa.fecha_vencimiento_suscripcion ? diasHastaVencer(empresa.fecha_vencimiento_suscripcion as string) : null,
    };
    cache = { empresaId: objetivo, leidoEn: Date.now(), estado };
    return estado;
  } catch {
    // Si no se puede saber, no se frena a nadie: el control nunca debe romper el trabajo por un error de lectura.
    return SIN_PROBLEMA;
  }
}

// Puerta de entrada de las cargas (ver registrarOperacion en lib/motor.ts).
export async function verificarTiempoParaCargar(empresaId: string): Promise<void> {
  const estado = await leerEstadoTiempo(empresaId);
  if (!estado.sinTiempo) return;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_TIEMPO_AGOTADO));
  throw new ErrorTiempoAgotado(estado.idioma);
}

export function mensajeWhatsappComprobante(idioma: string | null | undefined): string {
  return idioma === 'PT'
    ? 'Olá! Segue o comprovante de pagamento da minha assinatura da Visão Financeira.'
    : 'Hola! Te envío el comprobante de pago de mi suscripción de Visão Financeira.';
}
