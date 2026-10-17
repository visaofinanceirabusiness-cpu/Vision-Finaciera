// lib/analisisContrapartes.ts
//
// Análisis de clientes / proveedores (en Familia: fuentes de ingreso /
// destinos de pago) a partir de registro_operaciones. Lógica pura, sin
// acceso a base. La contraparte de cada operación es un texto libre
// (cliente_proveedor), así que se agrupa por nombre normalizado.

import { aCentavos } from './centavos';

export type OperacionTercero = {
  fecha: string;
  operacion: string | null;
  total: number | string | null;
  cliente_proveedor: string | null;
  estado: string | null;
};

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
