import { describe, expect, it } from 'vitest';
import { datosSimulados, simulacionConDatosReales } from './tutorialSimulacion';

describe('simulacionConDatosReales', () => {
  it('marca la simulación como lectura de datos reales (el guardado sigue simulado)', () => {
    const sim = simulacionConDatosReales('PT');
    expect(sim.datosReales).toBe(true);
    expect(datosSimulados('MIXTO', 'PT').datosReales).toBeUndefined();
  });
});
