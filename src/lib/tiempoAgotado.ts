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

export type EstadoTiempo = { sinTiempo: boolean; vencimiento: string | null; idioma: 'ES' | 'PT' };

const SIN_PROBLEMA: EstadoTiempo = { sinTiempo: false, vencimiento: null, idioma: 'ES' };
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

    const { data: empresa } = await supabase.from('empresas').select('control_tiempo_activo, fecha_vencimiento_suscripcion, idioma').eq('id', objetivo).maybeSingle();
    if (!empresa) return SIN_PROBLEMA;

    const estado: EstadoTiempo = {
      sinTiempo: estaSinTiempo({ controlActivo: Boolean(empresa.control_tiempo_activo), fechaVencimiento: (empresa.fecha_vencimiento_suscripcion as string | null) ?? null }),
      vencimiento: (empresa.fecha_vencimiento_suscripcion as string | null) ?? null,
      idioma: empresa.idioma === 'PT' ? 'PT' : 'ES',
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
