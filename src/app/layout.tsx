import './globals.css';
import type { Metadata } from 'next';
import React from 'react';
import { RegistrarServiceWorker } from '@/components/RegistrarServiceWorker';
import { GuardiaSesion } from '@/components/GuardiaSesion';
import { TemaGlobal } from '@/components/TemaGlobal';
import { ProveedorEspectador } from '@/components/demo/ProveedorEspectador';

export const metadata: Metadata = {
  // Las imágenes de la vista previa al compartir un link deben ser URLs absolutas.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://vision-finaciera.vercel.app'),
  title: 'Visão Financeira',
  description: 'Claridad para decidir. Seguridad para crecer.',
  openGraph: {
    type: 'website',
    siteName: 'Visão Financeira',
    title: 'Visão Financeira',
    description: 'Clareza para decidir. Segurança para crescer.',
    locale: 'pt_BR',
    images: [{ url: '/logo.jpeg', width: 1254, height: 1254, alt: 'Visão Financeira' }],
  },
  twitter: {
    card: 'summary',
    title: 'Visão Financeira',
    description: 'Clareza para decidir. Segurança para crescer.',
    images: ['/logo.jpeg'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Visão Financeira',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#1f3a5f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          background: 'var(--fondo-app, #f5f7f9)',
        }}
      >
        <RegistrarServiceWorker />
        <GuardiaSesion />
        <TemaGlobal />
        <ProveedorEspectador />
        {children}
      </body>
    </html>
  );
}
