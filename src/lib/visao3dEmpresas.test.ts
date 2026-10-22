import { describe, expect, it } from 'vitest';
import { empresaTieneVisao3D } from './visao3dEmpresas';

describe('empresaTieneVisao3D', () => {
  it('solo Buenaventura', () => {
    expect(empresaTieneVisao3D('8512b8b0-1985-4731-981b-955f1d62a898')).toBe(true);
    expect(empresaTieneVisao3D('c887a052-cbab-47f2-8ec7-a2102af43295')).toBe(false);
    expect(empresaTieneVisao3D(null)).toBe(false);
    expect(empresaTieneVisao3D(undefined)).toBe(false);
  });
});
