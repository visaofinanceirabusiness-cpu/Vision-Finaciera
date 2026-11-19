// lib/sabioSoporte/agenda.ts — AGENDA DEL DÍA (pura, con semilla: mismo día y misma semilla = misma agenda).
// `planificarDia` decide QUÉ se hace (tipos y montos objetivo); el ejecutor lo traduce a operaciones concretas contra el estado real de la
// empresa (stock, saldos) con los resolvedores de abajo, y es el motor contable quien da la última palabra.

import type { ConfigSabio, GastoFijo } from './config';
import { diaDeSemana, factorInflacion, metaVentasMes, pesoDelDia } from './plan';
import { elegir, elegirConPeso, entre, enteroEntre, hashUnitario, type Rng } from './rng';

export type Intencion =
  | { tipo: 'APORTE'; monto: number; motivo: string }
  | { tipo: 'PAGO_FIJO'; gasto: GastoFijo; monto: number }
  | { tipo: 'IMPUESTO'; monto: number }
  | { tipo: 'COMPRA'; presupuesto: number }
  | { tipo: 'VENTA_PRODUCTO'; objetivo: number }
  | { tipo: 'VENTA_SERVICIO'; objetivo: number }
  | { tipo: 'DEPOSITO' }
  | { tipo: 'RETIRO'; monto: number }
  | { tipo: 'PAGO_VARIABLE'; categoria: string; monto: number };

export type EntradaDia = {
  config: ConfigSabio;
  fecha: string;
  rng: Rng;
  presupuestoVentas: number;
  fijosPendientes: GastoFijo[]; // gastos fijos que ya corresponden este mes y todavía no se pagaron
  impuestoPendiente: number | null; // monto del impuesto si ya es el día y no se pagó este mes
  retiroPendiente: number | null;
  aporteInicialPendiente: boolean; // la empresa todavía no tiene ningún aporte de socios
  opsExistentesHoy: number; // operaciones que ya hay ese día (cargadas por personas o en una corrida anterior)
};

const redondear = (n: number, paso = 1) => Math.max(paso, Math.round(n / paso) * paso);

export function cantidadDeOperaciones(c: ConfigSabio, fecha: string, rng: Rng): number {
  const peso = pesoDelDia(c, fecha);
  if (peso <= 0) return 0;
  const base = enteroEntre(rng, c.ritmo.opsMin, c.ritmo.opsMax);
  // Los días de menor actividad (sábado) hacen proporcionalmente menos; los de más, hasta el máximo.
  return Math.min(c.ritmo.opsMax, Math.max(1, Math.round(base * Math.min(1, peso))));
}

export function planificarDia(e: EntradaDia): Intencion[] {
  const { config: c, fecha, rng } = e;
  const peso = pesoDelDia(c, fecha);
  const intenciones: Intencion[] = [];

  // 1) Lo obligatorio (en este orden): primero entra plata, después se paga.
  if (e.aporteInicialPendiente) intenciones.push({ tipo: 'APORTE', monto: c.capital.aporteInicial, motivo: 'Aporte inicial de capital' });
  if (peso > 0) {
    const f = factorInflacion(c, fecha);
    for (const g of e.fijosPendientes) intenciones.push({ tipo: 'PAGO_FIJO', gasto: g, monto: redondear(g.monto * f, 1) });
    if (e.impuestoPendiente && e.impuestoPendiente > 0) intenciones.push({ tipo: 'IMPUESTO', monto: Math.round(e.impuestoPendiente * 100) / 100 });
  }
  const obligatorias = intenciones.length;

  if (peso <= 0) return intenciones;

  const total = Math.min(c.ritmo.topeDiario, Math.max(cantidadDeOperaciones(c, fecha, rng), obligatorias + 1));
  let libres = Math.max(0, total - e.opsExistentesHoy - obligatorias);

  // 2) Compras: una probabilidad por día hábil que da, en promedio, `comprasPorSemana` por semana.
  const mes = fecha.slice(0, 7);
  const meta = metaVentasMes(c, mes);
  const costoRatio = 1 / (1 + c.ventas.margenProductosPct / 100);
  const comprasPorMes = Math.max(1, c.compras.comprasPorSemana * 4.3);
  const probCompra = Math.min(1, c.compras.comprasPorSemana / 5.85);
  if (libres > 0 && rng() < probCompra) {
    const presupuesto = (meta * (1 - c.ventas.mixServiciosPct / 100) * costoRatio) / comprasPorMes;
    intenciones.push({ tipo: 'COMPRA', presupuesto: redondear(presupuesto * entre(rng, 0.8, 1.25), 10) });
    libres--;
  }

  // 3) Viernes: depósito del efectivo acumulado al banco (el ejecutor lo salta si no hay suficiente).
  if (libres > 0 && diaDeSemana(fecha) === 5) {
    intenciones.push({ tipo: 'DEPOSITO' });
    libres--;
  }

  if (e.retiroPendiente && e.retiroPendiente > 0 && libres > 0) {
    intenciones.push({ tipo: 'RETIRO', monto: Math.round(e.retiroPendiente * 100) / 100 });
    libres--;
  }

  // 4) Gasto variable: ~7 por mes repartidos entre los días hábiles.
  const probVariable = 7 / 21;
  if (libres > 1 && c.gastos.variablesPctVentas > 0 && rng() < probVariable) {
    const mensual = meta * (c.gastos.variablesPctVentas / 100);
    intenciones.push({ tipo: 'PAGO_VARIABLE', categoria: elegir(rng, c.gastos.categoriasVariables), monto: redondear((mensual / 7) * entre(rng, 0.5, 1.6), 5) });
    libres--;
  }

  // 5) El resto del día son ventas, que se reparten el presupuesto: una parte en servicios y el resto en productos.
  if (libres > 0 && e.presupuestoVentas > 0) {
    const presServ = e.presupuestoVentas * (c.ventas.mixServiciosPct / 100);
    const presProd = e.presupuestoVentas - presServ;
    let nServ = Math.min(libres, Math.round(presServ / c.ventas.ticketServicios));
    if (nServ === 0 && presServ > c.ventas.ticketServicios * 0.4 && rng() < presServ / c.ventas.ticketServicios) nServ = 1;
    nServ = Math.min(nServ, Math.max(0, libres - (presProd > 0 ? 1 : 0)));
    const nProd = presProd > 0 ? Math.max(1, libres - nServ) : 0;
    for (let i = 0; i < nProd; i++) intenciones.push({ tipo: 'VENTA_PRODUCTO', objetivo: Math.min(c.ventas.ticketMaximoProductos, redondear((presProd / nProd) * entre(rng, 0.7, 1.3), 5)) });
    for (let i = 0; i < nServ; i++) intenciones.push({ tipo: 'VENTA_SERVICIO', objetivo: redondear((presServ / Math.max(1, nServ)) * entre(rng, 0.7, 1.3), 10) });
  }

  return intenciones;
}

// ---------------------------------------------------------------------------------------------------------------------
// Resolvedores: de «vender unos R$ 300» a líneas concretas con el stock y los costos reales.
// ---------------------------------------------------------------------------------------------------------------------

export type ProductoEstado = { id: string; nombre: string; categoria: string; cantidad: number; costoMedio: number };
export type LineaPlan = { producto: string; cantidad: number; precio: number };

// Precio de venta: costo promedio + recargo (con algo de variación) y nunca por debajo del costo (el motor lo prohíbe).
export function precioDeVenta(costoMedio: number, c: ConfigSabio, rng: Rng): number {
  const v = c.ventas.variacionPrecioPct / 100;
  const recargo = c.ventas.margenProductosPct / 100 * (1 + entre(rng, -v, v));
  const precio = Math.ceil(costoMedio * (1 + Math.max(0, recargo)) * 10) / 10;
  return Math.round(Math.max(precio, costoMedio + 0.1) * 100) / 100;
}

export function resolverVentaProducto(objetivo: number, productos: ProductoEstado[], c: ConfigSabio, rng: Rng): { categoria: string; lineas: LineaPlan[]; total: number } | null {
  const permitidas = new Set(c.ventas.categoriasProducto);
  const candidatos = productos.filter((p) => permitidas.has(p.categoria) && p.cantidad >= 1 && p.costoMedio > 0);
  if (candidatos.length === 0) return null;

  // Se prefieren los productos cuyo precio unitario no supera el objetivo (para no vender un auto a quien «compra R$ 200»).
  const primero = elegirConPeso(rng, candidatos.map((p) => ({ valor: p, peso: p.costoMedio * (1 + c.ventas.margenProductosPct / 100) <= objetivo * 1.5 ? 4 : 0.3 })));
  if (!primero) return null;

  const lineas: LineaPlan[] = [];
  let total = 0;
  const armar = (p: ProductoEstado, meta: number, esSegunda = false) => {
    const precio = precioDeVenta(p.costoMedio, c, rng);
    const lugar = c.ventas.ticketMaximoProductos - total;
    // La segunda línea solo entra si cabe entera; la primera lleva al menos una unidad aunque ella sola ya supere el ticket máximo.
    if (esSegunda && precio > lugar) return;
    const topeTicket = Math.max(1, Math.floor(Math.max(0, Math.min(meta, lugar)) / precio));
    const cantidad = Math.max(1, Math.min(Math.floor(p.cantidad), 6, Math.round(meta / precio), topeTicket));
    lineas.push({ producto: p.id, cantidad, precio });
    total += cantidad * precio;
  };
  armar(primero, objetivo);

  // Segunda línea (misma categoría: una venta con stock lleva una sola categoría) si el objetivo no se cubrió y hay otro producto.
  const resto = objetivo - total;
  if (resto > objetivo * 0.25 && total + 1 < c.ventas.ticketMaximoProductos) {
    const otros = candidatos.filter((p) => p.categoria === primero.categoria && p.id !== primero.id);
    if (otros.length > 0) armar(elegir(rng, otros), resto, true);
  }
  return { categoria: primero.categoria, lineas, total: Math.round(total * 100) / 100 };
}

export type ProductoCatalogo = { id: string; nombre: string; categoria: string };

// Costo unitario de compra: referencia de la categoría × un factor estable por producto (0,6 a 1,6) × la inflación acumulada.
export function costoDeCompra(p: ProductoCatalogo, c: ConfigSabio, fecha: string): number {
  const base = c.compras.costoBaseCategoria[p.categoria] ?? 80;
  const factor = 0.6 + hashUnitario(p.nombre) * 1.0;
  return Math.round(base * factor * factorInflacion(c, fecha) * 100) / 100;
}

export function resolverCompra(presupuesto: number, catalogo: ProductoCatalogo[], c: ConfigSabio, rng: Rng, fecha: string): { categoria: string; lineas: Array<{ producto: string; cantidad: number; costo: number }>; total: number } | null {
  const permitidas = c.ventas.categoriasProducto.filter((cat) => catalogo.some((p) => p.categoria === cat));
  if (permitidas.length === 0) return null;
  const categoria = elegir(rng, permitidas);
  const delaCategoria = catalogo.filter((p) => p.categoria === categoria);
  const cuantos = Math.min(delaCategoria.length, enteroEntre(rng, 1, 3));
  const elegidos = [...delaCategoria].sort(() => rng() - 0.5).slice(0, cuantos);

  const lineas = elegidos.map((p) => {
    const costo = costoDeCompra(p, c, fecha);
    return { producto: p.id, cantidad: Math.max(2, Math.round(presupuesto / elegidos.length / costo)), costo };
  });
  const total = lineas.reduce((s, l) => s + l.cantidad * l.costo, 0);
  return { categoria, lineas, total: Math.round(total * 100) / 100 };
}
