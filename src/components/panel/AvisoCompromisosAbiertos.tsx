'use client';

// Aviso "ya lo devengaste": ver lib/compromisosAbiertos.ts.

import { estaVencido, etiquetaPeriodo, type CompromisoAbierto } from '@/lib/compromisosAbiertos';

export function AvisoCompromisosAbiertos({
  items,
  operacion,
  idioma,
  simbolo,
  onElegir,
  onSeguir,
}: {
  items: CompromisoAbierto[];
  operacion: string;
  idioma: string;
  simbolo: string;
  onElegir: (item: CompromisoAbierto) => void;
  // Solo cuando el aviso frena el paso (Mini-Juego): seguir con la categoría original.
  onSeguir?: () => void;
}) {
  const esPT = idioma === 'PT';
  const cobro = operacion === 'COBRO';

  if (items.length === 0) return null;

  const boton: React.CSSProperties = {
    border: '1px solid #b45309',
    background: '#fff',
    color: '#92400e',
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  };

  return (
    <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 14, padding: '12px 14px', color: '#78350f', fontSize: 13.5, lineHeight: 1.45 }}>
      <strong>
        {esPT
          ? `⚠️ Você tem ${cobro ? 'a receber' : 'a pagar'} pendente:`
          : `⚠️ Tenés ${cobro ? 'por cobrar' : 'por pagar'} pendiente:`}
      </strong>
      <div style={{ margin: '6px 0 10px' }}>
        {items.map((i) => (
          <div key={i.recordatorioId}>
            {i.nombre} — {simbolo} {i.saldo.toFixed(2)}
            {i.tipo === 'CUOTA' && (
              <span style={{ fontWeight: 700, color: estaVencido(i.fechaVencimiento) ? '#b91c1c' : 'inherit' }}>
                {' '}· {estaVencido(i.fechaVencimiento) ? '⚠️ ' : ''}
                {etiquetaPeriodo(i.fechaVencimiento, idioma)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 10 }}>
        {items.every((i) => !i.devengado)
          ? esPT
            ? `Se é isso que você está ${cobro ? 'recebendo' : 'pagando'}, escolha abaixo e ele fica marcado como cumprido ao registrar.`
            : `Si es eso lo que estás ${cobro ? 'cobrando' : 'pagando'}, elegilo abajo y queda marcado como cumplido al registrar.`
          : esPT
            ? `Se é isso que você está ${cobro ? 'recebendo' : 'pagando'}, registre contra a conta do compromisso para não contar duas vezes.`
            : `Si es eso lo que estás ${cobro ? 'cobrando' : 'pagando'}, registralo contra la cuenta del compromiso para que no se cuente dos veces.`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((i) => (
          <button key={i.recordatorioId} type="button" onClick={() => onElegir(i)} style={boton}>
            {cobro ? (esPT ? 'Receber' : 'Cobrar') : esPT ? 'Pagar' : 'Pagar'}
            {i.devengado ? ` → ${i.categoriaLiquidacion}` : ` «${i.nombre}»`}
            {i.tipo === 'CUOTA' ? ` (${etiquetaPeriodo(i.fechaVencimiento, idioma)})` : ''}
          </button>
        ))}
        {onSeguir && (
          <button type="button" onClick={onSeguir} style={{ ...boton, border: '1px solid #d1d5db', color: '#374151' }}>
            {esPT ? 'É outra coisa, continuar' : 'Es otra cosa, seguir'}
          </button>
        )}
      </div>
    </div>
  );
}
