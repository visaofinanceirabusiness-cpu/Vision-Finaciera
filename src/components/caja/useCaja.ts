'use client';

// Hook para consultar la caja de materiales desde cualquier pantalla: `estaEnCaja('clave')`.
// Una pieza puede estar guardada para todas las empresas o solo para algunos perfiles: acá se resuelve según el perfil de quien
// está conectado. Mientras carga (o si falla la lectura) devuelve false: lo guardado se esconde recién cuando se sabe seguro.

import { useEffect, useState } from 'react';
import { cargarCaja, miContextoCaja, type EstadoCaja } from '@/lib/cajaMaterialesDatos';
import { estaEnCajaParaPerfil } from '@/lib/cajaMateriales';

export function useCaja(): { cargada: boolean; estaEnCaja: (clave: string) => boolean } {
  const [estado, setEstado] = useState<{ filas: Map<string, EstadoCaja>; perfil: string | null; empresaId: string | null } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([cargarCaja(), miContextoCaja()]).then(([filas, ctx]) => {
      if (vivo) setEstado({ filas: new Map(filas.map((f) => [f.clave, f])), perfil: ctx.codigo, empresaId: ctx.empresaId });
    });
    return () => {
      vivo = false;
    };
  }, []);

  return { cargada: estado !== null, estaEnCaja: (clave) => (estado ? estaEnCajaParaPerfil(estado.filas.get(clave), estado.perfil, estado.empresaId) : false) };
}
