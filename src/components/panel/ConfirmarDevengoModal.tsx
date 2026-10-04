'use client';

// CONFIRMAR EL MONTO DE UN GASTO VARIABLE (luz, agua...)
//
// Un gasto recurrente con monto variable que devenga mes a mes llega al
// día 1 "Por confirmar": acá se pone el importe real de la factura y,
// al confirmar, se reconoce el gasto (Gasto / Cuentas a Pagar). Pagarlo
// es un paso aparte (ver registrarPagoRecordatorio).

import { useState } from 'react';
import { confirmarDevengo } from '@/lib/devengoGastos';
import type { RecordatorioGastoRecurrente } from '@/lib/gastosRecurrentes';

type Colores = { azul: string; verde: string; blanco: string };

export function ConfirmarDevengoModal({
  empresaId,
  recordatorio,
  idioma,
  simbolo,
  colores,
  onClose,
  onConfirmado,
}: {
  empresaId: string;
  recordatorio: RecordatorioGastoRecurrente;
  idioma: string;
  simbolo: string;
  colores: Colores;
  onClose: () => void;
  onConfirmado: () => void;
}) {
  const esPT = idioma === 'PT';
  const [monto, setMonto] = useState(String(recordatorio.monto_habitual));
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
      await confirmarDevengo(empresaId, recordatorio.id, montoNumero);
      onConfirmado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
      setGuardando(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: colores.blanco, borderRadius: 20, padding: 22, width: '100%', maxWidth: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
      >
        <h3 style={{ margin: '0 0 4px', color: colores.azul, fontSize: 18 }}>🔁 {recordatorio.nombre}</h3>

        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#6e7781', lineHeight: 1.5 }}>
          {esPT
            ? `Confirme o valor real de ${recordatorio.periodo.slice(0, 7)}. Ao confirmar, o gasto é reconhecido nesse mês (ainda não é um pagamento).`
            : `Confirmá el monto real de ${recordatorio.periodo.slice(0, 7)}. Al confirmar, el gasto se reconoce en ese mes (todavía no es un pago).`}
        </p>

        {error && (
          <div style={{ fontSize: 12, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: colores.azul, marginBottom: 6 }}>
          {esPT ? 'Valor do mês' : 'Monto del mes'}
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#6e7781' }}>{simbolo}</span>
          <input
            type="number"
            autoFocus
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, fontWeight: 700, color: '#1f2937' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={confirmar}
            disabled={guardando}
            style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: 'none', background: colores.verde, color: '#fff', fontWeight: 800, fontSize: 14, cursor: guardando ? 'wait' : 'pointer' }}
          >
            {guardando ? (esPT ? 'Confirmando...' : 'Confirmando...') : esPT ? 'Confirmar' : 'Confirmar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid #d1d5db', background: 'transparent', color: '#6e7781', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            {esPT ? 'Cancelar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
