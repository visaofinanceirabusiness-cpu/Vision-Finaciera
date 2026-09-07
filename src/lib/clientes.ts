// lib/clientes.ts
//
// Alta rápida de un cliente nuevo desde el formulario de Venta en
// Contabilidad (sin tener que ir hasta Recursos Humanos). La clave
// para no duplicar es el TELÉFONO, no el nombre — dos personas
// pueden compartir nombre, pero no número. Se normaliza a solo
// dígitos para comparar (mismo criterio que lib/whatsapp.ts), así
// "+54 9 11 2233-4455" y "5491122334455" cuentan como el mismo.

import { supabase } from './supabase';

function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '');
}

function generarProximoCodigoCliente(existentes: { codigo: string | null }[]): string {
  let maximo = 0;

  for (const c of existentes) {
    const match = /^CLI-(\d+)$/.exec(c.codigo ?? '');
    if (match) {
      maximo = Math.max(maximo, parseInt(match[1], 10));
    }
  }

  return `CLI-${String(maximo + 1).padStart(5, '0')}`;
}

export async function crearOUsarClientePorTelefono(
  empresaId: string,
  nombre: string,
  telefono: string
): Promise<{ id: string; nombre: string; telefono: string | null; yaExistia: boolean }> {
  const telefonoNormalizado = soloDigitos(telefono);

  if (!telefonoNormalizado) {
    throw new Error('Ingresá un teléfono válido.');
  }

  const { data: existentes, error: errorLista } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, codigo')
    .eq('empresa_id', empresaId);

  if (errorLista) {
    throw errorLista;
  }

  const coincidente = (existentes ?? []).find(
    (c) => soloDigitos(c.telefono ?? '') === telefonoNormalizado
  );

  if (coincidente) {
    return { id: coincidente.id, nombre: coincidente.nombre, telefono: coincidente.telefono, yaExistia: true };
  }

  const codigo = generarProximoCodigoCliente(existentes ?? []);

  const { data: nuevo, error: errorInsert } = await supabase
    .from('clientes')
    .insert({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      codigo,
    })
    .select('id, nombre, telefono')
    .single();

  if (errorInsert) {
    throw errorInsert;
  }

  return { id: nuevo.id, nombre: nuevo.nombre, telefono: nuevo.telefono, yaExistia: false };
}
