// lib/cuotasOperacion.ts
//
// Criterio único de "¿esta operación admite cuotas?" para las pantallas
// que registran (Mini-Juego, Sabio Bot, Lanzamiento rápido). Central de
// Lanzamientos conserva su propia copia del criterio porque ya tiene
// cargados los rubros en memoria; mantener ambos alineados.

import { supabase } from './supabase';
import { crearCuotasPasivo } from './cuotas';
import { crearCuotasCobro } from './cuotasCobro';

export type TipoCuotas = 'PASIVO' | 'COBRO' | null;

// Compra/Pago contra un Pasivo (rubro '2') genera una deuda parcelable;
// Venta/Cobro contra un Activo que NO sirve para pagar gastos (Caja y
// Banco sí) es una cuenta por cobrar parcelable.
export function tipoCuotasPara(operacion: string, rubroCuenta: string | undefined, usableParaGasto: boolean): TipoCuotas {
  if ((operacion === 'COMPRA' || operacion === 'PAGO') && rubroCuenta === '2') return 'PASIVO';
  if ((operacion === 'VENTA' || operacion === 'COBRO') && rubroCuenta === '1' && !usableParaGasto) return 'COBRO';
  return null;
}

export async function tipoCuotasDeFormaPago(empresaId: string, operacion: string, formaPagoNombre: string): Promise<TipoCuotas> {
  if (!formaPagoNombre || !['COMPRA', 'PAGO', 'VENTA', 'COBRO'].includes(operacion)) return null;

  const { data: forma } = await supabase
    .from('formas_pago')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('nombre', formaPagoNombre)
    .maybeSingle();

  if (!forma) return null;

  const { data: vinculo } = await supabase
    .from('forma_pago_cuentas')
    .select('cuenta_id')
    .eq('forma_pago_id', forma.id)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  if (!vinculo) return null;

  const { data: cuenta } = await supabase.from('plan_cuentas').select('codigo').eq('id', vinculo.cuenta_id).maybeSingle();
  const rubro = cuenta?.codigo ? String(cuenta.codigo).charAt(0) : undefined;

  let usableParaGasto = false;
  if (rubro === '1') {
    const { count } = await supabase
      .from('matriz_operaciones')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('forma_pago', formaPagoNombre)
      .in('operacion', ['COMPRA', 'PAGO']);
    usableParaGasto = (count ?? 0) > 0;
  }

  return tipoCuotasPara(operacion, rubro, usableParaGasto);
}

export async function crearCuotasDeOperacion(
  empresaId: string,
  idioma: string | null | undefined,
  tipo: Exclude<TipoCuotas, null>,
  datos: { idOperacion: string; formaPagoNombre: string; total: number; cantidadCuotas: number; fecha: string }
) {
  const { idOperacion, formaPagoNombre, total, cantidadCuotas, fecha } = datos;

  if (tipo === 'COBRO') {
    await crearCuotasCobro(empresaId, idioma, { idOperacion, formaPagoNombre, total, cantidadCuotas, fechaVenta: fecha });
  } else {
    await crearCuotasPasivo(empresaId, idioma, { idOperacion, formaPagoNombre, total, cantidadCuotas, fechaCompra: fecha });
  }
}

// RED DE SEGURIDAD: una compra o pago con una forma de pago que es una deuda (tarjeta, préstamo) o una venta/cobro contra una cuenta a cobrar
// SIEMPRE deja una cuota pendiente, aunque la persona no haya marcado «en cuotas». Sin cuota la deuda existe en la contabilidad pero no aparece en
// Compromisos/Pasivos (pasó con OP-00352 de Buenaventura). Si la persona ya armó sus cuotas para ese medio no se toca nada; si no, se crea una
// sola cuota por el monto de esa parte que vence en la fecha de la operación (se puede ajustar después). Nunca frena el registro: si falla, avisa por consola.
export async function asegurarCuotasPendientes(
  empresaId: string,
  idioma: string | null | undefined,
  operacion: string,
  idOperacion: string,
  fecha: string,
  medios: Array<{ formaPago: string; monto: number }>
): Promise<void> {
  try {
    if (!idioma) {
      const { data: emp } = await supabase.from('empresas').select('idioma').eq('id', empresaId).maybeSingle();
      idioma = emp?.idioma as string | undefined;
    }
    for (const { formaPago, monto } of medios) {
      if (!formaPago || !(monto > 0)) continue;
      const tipo = await tipoCuotasDeFormaPago(empresaId, operacion, formaPago);
      if (!tipo) continue;

      const { count, error } = await supabase
        .from(tipo === 'COBRO' ? 'cuotas_cobro' : 'cuotas_pasivo')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('id_operacion', idOperacion)
        .eq('forma_pago_nombre', formaPago);
      if (error) throw error;
      if ((count ?? 0) > 0) continue;

      await crearCuotasDeOperacion(empresaId, idioma, tipo, { idOperacion, formaPagoNombre: formaPago, total: monto, cantidadCuotas: 1, fecha });
    }
  } catch (e) {
    console.warn('No se pudo asegurar la cuota pendiente de la operación:', idOperacion, e);
  }
}
