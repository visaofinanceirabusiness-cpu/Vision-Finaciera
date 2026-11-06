'use client';

// Hook para consultar la caja de materiales desde cualquier pantalla: `estaEnCaja('clave')`.
// Una pieza puede estar guardada para todas las empresas o solo para algunos perfiles: acá se resuelve según el perfil de quien
// está conectado. Mientras carga (o si falla la lectura) devuelve false: lo guardado se esconde recién cuando se sabe seguro.

import { useEffect, useState } from 'react';
import { cargarCaja, miPerfilCodigo, type EstadoCaja } from '@/lib/cajaMaterialesDatos';
import { estaEnCajaParaPerfil } from '@/lib/cajaMateriales';

export function useCaja(): { cargada: boolean; estaEnCaja: (clave: string) => boolean } {
  const [estado, setEstado] = useState<{ filas: Map<string, EstadoCaja>; perfil: string | null } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([cargarCaja(), miPerfilCodigo()]).then(([filas, perfil]) => {
      if (vivo) setEstado({ filas: new Map(filas.map((f) => [f.clave, f])), perfil });
    });
    return () => {
      vivo = false;
    };
  }, []);

  return { cargada: estado !== null, estaEnCaja: (clave) => (estado ? estaEnCajaParaPerfil(estado.filas.get(clave), estado.perfil) : false) };
}
