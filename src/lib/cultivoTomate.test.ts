import { describe, it, expect } from 'vitest';
import { agendaTareas, calcularCalendario, estadoProduccion, fasesPorDefecto, sumarDias } from './cultivoTomate';

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

describe('agendaTareas', () => {
  const calendario = calcularCalendario('2026-10-01', fasesPorDefecto());
  const agenda = agendaTareas(calendario);

  it('arranca el día de la siembra con la tarea de sembrar', () => {
    const primera = agenda[0];
    expect(primera.fecha).toBe('2026-10-01');
    expect(primera.clave).toBe('GERMINACION');
    expect(primera.texto).toMatch(/Sembrar/);
  });

  it('repite las tareas cada N días y no se pasa del fin de la fase', () => {
    const riegos = agenda.filter((t) => t.clave === 'PLANTULA' && t.texto.startsWith('Regar moderado'));
    expect(riegos.map((t) => t.fecha).slice(0, 3)).toEqual(['2026-10-09', '2026-10-11', '2026-10-13']);
    const finPlantula = calendario.find((f) => f.clave === 'PLANTULA')!.fin;
    expect(riegos.every((t) => t.fecha <= finPlantula)).toBe(true);
  });

  it('la tarea "fin" cae en el último día de la fase y los ids no se repiten', () => {
    const cierre = agenda.find((t) => t.texto.startsWith('Cerrar la producción'))!;
    expect(cierre.fecha).toBe(calendario[calendario.length - 1].fin);
    expect(new Set(agenda.map((t) => t.id)).size).toBe(agenda.length);
  });
});
