// lib/lanzamientoRapidoDatos.ts
//
// Acceso a datos de Lanzamiento rápido. Registrar y deshacer usan el mismo
// motor de siempre (registrarOperacion / eliminarOperacion): acá no hay
// lógica contable nueva.

import { supabase } from './supabase';
import { fechaLocalHoy } from './fecha';
import { registrarOperacion, eliminarOperacion } from './motor';
import { obtenerFormasPagoOperacion } from './formasPagoOperacion';
import { armarTop, type OperacionReciente, type TarjetaRapida } from './lanzamientoRapido';

const DIAS_VENTANA = 60;

function fechaHaceDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export async function cargarTopRapido(empresaId: string): Promise<TarjetaRapida[]> {
  const { data, error } = await supabase
    .from('registro_operaciones')
    .select('id_operacion, fecha, operacion, categoria, forma_pago, total, historico, cliente_proveedor, creado_en')
    .eq('empresa_id', empresaId)
    .gte('fecha', fechaHaceDias(DIAS_VENTANA));

  if (error) throw error;

  // Se arma con margen y se validan contra la matriz actual: una categoría o
  // medio que ya no existe (o que hoy es una cuenta interna) no debe ofrecerse.
  const candidatas = armarTop((data ?? []) as OperacionReciente[], 16);
  const medios = new Map<string, Set<string>>();

  // En paralelo: validar de a una (cada validación son varias consultas)
  // hacía lenta la entrada a la pantalla.
  await Promise.all(
    Array.from(new Set(candidatas.map((c) => `${c.operacion}|${c.categoria}`))).map(async (par) => {
      const [operacion, categoria] = par.split('|');
      medios.set(par, new Set(await obtenerFormasPagoOperacion(empresaId, operacion, categoria).catch(() => [])));
    })
  );

  return candidatas
    .filter((c) => medios.get(`${c.operacion}|${c.categoria}`)?.has(c.formaPago))
    .slice(0, 10);
}

export async function registrarLanzamiento(
  empresaId: string,
  tarjeta: TarjetaRapida,
  monto: number,
  fecha: string = fechaLocalHoy()
): Promise<string> {
  const resultado = await registrarOperacion(empresaId, {
    fecha,
    operacion: tarjeta.operacion,
    categoria: tarjeta.categoria,
    formaPago: tarjeta.formaPago,
    historico: tarjeta.ultimoHistorico || tarjeta.categoria,
    clienteProveedor: tarjeta.ultimoProveedor,
    lineas: [{ producto: '', cantidad: 1, monto }],
  });

  return resultado.idOperacion as string;
}

export async function deshacerLanzamiento(empresaId: string, idOperacion: string): Promise<void> {
  await eliminarOperacion(empresaId, idOperacion);
}
