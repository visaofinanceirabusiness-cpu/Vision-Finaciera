export const metadata = {
  title: 'Visão Financeira',
  description: 'Claridad para decidir. Seguridad para crecer.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f7f9' }}>
        {children}
      </body>
    </html>
  );
}
