import { describe, expect, it } from 'vitest';
import { INVENTARIO, claveCajaDeRuta, dependientesActivos, estaEnCajaParaPerfil, evaluarEnvioALaCaja, evaluarSalidaDeLaCaja, nombreAlcanceCaja, necesidadesEnCaja, piezaPorClave } from './cajaMateriales';

const vacia = new Set<string>();

describe('inventario de la caja', () => {
  it('las claves son únicas y todo lo que se "necesita" existe', () => {
    const claves = INVENTARIO.map((p) => p.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const p of INVENTARIO) for (const n of p.necesita ?? []) expect(claves, `${p.clave} necesita ${n}`).toContain(n);
  });
  it('toda pieza con interruptor conectado explica qué se oculta y qué se conserva', () => {
    for (const p of INVENTARIO.filter((x) => x.interruptor === 'conectado')) {
      expect(p.seOculta?.length, p.clave).toBeGreaterThan(0);
      expect(p.seConserva?.length, p.clave).toBeGreaterThan(0);
    }
  });
  it('Lanzamiento rápido es lo primero que puede ir a la caja', () => {
    expect(piezaPorClave('lanzamiento-rapido')?.interruptor).toBe('conectado');
  });
});

describe('mandar a la caja', () => {
  it('Lanzamiento rápido se puede guardar: nada activo depende de él', () => {
    expect(dependientesActivos('lanzamiento-rapido', vacia)).toEqual([]);
    const e = evaluarEnvioALaCaja('lanzamiento-rapido', vacia);
    expect(e.permitido).toBe(true);
    expect(e.seOculta.length).toBeGreaterThan(0);
    expect(e.seConserva.join(' ')).toContain('operaciones ya cargadas');
    expect(e.consecuencias.join(' ')).toContain('Motor contable');
  });
  it('no deja guardar el núcleo ni lo que tiene dependientes activos', () => {
    expect(evaluarEnvioALaCaja('motor-contable', vacia).permitido).toBe(false);
    expect(evaluarEnvioALaCaja('mercaderia', vacia).bloqueos.join(' ')).toMatch(/Mi Local|Producción/);
  });
  it('lo que todavía no tiene interruptor no se puede guardar', () => {
    const e = evaluarEnvioALaCaja('plan-accion', vacia);
    expect(e.permitido).toBe(false);
    expect(e.bloqueos.join(' ')).toContain('interruptor');
  });
  it('no se guarda dos veces y una pieza inexistente se rechaza', () => {
    expect(evaluarEnvioALaCaja('lanzamiento-rapido', new Set(['lanzamiento-rapido'])).permitido).toBe(false);
    expect(evaluarEnvioALaCaja('nada', vacia).permitido).toBe(false);
  });
  it('si lo que depende ya está en la caja, no bloquea', () => {
    expect(dependientesActivos('mi-local', new Set(['loja']))).toEqual([]);
  });
});

describe('sacar de la caja', () => {
  it('avisa si la pieza necesita otra que sigue guardada', () => {
    const enCaja = new Set(['mercaderia', 'mi-local']);
    expect(necesidadesEnCaja('mi-local', enCaja).map((p) => p.clave)).toEqual(['mercaderia']);
    expect(evaluarSalidaDeLaCaja('mi-local', enCaja).avisos[0]).toContain('Mercadería');
    expect(evaluarSalidaDeLaCaja('lanzamiento-rapido', new Set(['lanzamiento-rapido'])).avisos).toEqual([]);
  });
});

describe('alcance por perfil', () => {
  it('una pieza guardada para todos se esconde a cualquiera; para un perfil, solo a ese', () => {
    expect(estaEnCajaParaPerfil({ perfiles: null }, 'COMERCIAL')).toBe(true);
    expect(estaEnCajaParaPerfil({ perfiles: [] }, null)).toBe(true);
    expect(estaEnCajaParaPerfil({ perfiles: ['FAMILIAR'] }, 'FAMILIAR')).toBe(true);
    expect(estaEnCajaParaPerfil({ perfiles: ['FAMILIAR'] }, 'COMERCIAL')).toBe(false);
    expect(estaEnCajaParaPerfil({ perfiles: ['FAMILIAR'] }, null)).toBe(false);
    expect(estaEnCajaParaPerfil(undefined, 'FAMILIAR')).toBe(false);
  });
  it('nombra el alcance y mapea cada pantalla a su pieza', () => {
    expect(nombreAlcanceCaja(null)).toBe('todas las empresas');
    expect(nombreAlcanceCaja(['FAMILIAR', 'MIXTO'])).toBe('Finanzas Personales, Mixto');
    expect(claveCajaDeRuta('/finanzas')).toBe('finanzas');
    expect(claveCajaDeRuta('/stock/movimientos')).toBe('mercaderia');
    expect(claveCajaDeRuta('/contabilidad')).toBeNull();
    expect(claveCajaDeRuta(null)).toBeNull();
  });
  it('las piezas que se esconden por perfil están conectadas y existen en el inventario', () => {
    for (const c of ['finanzas', 'informes', 'visao-3d', 'recursos-humanos', 'contab-lanzamientos', 'contab-registros', 'contab-editar', 'sabio-registra']) expect(piezaPorClave(c)?.interruptor, c).toBe('conectado');
  });
});
