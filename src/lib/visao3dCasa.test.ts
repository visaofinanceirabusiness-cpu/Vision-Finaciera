import { describe, expect, it } from 'vitest';
import { construirEdificio, type CuentaPlan } from './visao3d';
import { construirObjetosCasa, objetoDeCuenta, planoDeObjetos } from './visao3dCasa';

const c = (id: string, codigo: string, nombre: string, tipo: string, nat: string, padre: string | null = null, ini = 0): CuentaPlan => ({ id, codigo, nombre, cuenta_padre_id: padre, tipo_saldo: tipo, naturaleza: nat, saldo_inicial: ini });
const plan: CuentaPlan[] = [
  c('a', '1', 'ACTIVO', 'ACTIVO', 'DEUDORA'),
  c('co', '1.1', 'ACTIVO CORRIENTE', 'ACTIVO', 'DEUDORA', 'a'), c('ef', '1.1.1', 'Efectivo', 'ACTIVO', 'DEUDORA', 'co', 3), c('bn', '1.1.2', 'Banco Nu', 'ACTIVO', 'DEUDORA', 'co', 0.29), c('uc', '1.1.3', 'Uber a cobrar', 'ACTIVO', 'DEUDORA', 'co', 63),
  c('ah', '1.2', 'AHORROS E INVERSIONES', 'ACTIVO', 'DEUDORA', 'a'), c('cx1', '1.2.1', 'Caxinha Viaje', 'ACTIVO', 'DEUDORA', 'ah', 1009), c('cx2', '1.2.2', 'Caxinha Facultad', 'ACTIVO', 'DEUDORA', 'ah', 172),
  c('lt', '1.2.3', 'Limite tarjeta Nu', 'ACTIVO', 'DEUDORA', 'ah', 1011), c('pv', '1.2.4', 'Providencia Santander', 'ACTIVO', 'DEUDORA', 'ah', 22195), c('sc', '1.2.5', 'Super Caxinha Nu', 'ACTIVO', 'DEUDORA', 'ah', 5030),
  c('bi', '1.3', 'BIENES Y PROPIEDADES', 'ACTIVO', 'DEUDORA', 'a'), c('ve', '1.3.1', 'Vehículos', 'ACTIVO', 'DEUDORA', 'bi', 20000), c('in', '1.3.2', 'Inmuebles', 'ACTIVO', 'DEUDORA', 'bi', 2),
  c('mu', '1.3.3', 'Muebles y Útiles', 'ACTIVO', 'DEUDORA', 'bi', 2957), c('el', '1.3.4', 'Electrodomésticos', 'ACTIVO', 'DEUDORA', 'bi', 200), c('cero', '1.3.5', 'Cuenta en cero', 'ACTIVO', 'DEUDORA', 'bi', 0),
  c('p', '2', 'PASIVO', 'PASIVO', 'ACREEDORA'), c('tj', '2.1', 'T. de Crédito a Pagar Nu', 'PASIVO', 'ACREEDORA', 'p', 484), c('pr', '2.2', 'Préstamos Santander', 'PASIVO', 'ACREEDORA', 'p', 8), c('cb', '2.3', 'Combustible Uber a pagar', 'PASIVO', 'ACREEDORA', 'p', 160), c('nf', '2.4', 'Netflix a pagar', 'PASIVO', 'ACREEDORA', 'p', 0),
  c('in1', '4.1', 'Sueldo', 'INGRESO', 'ACREEDORA', null, 0),
  c('pn', '3', 'PATRIMONIO', 'PATRIMONIO', 'ACREEDORA'), c('ap', '3.1', 'Aportes y Ayudas Recibidas', 'PATRIMONIO', 'ACREEDORA', 'pn', 49795),
];
const e = construirEdificio(plan, [], null, { empresa: 'E', ACTIVO: 'Ativo', PASIVO: 'Passivo', PATRIMONIO: 'PL', resultado: 'Resultado' });
const objetos = construirObjetosCasa(e.raiz);
const ids = (zona: string) => objetos.filter((o) => o.zona === zona).map((o) => o.id);

describe('construirObjetosCasa', () => {
  it('un objeto por cuenta con saldo; las cuentas en cero (y bajo 0,50) no se dibujan', () => {
    expect(objetos.find((o) => o.id === 'cero')).toBeUndefined();
    expect(objetos.find((o) => o.id === 'bn')).toBeUndefined(); // 0,29
    expect(objetos.find((o) => o.id === 'nf')).toBeUndefined();
    expect(ids('ACTIVO').sort()).toEqual(['cx1', 'cx2', 'ef', 'el', 'in', 'lt', 'mu', 'pv', 'sc', 'uc', 've'].sort());
    expect(ids('PASIVO').sort()).toEqual(['cb', 'pr', 'tj']);
  });

  it('el resultado del ejercicio sin cerrar (sintético) entra en Patrimonio para balancear', () => {
    const conResultado = construirObjetosCasa(
      construirEdificio(plan, [{ id_operacion: 'x', fecha: '2026-10-01', descripcion: '', debito: 'Banco Nu', credito: 'Sueldo', importe: 500 }], null, { empresa: 'E', ACTIVO: 'Ativo', PASIVO: 'Passivo', PATRIMONIO: 'PL', resultado: 'Resultado' }).raiz
    );
    expect(conResultado.some((o) => o.zona === 'PATRIMONIO' && o.nodo.sintetico)).toBe(true);
  });

  it('piezas grandes: auto en la entrada, sofá (Muebles) y TV (Electrodomésticos) en el living', () => {
    expect(objetos.find((o) => o.id === 've')).toMatchObject({ modo: 'auto', sala: 'entrada' });
    expect(objetos.find((o) => o.id === 'mu')).toMatchObject({ modo: 'sofa', sala: 'living' });
    expect(objetos.find((o) => o.id === 'el')).toMatchObject({ modo: 'tv', sala: 'living' });
  });

  it('llenado corrido: 5 por habitación en el orden de los grupos del Panel (mayor total primero)', () => {
    const plintos = objetos.filter((o) => o.zona === 'ACTIVO' && o.modo === 'plinto');
    expect(plintos).toHaveLength(8);
    expect(plintos.filter((o) => o.sala === 'garage')).toHaveLength(5);
    expect(plintos.filter((o) => o.sala === 'living')).toHaveLength(3);
    // El grupo Ahorros (el de mayor total) abre el llenado: Providencia es la primera.
    expect(plintos[0].id).toBe('pv');
    expect(plintos.filter((o) => o.sala === 'garage').every((o) => o.fila === 0)).toBe(true);
  });

  it('Pasivo y Patrimonio van en su habitación', () => {
    expect(objetos.filter((o) => o.zona === 'PASIVO').every((o) => o.sala === 'oficina')).toBe(true);
    expect(objetos.filter((o) => o.zona === 'PATRIMONIO').every((o) => o.sala === 'comedor')).toBe(true);
  });

  it('cada fila sabe cuántos objetos tiene (para centrarla)', () => {
    const garage = objetos.filter((o) => o.sala === 'garage');
    expect(garage.every((o) => o.enFila === 5)).toBe(true);
    expect(garage.map((o) => o.indice).sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('encuentra el objeto de una cuenta', () => {
    expect(objetoDeCuenta(objetos, 'pv')?.id).toBe('pv');
    expect(objetoDeCuenta(objetos, 'zzz')).toBeNull();
  });
});

describe('casa ampliada', () => {
  it('lo que no entra en un cuarto va a un cuarto nuevo del plano (nunca a otra fila)', () => {
    const muchas: CuentaPlan[] = [c('a', '1', 'ACTIVO', 'ACTIVO', 'DEUDORA'), c('p', '2', 'PASIVO', 'PASIVO', 'ACREEDORA')];
    for (let i = 0; i < 17; i++) muchas.push(c(`x${i}`, `1.${i + 1}`, `Ahorro ${i}`, 'ACTIVO', 'DEUDORA', 'a', 100 + i));
    const raiz = construirEdificio(muchas, [], null, { empresa: 'E', ACTIVO: 'Ativo', PASIVO: 'Passivo', PATRIMONIO: 'PL', resultado: 'Resultado' }).raiz;
    const lista = construirObjetosCasa(raiz);
    const plano = planoDeObjetos(lista);
    expect(plano.cuartosDe('ACTIVO')).toHaveLength(4);
    expect(lista.every((o) => o.fila === 0)).toBe(true);
    expect(lista.filter((o) => o.sala === 'activo-4')).toHaveLength(2);
    expect(lista.every((o) => plano.cuartos.some((q) => q.id === o.sala) || o.sala === 'entrada')).toBe(true);
  });
});
