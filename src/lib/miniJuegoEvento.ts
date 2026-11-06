// lib/miniJuegoEvento.ts
//
// Atajos para el Mini-Juego, que vive en el cascarón (components/shell/AppShell.tsx). Cualquier pantalla puede pedir que se abra
// SIN duplicarlo ni cambiar cómo funciona, y enterarse de que se cerró (para refrescar lo que muestra, como el Libro Diario).

export const EVENTO_ABRIR_MINIJUEGO = 'visao:abrir-minijuego';
export const EVENTO_MINIJUEGO_CERRADO = 'visao:minijuego-cerrado';

export function abrirMiniJuego() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_ABRIR_MINIJUEGO));
}
