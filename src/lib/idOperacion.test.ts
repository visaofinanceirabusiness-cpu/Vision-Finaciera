import { describe, expect, it } from 'vitest';
import { siguienteIdOperacion } from './motor';

describe('siguienteIdOperacion', () => {
  it('sigue al mayor número existente, sin importar el orden', () => {
    expect(siguienteIdOperacion(['OP-00003', 'OP-01002', 'OP-00010'])).toBe('OP-01003');
  });
  it('arranca en 1 sin operaciones y ignora lo que no es un OP', () => {
    expect(siguienteIdOperacion([])).toBe('OP-00001');
    expect(siguienteIdOperacion([null, undefined, 'x', 'OP-'])).toBe('OP-00001');
  });
  it('maneja más de 99999 sin cortar el número', () => {
    expect(siguienteIdOperacion(['OP-99999'])).toBe('OP-100000');
  });
});
