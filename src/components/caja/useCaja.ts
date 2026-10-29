'use client';

// Hook para consultar la caja de materiales desde cualquier pantalla: `estaEnCaja('clave')`.
// Mientras carga (o si falla la lectura) devuelve false: lo guardado se esconde recién cuando se sabe seguro.

import { useEffect, useState } from 'react';
import { cargarCaja } from '@/lib/cajaMaterialesDatos';

export function useCaja(): { cargada: boolean; estaEnCaja: (clave: string) => boolean } {
  const [claves, setClaves] = useState<Set<string> | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarCaja().then((filas) => {
      if (vivo) setClaves(new Set(filas.map((f) => f.clave)));
    });
    return () => {
      vivo = false;
    };
  }, []);

  return { cargada: claves !== null, estaEnCaja: (clave) => claves?.has(clave) ?? false };
}
