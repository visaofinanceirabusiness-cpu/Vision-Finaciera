import Link from 'next/link';
import { useEnShell } from '@/components/shell/ShellContext';

// Botón "volver al lobby" de las herramientas. Casita bien visible en
// vez del link de texto chico de antes, porque es la salida que más se
// busca y con el texto solo se perdía arriba a la izquierda.
export function VolverLobby({
  children,
  marginBottom = 18,
}: {
  children: React.ReactNode;
  marginBottom?: number;
}) {
  const enShell = useEnShell();
  // En el nuevo diseño el menú lateral reemplaza al botón «volver».
  if (enShell) return null;

  const texto = typeof children === 'string' ? children.replace(/^\s*(←|&larr;)\s*/, '') : children;

  return (
    <Link
      href="/?vista=empresa"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 16px 7px 10px',
        marginBottom,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.18)',
        border: '1.5px solid rgba(255,255,255,0.55)',
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 700,
        textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M3 11.5 12 4l9 7.5" stroke="#fde68a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 10v9.5h4.5v-5h4v5h4.5V10" fill="#fde68a" stroke="#fde68a" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span>{texto}</span>
    </Link>
  );
}
