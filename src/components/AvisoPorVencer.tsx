'use client';

// Aviso suave de «tu suscripción está por vencer» (ver lib/tiempoAgotado.ts): sale UNA vez cuando faltan 7 días y UNA vez cuando
// faltan 2 (o menos), solo con el control de tiempo activo. Usa el mismo look de los festejos (confeti, estrellas, fuegos y un
// sonido corto), pero con tono de recordatorio, y lleva el QR de Pix (Brasil) o el WhatsApp para pagar a tiempo.
// Lo ya visto se recuerda en el navegador por empresa + fecha de vencimiento, así que al renovar vuelve a empezar solo.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CONFIG_FESTEJO, POSICIONES_FUEGOS_FESTEJO, reproducirSonidoFestejo } from '@/lib/festejoVisual';
import { TELEFONO_PAGO, WHATSAPP_PAGO, leerEstadoTiempo, mensajeWhatsappComprobante, mostrarQrPix, nivelDeAviso, type EstadoTiempo, type NivelAviso } from '@/lib/tiempoAgotado';

const RUTAS_SIN_AVISO = ['/login', '/crear-cuenta', '/loja', '/recuperar-senha', '/restablecer-senha', '/aceptar-convite', '/demo', '/panel-maestro'];

const clave = (e: EstadoTiempo, nivel: NivelAviso) => `vf_aviso_tiempo:${e.empresaId}:${e.vencimiento}:${nivel}`;

function yaVisto(k: string): boolean {
  try {
    return window.localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
}

function marcarVisto(k: string) {
  try {
    window.localStorage.setItem(k, '1');
  } catch {
    /* sin almacenamiento: el aviso puede repetirse, no pasa nada */
  }
}

export function AvisoPorVencer() {
  const pathname = usePathname();
  const [datos, setDatos] = useState<{ estado: EstadoTiempo; nivel: NivelAviso } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pathname || RUTAS_SIN_AVISO.some((r) => pathname === r || pathname.startsWith(`${r}/`))) return;
    let vivo = true;
    (async () => {
      const e = await leerEstadoTiempo();
      if (!vivo || !e.controlActivo || e.sinTiempo || !e.empresaId || !e.vencimiento) return;
      const nivel = nivelDeAviso(e.diasRestantes);
      if (!nivel) return;
      // Cada aviso sale una sola vez; si ya vio el de 2 días, el de 7 no vuelve.
      if (yaVisto(clave(e, nivel)) || (nivel === 7 && yaVisto(clave(e, 2)))) return;
      marcarVisto(clave(e, nivel));
      setDatos((actual) => actual ?? { estado: e, nivel });
    })();
    return () => {
      vivo = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!datos) return;
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    reproducirSonidoFestejo(CONFIG_FESTEJO[datos.nivel === 2 ? 'BRONCE' : 'PLATA'].notasSonido);
    return () => cancelAnimationFrame(id);
  }, [datos]);

  if (!datos) return null;

  const { estado, nivel } = datos;
  const pt = estado.idioma === 'PT';
  const t = (es: string, p: string) => (pt ? p : es);
  // Tono: a los 7 días plateado y tranquilo; a los 2, naranja de «ya casi».
  const config = CONFIG_FESTEJO[nivel === 2 ? 'BRONCE' : 'PLATA'];
  const dias = estado.diasRestantes ?? nivel;
  const emoji = nivel === 2 ? '⌛' : '⏰';
  const titulo = dias <= 0 ? t('¡Tu suscripción vence hoy!', 'Sua assinatura vence hoje!') : dias === 1 ? t('¡Tu suscripción vence mañana!', 'Sua assinatura vence amanhã!') : t(`Tu suscripción vence en ${dias} días`, `Sua assinatura vence em ${dias} dias`);
  const vence = new Date(`${estado.vencimiento}T12:00:00Z`).toLocaleDateString(pt ? 'pt-BR' : 'es-AR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const conQr = mostrarQrPix(estado.moneda);
  const enlace = `https://wa.me/${WHATSAPP_PAGO}?text=${encodeURIComponent(mensajeWhatsappComprobante(estado.idioma))}`;
  const cerrar = () => setDatos(null);

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 19000, background: config.overlayFondo, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, overflow: 'auto' }}>
      <style>{`
        @keyframes vencePieza { 0% { transform: translateY(-40px) rotate(0deg); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(300px) rotate(360deg); opacity: 0; } }
        @keyframes venceBounce { 0% { transform: scale(0) rotate(-20deg); opacity: 0; } 55% { transform: scale(1.25) rotate(8deg); opacity: 1; } 75% { transform: scale(.95) rotate(-4deg); } 100% { transform: scale(1) rotate(0); } }
        @keyframes venceBalanceo { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
        @keyframes venceEstrella { 0%, 100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes venceFuego { 0% { transform: scale(0); opacity: 1; } 70% { opacity: .9; } 100% { transform: scale(1); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .vence-anim, .vence-anim * { animation: none !important; } }
      `}</style>

      <div className="vence-anim" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {POSICIONES_FUEGOS_FESTEJO.slice(0, Math.max(2, config.cantFuegos)).map((f, i) => (
          <div key={i} style={{ position: 'absolute', left: f.left, top: f.top, width: 140, height: 140, borderRadius: '50%', background: `repeating-conic-gradient(from 0deg, ${config.color} 0deg 12deg, transparent 12deg 30deg)`, opacity: 0.85, animation: `venceFuego 1.6s ease-out ${f.delay}s infinite` }} />
        ))}
        {Array.from({ length: Math.max(6, config.cantEstrellas) }).map((_, i) => (
          <span key={i} style={{ position: 'absolute', left: `${(i * 37 + 5) % 100}%`, top: `${(i * 53 + 8) % 100}%`, fontSize: 14 + (i % 3) * 6, animation: `venceEstrella ${1.2 + (i % 4) * 0.3}s ease-in-out ${i * 0.15}s infinite` }}>⭐</span>
        ))}
      </div>

      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', overflow: 'hidden', background: config.cardFondo, border: config.cardBorde === 'none' ? `3px solid ${config.color}` : config.cardBorde, boxShadow: config.cardSombra, borderRadius: 26, padding: '30px 24px 24px', maxWidth: 440, width: '100%', textAlign: 'center', margin: 'auto', color: '#1f2937', transform: visible ? 'scale(1)' : 'scale(0.6)', opacity: visible ? 1 : 0, transition: 'transform .35s cubic-bezier(.34,1.56,.64,1), opacity .25s ease' }}>
        <div className="vence-anim" aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {Array.from({ length: config.piezasConfetti }).map((_, i) => (
            <span key={i} style={{ position: 'absolute', top: 0, left: `${(i * 41) % 100}%`, width: 7, height: 7, borderRadius: i % 2 === 0 ? '50%' : 2, background: config.paletaConfetti[i % config.paletaConfetti.length], animation: `vencePieza ${1.4 + (i % 5) * 0.2}s ease-in ${i * 0.05}s infinite` }} />
          ))}
        </div>

        <div className="vence-anim" style={{ position: 'relative', fontSize: 84, lineHeight: 1, animation: 'venceBounce .7s cubic-bezier(.34,1.56,.64,1), venceBalanceo 1.6s ease-in-out .7s infinite' }}>{emoji}</div>
        <h2 style={{ position: 'relative', margin: '12px 0 4px', fontSize: 26, lineHeight: 1.15, color: config.color, fontWeight: 900 }}>{titulo}</h2>
        <p style={{ position: 'relative', margin: '0 0 12px', fontSize: 17, lineHeight: 1.5, fontWeight: 600 }}>
          {t(`Vence el ${vence}. Renová a tiempo para no quedarte sin poder cargar operaciones.`, `Vence em ${vence}. Renove a tempo para não ficar sem poder lançar operações.`)}
        </p>

        <div style={{ position: 'relative', background: 'rgba(255,255,255,0.85)', border: `2px solid ${config.color}55`, borderRadius: 16, padding: '10px 14px', margin: '0 0 12px', fontSize: 16, lineHeight: 1.5, textAlign: 'left' }}>
          {conQr ? (
            <>
              <div><strong>1️⃣</strong> {t('Pagá con Pix escaneando el QR.', 'Pague com Pix escaneando o QR.')}</div>
              <div><strong>2️⃣</strong> {t('Enviá el comprobante a este número:', 'Envie o comprovante para este número:')} <strong style={{ whiteSpace: 'nowrap' }}>{TELEFONO_PAGO}</strong></div>
            </>
          ) : (
            <div>{t('Escribinos por WhatsApp para coordinar el pago y envianos el comprobante a:', 'Escreva-nos pelo WhatsApp para combinar o pagamento e envie o comprovante para:')} <strong style={{ whiteSpace: 'nowrap' }}>{TELEFONO_PAGO}</strong></div>
          )}
        </div>

        {conQr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/pago/pix-qr.webp" alt={t('QR de Pix para pagar', 'QR do Pix para pagar')} style={{ position: 'relative', width: 'auto', maxWidth: '100%', maxHeight: '34vh', borderRadius: 14, border: '2px solid #e5e7eb' }} />
        )}

        <a href={enlace} target="_blank" rel="noreferrer" style={{ position: 'relative', display: 'block', marginTop: 12, background: '#25d366', color: '#fff', textDecoration: 'none', borderRadius: 14, padding: '12px 14px', fontWeight: 800, fontSize: 17 }}>
          📲 {t('Enviar comprobante por WhatsApp', 'Enviar comprovante por WhatsApp')}
        </a>
        <button type="button" onClick={cerrar} style={{ position: 'relative', marginTop: 12, border: 'none', background: config.color, color: '#fff', borderRadius: 12, padding: '12px 32px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
          {t('Entendido', 'Entendi')}
        </button>
      </div>
    </div>
  );
}
