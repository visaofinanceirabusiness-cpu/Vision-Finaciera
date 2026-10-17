import { describe, it, expect } from 'vitest';
import { clasificarCuentaSinOperacion, resumenAuditoria } from './auditoriaCuentas';

const cuenta = (nombre: string) => ({ nombre, tipo_saldo: 'ACTIVO' });

describe('clasificarCuentaSinOperacion', () => {
  it('Resultados Acumulados es estructural', () => {
    expect(clasificarCuentaSinOperacion(cuenta('Resultados Acumulados'))).toBe('ESTRUCTURAL');
  });

  it('las del punto 6 quedan pendientes, sin importar tildes ni mayúsculas', () => {
    expect(clasificarCuentaSinOperacion(cuenta('Depreciación Acumulada'))).toBe('PENDIENTE');
    expect(clasificarCuentaSinOperacion(cuenta('depreciacion acumulada'))).toBe('PENDIENTE');
    expect(clasificarCuentaSinOperacion(cuenta('IVA Débito Fiscal'))).toBe('PENDIENTE');
  });

  it('cualquier otra cuenta sin operación es NUEVA (incumple la regla)', () => {
    expect(clasificarCuentaSinOperacion(cuenta('Costo Flete'))).toBe('NUEVA');
    expect(clasificarCuentaSinOperacion(cuenta('Muebles y Útiles'))).toBe('NUEVA');
  });
});

describe('resumenAuditoria', () => {
  it('cuenta por estado', () => {
    expect(resumenAuditoria([cuenta('Resultados Acumulados'), cuenta('Sueldos a Pagar'), cuenta('Costo Flete'), cuenta('Anticipo a Proveedores')])).toEqual({
      ESTRUCTURAL: 1,
      PENDIENTE: 2,
      NUEVA: 1,
    });
  });
});
