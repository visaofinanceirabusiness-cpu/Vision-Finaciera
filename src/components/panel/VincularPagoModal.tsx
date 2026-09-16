'use client';

// VINCULAR UN GASTO RECURRENTE A UN PAGO YA CARGADO
// ==========================================================
//
// Para el caso de "ya lo pagué y lo cargué a mano en Contabilidad
// antes de que existiera este recordatorio" (típicamente los
// primeros meses tras crear la plantilla) — en vez de registrar el
// Pago de nuevo y duplicarlo, se busca el asiento ya cargado en el
// Libro Diario con la misma categoría y forma de pago, y se lo
// vincula directamente (sin tocar el motor contable).

import { useEffect, useState } from 'react';
import { buscarPagosCandidatos, vincularRecordatorioAPago, type PagoCandidato, type RecordatorioGastoRecurrente } from '@/lib/gastosRecurrentes';

type Colores = { azul: string; verde: string; blanco: string };

export function VincularPagoModal({
  recordatorio,
  empresaId,
  idioma,
  simbolo,
  colores,
  onClose,
  onVinculado,
}: {
  recordatorio: RecordatorioGastoRecurrente;
  empresaId: string;
  idioma: string;
  simbolo: string;
  colores: Colores;
  onClose: () => void;
  onVinculado: () => void;
}) {
  const esPT = idioma === 'PT';
  const [candidatos, setCandidatos] = useState<PagoCandidato[] | null>(null);
  const [error, setError] = useState('');
  const [vinculando, setVinculando] = useState<string | null>(null);

  useEffect(() => {
    buscarPagosCandidatos(empresaId, recordatorio.categoria, recordatorio.forma_pago)
      .then(setCandidatos)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error inesperado.'));
  }, [empresaId, recordatorio.categoria, recordatorio.forma_pago]);

  async function elegir(candidato: PagoCandidato) {
    setError('');
    setVinculando(candidato.idOperacion);

    try {
      await vincularRecordatorioAPago(empresaId, recordatorio, candidato);
      onVinculado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
      setVinculando(null);
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
          maxWidth: 420,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: colores.verde, marginBottom: 4 }}>
          {esPT ? 'VINCULAR A UM LANÇAMENTO JÁ FEITO' : 'VINCULAR A UN ASIENTO YA CARGADO'}
        </div>

        <h3 style={{ margin: '0 0 4px', color: colores.azul, fontSize: 18 }}>
          🔁 {recordatorio.nombre}
        </h3>

        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#6e7781' }}>
          {esPT
            ? `Buscando Pagos em ${recordatorio.categoria} · ${recordatorio.forma_pago} ainda não vinculados.`
            : `Buscando Pagos en ${recordatorio.categoria} · ${recordatorio.forma_pago} sin vincular todavía.`}
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

        {candidatos === null ? (
          <p style={{ fontSize: 13, color: '#6e7781' }}>{esPT ? 'Buscando...' : 'Buscando...'}</p>
        ) : candidatos.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#6e7781' }}>
            {esPT
              ? 'Não encontramos nenhum Pago com essa categoria e forma de pagamento sem vincular. Verifique no Livro Diário ou registre um novo.'
              : 'No encontramos ningún Pago con esa categoría y forma de pago sin vincular. Revisá el Libro Diario o registrá uno nuevo.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
            {candidatos.map((candidato) => (
              <div
                key={candidato.idOperacion}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 12.5, color: '#1f2937' }}>
                  {candidato.fecha} — {candidato.historico || candidato.idOperacion}
                  <br />
                  <strong style={{ color: '#c2410c' }}>
                    {simbolo} {candidato.total.toFixed(2)}
                  </strong>
                </span>

                <button
                  type="button"
                  disabled={vinculando !== null}
                  onClick={() => elegir(candidato)}
                  style={{
                    border: 'none',
                    background: colores.verde,
                    color: '#fff',
                    borderRadius: 8,
                    padding: '7px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: vinculando !== null && vinculando !== candidato.idOperacion ? 0.5 : 1,
                  }}
                >
                  {vinculando === candidato.idOperacion
                    ? (esPT ? 'Vinculando...' : 'Vinculando...')
                    : `✓ ${esPT ? 'Usar este' : 'Usar este'}`}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 10,
            width: '100%',
            border: '1px solid #d1d5db',
            background: 'transparent',
            color: '#374151',
            borderRadius: 10,
            padding: '9px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {esPT ? 'Cancelar' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}
