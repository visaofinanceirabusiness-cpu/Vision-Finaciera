// lib/deudasDatos.ts
//
// Junta los datos reales (cuentas de Pasivo con su saldo, cuotas y compromisos
// devengados sin pagar) y se los pasa a la lógica pura de deudas.ts.

import { supabase } from './supabase';
import { obtenerSaldoCuenta } from './motor';
import { listarCuotasPendientes } from './cuotas';
import { listarRecordatoriosConHistorial, saldoPendiente } from './gastosRecurrentes';
import { nombresCuentasCompromiso } from './cuentasCompromiso';
import { obtenerConfigAPagar } from './cuentaAPagar';
import { armarDeudas, type CuentaPasivo, type Deudas, type VencimientoDeuda } from './deudas';

export async function cargarDeudas(empresaId: string, hoy: string): Promise<Deudas> {
  const [{ data: pasivos, error }, { data: formas, error: errorFormas }, cuotas, recordatorios, internas, configGeneral] = await Promise.all([
    supabase.from('plan_cuentas').select('id, nombre, cuenta_padre_id').eq('empresa_id', empresaId).eq('tipo_saldo', 'PASIVO'),
    supabase.from('formas_pago').select('id, nombre, forma_pago_cuentas(cuenta_id, activo)').eq('empresa_id', empresaId),
    listarCuotasPendientes(empresaId),
    listarRecordatoriosConHistorial(empresaId),
    nombresCuentasCompromiso(empresaId),
    obtenerConfigAPagar(empresaId),
  ]);

  if (error) throw error;
  if (errorFormas) throw errorFormas;

  // Solo las hojas llevan saldo: los encabezados y grupos son contenedores.
  const padres = new Set((pasivos ?? []).map((c) => c.cuenta_padre_id).filter(Boolean));
  const hojas = (pasivos ?? []).filter((c) => !padres.has(c.id));

  const saldos = await Promise.all(hojas.map((c) => obtenerSaldoCuenta(empresaId, c.nombre, hoy)));

  // Una forma de pago apunta a una cuenta: así se asocian las cuotas (que
  // guardan el nombre de la forma de pago) y los compromisos devengados.
  const cuentaDeForma = new Map<string, string>();
  const cuentaDeFormaNombre = new Map<string, string>();
  for (const forma of formas ?? []) {
    const vinculos = (forma.forma_pago_cuentas ?? []) as unknown as { cuenta_id: string; activo: boolean }[];
    const cuentaId = (vinculos.find((v) => v.activo) ?? vinculos[0])?.cuenta_id;
    if (cuentaId) {
      cuentaDeForma.set(forma.id as string, cuentaId);
      cuentaDeFormaNombre.set(forma.nombre as string, cuentaId);
    }
  }

  const idsCompromiso = new Set(Array.from(internas).map((nombre) => cuentaDeFormaNombre.get(nombre)).filter((id): id is string => !!id));

  const cuentas: CuentaPasivo[] = hojas.map((c, i) => ({
    id: c.id as string,
    nombre: c.nombre as string,
    saldo: saldos[i]?.saldo ?? 0,
    esCompromiso: idsCompromiso.has(c.id as string),
  }));

  const vencimientos: VencimientoDeuda[] = [
    ...cuotas.flatMap((cuota) => {
      const cuentaId = cuentaDeFormaNombre.get(cuota.forma_pago_nombre);
      return cuentaId ? [{ cuentaId, fecha: cuota.fecha_vencimiento, monto: Number(cuota.monto) }] : [];
    }),
    ...recordatorios
      .filter((r) => r.estado === 'DEVENGADA' && !r.registrado)
      .flatMap((r) => {
        // Los devengos de la primera versión no tienen cuenta propia: van a la general.
        const cuentaId = r.cuenta_devengo_forma_pago_id
          ? cuentaDeForma.get(r.cuenta_devengo_forma_pago_id)
          : configGeneral
            ? cuentaDeFormaNombre.get(configGeneral.formaPago)
            : undefined;
        return cuentaId ? [{ cuentaId, fecha: r.fecha_vencimiento, monto: saldoPendiente(r) }] : [];
      }),
  ];

  return armarDeudas(cuentas, vencimientos, hoy);
}
