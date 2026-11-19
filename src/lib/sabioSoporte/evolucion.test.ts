import { describe, expect, it } from 'vitest';
import { calcularEvolucion, indicesDeCierre, valorAlCierreDelMes, type AsientoSimple, type CuentaPlan } from './evolucion';

const c = (id: string, codigo: string, nombre: string, tipo: string, naturaleza: string, padreId: string | null = null, saldoInicial = 0): CuentaPlan => ({ id, codigo, nombre, tipo, naturaleza, padreId, saldoInicial });

const plan: CuentaPlan[] = [
  c('a', '1.0.0.0.0', 'ATIVO', 'ACTIVO', 'DEUDORA'),
  c('caja', '1.1.1.0.1', 'Caixa', 'ACTIVO', 'DEUDORA', 'a'),
  c('banco', '1.1.1.0.2', 'Banco', 'ACTIVO', 'DEUDORA', 'a'),
  c('stock', '1.1.3.0.2', 'Estoque X', 'ACTIVO', 'DEUDORA', 'a'),
  c('dep', '1.2.1.9.9', 'Depreciação', 'ACTIVO', 'ACREEDORA', 'a'),
  c('p', '2.0.0.0.0', 'PASSIVO', 'PASIVO', 'ACREEDORA'),
  c('prov', '2.1.1.0.1', 'Fornecedores', 'PASIVO', 'ACREEDORA', 'p'),
  c('pn', '3.0.0.0.0', 'PATRIMONIO', 'PATRIMONIO', 'ACREEDORA'),
  c('aporte', '3.1.1.0.1', 'Aporte de Sócios', 'PATRIMONIO', 'ACREEDORA', 'pn'),
  c('retiro', '3.1.3.0.1', 'Retirada de Sócios', 'PATRIMONIO', 'DEUDORA', 'pn'),
  c('i', '4.0.0.0.0', 'RECEITAS', 'INGRESO', 'ACREEDORA'),
  c('venta', '4.1.0.0.1', 'Venda X', 'INGRESO', 'ACREEDORA', 'i'),
  c('k', '5.0.0.0.0', 'CUSTOS', 'COSTO', 'DEUDORA'),
  c('cmv', '5.1.0.0.1', 'Custo X', 'COSTO', 'DEUDORA', 'k'),
  c('g', '6.0.0.0.0', 'DESPESAS', 'GASTO', 'DEUDORA'),
  c('alq', '6.1.0.0.1', 'Aluguel', 'GASTO', 'DEUDORA', 'g'),
];

const asientos: AsientoSimple[] = [
  { fecha: '2026-01-02', debito: 'Banco', credito: 'Aporte de Sócios', importe: 1000 },
  { fecha: '2026-01-03', debito: 'Estoque X', credito: 'Banco', importe: 300 }, // compra
  { fecha: '2026-01-10', debito: 'Caixa', credito: 'Venda X', importe: 200 }, // venta
  { fecha: '2026-01-10', debito: 'Custo X', credito: 'Estoque X', importe: 120 }, // CMV
  { fecha: '2026-02-05', debito: 'Aluguel', credito: 'Banco', importe: 100 },
  { fecha: '2026-02-20', debito: 'Retirada de Sócios', credito: 'Caixa', importe: 50 },
];

describe('calcularEvolucion', () => {
  const ev = calcularEvolucion(plan, asientos, '2026-02-28');
  const v = (clave: string, mes: string) => valorAlCierreDelMes(ev, clave, mes);

  it('saldos de las cuentas hoja en su sentido natural', () => {
    expect(v('1.1.1.0.2', '2026-01')).toBe(700); // banco: +1000 −300
    expect(v('1.1.1.0.2', '2026-02')).toBe(600);
    expect(v('1.1.1.0.1', '2026-01')).toBe(200);
    expect(v('1.1.1.0.1', '2026-02')).toBe(150);
    expect(v('3.1.1.0.1', '2026-02')).toBe(1000);
  });
  it('las cuentas padre suman a sus hijas', () => {
    expect(v('1.0.0.0.0', '2026-01')).toBe(700 + 200 + 180);
    expect(ev.porClave.get('1.0.0.0.0')!.esPadre).toBe(true);
    expect(ev.porClave.get('1.1.1.0.2')!.esPadre).toBe(false);
  });
  it('resultado, patrimonio total y la ecuación contable cierran', () => {
    expect(v('RES:RESULTADO', '2026-01')).toBe(80); // 200 − 120
    expect(v('RES:RESULTADO', '2026-02')).toBe(-20); // −100 de alquiler
    for (const mes of ['2026-01', '2026-02']) {
      const activo = v('1.0.0.0.0', mes)!;
      const pasivo = v('2.0.0.0.0', mes)!;
      const pnTotal = v('RES:PN_TOTAL', mes)!;
      expect(activo).toBe(pasivo + pnTotal);
    }
  });
  it('la retirada de socios resta del patrimonio', () => {
    expect(v('3.0.0.0.0', '2026-02')).toBe(950);
  });
  it('disponibilidades y mercaderías salen de los códigos', () => {
    expect(v('RES:DISPONIBLE', '2026-02')).toBe(750);
    expect(v('RES:MERCADERIAS', '2026-02')).toBe(180);
  });
  it('sin asientos no hay serie', () => {
    expect(calcularEvolucion(plan, [], '2026-02-28').series).toEqual([]);
  });
});

describe('indicesDeCierre', () => {
  const fechas = ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'];
  it('mes: último día de cada mes (y el último dato)', () => {
    expect(indicesDeCierre(fechas, 'MES')).toEqual([1, 3]);
  });
  it('día: todos', () => {
    expect(indicesDeCierre(fechas, 'DIA')).toEqual([0, 1, 2, 3]);
  });
  it('semana: cierra cada semana en el último día que hay', () => {
    expect(indicesDeCierre(['2026-02-01', '2026-02-02', '2026-02-08'], 'SEMANA')).toEqual([0, 2]);
  });
});

describe('disponibilidades y mercaderías según la empresa', () => {
  it('usa los medios de pago indicados (no el prefijo de la plantilla)', () => {
    const otro: CuentaPlan[] = [c('a', '1.0.0.0.0', 'ACTIVO', 'ACTIVO', 'DEUDORA'), c('n', '1.1.0.0.4', 'Banco Nu', 'ACTIVO', 'DEUDORA', 'a'), c('r', '1.1.2.0.1', 'Alquiler a cobrar', 'ACTIVO', 'DEUDORA', 'a'), c('ap', '3.1.1.0.1', 'Aportes', 'PATRIMONIO', 'ACREEDORA')];
    const asi: AsientoSimple[] = [{ fecha: '2026-03-01', debito: 'Banco Nu', credito: 'Aportes', importe: 500 }, { fecha: '2026-03-02', debito: 'Alquiler a cobrar', credito: 'Aportes', importe: 200 }];
    const ev = calcularEvolucion(otro, asi, '2026-03-02', { disponibles: new Set(['n']) });
    expect(ev.porClave.get('RES:DISPONIBLE')!.valores.at(-1)).toBe(500);
    expect(ev.porClave.has('RES:MERCADERIAS')).toBe(false); // sin mercadería no hay serie
  });
  it('mercaderías = lo que cuelga del contenedor de stock', () => {
    const conStock: CuentaPlan[] = [{ ...c('a', '1.0.0.0.0', 'ACTIVO', 'ACTIVO', 'DEUDORA') }, { ...c('m', '1.1.7.0.0', 'Mercadorias', 'ACTIVO', 'DEUDORA', 'a'), rol: 'CONTENEDOR_STOCK' }, c('e', '1.1.7.0.2', 'Estoque Y', 'ACTIVO', 'DEUDORA', 'm'), c('b', '1.1.0.0.1', 'Banco', 'ACTIVO', 'DEUDORA', 'a')];
    const asi: AsientoSimple[] = [{ fecha: '2026-03-01', debito: 'Estoque Y', credito: 'Banco', importe: 300 }];
    expect(calcularEvolucion(conStock, asi, '2026-03-01').porClave.get('RES:MERCADERIAS')!.valores.at(-1)).toBe(300);
  });
});
