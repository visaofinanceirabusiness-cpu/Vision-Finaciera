import { describe, expect, it } from 'vitest';
import { empresaUsaShell, herramientaDeRuta, rutaActiva, rutaEnShell } from './shell';

describe('nuevo diseño (cascarón)', () => {
  it('fase 1: solo Buenaventura', () => {
    expect(empresaUsaShell('8512b8b0-1985-4731-981b-955f1d62a898')).toBe(true);
    expect(empresaUsaShell('c887a052-cbab-47f2-8ec7-a2102af43295')).toBe(false);
    expect(empresaUsaShell(null)).toBe(false);
  });
  it('fase 1: solo Inicio y Contabilidad (y sus subrutas)', () => {
    expect(rutaEnShell('/')).toBe(true);
    expect(rutaEnShell('/contabilidad')).toBe(true);
    expect(rutaEnShell('/contabilidad/algo')).toBe(true);
    expect(rutaEnShell('/finanzas')).toBe(false);
    expect(rutaEnShell('/login')).toBe(false);
    expect(rutaEnShell('/loja/encanto')).toBe(false);
    expect(rutaEnShell(null)).toBe(false);
  });
  it('resalta la herramienta correcta', () => {
    expect(rutaActiva('/', '/')).toBe(true);
    expect(rutaActiva('/contabilidad', '/')).toBe(false);
    expect(rutaActiva('/contabilidad', '/contabilidad')).toBe(true);
    expect(rutaActiva('/contabilidadx', '/contabilidad')).toBe(false);
    expect(herramientaDeRuta('/libro-diario', ['/', '/contabilidad', '/finanzas'])).toBe('/contabilidad');
    expect(herramientaDeRuta('/stock', ['/', '/mercaderia'])).toBe('/mercaderia');
    expect(herramientaDeRuta('/otra', ['/', '/contabilidad'])).toBeNull();
  });
});
