'use client';

import type { ReactNode } from 'react';

type DatosVentaMes = {
  mes: string;
  valor: number;
};

type DatosCategoria = {
  nombre: string;
  valor: number;
};

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

// CONTENEDOR GRÁFICOS
// =====================================================

export function ChartCard({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        border:
          '1px solid #e5e7eb',
        borderRadius:
          18,
        padding:
          18,
        background:
          '#fbfcfd',
      }}
    >
      <div
        style={{
          marginBottom:
            6,
        }}
      >
        <div
          style={{
            color:
              COLORES_BASE.gris,
            fontSize:
              16,
            fontWeight:
              800,
          }}
        >
          {titulo}
        </div>

        <div
          style={{
            color:
              '#94a3b8',
            fontSize:
              12,
            marginTop:
              3,
          }}
        >
          {subtitulo}
        </div>
      </div>

      {children}
    </div>
  );
}

// =====================================================
