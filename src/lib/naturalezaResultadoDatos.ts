// lib/naturalezaResultadoDatos.ts
//
// Qué asientos vienen de un gasto/ingreso recurrente (ver
// naturalezaResultado.ts): el asiento de devengo del mes y los pagos/cobros
// vinculados a cada recordatorio. De cada plantilla sale si el monto es fijo
// o variable.

import { supabase } from './supabase';
import { mapaNaturaleza, type Naturaleza, type VinculoRecurrente } from './naturalezaResultado';

type FilaPlantilla = { monto_fijo: boolean } | { monto_fijo: boolean }[] | null;

function montoFijoDe(plantilla: FilaPlantilla): boolean {
  const fila = Array.isArray(plantilla) ? plantilla[0] : plantilla;
  return fila ? Boolean(fila.monto_fijo) : true;
}

export async function cargarNaturalezaPorOperacion(empresaId: string): Promise<Map<string, Naturaleza>> {
  const [gastos, pagos, ingresos, cobros] = await Promise.all([
    supabase
      .from('gastos_recurrentes_recordatorios')
      .select('id_operacion, id_operacion_devengo, gastos_recurrentes!inner(monto_fijo)')
      .eq('empresa_id', empresaId),
    supabase
      .from('gastos_recurrentes_recordatorios_pagos')
      .select('id_operacion, gastos_recurrentes_recordatorios!inner(gastos_recurrentes!inner(monto_fijo))')
      .eq('empresa_id', empresaId),
    supabase
      .from('ingresos_recurrentes_recordatorios')
      .select('id_operacion, id_operacion_devengo, ingresos_recurrentes!inner(monto_fijo)')
      .eq('empresa_id', empresaId),
    supabase
      .from('ingresos_recurrentes_recordatorios_cobros')
      .select('id_operacion, ingresos_recurrentes_recordatorios!inner(ingresos_recurrentes!inner(monto_fijo))')
      .eq('empresa_id', empresaId),
  ]);

  for (const { error } of [gastos, pagos, ingresos, cobros]) {
    if (error) {
      throw error;
    }
  }

  const vinculos: VinculoRecurrente[] = [];

  for (const fila of gastos.data ?? []) {
    const montoFijo = montoFijoDe(fila.gastos_recurrentes as unknown as FilaPlantilla);
    if (fila.id_operacion) vinculos.push({ idOperacion: fila.id_operacion, montoFijo });
    if (fila.id_operacion_devengo) vinculos.push({ idOperacion: fila.id_operacion_devengo, montoFijo });
  }

  for (const fila of ingresos.data ?? []) {
    const montoFijo = montoFijoDe(fila.ingresos_recurrentes as unknown as FilaPlantilla);
    if (fila.id_operacion) vinculos.push({ idOperacion: fila.id_operacion, montoFijo });
    if (fila.id_operacion_devengo) vinculos.push({ idOperacion: fila.id_operacion_devengo, montoFijo });
  }

  const dePago = (fila: { id_operacion: string; [clave: string]: unknown }, recordatorio: string, plantilla: string) => {
    const intermedio = fila[recordatorio] as Record<string, unknown> | Record<string, unknown>[] | null;
    const recordatorioFila = Array.isArray(intermedio) ? intermedio[0] : intermedio;
    vinculos.push({
      idOperacion: fila.id_operacion,
      montoFijo: montoFijoDe((recordatorioFila?.[plantilla] ?? null) as FilaPlantilla),
    });
  };

  for (const fila of pagos.data ?? []) {
    dePago(fila as never, 'gastos_recurrentes_recordatorios', 'gastos_recurrentes');
  }

  for (const fila of cobros.data ?? []) {
    dePago(fila as never, 'ingresos_recurrentes_recordatorios', 'ingresos_recurrentes');
  }

  return mapaNaturaleza(vinculos);
}
