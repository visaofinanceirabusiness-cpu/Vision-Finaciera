import { describe, expect, it } from 'vitest';
import { partirEtiqueta } from './etiquetasGrafico';

describe('partirEtiqueta', () => {
  it('un nombre corto queda en una línea', () => {
    expect(partirEtiqueta('Consultoria', 14)).toEqual(['Consultoria']);
  });
  it('corta entre palabras sin pasar el largo', () => {
    expect(partirEtiqueta('Consultoria Empresarial', 14)).toEqual(['Consultoria', 'Empresarial']);
    expect(partirEtiqueta('Serviços de Estética', 14)).toEqual(['Serviços de', 'Estética']);
  });
  it('una palabra más larga que la línea se parte con guion', () => {
    const l = partirEtiqueta('Desenvolvimento de Software', 14);
    expect(l.every((x) => x.length <= 14)).toBe(true);
    expect(l.join('')).toContain('Software');
  });
  it('si no entra en el máximo de líneas cierra con puntos suspensivos', () => {
    const l = partirEtiqueta('uno dos tres cuatro cinco seis siete ocho', 8, 2);
    expect(l).toHaveLength(2);
    expect(l[1].endsWith('…')).toBe(true);
    expect(l.every((x) => x.length <= 8)).toBe(true);
  });
});
