import { describe, expect, it } from 'vitest';
import { siguienteEscalonPendiente } from './escalonesVistos';

describe('siguienteEscalonPendiente', () => {
  const objetivos = [
    { tipo: 'PAGO' as const, checkpointsCumplidos: 2 },
    { tipo: 'COBRO' as const, checkpointsCumplidos: 1 },
    { tipo: 'TRANSFERENCIA' as const, checkpointsCumplidos: 0 },
  ];

  it('devuelve el primero sin ver, del más chico al más grande', () => {
    expect(siguienteEscalonPendiente(objetivos, () => false)).toEqual({ tipo: 'PAGO', indice: 0 });
  });

  it('salta los ya vistos y encadena con los siguientes', () => {
    const vistos = new Set(['PAGO-0', 'PAGO-1']);
    expect(siguienteEscalonPendiente(objetivos, (t, i) => vistos.has(`${t}-${i}`))).toEqual({ tipo: 'COBRO', indice: 0 });
  });

  it('null si no hay nada pendiente', () => {
    expect(siguienteEscalonPendiente(objetivos, () => true)).toBeNull();
    expect(siguienteEscalonPendiente([{ tipo: 'PAGO', checkpointsCumplidos: 0 }], () => false)).toBeNull();
  });
});
