import { describe, expect, it } from 'vitest';
import { empresaTieneVisao3D, escenaDePerfil, PERFILES_ABIERTOS, type FilaApertura } from './visao3dEmpresas';

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

describe('empresaTieneVisao3D con las reglas de la base', () => {
  const fila = (tipo: string, clave: string, abierto: boolean): FilaApertura => ({ tipo, clave, abierto });
  const base = [fila('GLOBAL', 'todos', true), fila('PERFIL', 'FAMILIAR', true), fila('EMPRESA', 'buena', true)];

  it('abre por perfil y por empresa; sin fila está cerrado', () => {
    expect(empresaTieneVisao3D('x', 'FAMILIAR', base)).toBe(true);
    expect(empresaTieneVisao3D('buena', 'COMERCIAL', base)).toBe(true);
    expect(empresaTieneVisao3D('x', 'COMERCIAL', base)).toBe(false);
    expect(empresaTieneVisao3D(null, null, base)).toBe(false);
  });

  it('la excepción de la empresa gana sobre su perfil', () => {
    expect(empresaTieneVisao3D('cerrada', 'FAMILIAR', [...base, fila('EMPRESA', 'cerrada', false)])).toBe(false);
    expect(empresaTieneVisao3D('x', 'COMERCIAL', [...base, fila('PERFIL', 'COMERCIAL', false), fila('EMPRESA', 'x', true)])).toBe(true);
  });

  it('el apagado general cierra todo', () => {
    expect(empresaTieneVisao3D('buena', 'FAMILIAR', [fila('GLOBAL', 'todos', false), ...base.slice(1)])).toBe(false);
  });

  it('un perfil con fila en cerrado está cerrado', () => {
    expect(empresaTieneVisao3D('x', 'FAMILIAR', [fila('PERFIL', 'FAMILIAR', false)])).toBe(false);
  });

  it('si no se pudieron leer las reglas, vale el respaldo del código', () => {
    expect(empresaTieneVisao3D('x', 'FAMILIAR', null)).toBe(true);
    expect(empresaTieneVisao3D('x', 'COMERCIAL', null)).toBe(false);
  });
});
