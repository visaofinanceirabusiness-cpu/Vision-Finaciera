// lib/formasPagoOperacion.ts
//
// Medios (formas de pago) que se ofrecen para una operación + categoría.
// Mini Juego, Sabio Bot y Central de Lanzamientos son tres caminos al mismo
// registro: todos leen la lista de acá para que nunca difieran.

import { supabase } from './supabase';
import { nombresCuentasCompromiso } from '@/lib/cuentasCompromiso';

// Las cuentas internas de los compromisos (devengo) se saldan desde
// Compromisos, no son un medio del día a día. `conservar` es el medio que ya
// tiene un asiento que se está editando: no se oculta para no vaciar el campo.
export async function obtenerFormasPagoOperacion(
  empresaId: string,
  operacion: string,
  categoria: string,
  conservar?: string | null
): Promise<string[]> {
  const { data, error } = await supabase
    .from('matriz_operaciones')
    .select('forma_pago')
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion)
    .eq('categoria', categoria);

  if (error) throw error;

  const internas = await nombresCuentasCompromiso(empresaId);

  return (Array.from(new Set((data ?? []).map((f) => f.forma_pago).filter(Boolean))) as string[]).filter(
    (nombre) => !internas.has(nombre) || nombre === conservar
  );
}
