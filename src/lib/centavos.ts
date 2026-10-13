// lib/centavos.ts
//
// Los saldos se arman sumando muchos importes decimales con números de punto
// flotante (0.1 + 0.2 = 0.30000000000000004). Una cuenta que en pesos y
// centavos queda en exactamente 20,00 puede dar 19,999999999999996 en esa
// suma, y una comparación "saldo - total < 0" la tomaba como negativa y
// rechazaba un pago que la dejaba en cero (caso real: pagar los R$ 20 que
// quedaban de "Préstamos Santander"). Todo saldo y toda resta contra un
// saldo se redondean a centavos antes de comparar.
export function aCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
