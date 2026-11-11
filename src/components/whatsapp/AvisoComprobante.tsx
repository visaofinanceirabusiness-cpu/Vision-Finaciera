'use client';

// «COMPROBANTE LISTO» — aparece después de cada venta con cliente que tiene teléfono. WhatsApp se abre solo con el mensaje ya armado
// (no hay WhatsApp Business API: la persona toca «Enviar» dentro de WhatsApp). Si el navegador bloquea la apertura automática, queda
// este aviso con el botón y el mensaje a la vista. Lo usan la Central de Lanzamientos y el Mini-Juego.

import { useEffect, useRef, useState } from 'react';
import { abrirWhatsappAutomatico, type ComprobanteListo } from '@/lib/whatsappVentas';

export function AvisoComprobante({ comprobante, idioma, onCerrar, automatico = true }: { comprobante: ComprobanteListo; idioma: string | null | undefined; onCerrar: () => void; automatico?: boolean }) {
  const esPT = idioma === 'PT';
  const [bloqueado, setBloqueado] = useState(false);
  const intentado = useRef<string | null>(null);

  useEffect(() => {
    if (!automatico || intentado.current === comprobante.enlace) return;
    intentado.current = comprobante.enlace;
    if (!abrirWhatsappAutomatico(comprobante.enlace)) setBloqueado(true);
  }, [automatico, comprobante.enlace]);

  return (
    <div role="status" style={{ marginTop: 12, padding: '14px 16px', borderRadius: 14, background: '#e7f9ef', border: '2px solid #25D366', color: '#1f3a5f', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 15 }}>
          📲 {esPT ? `Comprovante pronto para ${comprobante.cliente}` : `Comprobante listo para ${comprobante.cliente}`}
        </strong>
        <button type="button" onClick={onCerrar} aria-label={esPT ? 'Fechar' : 'Cerrar'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#1f3a5f' }}>✕</button>
      </div>
      <p style={{ margin: '6px 0 8px', fontSize: 13 }}>
        {bloqueado
          ? esPT ? 'O navegador bloqueou a abertura automática. Toque em enviar:' : 'El navegador bloqueó la apertura automática. Tocá para enviarlo:'
          : esPT ? 'Abrimos o WhatsApp com a mensagem pronta: só falta tocar em Enviar.' : 'Abrimos WhatsApp con el mensaje ya armado: solo falta tocar Enviar.'}
      </p>
      <pre style={{ margin: '0 0 10px', padding: '10px 12px', background: '#fff', borderRadius: 10, fontSize: 12.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit', maxHeight: 180, overflow: 'auto' }}>{comprobante.mensaje}</pre>
      <a href={comprobante.enlace} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#25D366', color: '#fff', borderRadius: 10, padding: '10px 16px', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
        📲 {bloqueado ? (esPT ? 'Enviar por WhatsApp' : 'Enviar por WhatsApp') : esPT ? 'Abrir de novo' : 'Abrir de nuevo'}
      </a>
    </div>
  );
}
