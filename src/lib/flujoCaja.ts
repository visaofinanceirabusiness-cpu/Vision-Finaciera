// lib/flujoCaja.ts
//
// Flujo de caja por actividades (Informes → Flujo de Caja): cada asiento que
// mueve plata entre una cuenta de caja y el resto se clasifica por la cuenta
// contraparte, según su código del plan:
//   Comercial  → ventas y cobros a clientes, compras de mercadería, proveedores
//   Operativo  → gastos operacionales e impuestos
//   Inversión  → activos fijos y ahorros / inversiones
//   Financiero → préstamos, tarjeta, intereses y aportes / retiros de socios
//   Otros      → lo que no encaja, para que nada quede fuera
// Todo es lectura de asientos: no toca el motor ni genera nada.

export type BloqueFlujo = 'COMERCIAL' | 'OPERATIVO' | 'INVERSION' | 'FINANCIERO' | 'OTROS';

export const BLOQUES_FLUJO: BloqueFlujo[] = ['COMERCIAL', 'OPERATIVO', 'INVERSION', 'FINANCIERO', 'OTROS'];

export type CuentaFlujo = { nombre: string; codigo: string; tipo_saldo?: string | null };
export type AsientoFlujo = { fecha: string; debito: string | null; credito: string | null; importe: number };
export type FilaFlujo = { nombre: string; valor: number };

export type ResumenBloque = {
  entradas: FilaFlujo[];
  salidas: FilaFlujo[];
  totalEntradas: number;
  totalSalidas: number;
  neto: number;
};

export type Flujo = {
  bloques: Record<BloqueFlujo, ResumenBloque>;
  totalEntradas: number;
  totalSalidas: number;
  neto: number;
};

const aCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

// Proveedores, tarjeta y préstamo bancario son las cuentas de pasivo que el sistema crea siempre.
const PROVEEDORES = '2.1.1.0.1';
const FINANCIERAS_FIJAS = ['2.1.1.0.2', '2.1.1.0.3'];

function bloquePorCodigo(codigo: string): BloqueFlujo | 'ORIGEN' {
  if (codigo.startsWith('4.') || codigo.startsWith('5.') || codigo.startsWith('1.1.2.') || codigo.startsWith('1.1.3.')) return 'COMERCIAL';
  if (codigo.startsWith('1.2.') || codigo.startsWith('1.3.')) return 'INVERSION';
  if (codigo.startsWith('6.4.')) return 'FINANCIERO';
  if (codigo.startsWith('6.')) return 'OPERATIVO';
  if (codigo === PROVEEDORES) return 'COMERCIAL';
  if (FINANCIERAS_FIJAS.includes(codigo) || codigo.startsWith('2.2.')) return 'FINANCIERO';
  if (codigo.startsWith('2.1.')) return 'ORIGEN';
  if (codigo.startsWith('3.')) return 'FINANCIERO';
  return 'OTROS';
}

// Un pasivo propio ("Alquiler a pagar") se clasifica por aquello con lo que nació:
// pagarlo cierra un gasto (operativo), una compra (comercial), un activo (inversión)
// o una deuda tomada en plata (financiero).
export function crearClasificador(cuentas: CuentaFlujo[], asientos: AsientoFlujo[], nombresCaja: Set<string>) {
  const porNombre = new Map(cuentas.map((c) => [c.nombre, c]));
  const origen = new Map<string, BloqueFlujo>();

  const pesos = new Map<string, Map<BloqueFlujo, number>>();
  for (const a of asientos) {
    const pasivo = a.credito ? porNombre.get(a.credito) : undefined;
    if (!pasivo || bloquePorCodigo(pasivo.codigo) !== 'ORIGEN' || !a.debito) continue;

    const contra = porNombre.get(a.debito);
    const bloque = nombresCaja.has(a.debito) ? 'FINANCIERO' : contra ? bloquePorCodigo(contra.codigo) : 'OTROS';
    const acumulado = pesos.get(pasivo.nombre) ?? new Map<BloqueFlujo, number>();
    const clave: BloqueFlujo = bloque === 'ORIGEN' ? 'FINANCIERO' : bloque;
    acumulado.set(clave, (acumulado.get(clave) ?? 0) + a.importe);
    pesos.set(pasivo.nombre, acumulado);
  }

  for (const [nombre, mapa] of pesos) {
    origen.set(nombre, Array.from(mapa.entries()).sort((x, y) => y[1] - x[1])[0][0]);
  }

  return (nombreCuenta: string | null): BloqueFlujo => {
    const cuenta = nombreCuenta ? porNombre.get(nombreCuenta) : undefined;
    if (!cuenta) return 'OTROS';

    const bloque = bloquePorCodigo(cuenta.codigo);
    return bloque === 'ORIGEN' ? (origen.get(cuenta.nombre) ?? 'FINANCIERO') : bloque;
  };
}

export type MovimientoCaja = { fecha: string; entrada: boolean; contraparte: string | null; importe: number };

// Solo los asientos con UN lado en caja: entre dos cuentas de caja propias es una
// transferencia interna (ni entra ni sale plata). Las transferencias a ahorro o
// inversión sí cuentan, como flujo de inversión.
export function movimientosDeCaja(asientos: AsientoFlujo[], nombresCaja: Set<string>): MovimientoCaja[] {
  const resultado: MovimientoCaja[] = [];

  for (const a of asientos) {
    const debitoCaja = Boolean(a.debito && nombresCaja.has(a.debito));
    const creditoCaja = Boolean(a.credito && nombresCaja.has(a.credito));
    if (debitoCaja === creditoCaja) continue;

    resultado.push({
      fecha: a.fecha,
      entrada: debitoCaja,
      contraparte: debitoCaja ? a.credito : a.debito,
      importe: a.importe,
    });
  }

  return resultado;
}

function agrupar(mapa: Map<string, number>): FilaFlujo[] {
  return Array.from(mapa.entries())
    .map(([nombre, valor]) => ({ nombre, valor: aCentavos(valor) }))
    .sort((a, b) => b.valor - a.valor);
}

export function armarFlujo(
  movimientos: MovimientoCaja[],
  clasificar: (nombreCuenta: string | null) => BloqueFlujo,
  // Cobrar una cuenta a cobrar es plata del ingreso con que se devengó: se agrupa por ese ingreso.
  renombrarEntrada?: (contraparte: string | null) => string | null
): Flujo {
  const acumulado = Object.fromEntries(
    BLOQUES_FLUJO.map((b) => [b, { entradas: new Map<string, number>(), salidas: new Map<string, number>() }])
  ) as Record<BloqueFlujo, { entradas: Map<string, number>; salidas: Map<string, number> }>;

  for (const m of movimientos) {
    const contraparte = m.entrada && renombrarEntrada ? renombrarEntrada(m.contraparte) : m.contraparte;
    const bloque = clasificar(contraparte);
    const clave = contraparte ?? '__OTRO__';
    const lado = m.entrada ? acumulado[bloque].entradas : acumulado[bloque].salidas;
    lado.set(clave, (lado.get(clave) ?? 0) + m.importe);
  }

  const bloques = Object.fromEntries(
    BLOQUES_FLUJO.map((b) => {
      const entradas = agrupar(acumulado[b].entradas);
      const salidas = agrupar(acumulado[b].salidas);
      const totalEntradas = aCentavos(entradas.reduce((s, f) => s + f.valor, 0));
      const totalSalidas = aCentavos(salidas.reduce((s, f) => s + f.valor, 0));
      return [b, { entradas, salidas, totalEntradas, totalSalidas, neto: aCentavos(totalEntradas - totalSalidas) }];
    })
  ) as Record<BloqueFlujo, ResumenBloque>;

  const totalEntradas = aCentavos(BLOQUES_FLUJO.reduce((s, b) => s + bloques[b].totalEntradas, 0));
  const totalSalidas = aCentavos(BLOQUES_FLUJO.reduce((s, b) => s + bloques[b].totalSalidas, 0));

  return { bloques, totalEntradas, totalSalidas, neto: aCentavos(totalEntradas - totalSalidas) };
}

export type CajaFlujo = { nombre: string; saldo_inicial: number | null };

// Saldo de las cuentas de caja al cierre del mes anterior ("YYYY-MM" = período elegido).
// Con todos los períodos es el saldo con el que arrancó la empresa.
export function saldoInicialDePeriodo(cajas: CajaFlujo[], asientos: AsientoFlujo[], periodo: string): number {
  const nombres = new Set(cajas.map((c) => c.nombre));
  const base = cajas.reduce((s, c) => s + Number(c.saldo_inicial ?? 0), 0);
  if (periodo === 'TODOS') return aCentavos(base);

  let movimiento = 0;
  for (const a of asientos) {
    if (a.fecha.slice(0, 7) >= periodo) continue;
    if (a.debito && nombres.has(a.debito)) movimiento += a.importe;
    if (a.credito && nombres.has(a.credito)) movimiento -= a.importe;
  }

  return aCentavos(base + movimiento);
}

// "Disponible para aplicar" (sobra) o "Falta para llegar" (positivo = falta).
export function diferenciaConSaldoDeseado(saldoFinal: number, saldoDeseado: number): { tipo: 'SOBRA' | 'FALTA' | 'EXACTO'; monto: number } {
  const diferencia = aCentavos(saldoFinal - saldoDeseado);
  if (diferencia > 0) return { tipo: 'SOBRA', monto: diferencia };
  if (diferencia < 0) return { tipo: 'FALTA', monto: -diferencia };
  return { tipo: 'EXACTO', monto: 0 };
}
