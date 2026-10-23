import { describe, expect, it } from 'vitest';
import { HERRAMIENTAS_DEMO, rutaPermitidaEnDemo, SECCION_MERCADERIA, SECCION_VISAO3D } from './modoEspectador';

describe('rutaPermitidaEnDemo', () => {
  it('el lobby, la demo y el login siempre están permitidos', () => {
    expect(rutaPermitidaEnDemo('/', [])).toBe(true);
    expect(rutaPermitidaEnDemo('/demo/entrar', [])).toBe(true);
  });

  it('sin habilitar, todas las herramientas están bloqueadas', () => {
    for (const ruta of ['/panel-de-control', '/mercaderia', '/produccion', '/recursos-humanos', '/visao-3d', '/plan-accion', '/nuestro-sueno', '/mensajes', '/configuracoes', '/informes']) {
      expect(rutaPermitidaEnDemo(ruta, [])).toBe(false);
    }
  });

  it('cada herramienta se habilita sola y abre sus pantallas hijas', () => {
    expect(rutaPermitidaEnDemo('/visao-3d', [SECCION_VISAO3D])).toBe(true);
    expect(rutaPermitidaEnDemo('/mercaderia', [SECCION_VISAO3D])).toBe(false);
    expect(rutaPermitidaEnDemo('/stock', [SECCION_MERCADERIA])).toBe(true);
    expect(rutaPermitidaEnDemo('/movimientos-stock', [SECCION_MERCADERIA])).toBe(true);
    expect(rutaPermitidaEnDemo('/libro-diario', ['CONTABILIDAD'])).toBe(true);
  });

  it('todas las herramientas de la lista tienen una ruta que las abre', () => {
    const rutas: Record<string, string> = { PANEL: '/panel-de-control', CONTABILIDAD: '/contabilidad', FINANZAS: '/finanzas', MERCADERIA: '/mercaderia', PRODUCCION: '/produccion', RRHH: '/recursos-humanos', VISAO3D: '/visao-3d', PLAN_ACCION: '/plan-accion', NUESTRO_SUENO: '/nuestro-sueno', MENSAJES: '/mensajes', CONFIGURACOES: '/configuracoes' };
    for (const h of HERRAMIENTAS_DEMO) expect(rutaPermitidaEnDemo(rutas[h.clave], [h.clave])).toBe(true);
  });

  it('los informes se habilitan por pestaña', () => {
    expect(rutaPermitidaEnDemo('/informes', ['INFORMES_BALANCE'])).toBe(true);
    expect(rutaPermitidaEnDemo('/informes', ['PANEL'])).toBe(false);
  });
});
