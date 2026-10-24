import { describe, expect, it } from 'vitest';
import { HERRAMIENTAS_DEMO, pestanaInformeHabilitada, rutaPermitidaEnDemo, SECCION_INFORMES, SECCION_MERCADERIA, SECCION_VISAO3D } from './modoEspectador';

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
    const rutas: Record<string, string> = { PANEL: '/panel-de-control', CONTABILIDAD: '/contabilidad', FINANZAS: '/finanzas', INFORMES: '/informes', MERCADERIA: '/mercaderia', PRODUCCION: '/produccion', RRHH: '/recursos-humanos', VISAO3D: '/visao-3d', PLAN_ACCION: '/plan-accion', NUESTRO_SUENO: '/nuestro-sueno', MENSAJES: '/mensajes', CONFIGURACOES: '/configuracoes' };
    for (const h of HERRAMIENTAS_DEMO) expect(rutaPermitidaEnDemo(rutas[h.clave], [h.clave])).toBe(true);
  });

  it('Informes se habilita como una herramienta más, con todas sus pestañas', () => {
    expect(rutaPermitidaEnDemo('/informes', [SECCION_INFORMES])).toBe(true);
    expect(rutaPermitidaEnDemo('/informes', ['PANEL'])).toBe(false);
    for (const pestana of ['balance', 'resultado', 'flujo', 'mayor', 'sumas']) expect(pestanaInformeHabilitada(pestana, [SECCION_INFORMES])).toBe(true);
    expect(pestanaInformeHabilitada('balance', ['PANEL'])).toBe(false);
  });

  it('un acceso con pestañas sueltas guardadas sigue funcionando', () => {
    expect(rutaPermitidaEnDemo('/informes', ['INFORMES_BALANCE'])).toBe(true);
    expect(pestanaInformeHabilitada('balance', ['INFORMES_BALANCE'])).toBe(true);
    expect(pestanaInformeHabilitada('flujo', ['INFORMES_BALANCE'])).toBe(false);
  });
});
