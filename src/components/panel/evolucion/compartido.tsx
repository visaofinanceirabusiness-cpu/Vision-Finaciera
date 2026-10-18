'use client';

// Piezas compartidas por las vistas de la tarjeta de evolución financiera
// (Tendência, Comparar...).

import type { CSSProperties, ReactNode } from 'react';

export type Serie = 'ingresos' | 'costos' | 'gastos' | 'resultado' | 'margenBruto';

export const COLOR = {
  ingresos: '#2e8b57',
  costos: '#ea8a1a',
  gastos: '#dc2626',
  resultado: '#1f3a5f',
  margenBruto: '#0d9488',
};

export const AZUL = '#1f3a5f';

// Subir ingresos/resultado/margen es bueno; subir costos o gastos, no.
export const SUBIR_ES_BUENO: Record<Serie, boolean> = { ingresos: true, resultado: true, margenBruto: true, costos: false, gastos: false };

export const controlEstilo: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 14,
  fontWeight: 600,
  color: '#374151',
  background: '#fff',
};

export function Variacion({
  valor,
  subirEsBueno,
  etiqueta,
  locale,
  chica = false,
  noHayBase,
}: {
  valor: number | null;
  subirEsBueno: boolean;
  etiqueta: string;
  locale: string;
  chica?: boolean;
  noHayBase: string;
}) {
  if (valor === null) {
    return <span style={{ fontSize: chica ? 12 : 13, color: '#94a3b8' }}>{noHayBase}</span>;
  }

  const sube = valor > 0;
  const bueno = valor === 0 ? null : sube === subirEsBueno;
  const color = bueno === null ? '#6b7280' : bueno ? '#15803d' : '#dc2626';

  return (
    <span style={{ fontSize: chica ? 12 : 13, color: '#6b7280' }}>
      <b style={{ color }}>
        {valor > 0 ? '↑' : valor < 0 ? '↓' : '='} {Math.abs(valor).toLocaleString(locale, { maximumFractionDigits: 0 })}%
      </b>{' '}
      {etiqueta}
    </span>
  );
}

export function BotonFlecha({ deshabilitado, onClick, etiqueta, children }: { deshabilitado: boolean; onClick: () => void; etiqueta: string; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={deshabilitado}
      onClick={onClick}
      aria-label={etiqueta}
      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: AZUL, fontSize: 18, fontWeight: 800, lineHeight: 1, cursor: deshabilitado ? 'default' : 'pointer', opacity: deshabilitado ? 0.35 : 1 }}
    >
      {children}
    </button>
  );
}

export type VistaEvolucion = 'TENDENCIA' | 'COMPARAR';

export function PestanasVista({ vista, onCambiar, t }: { vista: VistaEvolucion; onCambiar: (v: VistaEvolucion) => void; t: (es: string, pt: string) => string }) {
  const opciones: { id: VistaEvolucion; etiqueta: string; icono: string }[] = [
    { id: 'TENDENCIA', etiqueta: t('Tendencia', 'Tendência'), icono: '📈' },
    { id: 'COMPARAR', etiqueta: t('Comparar', 'Comparar'), icono: '📊' },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 4px' }}>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onCambiar(o.id)}
          aria-pressed={vista === o.id}
          style={{
            border: `1px solid ${vista === o.id ? AZUL : '#d1d5db'}`,
            background: vista === o.id ? AZUL : '#fff',
            color: vista === o.id ? '#fff' : '#374151',
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {o.icono} {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
