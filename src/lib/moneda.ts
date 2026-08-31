// lib/moneda.ts
//
// El sistema arrancó con un cliente brasileño y durante un tiempo el
// símbolo "R$" quedó escrito a mano en varias pantallas. Esta función
// es el único lugar que decide qué símbolo mostrar — así, a medida
// que se detecten más lugares con el símbolo fijo, se reemplazan por
// esto en vez de escribir la moneda de nuevo.

export function simboloMoneda(moneda: string | null | undefined): string {
  if (moneda === 'ARS') return '$';
  if (moneda === 'USD') return 'US$';
  return 'R$';
}

// Formatea un monto con separador de miles y SIN decimales (números
// enteros, más fáciles de leer de un vistazo) — con el símbolo de la
// moneda real de la empresa.
export function formatearMonto(valor: number, moneda?: string | null): string {
  const numero = Math.round(valor).toLocaleString('es-AR', {
    maximumFractionDigits: 0,
  });
  return `${simboloMoneda(moneda)} ${numero}`;
}

// Igual que formatearMonto pero sin el símbolo — para cuando el
// símbolo ya se muestra aparte (ej. dentro de una tarjeta con su
// propio prefijo).
export function formatearNumeroEntero(valor: number): string {
  return Math.round(valor).toLocaleString('es-AR', {
    maximumFractionDigits: 0,
  });
}
