// lib/contabilidad.ts
//
// CÁLCULO DE INDICADORES REALES DEL PANEL DE CONTROL
//
// Reemplaza los datos de demostración que estaban escritos a mano.
// Todo sale de la base: plan de cuentas + asientos reales.
//
// De dónde sale cada cosa:
//
//  - El LIBRO MAYOR se arma con dos fuentes, igual que el Libro Diario:
//      1. registro_operaciones  (lo que carga el usuario)
//      2. registros_automaticos (el CMV que genera el motor)
//    Ambas guardan cuenta_debito / cuenta_credito como NOMBRE de cuenta,
//    y ese nombre se busca en plan_cuentas.nombre.
//
//  - El SALDO de cada cuenta es:
//      naturaleza DEUDORA   -> saldo_inicial + débitos - créditos
//      naturaleza ACREEDORA -> saldo_inicial + créditos - débitos
//
//  - Solo se suman las cuentas HOJA (las que no tienen cuentas hijas).
//    Las cuentas título (ATIVO, PASSIVO CIRCULANTE, etc.) son solo
//    encabezados: si se sumaran, se contaría todo dos veces.
//
// Criterio de PERÍODO (importante):
//  - Activo, Pasivo, Patrimonio y Caja son SALDOS ACUMULADOS a la fecha.
//    No dependen del período elegido: un activo no "pertenece" a un mes.
//  - Ingresos, Gastos, Costos, Lucro y Rentabilidad SÍ son del período
//    seleccionado (son cuentas de resultado).

import { supabase } from './supabase';

// Umbral fijo de stock bajo, definido con el cliente.
const STOCK_MINIMO = 3;

type CuentaPlan = {
  id: string;
  codigo: string;
  nombre: string;
  cuenta_padre_id: string | null;
  tipo_saldo: string | null;
  naturaleza: string | null;
  saldo_inicial: number | null;
};

type Asiento = {
  fecha: string;
  debito: string | null;
  credito: string | null;
  importe: number;
};

export type PuntoGrafico = {
  nombre: string;
  valor: number;
};

export type PuntoMes = {
  mes: string;
  valor: number;
};

export type PuntoLucroMes = {
  mes: string;
  ingresos: number;
  costos: number;
  gastos: number;
};

export type IndicadoresPanel = {
  // ---- "Tu negocio hoy": NO dependen del período ----
  activos: number;
  pasivos: number;
  patrimonio: number;
  cajaDisponible: number;
  stockBajo: number;

  // ---- Resumen ejecutivo: SÍ dependen del período ----
  ingresos: number;
  cmv: number;
  gastos: number;
  costos: number;
  lucro: number;
  rentabilidad: number;
  liquidez: number;

  // Gráficos
  ventasMensuales: PuntoMes[];
  evolucionLucro: PuntoLucroMes[];
  ventasCategorias: PuntoGrafico[];
  stockCategorias: PuntoGrafico[];

  // Control de consistencia contable
  descuadre: number;
};

const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function aNumero(valor: unknown): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// Devuelve el primer y último día del período, o null si son "todos".
function rangoDelPeriodo(periodo: string): { desde: string; hasta: string } | null {
  if (!periodo || periodo === 'TODOS') {
    return null;
  }

  const [anio, mes] = periodo.split('-').map(Number);

  if (!anio || !mes) {
    return null;
  }

  const ultimoDia = new Date(anio, mes, 0).getDate();

  return {
    desde: `${periodo.slice(0, 7)}-01`,
    hasta: `${periodo.slice(0, 7)}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

export async function obtenerIndicadores(
  empresaId: string,
  periodo: string
): Promise<IndicadoresPanel> {
  const [
    { data: cuentasData, error: errorCuentas },
    { data: operacionesData, error: errorOperaciones },
    { data: automaticosData, error: errorAutomaticos },
    { data: movimientosData, error: errorMovimientos },
  ] = await Promise.all([
    supabase
      .from('plan_cuentas')
      .select('id, codigo, nombre, cuenta_padre_id, tipo_saldo, naturaleza, saldo_inicial')
      .eq('empresa_id', empresaId),

    supabase
      .from('registro_operaciones')
      .select('fecha, operacion, categoria, total, cuenta_debito, cuenta_credito')
      .eq('empresa_id', empresaId),

    supabase
      .from('registros_automaticos')
      .select('fecha, importe, cuenta_debito, cuenta_credito')
      .eq('empresa_id', empresaId),

    supabase
      .from('movimientos_stock')
      .select('fecha, tipo, categoria, producto_id, cantidad')
      .eq('empresa_id', empresaId),
  ]);

  if (errorCuentas) throw errorCuentas;
  if (errorOperaciones) throw errorOperaciones;
  if (errorAutomaticos) throw errorAutomaticos;
  if (errorMovimientos) throw errorMovimientos;

  const cuentas = (cuentasData ?? []) as CuentaPlan[];
  const operaciones = operacionesData ?? [];
  const automaticos = automaticosData ?? [];
  const movimientos = movimientosData ?? [];

  // ---------------------------------------------------------------
  // 1. Cuentas hoja (las que no son encabezado de otras)
  // ---------------------------------------------------------------
  const idsConHijas = new Set(
    cuentas.map((cuenta) => cuenta.cuenta_padre_id).filter(Boolean) as string[]
  );

  const hojas = cuentas.filter((cuenta) => !idsConHijas.has(cuenta.id));

  // ---------------------------------------------------------------
  // 2. Todos los asientos, de las dos fuentes
  // ---------------------------------------------------------------
  const asientos: Asiento[] = [
    ...operaciones.map((fila) => ({
      fecha: String(fila.fecha ?? ''),
      debito: fila.cuenta_debito as string | null,
      credito: fila.cuenta_credito as string | null,
      importe: aNumero(fila.total),
    })),
    ...automaticos.map((fila) => ({
      fecha: String(fila.fecha ?? ''),
      debito: fila.cuenta_debito as string | null,
      credito: fila.cuenta_credito as string | null,
      importe: aNumero(fila.importe),
    })),
  ];

  const rango = rangoDelPeriodo(periodo);

  const dentroDelPeriodo = (fecha: string) =>
    !rango || (fecha >= rango.desde && fecha <= rango.hasta);

  // Acumula débitos y créditos por nombre de cuenta, tomando solo los
  // asientos cuya fecha pase el filtro.
  function acumular(incluir: (fecha: string) => boolean) {
    const debitos = new Map<string, number>();
    const creditos = new Map<string, number>();

    for (const asiento of asientos) {
      if (!incluir(asiento.fecha)) {
        continue;
      }

      if (asiento.debito) {
        debitos.set(asiento.debito, (debitos.get(asiento.debito) ?? 0) + asiento.importe);
      }

      if (asiento.credito) {
        creditos.set(asiento.credito, (creditos.get(asiento.credito) ?? 0) + asiento.importe);
      }
    }

    return { debitos, creditos };
  }

  // Tres miradas del mismo libro mayor:
  //  - total:     todo, sin importar la fecha  -> saldos "a la fecha"
  //  - periodo:   solo lo que pasó en el mes elegido -> cuentas de resultado
  //  - hastaFin:  todo hasta el cierre del mes elegido -> ratios de balance
  //               (la liquidez al cierre de ese mes)
  const acumuladoTotal = acumular(() => true);
  const acumuladoPeriodo = acumular(dentroDelPeriodo);
  const acumuladoHastaFin = rango
    ? acumular((fecha) => fecha <= rango.hasta)
    : acumuladoTotal;

  // Saldo de una cuenta, según su naturaleza.
  function saldoDe(
    cuenta: CuentaPlan,
    acumulado: { debitos: Map<string, number>; creditos: Map<string, number> },
    incluirSaldoInicial: boolean
  ): number {
    const debito = acumulado.debitos.get(cuenta.nombre) ?? 0;
    const credito = acumulado.creditos.get(cuenta.nombre) ?? 0;
    const inicial = incluirSaldoInicial ? aNumero(cuenta.saldo_inicial) : 0;

    return cuenta.naturaleza === 'ACREEDORA'
      ? inicial + credito - debito
      : inicial + debito - credito;
  }

  // ---------------------------------------------------------------
  // 3. Patrimoniales: siempre acumulados a la fecha
  // ---------------------------------------------------------------
  function totalPorTipo(tipo: string): number {
    return hojas
      .filter((cuenta) => cuenta.tipo_saldo === tipo)
      .reduce((suma, cuenta) => suma + saldoDe(cuenta, acumuladoTotal, true), 0);
  }

  function totalPorPrefijo(prefijo: string): number {
    return hojas
      .filter((cuenta) => (cuenta.codigo ?? '').startsWith(prefijo))
      .reduce((suma, cuenta) => suma + saldoDe(cuenta, acumuladoTotal, true), 0);
  }

  const activos = totalPorTipo('ACTIVO');
  const pasivos = totalPorTipo('PASIVO');
  const patrimonio = totalPorTipo('PATRIMONIO');

  // Caja disponible: solo el grupo 1.1.1.x (Caja, PIX, Aplicaciones
  // Financieras, Tarjeta). NO incluye "a Recibir" ni Clientes.
  const cajaDisponible = totalPorPrefijo('1.1.1.');

  // La liquidez SÍ sigue al selector, pero de la única forma que tiene
  // sentido contable: es el saldo al CIERRE del período elegido, no el
  // movimiento del mes (un ratio de balance no se "devenga").
  function circulanteAlCierre(prefijo: string): number {
    return hojas
      .filter((cuenta) => (cuenta.codigo ?? '').startsWith(prefijo))
      .reduce((suma, cuenta) => suma + saldoDe(cuenta, acumuladoHastaFin, true), 0);
  }

  const activoCirculante = circulanteAlCierre('1.1.');
  const pasivoCirculante = circulanteAlCierre('2.1.');

  const liquidez = pasivoCirculante !== 0 ? activoCirculante / pasivoCirculante : 0;

  // ---------------------------------------------------------------
  // 4. Resultado: del período seleccionado
  // ---------------------------------------------------------------
  // Con "Todos los períodos" se suma también el saldo inicial, porque
  // representa el arrastre histórico. Con un mes puntual, no: se mira
  // solo lo que pasó en ese mes.
  const incluirInicialEnResultado = !rango;

  function totalResultado(tipo: string): number {
    return hojas
      .filter((cuenta) => cuenta.tipo_saldo === tipo)
      .reduce(
        (suma, cuenta) =>
          suma + saldoDe(cuenta, acumuladoPeriodo, incluirInicialEnResultado),
        0
      );
  }

  const ingresos = totalResultado('INGRESO');
  const gastos = totalResultado('GASTO');
  const costos = totalResultado('COSTO');
  const lucro = ingresos - gastos - costos;
  const rentabilidad = ingresos !== 0 ? (lucro / ingresos) * 100 : 0;

  // Costo de Mercadería Vendida: solo la rama "CUSTOS DAS VENDAS" (5.1.x).
  // No incluye los costos de locación (5.2.x), que no son CMV.
  const cmv = hojas
    .filter((cuenta) => (cuenta.codigo ?? '').startsWith('5.1.'))
    .reduce(
      (suma, cuenta) =>
        suma + saldoDe(cuenta, acumuladoPeriodo, incluirInicialEnResultado),
      0
    );

  // Control: la ecuación contable debe cerrar.
  // Activo = Pasivo + Patrimonio + Resultado acumulado
  const resultadoAcumulado =
    totalPorTipo('INGRESO') - totalPorTipo('GASTO') - totalPorTipo('COSTO');

  const descuadre = activos - (pasivos + patrimonio + resultadoAcumulado);

  // ---------------------------------------------------------------
  // 5. Stock bajo (no depende del período: es la foto de hoy)
  // ---------------------------------------------------------------
  // Stock bajo: productos con menos de STOCK_MINIMO unidades.
  // Solo se cuentan los que alguna vez tuvieron movimiento — un producto
  // del catálogo que nunca se compró no es "stock bajo", es simplemente
  // un producto que todavía no se usó.
  const unidadesPorProducto = new Map<string, number>();

  for (const movimiento of movimientos) {
    const producto = movimiento.producto_id as string | null;

    if (!producto) {
      continue;
    }

    const cantidad = aNumero(movimiento.cantidad);
    const signo = movimiento.tipo === 'ENTRADA' ? 1 : -1;

    unidadesPorProducto.set(
      producto,
      (unidadesPorProducto.get(producto) ?? 0) + cantidad * signo
    );
  }

  const stockBajo = Array.from(unidadesPorProducto.values()).filter(
    (unidades) => unidades < STOCK_MINIMO
  ).length;

  // ---------------------------------------------------------------
  // 6. Gráficos
  // ---------------------------------------------------------------
  // Ventas por mes: se muestra toda la historia, porque es una tendencia.
  const ventasPorMes = new Map<string, number>();

  for (const fila of operaciones) {
    if (fila.operacion !== 'VENTA') {
      continue;
    }

    const clave = String(fila.fecha ?? '').slice(0, 7);

    if (!clave) {
      continue;
    }

    ventasPorMes.set(clave, (ventasPorMes.get(clave) ?? 0) + aNumero(fila.total));
  }

  const ventasMensuales: PuntoMes[] = Array.from(ventasPorMes.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([clave, valor]) => {
      const mes = Number(clave.slice(5, 7));
      return {
        mes: MESES_CORTOS[mes - 1] ?? clave,
        valor: redondear(valor),
      };
    });

  // Evolución del Lucro: Ingresos, Costos y Gastos de cada mes (no
  // acumulado, no incluye saldo inicial — es el movimiento de ese mes
  // solo), para que el gráfico muestre de qué se compone el resultado.
  const clavesMeses = Array.from(
    new Set(asientos.map((asiento) => asiento.fecha.slice(0, 7)).filter(Boolean))
  ).sort();

  function totalTipoEnMes(tipo: string, clave: string): number {
    const acumuladoMes = acumular((fecha) => fecha.slice(0, 7) === clave);

    return hojas
      .filter((cuenta) => cuenta.tipo_saldo === tipo)
      .reduce((suma, cuenta) => suma + saldoDe(cuenta, acumuladoMes, false), 0);
  }

  const evolucionLucro: PuntoLucroMes[] = clavesMeses.slice(-12).map((clave) => {
    const mes = Number(clave.slice(5, 7));

    return {
      mes: MESES_CORTOS[mes - 1] ?? clave,
      ingresos: redondear(totalTipoEnMes('INGRESO', clave)),
      costos: redondear(totalTipoEnMes('COSTO', clave)),
      gastos: redondear(totalTipoEnMes('GASTO', clave)),
    };
  });

  // Ventas por categoría: del período seleccionado.
  const ventasPorCategoria = new Map<string, number>();

  for (const fila of operaciones) {
    if (fila.operacion !== 'VENTA' || !dentroDelPeriodo(String(fila.fecha ?? ''))) {
      continue;
    }

    const categoria = String(fila.categoria ?? 'Sin categoría');
    ventasPorCategoria.set(
      categoria,
      (ventasPorCategoria.get(categoria) ?? 0) + aNumero(fila.total)
    );
  }

  const ventasCategorias: PuntoGrafico[] = Array.from(ventasPorCategoria.entries())
    .map(([nombre, valor]) => ({ nombre, valor: redondear(valor) }))
    .sort((a, b) => b.valor - a.valor);

  // Stock por categoría: unidades disponibles hoy (acumulado).
  const stockPorCategoria = new Map<string, number>();

  for (const movimiento of movimientos) {
    const categoria = String(movimiento.categoria ?? 'Sin categoría');
    const cantidad = aNumero(movimiento.cantidad);
    const signo = movimiento.tipo === 'ENTRADA' ? 1 : -1;

    stockPorCategoria.set(
      categoria,
      (stockPorCategoria.get(categoria) ?? 0) + cantidad * signo
    );
  }

  const stockCategorias: PuntoGrafico[] = Array.from(stockPorCategoria.entries())
    .map(([nombre, valor]) => ({ nombre, valor: redondear(valor) }))
    .sort((a, b) => b.valor - a.valor);

  return {
    // Situación a la fecha
    activos: redondear(activos),
    pasivos: redondear(pasivos),
    patrimonio: redondear(patrimonio),
    cajaDisponible: redondear(cajaDisponible),
    stockBajo,

    // Del período seleccionado
    ingresos: redondear(ingresos),
    cmv: redondear(cmv),
    gastos: redondear(gastos),
    costos: redondear(costos),
    lucro: redondear(lucro),
    rentabilidad: redondear(rentabilidad),
    liquidez: redondear(liquidez),

    ventasMensuales,
    evolucionLucro,
    ventasCategorias,
    stockCategorias,

    descuadre: redondear(descuadre),
  };
}
