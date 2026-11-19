// lib/sabioSoporte/ejecutor.ts — SOLO SERVIDOR.
//
// Ejecuta un día de Sabio Soporte sobre la empresa demo: arma la agenda (agenda.ts), la traduce a operaciones concretas contra el estado real
// (stock, saldos) y las carga con registrarOperacion, el MISMO motor contable de siempre (partida doble, saldos y stock no negativos, costo
// promedio). Si el motor rechaza algo se anota y se sigue: nunca se fuerza nada. Procesa de a UN día por llamada (una ruta de servidor) y
// restaura siempre el cliente de base de datos en un `finally`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { usarClienteDeServicio } from '../supabase';
import { registrarOperacion, traerTodo } from '../motor';
import { saldosDeMedios } from '../saldoCuenta';
import { obtenerCategoriasJuego } from '../miniJuego';
import { aCentavos } from '../centavos';
import { configCompleta, MEDIOS_PLATA, validarConfig, type ConfigSabio } from './config';
import { crearRng, elegir, elegirConPeso, semillaDelDia } from './rng';
import { diasDelMes, presupuestoVentasDia, ultimoDiaDelMes } from './plan';
import { planificarDia, resolverCompra, resolverVentaProducto, type Intencion, type ProductoCatalogo, type ProductoEstado } from './agenda';

export type EntradaRegistro = { tipo: 'OPERACION' | 'RECHAZO' | 'INFO'; operacion?: string; idOperacion?: string; monto?: number; detalle: string; error?: string };
export type ResumenDia = { fecha: string; omitido?: 'PAUSADO' | 'YA_EJECUTADO' | 'ANTES_DEL_INICIO' | 'FUTURO' | 'CONFIG_INVALIDA' | 'SIN_ACTIVIDAD'; ok: number; errores: number; simulado: boolean; registro: EntradaRegistro[]; presupuestoVentas?: number };

const aNum = (x: unknown) => Number(x ?? 0);

type Contexto = {
  admin: SupabaseClient;
  empresaId: string;
  fecha: string;
  c: ConfigSabio;
  simular: boolean;
  rng: ReturnType<typeof crearRng>;
  saldos: Record<string, number>;
  productos: Map<string, ProductoEstado>;
  catalogo: ProductoCatalogo[];
  serviciosCat: string[];
  clientes: string[];
  proveedores: string[];
  registro: EntradaRegistro[];
  ok: number;
  errores: number;
  opsEjecutadas: number;
};

// ---------------------------------------------------------------------------------------------------------------------
// Lectura del estado
// ---------------------------------------------------------------------------------------------------------------------

async function estadoDeStock(ctx: Pick<Contexto, 'admin' | 'empresaId' | 'fecha'>): Promise<Map<string, { cantidad: number; valor: number }>> {
  const filas = await traerTodo<{ producto_id: string; tipo: string; cantidad: number | string; costo_unitario: number | string }>((d, h) =>
    ctx.admin.from('movimientos_stock').select('producto_id, tipo, cantidad, costo_unitario').eq('empresa_id', ctx.empresaId).lte('fecha', ctx.fecha).order('id').range(d, h)
  );
  const m = new Map<string, { cantidad: number; valor: number }>();
  for (const f of filas) {
    const signo = f.tipo === 'ENTRADA' ? 1 : f.tipo === 'SALIDA' ? -1 : 0;
    if (signo === 0) continue;
    const previo = m.get(f.producto_id) ?? { cantidad: 0, valor: 0 };
    previo.cantidad += signo * aNum(f.cantidad);
    previo.valor += signo * aNum(f.cantidad) * aNum(f.costo_unitario);
    m.set(f.producto_id, previo);
  }
  return m;
}

async function sumaVentas(admin: SupabaseClient, empresaId: string, desde: string, hasta: string): Promise<number> {
  const filas = await traerTodo<{ total: number | string }>((d, h) =>
    admin.from('registro_operaciones').select('total').eq('empresa_id', empresaId).eq('operacion', 'VENTA').gte('fecha', desde).lte('fecha', hasta).range(d, h)
  );
  return aCentavos(filas.reduce((s, f) => s + aNum(f.total), 0));
}

function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 2, 1));
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Registrar (con el motor) y llevar el estado local al día
// ---------------------------------------------------------------------------------------------------------------------

type Form = Parameters<typeof registrarOperacion>[1];

async function registrar(ctx: Contexto, form: Form, detalle: string, aplicar: () => void, esVenta = false): Promise<boolean> {
  const total = form.lineas.reduce((s, l) => s + aNum(l.cantidad) * aNum(l.monto), 0);
  if (ctx.simular) {
    ctx.ok++;
    ctx.opsEjecutadas++;
    aplicar();
    ctx.registro.push({ tipo: 'INFO', operacion: form.operacion, monto: aCentavos(total), detalle: `(simulación) ${detalle}` });
    return true;
  }
  try {
    const r = await registrarOperacion(ctx.empresaId, form);
    // Igual que la Central de Lanzamientos: en una Venta el histórico pasa a ser el número de comprobante.
    if (esVenta) await ctx.admin.from('registro_operaciones').update({ historico: r.idOperacion }).eq('empresa_id', ctx.empresaId).eq('id_operacion', r.idOperacion);
    ctx.ok++;
    ctx.opsEjecutadas++;
    aplicar();
    ctx.registro.push({ tipo: 'OPERACION', operacion: form.operacion, idOperacion: r.idOperacion as string, monto: aCentavos(total), detalle });
    return true;
  } catch (e) {
    ctx.errores++;
    ctx.registro.push({ tipo: 'RECHAZO', operacion: form.operacion, monto: aCentavos(total), detalle, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

const mover = (ctx: Contexto, medio: string, delta: number) => {
  ctx.saldos[medio] = aCentavos((ctx.saldos[medio] ?? 0) + delta);
};

async function aporte(ctx: Contexto, monto: number, motivo: string, medio = ctx.c.capital.medioAporte): Promise<boolean> {
  const m = Math.max(monto, ctx.c.capital.aporteMinimo);
  const redondeado = Math.ceil(m / 500) * 500;
  return registrar(ctx, { fecha: ctx.fecha, operacion: 'INVERSION', categoria: 'Aporte de Sócios', formaPago: medio, historico: motivo, clienteProveedor: '', lineas: [{ producto: '', cantidad: 1, monto: redondeado }] }, `${motivo}: R$ ${redondeado.toFixed(2)} en ${medio}`, () => mover(ctx, medio, redondeado));
}

// Elige con qué medio se paga algo de `monto`: primero el preferido si alcanza; si no, cualquiera con saldo; y si ninguno alcanza, un aporte de
// socios repone el preferido (así la caja nunca queda negativa sin recurrir a deuda).
async function medioParaPagar(ctx: Contexto, monto: number, preferido?: string): Promise<string | null> {
  const orden = [preferido, ...MEDIOS_PLATA].filter((x, i, a): x is string => Boolean(x) && a.indexOf(x) === i);
  const conSaldo = orden.find((m) => (ctx.saldos[m] ?? 0) >= monto);
  if (conSaldo) return conSaldo;
  const destino = preferido ?? ctx.c.capital.medioAporte;
  const falta = monto - (ctx.saldos[destino] ?? 0) + ctx.c.capital.colchonMinimoCaja;
  return (await aporte(ctx, falta, 'Aporte de socios para sostener la operación', destino)) ? destino : null;
}

function medioDeCobro(ctx: Contexto): string {
  return elegirConPeso(ctx.rng, Object.entries(ctx.c.ventas.medios).map(([valor, peso]) => ({ valor, peso }))) ?? 'Banco';
}

const nombresProductos = (ctx: Contexto, lineas: Array<{ producto: string }>) => lineas.map((l) => ctx.productos.get(l.producto)?.nombre ?? l.producto).join(' / ');

// ---------------------------------------------------------------------------------------------------------------------
// Cada intención de la agenda
// ---------------------------------------------------------------------------------------------------------------------

async function hacerCompra(ctx: Contexto, presupuesto: number): Promise<boolean> {
  const r = resolverCompra(presupuesto, ctx.catalogo, ctx.c, ctx.rng, ctx.fecha);
  if (!r) return false;
  const medio = await medioParaPagar(ctx, r.total, elegirConPeso(ctx.rng, Object.entries(ctx.c.ventas.medios).map(([valor, peso]) => ({ valor, peso }))) ?? undefined);
  if (!medio) return false;
  const proveedor = ctx.proveedores.length ? elegir(ctx.rng, ctx.proveedores) : '';
  return registrar(
    ctx,
    { fecha: ctx.fecha, operacion: 'COMPRA', categoria: r.categoria, formaPago: medio, historico: `Reposição de estoque - ${r.categoria}`, clienteProveedor: proveedor, lineas: r.lineas.map((l) => ({ producto: l.producto, cantidad: l.cantidad, monto: l.costo })) },
    `Compra de ${r.categoria}: ${nombresProductos(ctx, r.lineas)} por R$ ${r.total.toFixed(2)} (${medio})`,
    () => {
      mover(ctx, medio, -r.total);
      for (const l of r.lineas) {
        const p = ctx.productos.get(l.producto);
        if (p) {
          const valor = p.cantidad * p.costoMedio + l.cantidad * l.costo;
          p.cantidad += l.cantidad;
          p.costoMedio = valor / p.cantidad;
        }
      }
    }
  );
}

async function hacerVentaProducto(ctx: Contexto, objetivo: number): Promise<boolean> {
  let r = resolverVentaProducto(objetivo, [...ctx.productos.values()], ctx.c, ctx.rng);
  if (!r) {
    // Sin stock vendible: primero se repone, como haría una persona.
    if (!(await hacerCompra(ctx, Math.max(objetivo * 2.5, 600)))) return false;
    r = resolverVentaProducto(objetivo, [...ctx.productos.values()], ctx.c, ctx.rng);
    if (!r) return false;
  }
  const venta = r;
  const medio = medioDeCobro(ctx);
  const cliente = ctx.clientes.length ? elegir(ctx.rng, ctx.clientes) : '';
  return registrar(
    ctx,
    { fecha: ctx.fecha, operacion: 'VENTA', categoria: venta.categoria, formaPago: medio, historico: nombresProductos(ctx, venta.lineas.map((l) => ({ producto: l.producto }))), clienteProveedor: cliente, lineas: venta.lineas.map((l) => ({ producto: l.producto, cantidad: l.cantidad, monto: l.precio })) },
    `Venta de ${venta.categoria}: ${nombresProductos(ctx, venta.lineas.map((l) => ({ producto: l.producto })))} por R$ ${venta.total.toFixed(2)} a ${cliente || 'cliente'} (${medio})`,
    () => {
      mover(ctx, medio, venta.total);
      for (const l of venta.lineas) {
        const p = ctx.productos.get(l.producto);
        if (p) p.cantidad -= l.cantidad;
      }
    },
    true
  );
}

async function hacerVentaServicio(ctx: Contexto, objetivo: number): Promise<boolean> {
  if (ctx.serviciosCat.length === 0) return false;
  const categoria = elegir(ctx.rng, ctx.serviciosCat);
  const medio = medioDeCobro(ctx);
  const cliente = ctx.clientes.length ? elegir(ctx.rng, ctx.clientes) : '';
  return registrar(
    ctx,
    { fecha: ctx.fecha, operacion: 'VENTA', categoria, formaPago: medio, historico: categoria, clienteProveedor: cliente, lineas: [{ producto: '', cantidad: 1, monto: objetivo }] },
    `Servicio de ${categoria} por R$ ${objetivo.toFixed(2)} a ${cliente || 'cliente'} (${medio})`,
    () => mover(ctx, medio, objetivo),
    true
  );
}

async function hacerPago(ctx: Contexto, categoria: string, monto: number, preferido: string | undefined, proveedor: string, detalle: string): Promise<boolean> {
  const medio = await medioParaPagar(ctx, monto, preferido);
  if (!medio) return false;
  return registrar(ctx, { fecha: ctx.fecha, operacion: 'PAGO', categoria, formaPago: medio, historico: detalle, clienteProveedor: proveedor, lineas: [{ producto: '', cantidad: 1, monto }] }, `Pago de ${categoria}: R$ ${monto.toFixed(2)} (${medio})`, () => mover(ctx, medio, -monto));
}

async function ejecutarIntencion(ctx: Contexto, i: Intencion): Promise<void> {
  switch (i.tipo) {
    case 'APORTE':
      await aporte(ctx, i.monto, i.motivo);
      return;
    case 'PAGO_FIJO':
      await hacerPago(ctx, i.gasto.categoria, i.monto, i.gasto.medio, i.gasto.proveedor, `${i.gasto.categoria} - ${ctx.fecha.slice(0, 7)}`);
      return;
    case 'IMPUESTO':
      await hacerPago(ctx, ctx.c.gastos.categoriaImpuesto, i.monto, ctx.c.capital.medioAporte, '', `${ctx.c.gastos.categoriaImpuesto} - ${ctx.fecha.slice(0, 7)}`);
      return;
    case 'PAGO_VARIABLE':
      await hacerPago(ctx, i.categoria, i.monto, undefined, ctx.proveedores.length ? elegir(ctx.rng, ctx.proveedores) : '', i.categoria);
      return;
    case 'COMPRA':
      await hacerCompra(ctx, i.presupuesto);
      return;
    case 'VENTA_PRODUCTO':
      await hacerVentaProducto(ctx, i.objetivo);
      return;
    case 'VENTA_SERVICIO':
      await hacerVentaServicio(ctx, i.objetivo);
      return;
    case 'DEPOSITO': {
      const { medioEfectivo, medioBanco, umbralEfectivo, efectivoQueSeDepositaPct } = ctx.c.transferencias;
      const efectivo = ctx.saldos[medioEfectivo] ?? 0;
      if (efectivo <= umbralEfectivo) return;
      const monto = Math.floor((efectivo * efectivoQueSeDepositaPct) / 100 / 10) * 10;
      if (monto <= 0) return;
      await registrar(ctx, { fecha: ctx.fecha, operacion: 'TRANSFERENCIA', categoria: medioBanco, formaPago: medioEfectivo, historico: 'Depósito del efectivo en el banco', clienteProveedor: '', lineas: [{ producto: '', cantidad: 1, monto }] }, `Depósito de R$ ${monto.toFixed(2)} de ${medioEfectivo} a ${medioBanco}`, () => {
        mover(ctx, medioEfectivo, -monto);
        mover(ctx, medioBanco, monto);
      });
      return;
    }
    case 'RETIRO': {
      const medio = ctx.c.capital.medioAporte;
      if ((ctx.saldos[medio] ?? 0) < i.monto + ctx.c.capital.colchonMinimoCaja) return;
      await registrar(ctx, { fecha: ctx.fecha, operacion: 'EXTRACCION', categoria: 'Retirada de Sócios', formaPago: medio, historico: 'Retirada de sócios', clienteProveedor: '', lineas: [{ producto: '', cantidad: 1, monto: i.monto }] }, `Retirada de sócios: R$ ${i.monto.toFixed(2)}`, () => mover(ctx, medio, -i.monto));
      return;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Un día
// ---------------------------------------------------------------------------------------------------------------------

export async function ejecutarDia(admin: SupabaseClient, empresaId: string, fecha: string, opciones: { simular?: boolean; forzar?: boolean; hoy: string }): Promise<ResumenDia> {
  const simular = Boolean(opciones.simular);
  const vacio = (omitido: ResumenDia['omitido']): ResumenDia => ({ fecha, omitido, ok: 0, errores: 0, simulado: simular, registro: [] });

  const { data: fila } = await admin.from('sabio_soporte_config').select('activo, pausado, config').eq('empresa_id', empresaId).maybeSingle();
  if (!fila) return vacio('CONFIG_INVALIDA');
  if (fila.pausado) return vacio('PAUSADO');
  const c = configCompleta(fila.config);
  if (validarConfig(c)) return { ...vacio('CONFIG_INVALIDA'), registro: [{ tipo: 'INFO', detalle: validarConfig(c) as string }] };
  if (fecha < c.inicio) return vacio('ANTES_DEL_INICIO');
  if (fecha > opciones.hoy) return vacio('FUTURO');

  // Reserva el día: dos corridas al mismo tiempo (cron + botón) no cargan lo mismo dos veces.
  if (!simular) {
    const { error } = await admin.from('sabio_soporte_dias').insert({ empresa_id: empresaId, fecha, ops_ok: 0, ops_error: 0 });
    if (error) {
      if (!opciones.forzar) return vacio('YA_EJECUTADO');
    }
  }

  const reservado = !simular;
  usarClienteDeServicio(admin as unknown as Parameters<typeof usarClienteDeServicio>[0]);
  try {
    const mes = fecha.slice(0, 7);
    const [productosDb, clientesDb, proveedoresDb, categoriasVenta, saldos, stock, ventasHastaAyer, ventasHoy, opsHoy, pagosMes, aportes, ventasMesAnterior, extraccionesMes] = await Promise.all([
      admin.from('productos').select('id, nombre, categoria, tipo_producto').eq('empresa_id', empresaId).eq('tipo_producto', 'TERMINADO'),
      admin.from('clientes').select('nombre').eq('empresa_id', empresaId),
      admin.from('proveedores').select('nombre').eq('empresa_id', empresaId),
      obtenerCategoriasJuego(empresaId, 'VENTA'),
      saldosDeMedios(empresaId, MEDIOS_PLATA, fecha),
      estadoDeStock({ admin, empresaId, fecha }),
      sumaVentas(admin, empresaId, `${mes}-01`, fecha === `${mes}-01` ? `${mes}-01` : diaAnterior(fecha)),
      sumaVentas(admin, empresaId, fecha, fecha),
      admin.from('registro_operaciones').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('fecha', fecha).eq('parte', 1),
      admin.from('registro_operaciones').select('categoria').eq('empresa_id', empresaId).eq('operacion', 'PAGO').gte('fecha', `${mes}-01`).lte('fecha', ultimoDiaDelMes(mes)),
      admin.from('registro_operaciones').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('operacion', 'INVERSION').lte('fecha', fecha),
      sumaVentas(admin, empresaId, `${mesAnterior(mes)}-01`, ultimoDiaDelMes(mesAnterior(mes))),
      admin.from('registro_operaciones').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('operacion', 'EXTRACCION').gte('fecha', `${mes}-01`).lte('fecha', ultimoDiaDelMes(mes)),
    ]);

    const hastaAyer = fecha === `${mes}-01` ? 0 : ventasHastaAyer;
    const catalogo: ProductoCatalogo[] = (productosDb.data ?? []).map((p) => ({ id: p.id as string, nombre: p.nombre as string, categoria: p.categoria as string })).filter((p) => c.ventas.categoriasProducto.includes(p.categoria));
    const productos = new Map<string, ProductoEstado>();
    for (const p of productosDb.data ?? []) {
      const s = stock.get(p.id as string);
      productos.set(p.id as string, { id: p.id as string, nombre: p.nombre as string, categoria: p.categoria as string, cantidad: s ? Math.round(s.cantidad * 1000) / 1000 : 0, costoMedio: s && s.cantidad > 0 ? s.valor / s.cantidad : 0 });
    }

    const ctx: Contexto = {
      admin,
      empresaId,
      fecha,
      c,
      simular,
      rng: crearRng(semillaDelDia(c.semilla, fecha)),
      saldos: { ...saldos },
      productos,
      catalogo,
      serviciosCat: categoriasVenta.filter((x) => x.stock !== 'SI').map((x) => x.nombre),
      clientes: (clientesDb.data ?? []).map((x) => x.nombre as string),
      proveedores: (proveedoresDb.data ?? []).map((x) => x.nombre as string),
      registro: [],
      ok: 0,
      errores: 0,
      opsEjecutadas: 0,
    };
    for (const m of MEDIOS_PLATA) ctx.saldos[m] = ctx.saldos[m] ?? 0;

    const dia = Number(fecha.slice(8, 10));
    const pagadas = new Set((pagosMes.data ?? []).map((x) => x.categoria as string));
    const presupuesto = Math.max(0, presupuestoVentasDia(c, fecha, hastaAyer) - ventasHoy);
    const ultimaSemana = dia >= diasDelMes(mes).length - 3;

    const intenciones = planificarDia({
      config: c,
      fecha,
      rng: ctx.rng,
      presupuestoVentas: presupuesto,
      fijosPendientes: c.gastos.fijos.filter((g) => g.activo && dia >= g.dia && !pagadas.has(g.categoria)),
      impuestoPendiente: dia >= 20 && c.gastos.impuestoPctVentas > 0 && !pagadas.has(c.gastos.categoriaImpuesto) && ventasMesAnterior > 0 ? (ventasMesAnterior * c.gastos.impuestoPctVentas) / 100 : null,
      retiroPendiente: ultimaSemana && c.capital.retiroSociosPctVentas > 0 && (extraccionesMes.count ?? 0) === 0 ? ((hastaAyer + ventasHoy) * c.capital.retiroSociosPctVentas) / 100 : null,
      aporteInicialPendiente: (aportes.count ?? 0) === 0,
      opsExistentesHoy: opsHoy.count ?? 0,
    });

    for (const i of intenciones) {
      if (ctx.opsEjecutadas >= c.ritmo.topeDiario + 2) break;
      await ejecutarIntencion(ctx, i);
    }

    // Colchón de caja: si al final del día el banco quedó por debajo del mínimo, los socios lo reponen.
    const banco = c.capital.medioAporte;
    if (ctx.opsEjecutadas > 0 && (ctx.saldos[banco] ?? 0) < c.capital.colchonMinimoCaja) {
      await aporte(ctx, c.capital.colchonMinimoCaja * 2 - (ctx.saldos[banco] ?? 0), 'Aporte de socios para reponer la caja', banco);
    }

    if (!simular) {
      if (ctx.registro.length > 0) {
        await admin.from('sabio_soporte_registro').insert(ctx.registro.map((r) => ({ empresa_id: empresaId, fecha, tipo: r.tipo, operacion: r.operacion ?? null, id_operacion: r.idOperacion ?? null, monto: r.monto ?? null, detalle: r.detalle, error: r.error ?? null })));
      }
      await admin.from('sabio_soporte_dias').upsert({ empresa_id: empresaId, fecha, ops_ok: ctx.ok, ops_error: ctx.errores, ejecutado_en: new Date().toISOString() }, { onConflict: 'empresa_id,fecha' });
    }

    return { fecha, ok: ctx.ok, errores: ctx.errores, simulado: simular, registro: ctx.registro, presupuestoVentas: presupuesto, ...(intenciones.length === 0 ? { omitido: 'SIN_ACTIVIDAD' as const } : {}) };
  } catch (e) {
    // Falló algo inesperado antes de terminar el día: se libera la reserva para poder reintentarlo.
    if (reservado) await admin.from('sabio_soporte_dias').delete().eq('empresa_id', empresaId).eq('fecha', fecha).eq('ops_ok', 0).eq('ops_error', 0);
    throw e;
  } finally {
    usarClienteDeServicio(null);
  }
}

function diaAnterior(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
