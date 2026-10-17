// lib/analisisContrapartes.ts
//
// Análisis de clientes / proveedores (en Familia: fuentes de ingreso /
// destinos de pago) a partir de registro_operaciones. Lógica pura, sin
// acceso a base. La contraparte de cada operación es un texto libre
// (cliente_proveedor), así que se agrupa por nombre normalizado.

import { aCentavos } from './centavos';

export type OperacionTercero = {
  id?: string;
  fecha: string;
  operacion: string | null;
  total: number | string | null;
  cliente_proveedor: string | null;
  estado: string | null;
  categoria?: string | null;
  historico?: string | null;
  id_operacion?: string | null;
  cuenta_debito?: string | null;
  cuenta_credito?: string | null;
};

// nombre de cuenta -> tipo_saldo (INGRESO, GASTO, COSTO, ACTIVO, PASIVO…)
export type TiposDeCuenta = Map<string, string>;

export type TipoContraparte = 'clientes' | 'proveedores';

export type EtiquetaFrecuencia = 'RECURRENTE' | 'OCASIONAL' | 'DORMIDO';

export type FilaContraparte = {
  nombre: string;
  valor: number;
  porcentaje: number;
  operaciones: number;
};

export type FilaFrecuencia = {
  nombre: string;
  operaciones: number;
  ultima: string;
  diasDesdeUltima: number;
  intervaloPromedioDias: number | null;
  etiqueta: EtiquetaFrecuencia;
};

export type AnalisisContrapartes = {
  total: number;
  operaciones: number;
  ticketPromedio: number;
  activos: number;
  nuevos: number;
  concentracionTop3: number;
  ranking: FilaContraparte[];
  evolucion: Array<{ clave: string; valor: number; operaciones: number }>;
  frecuencia: FilaFrecuencia[];
  // Operaciones del período que cuentan para el análisis pero no tienen
  // contraparte cargada (no se pueden atribuir a nadie).
  sinContraparte: { operaciones: number; importe: number };
  // Cobros (clientes) / pagos (proveedores) del período sin contraparte:
  // sin esto no se pueden calcular saldos por contraparte (fase siguiente).
  liquidacionesSinAsignar: { operaciones: number; importe: number };
};

// Empresas: lo devengado (venta / compra). Familia no tiene ventas ni
// compras de ingresos y gastos corrientes: lo que entra es un cobro y
// lo que sale un pago.
export function operacionBase(tipo: TipoContraparte, esFamiliar: boolean): string {
  if (tipo === 'clientes') return esFamiliar ? 'COBRO' : 'VENTA';
  return esFamiliar ? 'PAGO' : 'COMPRA';
}

// En Familia el cobro y el pago son a la vez el devengo (se reconoce el
// ingreso o el gasto: se acredita una cuenta de ingreso / se debita una de
// gasto) y la liquidación posterior (se acredita o debita "X a cobrar" /
// "X a pagar"). Contar las dos veces duplica el valor, así que el análisis
// solo cuenta la que reconoce el resultado: así coincide con "Ingresos" y
// "Gastos" del Panel de Control.
export function reconoceResultado(o: OperacionTercero, tipo: TipoContraparte, tipos?: TiposDeCuenta): boolean {
  const cuenta = ((tipo === 'clientes' ? o.cuenta_credito : o.cuenta_debito) ?? '').trim();
  if (!cuenta) return true;

  const tipoSaldo = tipos?.get(cuenta);
  if (tipoSaldo) return tipo === 'clientes' ? tipoSaldo === 'INGRESO' : tipoSaldo === 'GASTO' || tipoSaldo === 'COSTO';

  return !/cobrar|pagar/i.test(cuenta);
}

export function normalizarNombre(nombre: string | null | undefined): string {
  return (nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${hasta.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function mesesHacia(hasta: string, cantidad: number): string[] {
  const [anio, mes] = hasta.split('-').map(Number);
  const lista: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const fecha = new Date(Date.UTC(anio, mes - 1 - i, 1));
    lista.push(`${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return lista;
}

type Acumulado = { nombre: string; conteoNombres: Map<string, number>; fechas: string[]; valor: number; enPeriodo: number };

export function analizarContrapartes({
  operaciones,
  tipo,
  esFamiliar,
  periodo,
  hoy,
  fechasAlta,
  tiposCuenta,
}: {
  operaciones: OperacionTercero[];
  tipo: TipoContraparte;
  esFamiliar: boolean;
  // 'AAAA-MM' o 'TODOS'
  periodo: string;
  // 'AAAA-MM-DD'
  hoy: string;
  // nombre normalizado -> fecha de alta ('AAAA-MM-DD'), de la tabla clientes/proveedores
  fechasAlta: Map<string, string | null>;
  tiposCuenta?: TiposDeCuenta;
}): AnalisisContrapartes {
  const base = operacionBase(tipo, esFamiliar);
  const liquidacion = tipo === 'clientes' ? 'COBRO' : 'PAGO';

  const validas = operaciones.filter((o) => (o.estado ?? '').toUpperCase() === 'VALIDADO');
  const delPeriodo = (o: OperacionTercero) => periodo === 'TODOS' || o.fecha.slice(0, 7) === periodo;

  const porContraparte = new Map<string, Acumulado>();
  const sinContraparte = { operaciones: 0, importe: 0 };
  const liquidacionesSinAsignar = { operaciones: 0, importe: 0 };
  const porMes = new Map<string, { valor: number; operaciones: number }>();

  for (const o of validas) {
    const operacion = (o.operacion ?? '').toUpperCase();
    const importe = Number(o.total ?? 0) || 0;
    const clave = normalizarNombre(o.cliente_proveedor);

    if (operacion === liquidacion && !esFamiliar && delPeriodo(o) && !clave) {
      liquidacionesSinAsignar.operaciones += 1;
      liquidacionesSinAsignar.importe += importe;
    }

    if (operacion !== base) continue;
    if (esFamiliar && !reconoceResultado(o, tipo, tiposCuenta)) continue;

    if (!clave) {
      if (delPeriodo(o)) {
        sinContraparte.operaciones += 1;
        sinContraparte.importe += importe;
      }
      const mesSin = o.fecha.slice(0, 7);
      const acumMes = porMes.get(mesSin) ?? { valor: 0, operaciones: 0 };
      acumMes.valor += importe;
      acumMes.operaciones += 1;
      porMes.set(mesSin, acumMes);
      continue;
    }

    const nombreOriginal = (o.cliente_proveedor ?? '').trim();
    const acum: Acumulado = porContraparte.get(clave) ?? {
      nombre: nombreOriginal,
      conteoNombres: new Map<string, number>(),
      fechas: [],
      valor: 0,
      enPeriodo: 0,
    };
    acum.conteoNombres.set(nombreOriginal, (acum.conteoNombres.get(nombreOriginal) ?? 0) + 1);
    acum.fechas.push(o.fecha.slice(0, 10));
    if (delPeriodo(o)) {
      acum.valor += importe;
      acum.enPeriodo += 1;
    }
    porContraparte.set(clave, acum);

    const mes = o.fecha.slice(0, 7);
    const acumMes = porMes.get(mes) ?? { valor: 0, operaciones: 0 };
    acumMes.valor += importe;
    acumMes.operaciones += 1;
    porMes.set(mes, acumMes);
  }

  // Nombre a mostrar: la grafía que más se usó.
  for (const acum of porContraparte.values()) {
    let mejor = acum.nombre;
    let max = 0;
    for (const [nombre, cantidad] of acum.conteoNombres) {
      if (cantidad > max) {
        mejor = nombre;
        max = cantidad;
      }
    }
    acum.nombre = mejor;
  }

  const delPeriodoLista = [...porContraparte.entries()].filter(([, a]) => a.enPeriodo > 0);

  const totalAtribuido = delPeriodoLista.reduce((suma, [, a]) => suma + a.valor, 0);
  const total = totalAtribuido + sinContraparte.importe;
  const cantidadOperaciones = delPeriodoLista.reduce((suma, [, a]) => suma + a.enPeriodo, 0) + sinContraparte.operaciones;

  const ordenado = delPeriodoLista
    .map(([, a]) => a)
    .sort((a, b) => b.valor - a.valor);

  const ranking: FilaContraparte[] = ordenado.map((a) => ({
    nombre: a.nombre,
    valor: aCentavos(a.valor),
    porcentaje: total > 0 ? (a.valor / total) * 100 : 0,
    operaciones: a.enPeriodo,
  }));

  const concentracionTop3 =
    total > 0 ? (ordenado.slice(0, 3).reduce((suma, a) => suma + a.valor, 0) / total) * 100 : 0;

  const nuevos = delPeriodoLista.filter(([clave]) => {
    const alta = fechasAlta.get(clave);
    if (!alta) return false;
    return periodo === 'TODOS' || alta.slice(0, 7) === periodo;
  }).length;

  const hastaEvolucion = periodo === 'TODOS' ? hoy.slice(0, 7) : periodo;
  const evolucion = mesesHacia(hastaEvolucion, 12).map((clave) => ({
    clave,
    valor: aCentavos(porMes.get(clave)?.valor ?? 0),
    operaciones: porMes.get(clave)?.operaciones ?? 0,
  }));

  // La frecuencia mira todo el historial (no solo el período elegido):
  // "dormido" no tiene sentido dentro de una ventana de un mes.
  const frecuencia: FilaFrecuencia[] = [...porContraparte.values()]
    .map((a) => {
      const fechas = [...a.fechas].sort();
      const ultima = fechas[fechas.length - 1];
      const diasDesdeUltima = Math.max(0, diasEntre(ultima, hoy));
      const intervaloPromedioDias =
        fechas.length > 1 ? Math.round(diasEntre(fechas[0], ultima) / (fechas.length - 1)) : null;

      let etiqueta: EtiquetaFrecuencia;
      const umbralDormido = Math.max(60, (intervaloPromedioDias ?? 0) * 2);
      if (diasDesdeUltima > umbralDormido) etiqueta = 'DORMIDO';
      else if (fechas.length >= 3) etiqueta = 'RECURRENTE';
      else etiqueta = 'OCASIONAL';

      return { nombre: a.nombre, operaciones: fechas.length, ultima, diasDesdeUltima, intervaloPromedioDias, etiqueta };
    })
    .sort((a, b) => a.diasDesdeUltima - b.diasDesdeUltima || b.operaciones - a.operaciones);

  return {
    total: aCentavos(total),
    operaciones: cantidadOperaciones,
    ticketPromedio: cantidadOperaciones > 0 ? aCentavos(total / cantidadOperaciones) : 0,
    activos: delPeriodoLista.length,
    nuevos,
    concentracionTop3,
    ranking,
    evolucion,
    frecuencia,
    sinContraparte: { operaciones: sinContraparte.operaciones, importe: aCentavos(sinContraparte.importe) },
    liquidacionesSinAsignar: {
      operaciones: liquidacionesSinAsignar.operaciones,
      importe: aCentavos(liquidacionesSinAsignar.importe),
    },
  };
}

// Operaciones que se atribuyen a un cliente (venta y cobro) o a un
// proveedor (compra y pago). En Familia solo existen el cobro y el pago.
export function operacionesDeContraparte(tipo: TipoContraparte, esFamiliar: boolean): string[] {
  if (esFamiliar) return [operacionBase(tipo, true)];
  return tipo === 'clientes' ? ['VENTA', 'COBRO'] : ['COMPRA', 'PAGO'];
}

export type FichaContraparte = {
  nombre: string;
  totalHistorico: number;
  totalPeriodo: number;
  operaciones: number;
  operacionesPeriodo: number;
  ticketPromedio: number;
  primera: string | null;
  ultima: string | null;
  diasDesdeUltima: number | null;
  evolucion: Array<{ clave: string; valor: number; operaciones: number }>;
  movimientos: Array<{
    fecha: string;
    operacion: string;
    total: number;
    categoria: string;
    historico: string;
    esBase: boolean;
  }>;
};

export function fichaDeContraparte({
  operaciones,
  tipo,
  esFamiliar,
  clave,
  periodo,
  hoy,
  tiposCuenta,
}: {
  operaciones: OperacionTercero[];
  tipo: TipoContraparte;
  esFamiliar: boolean;
  tiposCuenta?: TiposDeCuenta;
  // nombre ya normalizado
  clave: string;
  periodo: string;
  hoy: string;
}): FichaContraparte {
  const base = operacionBase(tipo, esFamiliar);
  const cuentaPropia = (o: OperacionTercero) => (o.operacion ?? '').toUpperCase() === base && (!esFamiliar || reconoceResultado(o, tipo, tiposCuenta));
  const tipos = operacionesDeContraparte(tipo, esFamiliar);
  const propias = operaciones.filter(
    (o) =>
      (o.estado ?? '').toUpperCase() === 'VALIDADO' &&
      normalizarNombre(o.cliente_proveedor) === clave &&
      tipos.includes((o.operacion ?? '').toUpperCase())
  );

  const bases = propias.filter(cuentaPropia);
  const delPeriodo = bases.filter((o) => periodo === 'TODOS' || o.fecha.slice(0, 7) === periodo);

  const sumar = (lista: OperacionTercero[]) => lista.reduce((suma, o) => suma + (Number(o.total ?? 0) || 0), 0);
  const fechas = bases.map((o) => o.fecha.slice(0, 10)).sort();
  const ultima = fechas.length ? fechas[fechas.length - 1] : null;

  const porMes = new Map<string, { valor: number; operaciones: number }>();
  for (const o of bases) {
    const mes = o.fecha.slice(0, 7);
    const acum = porMes.get(mes) ?? { valor: 0, operaciones: 0 };
    acum.valor += Number(o.total ?? 0) || 0;
    acum.operaciones += 1;
    porMes.set(mes, acum);
  }

  const nombres = new Map<string, number>();
  for (const o of propias) {
    const n = (o.cliente_proveedor ?? '').trim();
    nombres.set(n, (nombres.get(n) ?? 0) + 1);
  }
  const nombre = [...nombres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? clave;

  const hasta = periodo === 'TODOS' ? hoy.slice(0, 7) : periodo;

  return {
    nombre,
    totalHistorico: aCentavos(sumar(bases)),
    totalPeriodo: aCentavos(sumar(delPeriodo)),
    operaciones: bases.length,
    operacionesPeriodo: delPeriodo.length,
    ticketPromedio: bases.length ? aCentavos(sumar(bases) / bases.length) : 0,
    primera: fechas[0] ?? null,
    ultima,
    diasDesdeUltima: ultima ? Math.max(0, diasEntre(ultima, hoy)) : null,
    evolucion: mesesHacia(hasta, 12).map((mes) => ({
      clave: mes,
      valor: aCentavos(porMes.get(mes)?.valor ?? 0),
      operaciones: porMes.get(mes)?.operaciones ?? 0,
    })),
    movimientos: propias
      .map((o) => ({
        fecha: o.fecha.slice(0, 10),
        operacion: (o.operacion ?? '').toUpperCase(),
        total: Number(o.total ?? 0) || 0,
        categoria: o.categoria ?? '',
        historico: o.historico ?? '',
        esBase: cuentaPropia(o),
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
}

function palabrasClave(normal: string): string[] {
  return normal.split(/[^a-z0-9]+/).filter((palabra) => palabra.length >= 4);
}

function distanciaEdicion(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temporal = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = temporal;
    }
  }
  return fila[b.length];
}

export type GrafiaPorRevisar = {
  // Texto tal cual está guardado en las operaciones.
  grafia: string;
  operaciones: number;
  importe: number;
  primeraFecha: string;
  // Nombre dado de alta con el que se puede unificar (o null: falta darlo de alta).
  sugerencia: string | null;
  // 'MISMA' = es la misma persona escrita distinto; 'PARECIDA' = parecida, a confirmar.
  confianza: 'MISMA' | 'PARECIDA' | null;
};

// Nombres que las operaciones usan pero que no coinciden EXACTAMENTE con un
// alta de clientes / proveedores: o es la misma persona escrita distinto, o
// se parece a una, o falta darla de alta.
export function grafiasPorRevisar({
  operaciones,
  tipo,
  esFamiliar,
  altas,
}: {
  operaciones: OperacionTercero[];
  tipo: TipoContraparte;
  esFamiliar: boolean;
  altas: string[];
}): GrafiaPorRevisar[] {
  const tipos = operacionesDeContraparte(tipo, esFamiliar);
  const altasExactas = new Set(altas);
  const altasNormalizadas = new Map(altas.map((a) => [normalizarNombre(a), a]));

  const porGrafia = new Map<string, { operaciones: number; importe: number; primeraFecha: string }>();
  for (const o of operaciones) {
    if ((o.estado ?? '').toUpperCase() !== 'VALIDADO') continue;
    if (!tipos.includes((o.operacion ?? '').toUpperCase())) continue;
    const grafia = o.cliente_proveedor ?? '';
    if (!normalizarNombre(grafia)) continue;
    if (altasExactas.has(grafia)) continue;

    const acum = porGrafia.get(grafia) ?? { operaciones: 0, importe: 0, primeraFecha: o.fecha.slice(0, 10) };
    acum.operaciones += 1;
    acum.importe += Number(o.total ?? 0) || 0;
    if (o.fecha.slice(0, 10) < acum.primeraFecha) acum.primeraFecha = o.fecha.slice(0, 10);
    porGrafia.set(grafia, acum);
  }

  return [...porGrafia.entries()]
    .map(([grafia, acum]) => {
      const normal = normalizarNombre(grafia);
      let sugerencia: string | null = null;
      let confianza: GrafiaPorRevisar['confianza'] = null;

      const exacta = altasNormalizadas.get(normal);
      if (exacta) {
        sugerencia = exacta;
        confianza = 'MISMA';
      } else {
        let mejor: { nombre: string; distancia: number } | null = null;
        let empate = false;
        for (const [normalAlta, original] of altasNormalizadas) {
          const contiene = Math.min(normal.length, normalAlta.length) >= 4 && (normalAlta.includes(normal) || normal.includes(normalAlta));
          const distancia = contiene ? 1 : normal.length >= 5 ? distanciaEdicion(normal, normalAlta) : 99;
          if (distancia > 2) continue;
          if (!mejor || distancia < mejor.distancia) {
            mejor = { nombre: original, distancia };
            empate = false;
          } else if (distancia === mejor.distancia) {
            empate = true;
          }
        }
        // Si dos altas se parecen igual, no se adivina: que lo elija la persona.
        if (empate) mejor = null;
        if (!mejor && !empate) {
          // "Casita 💚" vs "Alquiler Arg. Casita": todas sus palabras están en un único alta.
          const palabras = palabrasClave(normal);
          if (palabras.length > 0) {
            const candidatos = [...altasNormalizadas].filter(([normalAlta]) => {
              const delAlta = palabrasClave(normalAlta);
              return palabras.every((p) => delAlta.includes(p));
            });
            if (candidatos.length === 1) mejor = { nombre: candidatos[0][1], distancia: 2 };
          }
        }
        if (mejor) {
          sugerencia = mejor.nombre;
          confianza = 'PARECIDA';
        }
      }

      return { grafia, operaciones: acum.operaciones, importe: aCentavos(acum.importe), primeraFecha: acum.primeraFecha, sugerencia, confianza };
    })
    .sort((a, b) => b.operaciones - a.operaciones || a.grafia.localeCompare(b.grafia));
}

// Los devengos de plantillas recurrentes anteriores a guardar el nombre
// quedaron con el nombre solo dentro del histórico: "Uber — devengado 2026-10".
export function sugerenciaDeHistorico(historico: string | null | undefined): string | null {
  const coincidencia = /^(.+?)\s+—\s+devengado\s+\d{4}-\d{2}$/.exec((historico ?? '').trim());
  const nombre = coincidencia?.[1].trim();
  return nombre ? nombre : null;
}

export type OperacionSinContraparte = {
  id: string;
  fecha: string;
  operacion: string;
  categoria: string;
  historico: string;
  total: number;
  sugerencia: string | null;
};

// Operaciones de este tipo (cliente / proveedor) que no tienen nombre
// cargado, más nuevas primero.
export function operacionesSinContraparte({
  operaciones,
  tipo,
  esFamiliar,
}: {
  operaciones: OperacionTercero[];
  tipo: TipoContraparte;
  esFamiliar: boolean;
}): OperacionSinContraparte[] {
  const tipos = operacionesDeContraparte(tipo, esFamiliar);

  return operaciones
    .filter(
      (o) =>
        !!o.id &&
        (o.estado ?? '').toUpperCase() === 'VALIDADO' &&
        tipos.includes((o.operacion ?? '').toUpperCase()) &&
        !normalizarNombre(o.cliente_proveedor)
    )
    .map((o) => ({
      id: o.id as string,
      fecha: o.fecha.slice(0, 10),
      operacion: (o.operacion ?? '').toUpperCase(),
      categoria: o.categoria ?? '',
      historico: o.historico ?? '',
      total: Number(o.total ?? 0) || 0,
      sugerencia: sugerenciaDeHistorico(o.historico),
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
