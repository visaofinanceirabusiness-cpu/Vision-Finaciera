import { describe, expect, it } from 'vitest';
import { costoPromedioUnitario, precioConMarkup } from './precioSugerido';

describe('precio sugerido', () => {
  it('promedia ponderado y descarta lo ya vendido', () => {
    const costo = costoPromedioUnitario([
      { tipo: 'ENTRADA', cantidad: 10, costo_unitario: 5 },
      { tipo: 'ENTRADA', cantidad: 10, costo_unitario: 7 },
      { tipo: 'SALIDA', cantidad: 10, costo_unitario: 6 },
    ]);
    expect(costo).toBe(6);
  });

  it('sin stock o sin costo no hay sugerencia', () => {
    expect(costoPromedioUnitario([])).toBeNull();
    expect(costoPromedioUnitario([{ tipo: 'ENTRADA', cantidad: 2, costo_unitario: 0 }])).toBeNull();
  });

  it('aplica markup sobre costo', () => {
    expect(precioConMarkup(62.4, 30)).toBe(81.12);
    expect(precioConMarkup(100, 0)).toBe(100);
  });
});
