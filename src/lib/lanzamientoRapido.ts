// lib/lanzamientoRapido.ts
//
// Lógica pura de "Lanzamiento rápido": armar el top de tarjetas a partir de
// las operaciones recientes y las reglas de seguridad del monto. No toca la
// base ni el motor — el registro real sigue siendo registrarOperacion.

export type OperacionReciente = {
  id_operacion: string;
  fecha: string;
  operacion: string;
  categoria: string;
  forma_pago: string;
  total: number | string;
  historico: string | null;
  cliente_proveedor: string | null;
  creado_en?: string | null;
};

export type TarjetaRapida = {
  clave: string;
  operacion: string;
  categoria: string;
  formaPago: string;
  usos: number;
  ultimoValor: number;
  mediana: number;
  ultimoHistorico: string;
  ultimoProveedor: string;
};

// Compra/venta/pérdida llevan producto y cantidad: no caben en una tarjeta de
// un solo valor.
export const OPERACIONES_RAPIDAS = ['PAGO', 'COBRO', 'TRANSFERENCIA', 'INVERSION', 'EXTRACCION'];

export const MIN_USOS_PARA_ALERTA = 3;
export const FACTOR_ALERTA = 10;

// Los asientos automáticos de devengo ("— devengado …") no los carga la
// persona: repetirlos a mano duplicaría el compromiso.
export function esAsientoAutomatico(historico: string | null | undefined): boolean {
  return /devengad/i.test(historico ?? '');
}

export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

export function armarTop(filas: OperacionReciente[], limite = 10): TarjetaRapida[] {
  const grupos = new Map<string, OperacionReciente[]>();

  for (const fila of filas) {
    if (!OPERACIONES_RAPIDAS.includes(fila.operacion)) continue;
    if (esAsientoAutomatico(fila.historico)) continue;
    if (!fila.categoria || !fila.forma_pago) continue;
    if (!(Number(fila.total) > 0)) continue;

    const clave = `${fila.operacion}|${fila.categoria}|${fila.forma_pago}`;
    const lista = grupos.get(clave) ?? [];
    lista.push(fila);
    grupos.set(clave, lista);
  }

  const tarjetas: Array<TarjetaRapida & { ultima: string }> = [];

  for (const [clave, lista] of grupos) {
    const ordenadas = [...lista].sort(
      (a, b) => b.fecha.localeCompare(a.fecha) || b.id_operacion.localeCompare(a.id_operacion)
    );
    const ultima = ordenadas[0];

    tarjetas.push({
      clave,
      operacion: ultima.operacion,
      categoria: ultima.categoria,
      formaPago: ultima.forma_pago,
      usos: lista.length,
      ultimoValor: Number(ultima.total),
      mediana: mediana(lista.map((f) => Number(f.total))),
      ultimoHistorico: ultima.historico ?? '',
      ultimoProveedor: ultima.cliente_proveedor ?? '',
      ultima: ultima.fecha,
    });
  }

  return tarjetas
    .sort((a, b) => b.usos - a.usos || b.ultima.localeCompare(a.ultima) || a.clave.localeCompare(b.clave))
    .slice(0, limite)
    .map(({ ultima: _ultima, ...tarjeta }) => tarjeta);
}

export function parsearMonto(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, '');
  if (!limpio) return NaN;
  // "1.234,50" (es/pt) o "1234.50"
  const normal = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio;
  return Number(normal);
}

export function validarMonto(monto: number): string | null {
  if (!Number.isFinite(monto) || monto <= 0) return 'Poné un valor mayor a cero.';
  return null;
}

export function montoSospechoso(monto: number, tarjeta: Pick<TarjetaRapida, 'usos' | 'mediana'>): boolean {
  return tarjeta.usos >= MIN_USOS_PARA_ALERTA && tarjeta.mediana > 0 && monto > tarjeta.mediana * FACTOR_ALERTA;
}
