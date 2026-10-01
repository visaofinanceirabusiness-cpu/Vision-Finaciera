// Tests de generarCodigo — la única función realmente pura de
// categorias.ts (el resto son todas async y hablan con Supabase; ver
// mantenimiento/2026-10.md Fase 3 para el resto del plan de tests).

import { describe, expect, it } from 'vitest';
import { generarCodigo } from './categorias';

describe('generarCodigo', () => {
  it('arma un código de 3 letras mayúsculas a partir del nombre', () => {
    expect(generarCodigo('Mercadería', [])).toBe('MER');
    expect(generarCodigo('ventas', [])).toBe('VEN');
  });

  it('ignora números, espacios y símbolos al armar el código', () => {
    expect(generarCodigo('Gasto N°1', [])).toBe('GAS');
  });

  it('quita los acentos antes de tomar las primeras 3 letras', () => {
    expect(generarCodigo('Energía', [])).toBe('ENE');
  });

  it('rellena con X cuando el nombre tiene menos de 3 letras', () => {
    expect(generarCodigo('A', [])).toBe('AXX');
    expect(generarCodigo('Yo', [])).toBe('YOX');
  });

  it('si el código base ya existe, agrega un sufijo numérico desde 2', () => {
    expect(generarCodigo('Ventas', ['VEN'])).toBe('VE2');
    expect(generarCodigo('Ventas', ['VEN', 'VE2'])).toBe('VE3');
  });

  it('sigue probando sufijos hasta encontrar uno libre', () => {
    const existentes = ['VEN', ...Array.from({ length: 10 }, (_, i) => `VE${i + 2}`)];
    expect(generarCodigo('Ventas', existentes)).toBe('VE12');
  });

  it('no se cruza con códigos de otro nombre que casualmente empiecen igual', () => {
    // "Varios" y "Ventas" arrancan distinto ('VAR' vs 'VEN') así que
    // no deberían pisarse entre sí.
    expect(generarCodigo('Varios', ['VEN'])).toBe('VAR');
  });
});
