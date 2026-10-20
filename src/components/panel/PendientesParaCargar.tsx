'use client';

// Cobros y pagos recurrentes que todavía faltan este mes, a un toque desde los
// métodos de carga: al elegir uno viene todo precargado y solo se confirma.

import { useEffect, useState } from 'react';
import { estaVencido, etiquetaPeriodo, pendientesParaCargar, type CompromisoAbierto } from '@/lib/compromisosAbiertos';

export function PendientesParaCargar({
  empresaId,
  idioma,
  simbolo,
  onElegir,
  oscuro = false,
}: {
  empresaId: string;
  idioma: string;
  simbolo: string;
  onElegir: (item: CompromisoAbierto) => void;
  // Sobre fondo oscuro (Mini-Juego) el recuadro se invierte.
  oscuro?: boolean;
}) {
  const esPT = idioma === 'PT';
  const [items, setItems] = useState<CompromisoAbierto[]>([]);

  useEffect(() => {
    let cancelado = false;

    pendientesParaCargar(empresaId)
      .then((lista) => {
        if (!cancelado) setItems(lista);
      })
      .catch(() => {
        if (!cancelado) setItems([]);
      });

    return () => {
      cancelado = true;
    };
  }, [empresaId]);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        background: oscuro ? 'rgba(255,255,255,0.14)' : '#fffbeb',
        border: oscuro ? '1px solid rgba(255,255,255,0.35)' : '1px solid #f59e0b',
        borderRadius: 14,
        padding: '12px 14px',
        marginBottom: 14,
        color: oscuro ? '#fff' : '#78350f',
        fontSize: 13.5,
      }}
    >
      <strong>
        {esPT ? `📌 Você tem ${items.length} pendente${items.length === 1 ? '' : 's'} neste mês` : `📌 Tenés ${items.length} pendiente${items.length === 1 ? '' : 's'} este mes`}
      </strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {items.map((i) => (
          <button
            key={`${i.lado}-${i.recordatorioId}`}
            type="button"
            onClick={() => onElegir(i)}
            style={{
              border: oscuro ? '1px solid rgba(255,255,255,0.5)' : '1px solid #b45309',
              background: oscuro ? 'rgba(255,255,255,0.18)' : '#fff',
              color: oscuro ? '#fff' : '#92400e',
              borderRadius: 10,
              padding: '9px 12px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'block' }}>
              {i.lado === 'COBRAR' ? (esPT ? 'Receber' : 'Cobrar') : 'Pagar'} · {i.nombre} — {simbolo} {i.saldo.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
            </span>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, marginTop: 2, color: estaVencido(i.fechaVencimiento) ? (oscuro ? '#fecaca' : '#b91c1c') : 'inherit' }}>
              {estaVencido(i.fechaVencimiento) ? (esPT ? '⚠️ Vencida' : '⚠️ Vencida') : '📅'} · {etiquetaPeriodo(i.fechaVencimiento, idioma)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
