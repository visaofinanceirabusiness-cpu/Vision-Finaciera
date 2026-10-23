// Medidas compartidas de la casa de Visão 3D (modelo Familia): paredes, profundidad y cuánto se corre cada columna
// del mobiliario al ensanchar los cuartos. El frente de la casa mira a +z.

export const X_IZQ = -11.6; // pared exterior de la cochera
export const X_COCHERA = -5.7; // tabique cochera | casa (y pared exterior del piso de arriba)
export const X_CENTRO = 0.6; // tabique entre las dos columnas de cuartos
export const X_DER = 6.8; // pared exterior derecha
export const Z_ATRAS = -3.45;
export const PROF = 6.9;

// Los cuartos se ensancharon: lo que se había ubicado con las medidas anteriores (cochera x<-4.7, casa izquierda y
// casa derecha) se corre para quedar centrado en su cuarto nuevo.
export function desplazarX(x: number): number {
  if (x < -4.7) return x - 1;
  if (x < 0.6) return x - 0.5;
  return x + 0.5;
}
