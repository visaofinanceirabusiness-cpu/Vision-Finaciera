// lib/compromisosAbiertos.ts
//
// Para el aviso "ojo, esto ya lo devengaste": al cargar un COBRO (o PAGO) de una
// categoría de ingreso (gasto) que tiene compromisos devengados con saldo, se
// ofrece registrarlo contra la cuenta "X a cobrar" ("X a pagar"). Si se carga como
// ingreso directo, el ingreso se cuenta dos veces (al devengarlo y al cobrarlo).

import { listarRecordatoriosIngresosPendientes, saldoPendienteCobro } from './ingresosRecurrentes';
import { listarRecordatoriosPendientes, saldoPendiente } from './gastosRecurrentes';
import { resolverCuentaCompromiso } from './cuentasCompromiso';

export type CompromisoAbierto = {
  recordatorioId: string;
  nombre: string;
  saldo: number;
  // Categoría de un COBRO/PAGO que salda esa cuenta a cobrar/pagar.
  categoriaLiquidacion: string;
  cuenta: string;
};

export async function compromisosAbiertosDeCategoria(
  empresaId: string,
  operacion: string,
  categoria: string
): Promise<CompromisoAbierto[]> {
  if (operacion !== 'COBRO' && operacion !== 'PAGO') return [];

  const lado = operacion === 'COBRO' ? 'COBRAR' : 'PAGAR';

  const pendientes: Array<{ id: string; nombre: string; categoria: string; estado: string | null; saldo: number; cuentaId: string | null }> =
    operacion === 'COBRO'
      ? (await listarRecordatoriosIngresosPendientes(empresaId)).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          categoria: r.categoria,
          estado: r.estado,
          saldo: saldoPendienteCobro(r),
          cuentaId: r.cuenta_devengo_forma_pago_id,
        }))
      : (await listarRecordatoriosPendientes(empresaId)).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          categoria: r.categoria,
          estado: r.estado,
          saldo: saldoPendiente(r),
          cuentaId: r.cuenta_devengo_forma_pago_id,
        }));

  const abiertos = pendientes.filter((p) => p.estado === 'DEVENGADA' && p.cuentaId && p.categoria === categoria && p.saldo > 0.01);

  const resultado: CompromisoAbierto[] = [];
  for (const p of abiertos) {
    try {
      const cuenta = await resolverCuentaCompromiso(p.cuentaId as string, lado);
      resultado.push({ recordatorioId: p.id, nombre: p.nombre, saldo: p.saldo, categoriaLiquidacion: cuenta.categoriaLiquidacion, cuenta: cuenta.cuentaNombre });
    } catch {
      // Sin cuenta resoluble no hay a dónde redirigir: no se ofrece.
    }
  }

  return resultado;
}
