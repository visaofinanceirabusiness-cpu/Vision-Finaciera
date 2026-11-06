'use client';

// Aviso que reemplaza una pantalla cuya pieza está guardada en la caja de materiales para el perfil de quien la abre
// (ver lib/cajaMateriales.ts). El administrador de plataforma nunca lo ve: abre todo.

import Link from 'next/link';

export function CajaNoDisponible({ nombre, idioma }: { nombre: string; idioma: 'ES' | 'PT' }) {
  const pt = idioma === 'PT';
  return (
    <main style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', maxWidth: 440, textAlign: 'center', boxShadow: '0 10px 30px rgba(31,58,95,0.10)' }}>
        <div style={{ fontSize: 44 }}>📦</div>
        <h1 style={{ color: '#1f3a5f', fontSize: 22, margin: '8px 0' }}>{pt ? `${nombre} não está disponível` : `${nombre} no está disponible`}</h1>
        <p style={{ color: '#6e7781', lineHeight: 1.5 }}>{pt ? 'Esta ferramenta não está disponível no seu perfil por enquanto. Seus dados e operações continuam intactos.' : 'Esta herramienta no está disponible en tu perfil por ahora. Tus datos y operaciones siguen intactos.'}</p>
        <Link href="/" style={{ display: 'inline-block', marginTop: 8, background: '#2e8b57', color: '#fff', fontWeight: 700, padding: '11px 22px', borderRadius: 12, textDecoration: 'none' }}>{pt ? 'Voltar ao início' : 'Volver al inicio'}</Link>
      </div>
    </main>
  );
}
