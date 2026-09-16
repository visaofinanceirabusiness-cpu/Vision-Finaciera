'use client';

// MINI-DIÁLOGO DE SABIO PARA REGISTRAR UN INGRESO RECURRENTE
// ==========================================================
//
// Espejo exacto de SabioRegistrarGastoModal, del lado del cobro:
// permite confirmar (o ajustar) el monto y registrar el Cobro sin
// salir de Panel de Controle. Categoría y forma de cobro ya quedaron
// fijadas al cargar la plantilla en Mis Ingresos.

import { useState } from 'react';
import { registrarCobroRecordatorio, saldoPendienteCobro, type RecordatorioIngresoRecurrente } from '@/lib/ingresosRecurrentes';

type Colores = { azul: string; verde: string; blanco: string };

export function SabioRegistrarIngresoModal({
  empresaId,
  recordatorio,
  idioma,
  simbolo,
  colores,
  onClose,
  onRegistrado,
}: {
  empresaId: string;
  recordatorio: RecordatorioIngresoRecurrente;
  idioma: string;
  simbolo: string;
  colores: Colores;
  onClose: () => void;
  onRegistrado: () => void;
}) {
  const esPT = idioma === 'PT';
  const [monto, setMonto] = useState(String(saldoPendienteCobro(recordatorio)));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function confirmar() {
    const montoNumero = Number(monto);

    if (!montoNumero || montoNumero <= 0) {
      setError(esPT ? 'Informe um valor válido.' : 'Ingresá un monto válido.');
      return;
    }

    setError('');
    setGuardando(true);

    try {
      await registrarCobroRecordatorio(empresaId, recordatorio, montoNumero);
      onRegistrado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
      setGuardando(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colores.blanco,
          borderRadius: 20,
          padding: 22,
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: colores.verde, marginBottom: 4 }}>
          {esPT ? 'SABIO DIZ' : 'SABIO DICE'}
        </div>

        <h3 style={{ margin: '0 0 4px', color: colores.azul, fontSize: 18 }}>
          💰 {recordatorio.nombre}
        </h3>

        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#6e7781' }}>
          {esPT ? 'Vencimento: ' : 'Vencimiento: '}
          {recordatorio.fecha_vencimiento} · {recordatorio.categoria} · {recordatorio.forma_pago}
          {recordatorio.monto_cobrado > 0 && (
            <>
              <br />
              <span style={{ color: '#15803d', fontWeight: 700 }}>
                {esPT ? 'Já recebido' : 'Ya cobrado'} {simbolo} {recordatorio.monto_cobrado.toFixed(2)} {esPT ? 'de' : 'de'} {simbolo}{' '}
                {recordatorio.monto_habitual.toFixed(2)}
              </span>
            </>
          )}
        </p>

        {error && (
          <div
            style={{
              fontSize: 12,
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: '8px 10px',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: colores.azul, marginBottom: 6 }}>
          {esPT ? 'Valor a receber' : 'Monto a cobrar'}
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#6e7781' }}>{simbolo}</span>
          <input
            type="number"
            autoFocus
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: 16,
              fontWeight: 700,
              color: '#1f2937',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            style={{
              flex: 1,
              border: '1px solid #d1d5db',
              background: 'transparent',
              color: '#374151',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {esPT ? 'Agora não' : 'Ahora no'}
          </button>

          <button
            type="button"
            onClick={confirmar}
            disabled={guardando}
            style={{
              flex: 1,
              border: 'none',
              background: colores.verde,
              color: '#fff',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              opacity: guardando ? 0.7 : 1,
            }}
          >
            {guardando ? (esPT ? 'Registrando...' : 'Registrando...') : `✓ ${esPT ? 'Registrar' : 'Registrar'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
