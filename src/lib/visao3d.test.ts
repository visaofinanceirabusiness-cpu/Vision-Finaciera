import { describe, expect, it } from 'vitest';
import { alturasProporcionales, buscarNodo, caminoHasta, construirEdificio, mesAnterior, mesesDisponibles, movimientosDeCuenta, type AsientoVisao, type CuentaPlan } from './visao3d';

const etiquetas = { empresa: 'Empresa', ACTIVO: 'Ativo', PASIVO: 'Passivo', PATRIMONIO: 'Patrimônio Líquido', resultado: 'Resultado do exercício' };

const c = (id: string, codigo: string, nombre: string, tipo: string, naturaleza: string, padre: string | null = null, inicial = 0): CuentaPlan => ({
  id, codigo, nombre, cuenta_padre_id: padre, tipo_saldo: tipo, naturaleza, saldo_inicial: inicial,
});

const plan: CuentaPlan[] = [
  c('a', '1.0', 'ACTIVO', 'ACTIVO', 'DEUDORA'),
  c('ac', '1.1', 'ACTIVO CORRIENTE', 'ACTIVO', 'DEUDORA', 'a'),
  c('caja', '1.1.1', 'Caja', 'ACTIVO', 'DEUDORA', 'ac', 100),
  c('banco', '1.1.2', 'Banco', 'ACTIVO', 'DEUDORA', 'ac'),
  c('p', '2.0', 'PASIVO', 'PASIVO', 'ACREEDORA'),
  c('pc', '2.1', 'PASIVO CORRIENTE', 'PASIVO', 'ACREEDORA', 'p'),
  c('prov', '2.1.1', 'Proveedores', 'PASIVO', 'ACREEDORA', 'pc'),
  c('pn', '3.0', 'PATRIMONIO', 'PATRIMONIO', 'ACREEDORA'),
  c('cap', '3.1', 'Capital', 'PATRIMONIO', 'ACREEDORA', 'pn', 100),
  c('ret', '3.2', 'Retiro Personal', 'PATRIMONIO', 'DEUDORA', 'pn'),
  c('ing', '4.1', 'Ventas', 'INGRESO', 'ACREEDORA'),
  c('gas', '6.1', 'Alquiler', 'GASTO', 'DEUDORA'),
];

const as = (id: string, fecha: string, debito: string, credito: string, importe: number): AsientoVisao => ({ id_operacion: id, fecha, descripcion: id, debito, credito, importe });

const asientos = [
  as('OP-1', '2026-09-10', 'Banco', 'Ventas', 300), // ingreso
  as('OP-2', '2026-09-15', 'Alquiler', 'Banco', 50), // gasto pagado
  as('OP-3', '2026-10-05', 'Banco', 'Proveedores', 80), // préstamo/compra a crédito
  as('OP-4', '2026-10-06', 'Retiro Personal', 'Banco', 20), // retiro (cuenta contra)
];

describe('construirEdificio', () => {
  const e = construirEdificio(plan, asientos, null, etiquetas);
  const grupo = (id: string) => buscarNodo(e.raiz, `grupo:${id}`)!;

  it('los grupos suman solo hojas y cierran Activo = Pasivo + Patrimonio', () => {
    // Activo: caja 100 + banco (300-50+80-20=310) = 410
    expect(grupo('ACTIVO').saldo).toBe(410);
    expect(grupo('PASIVO').saldo).toBe(80);
    // Patrimonio: capital 100 − retiro 20 + resultado (300 − 50 = 250) = 330
    expect(grupo('PATRIMONIO').saldo).toBe(330);
    expect(e.diferencia).toBe(0);
    expect(e.raiz.saldo).toBe(410);
  });

  it('no repite el título cuando hay una sola raíz y deja el resultado como línea sintética', () => {
    expect(grupo('ACTIVO').hijos.map((h) => h.nombre)).toEqual(['ACTIVO CORRIENTE']);
    const pat = grupo('PATRIMONIO');
    expect(pat.hijos.map((h) => h.nombre)).toEqual(['Capital', 'Retiro Personal', 'Resultado do exercício']);
    expect(pat.hijos[2]).toMatchObject({ sintetico: true, saldo: 250 });
    expect(pat.hijos[1].saldo).toBe(-20);
  });

  it('participación sobre el padre y cuentas dependientes', () => {
    const ac = buscarNodo(e.raiz, 'ac')!;
    expect(ac.cuentasDependientes).toBe(2);
    expect(buscarNodo(e.raiz, 'banco')!.participacion).toBe(75.61);
    expect(grupo('ACTIVO').participacion).toBe(100);
  });

  it('con un mes elige el cierre y compara contra el mes anterior', () => {
    const oct = construirEdificio(plan, asientos, '2026-10', etiquetas);
    const banco = buscarNodo(oct.raiz, 'banco')!;
    expect(banco).toMatchObject({ saldo: 310, saldoAnterior: 250, variacion: 60, variacionPct: 24 });
    const sep = construirEdificio(plan, asientos, '2026-09', etiquetas);
    expect(buscarNodo(sep.raiz, 'banco')!.saldo).toBe(250);
    expect(sep.diferencia).toBe(0);
  });

  it('camino y movimientos', () => {
    expect(caminoHasta(e.raiz, 'banco').map((n) => n.nombre)).toEqual(['Empresa', 'Ativo', 'ACTIVO CORRIENTE', 'Banco']);
    const movs = movimientosDeCuenta('Banco', asientos, '2026-09');
    expect(movs.map((m) => m.id_operacion)).toEqual(['OP-2', 'OP-1']);
    expect(movs[0].esDebe).toBe(false);
  });
});

describe('utilidades', () => {
  it('meses', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
    expect(mesesDisponibles(asientos)).toEqual(['2026-10', '2026-09']);
  });

  it('alturas: mínimo visible, respeta el total y usa valor absoluto', () => {
    const h = alturasProporcionales([1000, 1, -500], 6, 0.5);
    expect(h.every((x) => x >= 0.5 - 1e-9)).toBe(true);
    expect(h.reduce((s, x) => s + x, 0)).toBeCloseTo(6, 5);
    expect(h[2]).toBeGreaterThan(0);
    expect(alturasProporcionales([], 6, 0.5)).toEqual([]);
  });
});
