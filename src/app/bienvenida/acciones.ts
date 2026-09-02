// app/bienvenida/acciones.ts
//
// Altas mínimas que hace el wizard de onboarding. Reusa lib/categorias.ts
// y lib/socios.ts tal cual (ya solo piden un nombre); clientes,
// proveedores y productos no tenían una función compartida así que se
// arma acá una versión mínima (solo alta, sin edición) con el mismo
// esquema de código correlativo que ya usan Recursos Humanos y
// Mercadería (CLI-00001, PROVE-00001, PROD-00001).

import { supabase } from '@/lib/supabase';
import { fechaLocalHoy } from '@/lib/fecha';

async function siguienteCodigo(empresaId: string, tabla: 'clientes' | 'proveedores' | 'productos', prefijo: string) {
  const { data, error } = await supabase.from(tabla).select('codigo').eq('empresa_id', empresaId);

  if (error) {
    throw error;
  }

  let maximo = 0;

  for (const fila of data ?? []) {
    const coincidencia = (fila.codigo as string | null)?.match(/\d+/);
    if (coincidencia) {
      const numero = Number(coincidencia[0]);
      if (numero > maximo) maximo = numero;
    }
  }

  return `${prefijo}-${String(maximo + 1).padStart(5, '0')}`;
}

export async function crearContacto(
  empresaId: string,
  tabla: 'clientes' | 'proveedores',
  nombre: string
) {
  const nombreLimpio = nombre.trim();

  if (!nombreLimpio) {
    throw new Error('El nombre no puede estar vacío.');
  }

  const codigo = await siguienteCodigo(empresaId, tabla, tabla === 'clientes' ? 'CLI' : 'PROVE');

  const { error } = await supabase.from(tabla).insert({
    empresa_id: empresaId,
    nombre: nombreLimpio,
    codigo,
    fecha_alta: fechaLocalHoy(),
  });

  if (error) {
    throw error;
  }
}

export async function crearProductoBasico(
  empresaId: string,
  nombre: string,
  categoriaProductoId: string,
  categoriaNombre: string
) {
  const nombreLimpio = nombre.trim();

  if (!nombreLimpio) {
    throw new Error('El nombre no puede estar vacío.');
  }

  const codigo = await siguienteCodigo(empresaId, 'productos', 'PROD');

  const { error } = await supabase.from('productos').insert({
    empresa_id: empresaId,
    nombre: nombreLimpio,
    codigo,
    categoria_producto_id: categoriaProductoId,
    categoria: categoriaNombre,
    fecha_alta: fechaLocalHoy(),
  });

  if (error) {
    throw error;
  }
}
