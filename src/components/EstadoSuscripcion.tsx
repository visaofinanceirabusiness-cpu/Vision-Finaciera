'use client';

import type { ResumenSuscripcion } from '@/lib/suscripcion';

const COLORES_ESTADO: Record<ResumenSuscripcion['estado'], { fondo: string; borde: string; texto: string; emoji: string }> = {
  AL_DIA: { fondo: '#f0fdf4', borde: '#bbf7d0', texto: '#166534', emoji: '🟢' },
  POR_VENCER: { fondo: '#fffbeb', borde: '#fde68a', texto: '#92400e', emoji: '🟡' },
  VENCIDA: { fondo: '#fef2f2', borde: '#fecaca', texto: '#b91c1c', emoji: '🔴' },
};

function textoEstado(resumen: ResumenSuscripcion): string {
  if (resumen.estado === 'VENCIDA') {
    return `Tu período venció hace ${Math.abs(resumen.diasRestantes)} día${Math.abs(resumen.diasRestantes) === 1 ? '' : 's'}.`;
  }

  if (resumen.diasRestantes === 0) {
    return 'Tu período vence hoy.';
  }

  return `Te quedan ${resumen.diasRestantes} día${resumen.diasRestantes === 1 ? '' : 's'} de tu período actual.`;
}

export function TarjetaEstadoSuscripcion({ resumen }: { resumen: ResumenSuscripcion }) {
  const colores = COLORES_ESTADO[resumen.estado];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 12,
        background: colores.fondo,
        border: `1px solid ${colores.borde}`,
        color: colores.texto,
        fontSize: 13.5,
        fontWeight: 600,
        marginBottom: 18,
      }}
    >
      <span style={{ fontSize: 16 }}>{colores.emoji}</span>
      <span>
        {textoEstado(resumen)}{' '}
        <span style={{ fontWeight: 400, opacity: 0.85 }}>
          (vence el {new Date(`${resumen.fechaVencimiento}T00:00:00Z`).toLocaleDateString('es-AR', { timeZone: 'UTC' })})
        </span>
      </span>
    </div>
  );
}

export function BadgeEstadoSuscripcion({ resumen }: { resumen: ResumenSuscripcion }) {
  const colores = COLORES_ESTADO[resumen.estado];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: colores.fondo,
        border: `1px solid ${colores.borde}`,
        color: colores.texto,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {colores.emoji}{' '}
      {resumen.estado === 'VENCIDA'
        ? `Vencida hace ${Math.abs(resumen.diasRestantes)}d`
        : `${resumen.diasRestantes}d restantes`}
    </span>
  );
}
