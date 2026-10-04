import { describe, it, expect } from 'vitest';
import {
  periodosVentana,
  periodosFaltantes,
  fechaVencimientoDe,
  correspondeDevengar,
  devengoTrabado,
  estadoTrasPago,
  historicoDevengo,
} from './devengo';

describe('devengo', () => {
  it('la ventana es el mes en curso + 11 (12 meses móviles) y cruza de año', () => {
    const v = periodosVentana('2026-10-04');
    expect(v).toHaveLength(12);
    expect(v[0]).toBe('2026-10-01');
    expect(v[3]).toBe('2027-01-01');
    expect(v[11]).toBe('2027-09-01');
  });

  it('solo faltan los períodos que no tienen fila', () => {
    const faltan = periodosFaltantes(['2026-10-01', '2026-12-01'], '2026-10-04');
    expect(faltan).not.toContain('2026-10-01');
    expect(faltan).not.toContain('2026-12-01');
    expect(faltan[0]).toBe('2026-11-01');
    expect(faltan).toHaveLength(10);
  });

  it('el vencimiento cae en el día de la plantilla', () => {
    expect(fechaVencimientoDe('2026-10-01', 10)).toBe('2026-10-10');
    expect(fechaVencimientoDe('2027-02-01', 5)).toBe('2027-02-05');
  });

  it('se devenga desde el día 1 del período, no antes', () => {
    expect(correspondeDevengar('2026-10-01', '2026-10-04')).toBe(true);
    expect(correspondeDevengar('2026-10-01', '2026-10-01')).toBe(true);
    expect(correspondeDevengar('2026-11-01', '2026-10-31')).toBe(false);
  });

  it('un devengo en curso solo se considera trabado pasados 10 minutos', () => {
    const ahora = new Date('2026-10-04T12:00:00Z');
    expect(devengoTrabado('2026-10-04T11:55:00Z', ahora)).toBe(false);
    expect(devengoTrabado('2026-10-04T11:45:00Z', ahora)).toBe(true);
    expect(devengoTrabado(null, ahora)).toBe(true);
  });

  it('queda saldada cuando no falta nada (con tolerancia de un centavo)', () => {
    expect(estadoTrasPago(1800, 1800)).toBe('SALDADA');
    expect(estadoTrasPago(1800, 1799.995)).toBe('SALDADA');
    expect(estadoTrasPago(1800, 900)).toBe('DEVENGADA');
  });

  it('la marca del asiento de devengo identifica nombre y mes', () => {
    expect(historicoDevengo('Alquiler Santihno', '2026-10-01')).toBe('Alquiler Santihno — devengado 2026-10');
  });
});
