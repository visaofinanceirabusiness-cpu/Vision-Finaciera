'use client';

// Cartel informativo al cargar una venta de producto: cuánto cuesta una unidad y a cuánto venderla
// para ganar el % elegido (markup sobre costo). No cambia nada solo: el precio lo sigue definiendo
// quien carga; "Usar este precio" solo lo copia al campo.

import { useEffect, useState } from 'react';
import {
  guardarPorcentaje,
  leerPorcentajeGuardado,
  obtenerCostoUnitario,
  PORCENTAJE_INICIAL,
  precioConMarkup,
} from '@/lib/precioSugerido';

function formatear(valor: number, esPT: boolean): string {
  return valor.toLocaleString(esPT ? 'pt-BR' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CartelPrecioSugerido({
  empresaId,
  productoId,
  fecha,
  idioma,
  simbolo,
  cantidad,
  onUsar,
  oscuro = false,
}: {
  empresaId: string;
  productoId: string;
  fecha: string;
  idioma: string;
  simbolo: string;
  // Unidades de stock de la venta: con ellas "Usar este precio" arma el total.
  cantidad: number;
  onUsar: (totalVenta: number) => void;
  oscuro?: boolean;
}) {
  const esPT = idioma === 'PT';
  const [costo, setCosto] = useState<number | null>(null);
  const [porcentaje, setPorcentaje] = useState(PORCENTAJE_INICIAL);

  useEffect(() => {
    setPorcentaje(leerPorcentajeGuardado());
  }, []);

  useEffect(() => {
    let cancelado = false;
    setCosto(null);
    if (!empresaId || !productoId) return;

    obtenerCostoUnitario(empresaId, productoId, fecha)
      .then((c) => {
        if (!cancelado) setCosto(c);
      })
      .catch(() => {
        if (!cancelado) setCosto(null);
      });

    return () => {
      cancelado = true;
    };
  }, [empresaId, productoId, fecha]);

  if (costo === null) return null;

  const precio = precioConMarkup(costo, porcentaje);
  const puedeUsar = cantidad > 0;

  return (
    <div
      role="note"
      style={{
        background: oscuro ? 'rgba(255,255,255,0.92)' : '#fffbeb',
        border: '1px solid #f59e0b',
        borderRadius: 14,
        padding: '10px 14px',
        margin: '8px 0',
        fontSize: 13.5,
        lineHeight: 1.5,
        color: '#78350f',
        textAlign: 'left',
      }}
    >
      💡{' '}
      {esPT ? (
        <>
          Para 1 unidade gastamos <b>{simbolo} {formatear(costo, true)}</b>. Se quiser ganhar
        </>
      ) : (
        <>
          Para 1 unidad gastamos <b>{simbolo} {formatear(costo, false)}</b>. Si le queremos ganar
        </>
      )}{' '}
      <input
        type="number"
        min={0}
        step="any"
        value={porcentaje || ''}
        aria-label={esPT ? 'Percentual de ganho' : 'Porcentaje de ganancia'}
        onChange={(e) => {
          const nuevo = Number(e.target.value);
          setPorcentaje(nuevo);
          if (nuevo > 0) guardarPorcentaje(nuevo);
        }}
        style={{ width: 58, padding: '2px 6px', borderRadius: 8, border: '1px solid #d1d5db', fontWeight: 800, textAlign: 'center' }}
      />
      % {esPT ? 'recomendo vender por' : 'te recomiendo venderlo por'} <b>{simbolo} {formatear(precio, esPT)}</b>
      {esPT ? ' por unidade.' : ' por unidad.'}
      <div style={{ marginTop: 6 }}>
        <button
          type="button"
          disabled={!puedeUsar}
          onClick={() => onUsar(Math.round(precio * cantidad * 100) / 100)}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '6px 14px',
            fontSize: 12.5,
            fontWeight: 800,
            background: puedeUsar ? '#f59e0b' : '#e5e7eb',
            color: puedeUsar ? '#fff' : '#6b7280',
            cursor: puedeUsar ? 'pointer' : 'not-allowed',
          }}
        >
          {esPT ? 'Usar este preço' : 'Usar este precio'}
          {puedeUsar && cantidad !== 1 ? ` (${simbolo} ${formatear(Math.round(precio * cantidad * 100) / 100, esPT)})` : ''}
        </button>
        {!puedeUsar && (
          <span style={{ marginLeft: 8, fontSize: 12 }}>{esPT ? 'Informe a quantidade primeiro.' : 'Primero indicá la cantidad.'}</span>
        )}
      </div>
    </div>
  );
}
