import { describe, expect, it } from 'vitest';
import { empresaTieneVisao3D, escenaDePerfil, PERFILES_ABIERTOS } from './visao3dEmpresas';

describe('empresaTieneVisao3D', () => {
  it('abierto a todo el perfil Familia y, de los demás, solo a Buenaventura (piloto)', () => {
    expect(PERFILES_ABIERTOS).toEqual(['FAMILIAR']);
    expect(empresaTieneVisao3D('c887a052-cbab-47f2-8ec7-a2102af43295', 'FAMILIAR')).toBe(true);
    expect(empresaTieneVisao3D('8512b8b0-1985-4731-981b-955f1d62a898')).toBe(true);
    expect(empresaTieneVisao3D('c887a052-cbab-47f2-8ec7-a2102af43295', 'COMERCIAL')).toBe(false);
    expect(empresaTieneVisao3D('c887a052-cbab-47f2-8ec7-a2102af43295')).toBe(false);
    expect(empresaTieneVisao3D(null)).toBe(false);
    expect(empresaTieneVisao3D(undefined)).toBe(false);
  });

  it('escena por perfil', () => {
    expect(escenaDePerfil('FAMILIAR')).toBe('casa');
    expect(escenaDePerfil('COMERCIAL')).toBe('casa');
    expect(escenaDePerfil('PRODUCCION')).toBe('casa');
    expect(escenaDePerfil('OTRO')).toBe('edificio');
    expect(escenaDePerfil(null)).toBe('edificio');
  });
});
