'use client';

// SECCIÓN DESPLEGABLE (ACORDEÓN)
// ==========================================================
//
// Envoltorio genérico para las secciones de Mis Vencimientos / Mis
// Ingresos (Pasivos, Gastos Recurrentes, Cuentas por Cobrar, Ingresos
// Recurrentes) — cada una se puede cerrar tocando su encabezado, para
// no tener que scrollear un panel entero cuando ya está resuelta o
// simplemente no hace falta verla en este momento.

import { useState, type ReactNode } from 'react';

export function AcordeonSeccion({
  titulo,
  totalTexto,
  colorTitulo,
  abiertoPorDefecto = true,
  children,
}: {
  titulo: ReactNode;
  totalTexto?: ReactNode;
  colorTitulo: string;
  abiertoPorDefecto?: boolean;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);

  return (
    <div style={{ marginBottom: 22 }}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'transparent',
          border: 'none',
          padding: '4px 0 8px',
          cursor: 'pointer',
          flexWrap: 'wrap',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: colorTitulo }}>
          <span
            style={{
              display: 'inline-block',
              transform: abierto ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
              fontSize: 11,
            }}
          >
            ▶
          </span>
          {titulo}
        </span>

        {totalTexto}
      </button>

      {abierto && <div>{children}</div>}
    </div>
  );
}
