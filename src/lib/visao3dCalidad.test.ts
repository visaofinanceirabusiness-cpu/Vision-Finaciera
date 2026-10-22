import { describe, expect, it } from 'vitest';
import { calcularCalidad, usaSombras } from './visao3dCalidad';

describe('calcularCalidad', () => {
  it('un teléfono común es calidad baja', () => {
    expect(calcularCalidad({ tactil: true, memoriaGB: 4, nucleos: 8 })).toBe('bajo');
    expect(calcularCalidad({ tactil: true })).toBe('bajo');
  });
  it('un teléfono potente sube a media, nunca a alta', () => {
    expect(calcularCalidad({ tactil: true, memoriaGB: 8, nucleos: 8 })).toBe('medio');
  });
  it('escritorio: alta con buena memoria y núcleos, media si no', () => {
    expect(calcularCalidad({ tactil: false, memoriaGB: 8, nucleos: 8 })).toBe('alto');
    expect(calcularCalidad({ tactil: false, memoriaGB: 4, nucleos: 4 })).toBe('medio');
  });
  it('el ahorro de datos fuerza calidad baja', () => {
    expect(calcularCalidad({ tactil: false, memoriaGB: 16, nucleos: 16, ahorroDatos: true })).toBe('bajo');
  });
  it('las sombras en tiempo real solo en equipos no táctiles de calidad alta', () => {
    expect(usaSombras('alto', false)).toBe(true);
    expect(usaSombras('alto', true)).toBe(false);
    expect(usaSombras('medio', false)).toBe(false);
  });
});
