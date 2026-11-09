// lib/pagoDividido.ts
//
// PAGO DIVIDIDO — una operación con más de un movimiento
// =====================================================
// Un gasto de 300 pagado con Banco 100 y Efectivo 200 (o una venta cobrada en dos medios, o un gasto repartido en dos categorías)
// se guarda como VARIAS filas con el mismo id_operacion, una por «parte» (registro_operaciones.parte = 1, 2, 3…). Cada parte se
// resuelve con la regla de la matriz de operaciones de SU categoría y forma de pago: no hay reglas nuevas ni cambia el Debe y Haber
// de ninguna. Los informes, los saldos y el Libro Diario ya trabajan fila por fila, así que suman bien sin tocarlos; lo único que
// cambia es que los contadores de operaciones cuentan solo la parte 1.
//
// Acá viven las cuentas puras (validación de las partes y chequeo de saldos por cuenta): se prueban en pagoDividido.test.ts. El
// motor (lib/motor.ts) las usa tanto para una operación común (una sola parte, igual que siempre) como para una dividida.

import { aCentavos } from './centavos';
import { primerDiaSinSaldo, saldoAFecha, saldoUtilizableAFecha, type MovimientoCuenta } from './saldoFecha';

export const MAX_PARTES = 5;

export type ParteOperacion = {
  categoria: string;
  formaPago: string;
  monto: number;
  // Solo para formas de pago que admiten cuotas (tarjeta, cuenta a cobrar): como mucho una parte por operación.
  enCuotas?: boolean;
};

export type Asiento = { cuenta_debito: string | null; cuenta_credito: string | null; importe: number };

export type HistorialSaldo = { naturaleza: string; saldoInicial: number; movimientos: MovimientoCuenta[] };

export function totalDePartes(partes: ParteOperacion[]): number {
  return aCentavos(partes.reduce((suma, p) => suma + Number(p.monto || 0), 0));
}

// null = está bien; si no, el mensaje para mostrar. `tieneStock`: la operación mueve stock (compra o venta de producto): ahí la
// categoría es la del producto y no se puede repartir entre categorías, solo entre formas de pago.
export function validarPartes(partes: ParteOperacion[], total: number, opciones: { tieneStock: boolean }): string | null {
  if (partes.length < 2) return 'Un pago dividido necesita al menos dos partes.';
  if (partes.length > MAX_PARTES) return `Un pago se puede dividir en hasta ${MAX_PARTES} partes.`;

  for (const [i, p] of partes.entries()) {
    if (!p.categoria?.trim() || !p.formaPago?.trim()) return `En la parte ${i + 1} falta elegir la categoría y la forma de pago.`;
    if (!(Number(p.monto) > 0)) return `El monto de la parte ${i + 1} tiene que ser mayor que cero.`;
  }

  const claves = partes.map((p) => `${p.categoria.trim()}||${p.formaPago.trim()}`);
  if (new Set(claves).size !== claves.length) return 'No repitas la misma categoría con la misma forma de pago: sumá los montos en una sola parte.';

  if (opciones.tieneStock && new Set(partes.map((p) => p.categoria.trim())).size > 1) {
    return 'En una operación con productos todas las partes llevan la misma categoría; solo se puede dividir entre formas de pago.';
  }

  if (partes.filter((p) => p.enCuotas).length > 1) return 'Solo una de las partes puede pagarse en cuotas.';

  const suma = totalDePartes(partes);
  if (aCentavos(suma) !== aCentavos(total)) {
    const diferencia = aCentavos(total - suma);
    return diferencia > 0 ? `Las partes suman ${suma.toFixed(2)} y faltan ${diferencia.toFixed(2)} para llegar al total (${aCentavos(total).toFixed(2)}).` : `Las partes suman ${suma.toFixed(2)} y se pasan ${Math.abs(diferencia).toFixed(2)} del total (${aCentavos(total).toFixed(2)}).`;
  }

  return null;
}

// PARTIDA DOBLE: en cada asiento el Debe y el Haber tienen que existir y ser del mismo importe, y en toda la operación la suma del
// Debe tiene que ser igual a la del Haber (al centavo). Si algo no cuadra, la operación NO se graba.
export function validarPartidaDoble(asientos: Asiento[]): string | null {
  let debe = 0;
  let haber = 0;

  for (const [i, a] of asientos.entries()) {
    const n = asientos.length > 1 ? ` (parte ${i + 1})` : '';
    if (!a.cuenta_debito || !a.cuenta_credito) {
      return `Partida doble: el asiento${n} no tiene cuenta en el Debe y en el Haber, no se puede registrar.`;
    }
    if (!Number.isFinite(a.importe) || aCentavos(a.importe) <= 0) {
      return `Partida doble: el asiento${n} tiene un importe inválido, no se puede registrar.`;
    }
    debe = aCentavos(debe + a.importe);
    haber = aCentavos(haber + a.importe);
  }

  if (debe !== haber) {
    return `Partida doble: el Debe (${debe.toFixed(2)}) y el Haber (${haber.toFixed(2)}) no son iguales, no se puede registrar.`;
  }

  return null;
}

export type ImporteDeCuenta = { cuenta: string; lado: 'DEBITO' | 'CREDITO'; importe: number };

// Suma lo que cada cuenta recibe por el Debe y lo que da por el Haber: dos partes que terminan en la misma cuenta se validan juntas.
export function importesPorCuenta(asientos: Asiento[]): ImporteDeCuenta[] {
  const mapa = new Map<string, ImporteDeCuenta>();
  for (const a of asientos) {
    // Primero el Haber y después el Debe: es el orden en que el motor siempre chequeó los saldos (importa solo para qué error sale primero).
    for (const [cuenta, lado] of [[a.cuenta_credito, 'CREDITO'], [a.cuenta_debito, 'DEBITO']] as const) {
      if (!cuenta) continue;
      const clave = `${lado}|${cuenta}`;
      const actual = mapa.get(clave) ?? { cuenta, lado, importe: 0 };
      actual.importe = aCentavos(actual.importe + a.importe);
      mapa.set(clave, actual);
    }
  }
  return [...mapa.values()];
}

export function cuentasInvolucradas(asientos: Asiento[]): string[] {
  return [...new Set(importesPorCuenta(asientos).map((i) => i.cuenta))];
}

// La misma regla de siempre del motor, aplicada a cada cuenta con el importe total que le toca en esta operación:
//  - lo que se ACREDITA de una cuenta DEUDORA (Caja, Banco, Stock, un Gasto) resta de su saldo y no puede dejarla en negativo;
//  - lo que se DEBITA de una cuenta ACREEDORA (Proveedor, un Ingreso, Patrimonio) también resta y tampoco.
// Además de al día de la operación, no puede dejar sin fondos a un movimiento ya cargado con fecha posterior.
// `historiales` trae la cuenta ya leída (null si no existe en el plan: se ignora, como siempre).
export function chequearSaldos(asientos: Asiento[], historiales: Map<string, HistorialSaldo | null>, fecha: string): string | null {
  for (const { cuenta, lado, importe } of importesPorCuenta(asientos)) {
    const historial = historiales.get(cuenta);
    if (!historial) continue;

    if (lado === 'CREDITO' && historial.naturaleza === 'DEUDORA') {
      const saldo = saldoAFecha(historial.saldoInicial, historial.movimientos, fecha);

      if (aCentavos(saldo - importe) < 0) {
        return `No hay saldo suficiente en "${cuenta}" para esta operación en la fecha indicada. Saldo disponible al ${fecha}: R$ ${saldo.toFixed(2)}, se necesitan R$ ${importe.toFixed(2)}. Registrá una Inversión (aporte) con fecha anterior o igual a esta para cubrir la diferencia.`;
      }

      if (aCentavos(saldoUtilizableAFecha(historial.saldoInicial, historial.movimientos, fecha) - importe) < 0) {
        const dia = primerDiaSinSaldo(historial.saldoInicial, historial.movimientos, fecha, importe);
        return `Esta operación dejaría sin saldo a "${cuenta}" más adelante: un movimiento ya cargado con fecha posterior (el ${dia ?? 'día siguiente'}) necesita ese dinero. Registrá antes un ingreso o aporte con fecha anterior, o usá una fecha posterior.`;
      }
    }

    if (lado === 'DEBITO' && historial.naturaleza === 'ACREEDORA') {
      const saldo = saldoAFecha(historial.saldoInicial, historial.movimientos, fecha);

      if (aCentavos(saldo - importe) < 0) {
        return `Esta operación dejaría "${cuenta}" con saldo a favor (negativo) en la fecha indicada, y todavía no hay una cuenta de anticipo para eso. Saldo al ${fecha}: R$ ${saldo.toFixed(2)}, se necesitan R$ ${importe.toFixed(2)}.`;
      }

      if (aCentavos(saldoUtilizableAFecha(historial.saldoInicial, historial.movimientos, fecha) - importe) < 0) {
        const dia = primerDiaSinSaldo(historial.saldoInicial, historial.movimientos, fecha, importe);
        return `Esta operación dejaría "${cuenta}" con saldo a favor (negativo) más adelante, el ${dia ?? 'día siguiente'}, por un movimiento ya cargado con fecha posterior. Usá una fecha posterior a ese movimiento.`;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Lo que usa el formulario «Dividir el pago» (components/contabilidad/DivisionDelPago.tsx): los montos viajan como texto.
// ---------------------------------------------------------------------------------------------------------------------

export type ParteForm = {
  categoria: string;
  formaPago: string;
  monto: string;
  enCuotas?: boolean;
  cuotas?: string;
  // true = el monto lo calculó el formulario (lo que falta); deja de serlo apenas la persona lo escribe.
  auto?: boolean;
};

export function numeroDeMonto(texto: string | number | undefined): number {
  if (typeof texto === 'number') return texto;
  const n = Number(String(texto ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function partesDeForm(partes: ParteForm[]): ParteOperacion[] {
  return partes.map((p) => ({ categoria: p.categoria, formaPago: p.formaPago, monto: aCentavos(numeroDeMonto(p.monto)), enCuotas: p.enCuotas ? true : undefined }));
}

// Cuánto falta (positivo) o sobra (negativo) para llegar al total.
export function faltante(partes: ParteForm[], total: number): number {
  return aCentavos(total - partes.reduce((suma, p) => suma + numeroDeMonto(p.monto), 0));
}

// Dos partes para empezar: la primera con la categoría y la forma de pago ya elegidas y todo el monto, la segunda en blanco.
export function partesIniciales(categoria: string, formaPago: string, total: number): ParteForm[] {
  return [
    { categoria, formaPago, monto: String(aCentavos(total)) },
    { categoria, formaPago: '', monto: '', auto: true },
  ];
}

// La última parte se completa sola con lo que falta mientras no la haya escrito la persona.
export function autocompletarUltima(partes: ParteForm[], total: number): ParteForm[] {
  if (partes.length < 2) return partes;
  const ultima = partes[partes.length - 1];
  if (!(ultima.auto || numeroDeMonto(ultima.monto) === 0)) return partes;
  const sinUltima = partes.slice(0, -1);
  const resto = faltante(sinUltima, total);
  return [...sinUltima, { ...ultima, monto: resto > 0 ? String(resto) : '', auto: true }];
}

export function resumenDePartes(partes: ParteOperacion[], simbolo: string, categoriasDistintas: boolean): string {
  return partes.map((p) => `${categoriasDistintas ? `${p.categoria} · ` : ''}${p.formaPago} ${simbolo} ${p.monto.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(p.monto) ? 0 : 2, maximumFractionDigits: 2 })}`).join(' + ');
}
