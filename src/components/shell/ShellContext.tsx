'use client';

import { createContext, useContext } from 'react';

// `true` cuando la pantalla se muestra dentro del nuevo diseño (menú lateral + barra superior): ahí no se dibujan los
// encabezados propios de cada herramienta, que pasan a la barra y al menú del cascarón.
const ShellContext = createContext(false);

export const ShellProveedor = ShellContext.Provider;

export function useEnShell(): boolean {
  return useContext(ShellContext);
}
