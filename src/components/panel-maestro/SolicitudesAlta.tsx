'use client';

// Solicitudes de alta nuevas — pedidos de cuenta hechos por el propio
// cliente desde /crear-cuenta, pendientes de aprobar. Vive en un
// componente propio (compartido entre el lobby del Panel Maestro y
// Panel Maestro → Notificações) para no duplicar este bloque.

import { useState } from 'react';
import type { SolicitudAlta as SolicitudAltaTipo } from '@/lib/panelMaestroTipos';

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

export function SolicitudesAlta({
  solicitudes,
  resolviendo,
  onAprobar,
  onRechazar,
}: {
  solicitudes: SolicitudAltaTipo[];
  resolviendo: string | null;
  onAprobar: (s: SolicitudAltaTipo, modoAutomatico: boolean) => void;
  onRechazar: (s: SolicitudAltaTipo) => void;
}) {
  // Modo con el que arranca cada empresa nueva al aprobarse — por
  // defecto Automático (informes al instante, sin esperar validación
  // manual). El alta en sí siempre es instantánea con cualquiera de
  // los dos: esto solo decide si sus operaciones futuras necesitan
  // que un admin las valide a mano antes de reflejarse.
  const [modoPorSolicitud, setModoPorSolicitud] = useState<Record<string, boolean>>({});

  if (solicitudes.length === 0) return null;

  return (
    <div
      style={{
        background: COLORES_BASE.blanco,
        border: '1px solid #bfdbfe',
        borderRadius: 20,
        padding: 22,
        marginBottom: 24,
        boxShadow: '0 10px 24px rgba(37,99,235,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800, color: COLORES_BASE.azul, marginBottom: 16 }}>
        📥 Solicitudes de alta nuevas
        <span
          style={{
            background: '#2563eb',
            color: '#ffffff',
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {solicitudes.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {solicitudes.map((s) => {
          const modoAutomatico = modoPorSolicitud[s.id] ?? true;

          return (
            <div
              key={s.id}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 13.5, color: COLORES_BASE.azul, lineHeight: 1.6 }}>
                <strong>{s.nombre_empresa}</strong>
                {s.rubro && <span style={{ color: COLORES_BASE.gris }}> · {s.rubro}</span>}
                <br />
                <span style={{ color: COLORES_BASE.gris }}>
                  {s.nombre} · {s.email} · {s.telefono}
                </span>
                <br />
                Perfil elegido: <strong>{s.perfiles_empresa?.nombre ?? '—'}</strong>
                {s.componentes_mixto.length > 0 && (
                  <span style={{ color: COLORES_BASE.gris }}> ({s.componentes_mixto.join(', ')})</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={modoAutomatico ? 'automatico' : 'manual'}
                  onChange={(e) =>
                    setModoPorSolicitud((prev) => ({ ...prev, [s.id]: e.target.value === 'automatico' }))
                  }
                  disabled={resolviendo === s.id}
                  title="Modo con el que arranca esta empresa — se puede cambiar después desde su tarjeta"
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: '1px solid #bfdbfe',
                    background: COLORES_BASE.blanco,
                    color: COLORES_BASE.azul,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <option value="automatico">⚡ Automático</option>
                  <option value="manual">🕒 Manual</option>
                </select>

                <button
                  type="button"
                  disabled={resolviendo === s.id}
                  onClick={() => onAprobar(s, modoAutomatico)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #bbf7d0',
                    background: '#f0fdf4',
                    color: '#166534',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {resolviendo === s.id ? 'Aprobando...' : 'Aprobar ✓'}
                </button>

                <button
                  type="button"
                  disabled={resolviendo === s.id}
                  onClick={() => onRechazar(s)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Rechazar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
