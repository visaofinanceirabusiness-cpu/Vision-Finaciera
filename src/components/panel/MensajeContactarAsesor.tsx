import Link from 'next/link';

// Herramientas con contenido a medida (Plan de Acción de 30 Días, Nuestro
// Sueño): la pantalla existe para todas las empresas, pero el contenido lo
// carga un asesor. Hasta entonces se muestra este aviso en vez de una pantalla
// vacía o un acceso que desaparece.
export function MensajeContactarAsesor({
  emoji,
  titulo,
  idioma,
}: {
  emoji: string;
  titulo: string;
  idioma?: string | null;
}) {
  const esPT = idioma === 'PT';

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--fondo-app, #f5f7f9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 24,
          padding: 28,
          textAlign: 'center',
          boxShadow: '0 10px 28px rgba(31,58,95,0.06)',
        }}
      >
        <div style={{ fontSize: 44 }}>{emoji}</div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 24, color: 'var(--color-primario, #1f3a5f)' }}>{titulo}</h1>
        <p style={{ margin: '0 0 18px', fontSize: 15, color: '#475569', lineHeight: 1.6 }}>
          {esPT
            ? 'Esta ferramenta ainda não tem conteúdo carregado para a sua empresa. Entre em contato com um assessor para carregar o plano.'
            : 'Esta herramienta todavía no tiene contenido cargado para tu empresa. Ponete en contacto con un asesor para que cargue el plan.'}
        </p>
        <Link href="/" style={{ color: 'var(--color-primario, #1f3a5f)', fontWeight: 800, textDecoration: 'none' }}>
          {esPT ? '← Voltar ao início' : '← Volver al inicio'}
        </Link>
      </div>
    </main>
  );
}
