// lib/devengoAjuste.ts
//
// AJUSTAR EL MONTO DE UN MES YA DEVENGADO
// =====================================================
//
// Editar el monto de una plantilla solo afecta a los meses que todavía no se
// devengaron; el que ya tiene su asiento (Cuenta a Cobrar / Ingreso, o Gasto /
// Cuenta a Pagar) queda con el monto de ese día. Esto lo corrige a pedido, con
// editarOperacion (el mismo camino de "Editar Registros": mismo número de
// operación, solo cambia el monto). Los cobros/pagos ya cargados son asientos
// aparte y no se tocan: por eso el nuevo monto no puede ser menor a lo ya
// movido, y si es justo igual el mes queda saldado (ver resolverAjusteDevengo).
// Sirve para los dos lados, y para cuando se cobró/pagó de más.

import { supabase } from './supabase';
import { editarOperacion } from './motor';
import { configParaCobrar } from './cuentaACobrar';
import { configParaSaldar } from './cuentaAPagar';
import { liberarCuentaSiCorresponde } from './cuentasCompromiso';
import { resolverAjusteDevengo } from './devengo';

export type LadoAjuste = 'INGRESO' | 'GASTO';

const CONFIG = {
  INGRESO: {
    tabla: 'ingresos_recurrentes_recordatorios',
    plantillas: 'ingresos_recurrentes',
    columnaPlantilla: 'ingreso_recurrente_id',
    columnaMovido: 'monto_cobrado',
    operacion: 'COBRO',
    lado: 'COBRAR',
    verbo: 'cobrado',
  },
  GASTO: {
    tabla: 'gastos_recurrentes_recordatorios',
    plantillas: 'gastos_recurrentes',
    columnaPlantilla: 'gasto_recurrente_id',
    columnaMovido: 'monto_pagado',
    operacion: 'PAGO',
    lado: 'PAGAR',
    verbo: 'pagado',
  },
} as const;

type FilaMes = {
  id: string;
  periodo: string;
  estado: string | null;
  registrado: boolean;
  monto_devengado: number | null;
  id_operacion_devengo: string | null;
  cuenta_devengo_forma_pago_id: string | null;
  evento_calendario_id: string | null;
  [columna: string]: unknown;
};

export async function ajustarMontoDevengado(empresaId: string, lado: LadoAjuste, recordatorioId: string, nuevoMonto: number) {
  const c = CONFIG[lado];

  const { data: fila, error } = await supabase
    .from(c.tabla)
    .select(`id, periodo, estado, registrado, monto_devengado, ${c.columnaMovido}, id_operacion_devengo, cuenta_devengo_forma_pago_id, evento_calendario_id`)
    .eq('id', recordatorioId)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const mes = fila as unknown as FilaMes | null;

  if (!mes || mes.estado !== 'DEVENGADA' || mes.registrado || !mes.id_operacion_devengo || mes.monto_devengado === null) {
    throw new Error('Solo se puede ajustar un mes devengado que todavía tiene saldo pendiente.');
  }

  const montoMovido = Number(mes[c.columnaMovido] ?? 0);
  const ajuste = resolverAjusteDevengo(Number(mes.monto_devengado), montoMovido, nuevoMonto);

  if (ajuste.accion === 'SIN_CAMBIO') {
    return;
  }

  if (ajuste.accion === 'RECHAZAR') {
    throw new Error(
      ajuste.motivo === 'MONTO_INVALIDO'
        ? 'Ingresá un monto mayor que cero.'
        : `Ya hay ${montoMovido.toFixed(2)} ${c.verbo}: el monto del mes no puede ser menor.`
    );
  }

  const { data: operacion, error: errorOperacion } = await supabase
    .from('registro_operaciones')
    .select('fecha, categoria, historico, cliente_proveedor')
    .eq('empresa_id', empresaId)
    .eq('id_operacion', mes.id_operacion_devengo)
    .maybeSingle();

  if (errorOperacion) {
    throw errorOperacion;
  }

  if (!operacion) {
    throw new Error(`No se encontró el asiento ${mes.id_operacion_devengo} de ${mes.periodo.slice(0, 7)}.`);
  }

  // Con qué cuenta se devengó ese mes (por id, así un renombrado no importa).
  const config =
    lado === 'INGRESO'
      ? await configParaCobrar(empresaId, mes.cuenta_devengo_forma_pago_id)
      : await configParaSaldar(empresaId, mes.cuenta_devengo_forma_pago_id);

  if (!config) {
    throw new Error('No se encontró la cuenta con la que se devengó este mes.');
  }

  await editarOperacion(empresaId, mes.id_operacion_devengo, {
    fecha: operacion.fecha,
    operacion: c.operacion,
    categoria: operacion.categoria,
    formaPago: config.formaPago,
    historico: operacion.historico ?? '',
    clienteProveedor: operacion.cliente_proveedor ?? '',
    lineas: [{ producto: '', cantidad: 1, monto: nuevoMonto }],
  });

  const saldado = ajuste.accion === 'SALDAR';

  const { error: errorMes } = await supabase
    .from(c.tabla)
    .update({ monto_devengado: nuevoMonto, ...(saldado ? { estado: 'SALDADA', registrado: true } : {}) })
    .eq('id', mes.id);

  if (errorMes) {
    throw errorMes;
  }

  if (saldado) {
    if (mes.evento_calendario_id) {
      await supabase.from('eventos_calendario').delete().eq('id', mes.evento_calendario_id);
    }

    if (mes.cuenta_devengo_forma_pago_id) {
      await liberarCuentaSiCorresponde(empresaId, mes.cuenta_devengo_forma_pago_id, c.lado).catch((e) =>
        console.warn('No se pudo desactivar la cuenta sin uso:', e)
      );
    }
  }
}

export type MesAjustable = { id: string; periodo: string; montoDevengado: number };

// Meses ya devengados de una plantilla cuyo monto difiere del nuevo y que se
// pueden ajustar (lo ya movido no supera el nuevo monto): para ofrecerlo al
// editar el monto de la plantilla.
export async function buscarMesesAjustables(empresaId: string, lado: LadoAjuste, plantillaId: string, nuevoMonto: number): Promise<MesAjustable[]> {
  const c = CONFIG[lado];

  const { data, error } = await supabase
    .from(c.tabla)
    .select(`id, periodo, monto_devengado, ${c.columnaMovido}`)
    .eq('empresa_id', empresaId)
    .eq(c.columnaPlantilla, plantillaId)
    .eq('estado', 'DEVENGADA')
    .eq('registrado', false)
    .not('id_operacion_devengo', 'is', null)
    .order('periodo');

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Record<string, unknown>[])
    .filter((mes) => {
      const accion = resolverAjusteDevengo(Number(mes.monto_devengado), Number(mes[c.columnaMovido] ?? 0), nuevoMonto).accion;
      return accion === 'AJUSTAR' || accion === 'SALDAR';
    })
    .map((mes) => ({ id: mes.id as string, periodo: mes.periodo as string, montoDevengado: Number(mes.monto_devengado) }));
}
