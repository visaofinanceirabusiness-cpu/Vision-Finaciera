// Tests de diasEntre — usada por el Plan de Acción (lib/planAccion.ts
// y api/plan-accion/resumen-diario) para medir el atraso de un día
// sin completar.

import { describe, expect, it } from 'vitest';
import { diasEntre, sumarMesesPeriodo, formatearPeriodo, periodosDisponibles } from './fecha';

describe('diasEntre', () => {
  it('da 0 para la misma fecha', () => {
    expect(diasEntre('2026-10-03T10:00:00Z', '2026-10-03T23:00:00Z')).toBe(0);
  });

  it('cuenta días completos de calendario, sin importar la hora', () => {
    expect(diasEntre('2026-09-24T02:29:54Z', '2026-10-03T10:00:00Z')).toBe(9);
  });

  it('da 0 cuando todavía no pasó un día (mismo día calendario)', () => {
    expect(diasEntre('2026-10-03T00:01:00Z', '2026-10-03T23:59:00Z')).toBe(0);
  });

  it('da 1 apenas cruza la medianoche', () => {
    expect(diasEntre('2026-10-03T23:50:00Z', '2026-10-04T00:10:00Z')).toBe(1);
  });

  it('usa el momento actual cuando no se pasa segunda fecha', () => {
    const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(diasEntre(hace2Dias)).toBeGreaterThanOrEqual(1);
  });
});

describe('sumarMesesPeriodo', () => {
  it('suma meses dentro del mismo año', () => {
    expect(sumarMesesPeriodo('2026-10-01', 1)).toBe('2026-11-01');
  });

  it('cruza de diciembre a enero del año siguiente', () => {
    expect(sumarMesesPeriodo('2026-12-01', 1)).toBe('2027-01-01');
  });

  it('resta meses (período negativo)', () => {
    expect(sumarMesesPeriodo('2026-01-01', -1)).toBe('2025-12-01');
  });
});

describe('formatearPeriodo', () => {
  it('formatea en español por defecto', () => {
    expect(formatearPeriodo('2026-10-01', false)).toContain('2026');
  });

  it('formatea en portugués cuando corresponde', () => {
    const texto = formatearPeriodo('2026-10-01', true);
    expect(texto.toLowerCase()).toContain('outubro');
  });
});

describe('periodosDisponibles', () => {
  it('da 6 períodos: 2 meses atrás hasta 3 meses adelante', () => {
    const periodos = periodosDisponibles('2026-10-03', false);
    expect(periodos).toHaveLength(6);
    expect(periodos[0].valor).toBe('2026-08-01');
    expect(periodos[periodos.length - 1].valor).toBe('2027-01-01');
  });

  it('incluye el período actual', () => {
    const periodos = periodosDisponibles('2026-10-03', false);
    expect(periodos.map((p) => p.valor)).toContain('2026-10-01');
  });
});
