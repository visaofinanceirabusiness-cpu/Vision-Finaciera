import './globals.css';
import type { Metadata } from 'next';
import React from 'react';
import { RegistrarServiceWorker } from '@/components/RegistrarServiceWorker';
import { GuardiaSesion } from '@/components/GuardiaSesion';

export const metadata: Metadata = {
  title: 'Visão Financeira',
  description: 'Claridad para decidir. Seguridad para crecer.',
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
          background: '#f5f7f9',
        }}
      >
        <RegistrarServiceWorker />
        <GuardiaSesion />
        {children}
      </body>
    </html>
  );
}
