// Celdas de tabla y badge de Estado compartidos entre Registro de
// Operaciones y Libro Diario (GrupoOperacionCard) — movidos de
// contabilidad/page.tsx (Fase 2 de mantenimiento), sin cambiar nada.

import type { ReactNode, CSSProperties } from 'react';
import { estadoDisplay } from '@/lib/i18n';

export function Th({ children, align = 'left' }: { children?: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      style={{
        padding: '12px 14px',
        color: '#374151',
        fontSize: 12,
        textAlign: align,
        whiteSpace: 'nowrap',
        fontWeight: 800,
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  style,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  style?: CSSProperties;
}) {
  return (
    <td
      style={{
        padding: '12px 14px',
        fontSize: 13,
        textAlign: align,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

export function Estado({ estado, idioma }: { estado: string | null; idioma: string | null }) {
  const valor = estado || 'PENDIENTE';
  const validado = valor.toUpperCase() === 'VALIDADO';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: validado ? '#dcfce7' : '#fef3c7',
        color: validado ? '#166534' : '#92400e',
      }}
    >
      {estadoDisplay(idioma, valor)}
    </span>
  );
}
