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
  total,
  acciones,
  colorTitulo,
  abiertoPorDefecto = false,
  children,
}: {
  titulo: ReactNode;
  // Separado de `acciones` (en vez de un solo `totalTexto` combinado)
  // para que el título tenga un ancho fijo y el total de las cuatro
  // secciones (Pasivos, Gastos/Ingresos Recurrentes, Cuentas por
  // Cobrar) arranque siempre en la misma columna, en vez de correrse
  // según cuánto texto tenga cada título o si trae botones al lado.
  total?: ReactNode;
  acciones?: ReactNode;
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
          gap: 16,
          background: 'transparent',
          border: 'none',
          padding: '4px 0 8px',
          cursor: 'pointer',
          flexWrap: 'wrap',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800, color: colorTitulo }}>
          <span
            style={{
              display: 'inline-block',
              transform: abierto ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
              fontSize: 13,
            }}
          >
            ▶
          </span>
          {titulo}
        </span>

        {acciones}

        {/* Empuja el total al borde derecho — así el número de las
            cuatro secciones queda en la misma columna, alineado a la
            derecha, mientras que los botones de acciones quedan
            pegados al título en vez de mezclados con el número. */}
        <span style={{ flex: 1 }} />

        <span style={{ minWidth: 140, textAlign: 'right', flexShrink: 0 }}>{total}</span>
      </button>

      {abierto && <div>{children}</div>}
    </div>
  );
}
