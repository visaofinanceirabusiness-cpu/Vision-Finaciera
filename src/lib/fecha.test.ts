// Tests de diasEntre — usada por el Plan de Acción (lib/planAccion.ts
// y api/plan-accion/resumen-diario) para medir el atraso de un día
// sin completar.

import { describe, expect, it } from 'vitest';
import { diasEntre } from './fecha';

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
