'use client';

// Cartel de «se agotó tu tiempo» (ver lib/tiempoAgotado.ts). Se puede cerrar, pero vuelve a salir CADA vez que la persona cambia
// de pantalla y cada vez que intenta cargar una operación: es a propósito algo molesto. La X se habilita a los 3 segundos.
// Lleva el QR de Pix y la instrucción de mandar el comprobante al WhatsApp indicado.

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EVENTO_TIEMPO_AGOTADO, TELEFONO_PAGO, WHATSAPP_PAGO, leerEstadoTiempo, mensajeWhatsappComprobante, mostrarQrPix, type EstadoTiempo } from '@/lib/tiempoAgotado';

// Pantallas públicas o de acceso: ahí no hay nadie «usando» el sistema.
const RUTAS_SIN_CARTEL = ['/login', '/crear-cuenta', '/loja', '/recuperar-senha', '/restablecer-senha', '/aceptar-convite', '/demo', '/panel-maestro'];
const ESPERA_X_SEGUNDOS = 3;

export function AvisoTiempoAgotado() {
  const pathname = usePathname();
  const [estado, setEstado] = useState<EstadoTiempo | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [espera, setEspera] = useState(ESPERA_X_SEGUNDOS);

  const mostrar = useCallback(async () => {
    const e = await leerEstadoTiempo();
    if (!e.sinTiempo) return;
    setEstado(e);
    setEspera(ESPERA_X_SEGUNDOS);
    setAbierto(true);
  }, []);

  // Cada cambio de pantalla lo vuelve a mostrar.
  useEffect(() => {
    if (!pathname || RUTAS_SIN_CARTEL.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
      setAbierto(false);
      return;
    }
    void mostrar();
  }, [pathname, mostrar]);

  // Y también cuando se intenta cargar una operación sin tiempo.
  useEffect(() => {
    const alIntentar = () => void mostrar();
    window.addEventListener(EVENTO_TIEMPO_AGOTADO, alIntentar);
    return () => window.removeEventListener(EVENTO_TIEMPO_AGOTADO, alIntentar);
  }, [mostrar]);

  useEffect(() => {
    if (!abierto || espera <= 0) return;
    const id = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [abierto, espera]);

  if (!abierto || !estado) return null;

  const pt = estado.idioma === 'PT';
  const t = (es: string, p: string) => (pt ? p : es);
  const vence = estado.vencimiento ? new Date(`${estado.vencimiento}T12:00:00Z`).toLocaleDateString(pt ? 'pt-BR' : 'es-AR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
  const enlace = `https://wa.me/${WHATSAPP_PAGO}?text=${encodeURIComponent(mensajeWhatsappComprobante(estado.idioma))}`;
  const puedeCerrar = espera <= 0;
  const conQr = mostrarQrPix(estado.moneda);

  return (
    <div role="alertdialog" aria-modal="true" aria-label={t('Se agotó tu tiempo', 'Seu tempo acabou')} style={{ position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(15,23,42,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, overflowY: 'auto' }}>
      <style>{`
        @keyframes tiempo-entra { 0% { transform: scale(.85) rotate(-1.5deg); opacity: 0; } 55% { transform: scale(1.04) rotate(1deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
        @keyframes tiempo-late { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,.55), 0 24px 60px rgba(0,0,0,.45); } 50% { box-shadow: 0 0 0 14px rgba(220,38,38,0), 0 24px 60px rgba(0,0,0,.45); } }
        .tiempo-tarjeta { animation: tiempo-entra .5s ease-out, tiempo-late 1.6s ease-in-out .5s infinite; }
        @media (prefers-reduced-motion: reduce) { .tiempo-tarjeta { animation: none; } }
      `}</style>
      <div className="tiempo-tarjeta" style={{ position: 'relative', background: '#fff', borderRadius: 26, maxWidth: 520, width: '100%', padding: '22px 22px 24px', borderTop: '10px solid #dc2626', textAlign: 'center', color: '#1f3a5f', margin: 'auto' }}>
        <button
          type="button"
          onClick={() => puedeCerrar && setAbierto(false)}
          disabled={!puedeCerrar}
          aria-label={t('Cerrar', 'Fechar')}
          style={{ position: 'absolute', top: 12, right: 12, minWidth: 40, height: 40, padding: '0 12px', borderRadius: 999, border: 'none', background: puedeCerrar ? '#eef2f7' : '#f3f4f6', color: puedeCerrar ? '#1f3a5f' : '#9ca3af', fontSize: puedeCerrar ? 20 : 14, fontWeight: 800, cursor: puedeCerrar ? 'pointer' : 'not-allowed' }}
        >
          {puedeCerrar ? '✕' : espera}
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sabio/sabio-calendario.webp" alt="" style={{ height: 96, width: 'auto', display: 'block', margin: '0 auto 6px' }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 28, lineHeight: 1.15, color: '#b91c1c' }}>⏳ {t('¡Se agotó tu tiempo!', 'Seu tempo acabou!')}</h2>
        <p style={{ margin: '0 0 12px', fontSize: 17, lineHeight: 1.5 }}>
          {t('Tu período en Visão Financeira terminó', 'Seu período na Visão Financeira terminou')}{vence ? ` ${t('el', 'em')} ${vence}` : ''}.{' '}
          {t('Podés seguir mirando tus informes, pero no vas a poder cargar operaciones nuevas hasta renovar.', 'Você pode continuar vendo seus relatórios, mas não poderá lançar novas operações até renovar.')}
        </p>

        <div style={{ background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 16, padding: '12px 14px', margin: '0 0 12px', fontSize: 17, lineHeight: 1.5, textAlign: 'left' }}>
          {conQr ? (
            <>
              <div><strong>1️⃣</strong> {t('Pagá con Pix escaneando el QR.', 'Pague com Pix escaneando o QR.')}</div>
              <div><strong>2️⃣</strong> {t('Enviá el comprobante de pago a este número:', 'Envie o comprovante de pagamento para este número:')} <strong style={{ whiteSpace: 'nowrap' }}>{TELEFONO_PAGO}</strong></div>
            </>
          ) : (
            <div>{t('Escribinos por WhatsApp para coordinar el pago y renovar. Después enviá el comprobante al mismo número:', 'Escreva-nos pelo WhatsApp para combinar o pagamento e renovar. Depois envie o comprovante para o mesmo número:')} <strong style={{ whiteSpace: 'nowrap' }}>{TELEFONO_PAGO}</strong></div>
          )}
        </div>

        {conQr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/pago/pix-qr.webp" alt={t('QR de Pix para pagar', 'QR do Pix para pagar')} style={{ width: 'auto', maxWidth: '100%', maxHeight: '46vh', borderRadius: 14, border: '2px solid #e5e7eb' }} />
        )}

        <a href={enlace} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 14, background: '#25d366', color: '#fff', textDecoration: 'none', borderRadius: 16, padding: '14px 16px', fontWeight: 800, fontSize: 18 }}>
          📲 {t('Enviar comprobante por WhatsApp', 'Enviar comprovante por WhatsApp')}
        </a>
        <div style={{ marginTop: 10, fontSize: 14, color: '#6e7781' }}>{puedeCerrar ? t('Podés cerrar este aviso, pero va a volver a aparecer.', 'Você pode fechar este aviso, mas ele voltará a aparecer.') : t(`Podés cerrar este aviso en ${espera}…`, `Você poderá fechar este aviso em ${espera}…`)}</div>
      </div>
    </div>
  );
}
