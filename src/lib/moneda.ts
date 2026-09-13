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

// Costo por unidad de stock (ej. precio por gramo, por mililitro o
// por centímetro de un insumo) — a diferencia de un total, acá
// redondear a entero puede esconder el valor entero: comprar a
// R$ 0,05 el gramo se mostraba como "0" con formatearNumeroEntero.
// Se muestran hasta 4 decimales para valores menores a 1, y hasta 2
// para el resto (toLocaleString recorta los decimales que sobran).
export function formatearCostoUnitario(valor: number): string {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(valor) < 1 ? 4 : 2,
  });
}
