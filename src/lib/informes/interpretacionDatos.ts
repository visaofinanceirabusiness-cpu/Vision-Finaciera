// lib/informes/interpretacionDatos.ts — reúne, para un mes, los números que cuenta la Interpretación. Usa los MISMOS cálculos que los informes
// (árbol del Mayor, balance, flujo de caja) para que cada cifra del relato coincida con la pantalla del informe correspondiente.

import { BLOQUES_FLUJO, armarFlujo, crearClasificador, movimientosDeCaja, saldoInicialDePeriodo } from '../flujoCaja';
import { arbolMayor, type CuentaArbol, type NodoMayor } from './mayorArbol';
import { totalesBalance } from './balance';
import type { DatosInterpretacion, Fila } from './interpretacion';

export type AsientoDatos = { fecha: string; debito: string | null; credito: string | null; importe: number };

export function mesAnteriorClave(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const hojasDe = (nodos: NodoMayor[]): NodoMayor[] => nodos.flatMap((n) => (n.esHoja ? [n] : hojasDe(n.hijos)));
const r2 = (n: number) => Math.round(n * 100) / 100;

function totalPorTipo(raices: NodoMayor[], tipo: string): number {
  return raices.filter((r) => r.cuenta.tipo_saldo === tipo).reduce((s, r) => s + r.saldoFinal, 0);
}

function top(nodos: NodoMayor[], tipos: string[], n: number): Fila[] {
  return hojasDe(nodos)
    .filter((h) => tipos.includes(h.cuenta.tipo_saldo ?? '') && h.saldoFinal > 0)
    .sort((a, b) => b.saldoFinal - a.saldoFinal)
    .slice(0, n)
    .map((h) => ({ nombre: h.cuenta.nombre, valor: h.saldoFinal }));
}

export function reunirDatos(p: {
  pt: boolean;
  esFamiliar: boolean;
  periodo: string; // AAAA-MM
  etiquetaPeriodo: string;
  dinero: (n: number) => string;
  cuentas: CuentaArbol[];
  hojas: CuentaArbol[];
  asientos: AsientoDatos[];
  // Para el balance: los asientos con los de cierre de ejercicio (como la pestaña Balance). El resto usa `asientos`, sin cierres.
  asientosBalance?: AsientoDatos[];
  nombresMedioFinanciero: Set<string>;
  nombresPorCobrar: Set<string>;
  nombreDeCuenta?: (nombre: string) => string;
  etiquetaMes?: (clave: string) => string;
}): DatosInterpretacion {
  const nom = p.nombreDeCuenta ?? ((n: string) => n);
  const previo = mesAnteriorClave(p.periodo);
  const delMes = p.asientos.filter((a) => a.fecha.slice(0, 7) === p.periodo);
  const paraBalance = p.asientosBalance ?? p.asientos;
  const hastaMes = paraBalance.filter((a) => a.fecha.slice(0, 7) <= p.periodo);
  const hastaPrevio = paraBalance.filter((a) => a.fecha.slice(0, 7) <= previo);
  const hayPrevio = p.asientos.some((a) => a.fecha.slice(0, 7) <= previo);

  // Resultado del mes (las cuentas de resultado arrancan en cero cada mes) y el del mes anterior.
  const A = arbolMayor(p.cuentas, p.asientos, p.periodo, true);
  const B = hayPrevio ? arbolMayor(p.cuentas, p.asientos, previo, true) : null;
  const resumenResultado = (raices: NodoMayor[]) => {
    const ingresos = totalPorTipo(raices, 'INGRESO');
    const costos = totalPorTipo(raices, 'COSTO');
    const gastos = totalPorTipo(raices, 'GASTO');
    return { ingresos, costos, gastos, resultado: ingresos - costos - gastos };
  };
  const ra = resumenResultado(A.raices);
  const rb = B ? resumenResultado(B.raices) : null;
  const nombrar = (filas: Fila[]) => filas.map((f) => ({ ...f, nombre: nom(f.nombre) }));

  // Flujo de caja: la misma construcción de la pestaña Flujo de Caja.
  const cuentasCaja = p.hojas.filter((c) => p.nombresMedioFinanciero.has(c.nombre));
  const nombresCaja = new Set(cuentasCaja.map((c) => c.nombre));
  const nombresIngreso = new Set(p.hojas.filter((c) => c.tipo_saldo === 'INGRESO').map((c) => c.nombre));
  const ingresosPorCuenta = new Map<string, Set<string>>();
  for (const a of p.asientos) {
    if (a.debito && a.credito && p.nombresPorCobrar.has(a.debito) && nombresIngreso.has(a.credito)) ingresosPorCuenta.set(a.debito, (ingresosPorCuenta.get(a.debito) ?? new Set<string>()).add(a.credito));
  }
  const ingresoDeCuentaPorCobrar = new Map<string, string>();
  for (const [cuenta, ingresos] of ingresosPorCuenta) if (ingresos.size === 1) ingresoDeCuentaPorCobrar.set(cuenta, Array.from(ingresos)[0]);

  const clasificar = crearClasificador(p.hojas, p.asientos, nombresCaja, p.esFamiliar);
  const flujo = armarFlujo(movimientosDeCaja(delMes, nombresCaja), clasificar, (c) => (c && ingresoDeCuentaPorCobrar.get(c)) || c);
  const juntar = (lado: 'entradas' | 'salidas', sinInversion: boolean): Fila[] => {
    const mapa = new Map<string, number>();
    for (const b of BLOQUES_FLUJO) {
      if (sinInversion && (b === 'INVERSION' || b === 'BIENES')) continue;
      for (const f of flujo.bloques[b][lado]) mapa.set(f.nombre, (mapa.get(f.nombre) ?? 0) + f.valor);
    }
    return Array.from(mapa.entries()).map(([nombre, valor]) => ({ nombre: nom(nombre === '__OTRO__' ? '—' : nombre), valor })).sort((a, b) => b.valor - a.valor);
  };
  const entradasL = juntar('entradas', p.esFamiliar);
  const salidasL = juntar('salidas', p.esFamiliar);
  const saldoInicial = saldoInicialDePeriodo(cuentasCaja.map((c) => ({ nombre: c.nombre, saldo_inicial: c.saldo_inicial == null ? null : Number(c.saldo_inicial) })), p.asientos, p.periodo);
  const ahorro = p.esFamiliar ? r2(flujo.bloques.INVERSION.totalSalidas - flujo.bloques.INVERSION.totalEntradas) : null;
  const ingresosComerciales = flujo.bloques.COMERCIAL.totalEntradas;

  const bal = totalesBalance(p.hojas, hastaMes);
  const balPrev = hayPrevio ? totalesBalance(p.hojas, hastaPrevio) : null;

  const cuentasMovidas = hojasDe(A.raices)
    .map((h) => ({ nombre: nom(h.cuenta.nombre), variacion: r2(h.saldoFinal - h.saldoInicial), saldoFinal: h.saldoFinal }))
    .filter((c) => Math.abs(c.variacion) >= 0.5)
    .sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion))
    .slice(0, 3);

  // Tendencia: resultado e ingresos de los últimos meses con movimiento (hasta el elegido).
  const mesesConDatos = Array.from(new Set(p.asientos.map((a) => a.fecha.slice(0, 7)).filter((m) => m <= p.periodo))).sort().slice(-4);
  const tendencia = mesesConDatos.map((clave) => {
    const res = resumenResultado(arbolMayor(p.cuentas, p.asientos, clave, true).raices);
    return { etiqueta: p.etiquetaMes ? p.etiquetaMes(clave) : clave, resultado: res.resultado, ingresos: res.ingresos };
  });

  const saldoPrevioRaiz = new Map(B ? B.raices.map((r) => [r.cuenta.id, r.saldoFinal]) : []);

  return {
    pt: p.pt,
    esFamiliar: p.esFamiliar,
    periodo: p.etiquetaPeriodo,
    dinero: p.dinero,
    hayMovimientos: delMes.length > 0,
    resultado: {
      ...ra,
      anterior: rb,
      topIngresos: nombrar(top(A.raices, ['INGRESO'], 3)),
      topSalidas: nombrar(top(A.raices, ['COSTO', 'GASTO'], 3)),
    },
    flujo: {
      saldoInicial,
      entradas: p.esFamiliar ? entradasL.reduce((s, f) => s + f.valor, 0) : flujo.totalEntradas,
      salidas: p.esFamiliar ? salidasL.reduce((s, f) => s + f.valor, 0) : flujo.totalSalidas,
      saldoFinal: saldoInicial + flujo.neto,
      topEntradas: entradasL.slice(0, 3),
      topSalidas: salidasL.slice(0, 3),
      ahorro,
      tasaAhorro: ahorro !== null && ingresosComerciales > 0 ? (ahorro / ingresosComerciales) * 100 : null,
    },
    balance: { ...bal, anterior: balPrev ? { activo: balPrev.activo, pasivo: balPrev.pasivo, patrimonio: balPrev.patrimonio } : null },
    cuentasMovidas,
    gruposVariacion: B ? A.raices.map((r) => ({ nombre: nom(r.cuenta.nombre), variacion: r2(r.saldoFinal - (saldoPrevioRaiz.get(r.cuenta.id) ?? 0)) })) : null,
    sumas: { cuadra: Math.abs(A.totalDebe - A.totalHaber) < 0.01, totalDebe: A.totalDebe, totalHaber: A.totalHaber },
    tendencia,
    mesAnterior: hayPrevio && p.etiquetaMes ? p.etiquetaMes(previo) : null,
  };
}
