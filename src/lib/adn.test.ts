import { describe, expect, it } from 'vitest';
import { construirHistoria, fechaLocal } from './adn';

const base = {
  empresa: { nombre: 'Mi Empresa', creadoEn: '2026-09-01T10:00:00Z', logoUrl: null, idioma: 'ES' as const, onboardingCompletado: true, matrizGenerada: true },
  trofeos: [],
  hitos: [],
  usuarios: [],
  actividad: [],
  nombresNivel: { 2: { nombre: 'Organizador', emoji: '🗂️' } },
};

describe('construirHistoria', () => {
  it('sin operaciones solo cuenta el nacimiento de la empresa', () => {
    const h = construirHistoria({ ...base, momentosOperaciones: [] }, 'ES');
    expect(h.map((e) => e.clave)).toEqual(['alta']);
  });
  it('marca la primera operación y la subida de nivel en la operación 75', () => {
    const momentos = Array.from({ length: 80 }, (_, i) => `2026-09-${String(2 + Math.floor(i / 10)).padStart(2, '0')}T12:00:0${i % 10}Z`);
    const h = construirHistoria({ ...base, momentosOperaciones: momentos }, 'ES');
    expect(h.map((e) => e.clave)).toEqual(['alta', 'primera-op', 'nivel-2']);
    expect(h[2].fecha).toBe(momentos[74]);
    expect(h[2].titulo).toContain('Organizador');
  });
  it('ordena por fecha, traduce al portugués y marca desde cuándo se mide', () => {
    const h = construirHistoria(
      {
        ...base,
        momentosOperaciones: [],
        hitos: [{ nivel: 1, tipo: 'BRONCE', vistoEn: '2026-09-05T00:00:00Z' }],
        actividad: [{ usuario_id: 'u', fecha: '2026-11-03', ruta: '/', segundos: 30, visitas: 1, sesiones: 1, estimado: false }],
      },
      'PT'
    );
    expect(h.map((e) => e.clave)).toEqual(['alta', 'hito-1-BRONCE', 'medicion']);
    expect(h[1].titulo).toContain('Bronze');
  });
});

describe('fechaLocal', () => {
  it('usa el día de Buenos Aires, no el UTC', () => {
    expect(fechaLocal('2026-09-02T01:30:00Z')).toBe('2026-09-01');
  });
});
