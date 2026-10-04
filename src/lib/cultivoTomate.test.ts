import { describe, it, expect } from 'vitest';
import { calcularCalendario, estadoProduccion, fasesPorDefecto, sumarDias } from './cultivoTomate';

describe('cultivoTomate', () => {
  const calendario = calcularCalendario('2026-10-01', fasesPorDefecto());

  it('encadena las fases sin huecos ni solapes', () => {
    expect(calendario[0].inicio).toBe('2026-10-01');
    expect(calendario[0].fin).toBe('2026-10-07');
    for (let i = 1; i < calendario.length; i++) {
      expect(calendario[i].inicio).toBe(sumarDias(calendario[i - 1].fin, 1));
    }
  });

  it('ubica la fase y la semana según la fecha de hoy', () => {
    // Plántula arranca el 08/10 y dura 4 semanas
    const e = estadoProduccion(calendario, '2026-10-16');
    expect(e.estado).toBe('EN_CURSO');
    expect(e.faseActual?.clave).toBe('PLANTULA');
    expect(e.semanaDeLaFase).toBe(2);
    expect(e.diaActual).toBe(16);
  });

  it('distingue producción pendiente y terminada', () => {
    expect(estadoProduccion(calendario, '2026-09-20').estado).toBe('PENDIENTE');
    const fin = calendario[calendario.length - 1].fin;
    expect(estadoProduccion(calendario, sumarDias(fin, 1)).estado).toBe('TERMINADA');
    expect(estadoProduccion(calendario, fin).porcentaje).toBe(100);
  });
});
