import { describe, expect, it } from 'vitest';
import { TODAS_LAS_HERRAMIENTAS } from './herramientasMenu';
import { empresaUsaShell, herramientaDeRuta, rutaActiva, rutaEnShell } from './shell';

describe('nuevo diseño (cascarón)', () => {
  it('fase 3: toda empresa con usuario usa el cascarón', () => {
    expect(empresaUsaShell('8512b8b0-1985-4731-981b-955f1d62a898')).toBe(true);
    expect(empresaUsaShell('c887a052-cbab-47f2-8ec7-a2102af43295')).toBe(true);
    expect(empresaUsaShell(null)).toBe(false);
  });
  it('fase 2: todas las herramientas del menú (y sus subrutas) van en el cascarón', () => {
    for (const r of ['/', '/panel-de-control', '/contabilidad', '/finanzas', '/mercaderia', '/informes', '/visao-3d', '/mi-local', '/configuracoes', '/libro-diario']) expect(rutaEnShell(r), r).toBe(true);
    expect(rutaEnShell('/contabilidad/algo')).toBe(true);
    expect(rutaEnShell('/login')).toBe(false);
    expect(rutaEnShell('/panel-maestro')).toBe(false);
    expect(rutaEnShell('/panel-maestro/caja-de-materiales')).toBe(false);
    expect(rutaEnShell('/demo')).toBe(false);
    expect(rutaEnShell('/bienvenida')).toBe(false);
    expect(rutaEnShell('/loja/encanto')).toBe(false);
    expect(rutaEnShell(null)).toBe(false);
  });
  it('toda herramienta del menú tiene su ruta en el cascarón', () => {
    for (const h of TODAS_LAS_HERRAMIENTAS) expect(rutaEnShell(h.href), h.href).toBe(true);
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
