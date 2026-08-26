'use client';
import { supabase } from '@/lib/supabase';

type Empresa = {
  nombre: string;
  rubro: string | null;
  logo_url: string | null;
};

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

export function PanelHeader({
  empresa,
  colores,
  onLogout,
}: {
  empresa: Empresa | null;
  colores: {
    azul: string;
    verde: string;
    acento: string;
    blanco: string;
  };
  onLogout: () => void;
}) {
  const logoDisponible = Boolean(empresa?.logo_url?.trim());

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 78, height: 78, borderRadius: 20, background: colores.blanco, border: `2px solid ${colores.acento}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 8px 20px rgba(31,58,95,0.10)', flexShrink: 0 }}>
          {logoDisponible ? (
            <img src={empresa!.logo_url!} alt={`Logo de ${empresa?.nombre ?? 'empresa'}`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
          ) : (
            <span style={{ fontSize: 30, fontWeight: 800, color: colores.azul }}>
              {(empresa?.nombre ?? 'M').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: colores.azul }}>
            {empresa?.nombre ?? 'Mi Negocio'}
          </div>
          <div style={{ fontSize: 13, color: COLORES_BASE.gris, marginTop: 3 }}>
            {empresa?.rubro ?? 'Gestión financiera'}
          </div>
        </div>
      </div>
      <button onClick={onLogout} style={{ background: colores.blanco, border: '1px solid #d1d5db', borderRadius: 12, padding: '11px 16px', cursor: 'pointer', color: colores.azul, fontWeight: 700 }}>
        Cerrar sesión
      </button>
    </div>
  );
}
