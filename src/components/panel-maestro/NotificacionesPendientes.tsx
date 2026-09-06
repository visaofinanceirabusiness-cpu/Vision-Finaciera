'use client';

// Operaciones (registros y movimientos de mercadería) pendientes de
// que un admin las valide a mano, agrupadas por empresa. Solo aplica
// a empresas en modo Manual — las que están en modo Automático nunca
// llegan acá (ver empresas.validacion_automatica). Componente propio
// (compartido entre el lobby del Panel Maestro y Panel Maestro →
// Notificações) para no duplicar este bloque.

import { useState } from 'react';
import type { Empresa, Pendiente, PendienteRegistro, PendienteMovimiento } from '@/lib/panelMaestroTipos';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

export function NotificacionesPendientes({
  pendientes,
  empresas,
  validando,
  rechazando,
  onValidarRegistro,
  onValidarMovimiento,
  onRechazarRegistro,
  onRechazarMovimiento,
}: {
  pendientes: Pendiente[];
  empresas: Empresa[];
  validando: string | null;
  rechazando: string | null;
  onValidarRegistro: (p: PendienteRegistro) => void;
  onValidarMovimiento: (p: PendienteMovimiento) => void;
  onRechazarRegistro: (p: PendienteRegistro) => void;
  onRechazarMovimiento: (p: PendienteMovimiento) => void;
}) {
  const [abierta, setAbierta] = useState(true);
  const nombrePorEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));
  const simboloPorEmpresa = new Map(empresas.map((e) => [e.id, simboloMoneda(e.moneda)]));

  const porEmpresa = new Map<string, Pendiente[]>();
  for (const p of pendientes) {
    const lista = porEmpresa.get(p.empresaId) ?? [];
    lista.push(p);
    porEmpresa.set(p.empresaId, lista);
  }

  if (pendientes.length === 0) {
    return (
      <div
        style={{
          background: COLORES_BASE.blanco,
          border: '1px solid #e5e7eb',
          borderRadius: 20,
          padding: '18px 22px',
          marginBottom: 24,
          color: COLORES_BASE.gris,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        ✅ No hay nada pendiente de validar en ninguna empresa.
      </div>
    );
  }

  return (
    <div
      style={{
        background: COLORES_BASE.blanco,
        border: '1px solid #fde68a',
        borderRadius: 20,
        padding: 22,
        marginBottom: 24,
        boxShadow: '0 10px 24px rgba(217,119,6,0.08)',
      }}
    >
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800, color: COLORES_BASE.azul }}>
          🔔 Pendientes de validar
          <span
            style={{
              background: '#f59e0b',
              color: '#ffffff',
              borderRadius: 999,
              padding: '3px 10px',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {pendientes.length}
          </span>
        </span>

        <span style={{ color: COLORES_BASE.gris, fontSize: 13 }}>{abierta ? '▾ ocultar' : '▸ mostrar'}</span>
      </button>

      {abierta && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Array.from(porEmpresa.entries()).map(([empresaId, items]) => (
            <div key={empresaId}>
              <div style={{ fontSize: 13, fontWeight: 800, color: COLORES_BASE.azul, marginBottom: 8 }}>
                {nombrePorEmpresa.get(empresaId) ?? 'Empresa'}{' '}
                <span style={{ color: COLORES_BASE.gris, fontWeight: 600 }}>· {items.length} pendiente{items.length === 1 ? '' : 's'}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((p) => (
                  <div
                    key={`${p.tipo}-${p.idOperacion}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ fontSize: 13, color: COLORES_BASE.azul }}>
                      <strong>{p.idOperacion}</strong>{' '}
                      <span style={{ color: COLORES_BASE.gris }}>
                        {p.tipo === 'registro'
                          ? `· ${p.operacion} · ${p.categoria}${p.historico ? ` · ${p.historico}` : ''}`
                          : `· Movimiento de mercadería · ${p.lineas} línea${p.lineas === 1 ? '' : 's'}`}
                      </span>
                      {' — '}
                      <span style={{ fontWeight: 700 }}>
                        {simboloPorEmpresa.get(empresaId) ?? 'R$'} {formatearNumeroEntero(p.total)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={validando === `${p.tipo}-${p.idOperacion}` || rechazando === `${p.tipo}-${p.idOperacion}`}
                        onClick={() => (p.tipo === 'registro' ? onValidarRegistro(p) : onValidarMovimiento(p))}
                        style={{
                          padding: '7px 14px',
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
                        {validando === `${p.tipo}-${p.idOperacion}` ? '...' : 'Validado ✓'}
                      </button>

                      <button
                        type="button"
                        disabled={validando === `${p.tipo}-${p.idOperacion}` || rechazando === `${p.tipo}-${p.idOperacion}`}
                        onClick={() => (p.tipo === 'registro' ? onRechazarRegistro(p) : onRechazarMovimiento(p))}
                        style={{
                          padding: '7px 14px',
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
                        {rechazando === `${p.tipo}-${p.idOperacion}` ? '...' : 'Rechazar ✗'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
