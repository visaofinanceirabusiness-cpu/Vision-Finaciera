// lib/indicadoresLibroDiario.ts
//
// Indicadores de la cabecera del Libro Diario: convierten los asientos en información
// (movimiento, ritmo de actividad, mix de operaciones, cuentas, contrapartes y calidad del
// registro). Solo lectura sobre lo que ya muestra la pestaña; no consulta nada ni toca el motor.

export type FilaLibro = {
  id_operacion: string;
  fecha: string;
  operacion: string;
  cuenta_debito: string | null;
  cuenta_credito: string | null;
  importe: number;
  estado: string | null;
  tipo_registro: 'OPERACION' | 'AUTOMATICO';
  cliente_proveedor?: string | null;
};

export type PeriodoLibro = 'MES' | 'MES_ANTERIOR' | 'TODO';

export type RangoFechas = { desde: string; hasta: string };

const dia = (fecha: string) => fecha.slice(0, 10);

function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

function mesISO(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

// `hoy` = 'YYYY-MM-DD'. TODO no tiene rango (null).
export function rangoDelPeriodo(periodo: PeriodoLibro, hoy: string): RangoFechas | null {
  if (periodo === 'TODO') return null;

  const [anio, mes] = hoy.split('-').map(Number);
  const objetivo = periodo === 'MES' ? { anio, mes } : mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };

  return {
    desde: `${mesISO(objetivo.anio, objetivo.mes)}-01`,
    hasta: `${mesISO(objetivo.anio, objetivo.mes)}-${String(ultimoDiaDelMes(objetivo.anio, objetivo.mes)).padStart(2, '0')}`,
  };
}

// El mes inmediatamente anterior al rango (para comparar). Solo tiene sentido con rango mensual.
export function rangoAnterior(rango: RangoFechas | null): RangoFechas | null {
  if (!rango) return null;
  const [anio, mes] = rango.desde.split('-').map(Number);
  const previo = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
  return rangoDelPeriodo('MES', `${mesISO(previo.anio, previo.mes)}-01`);
}

export function filtrarPorRango<T extends { fecha: string }>(filas: T[], rango: RangoFechas | null): T[] {
  if (!rango) return filas;
  return filas.filter((f) => dia(f.fecha) >= rango.desde && dia(f.fecha) <= rango.hasta);
}

export type FiltroIndicador =
  | { tipo: 'operacion'; valor: string }
  | { tipo: 'cuenta'; valor: string }
  | { tipo: 'contraparte'; valor: string }
  | { tipo: 'estado'; valor: 'VALIDADO' | 'PENDIENTE' }
  | { tipo: 'origen'; valor: 'OPERACION' | 'AUTOMATICO' }
  | { tipo: 'dia'; valor: string };

export function aplicarFiltroIndicador<T extends FilaLibro>(filas: T[], filtro: FiltroIndicador | null): T[] {
  if (!filtro) return filas;

  switch (filtro.tipo) {
    case 'operacion':
      return filas.filter((f) => f.operacion === filtro.valor);
    case 'cuenta':
      return filas.filter((f) => f.cuenta_debito === filtro.valor || f.cuenta_credito === filtro.valor);
    case 'contraparte':
      return filas.filter((f) => f.cliente_proveedor === filtro.valor);
    case 'estado':
      return filas.filter((f) => (esValidado(f) ? 'VALIDADO' : 'PENDIENTE') === filtro.valor);
    case 'origen':
      return filas.filter((f) => f.tipo_registro === filtro.valor);
    case 'dia':
      return filas.filter((f) => dia(f.fecha) === filtro.valor);
  }
}

function esValidado(f: Pick<FilaLibro, 'estado'>): boolean {
  return (f.estado ?? '').toUpperCase() === 'VALIDADO';
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export type ItemConteo = { clave: string; cantidad: number; importe: number };

export type IndicadoresLibro = {
  movimiento: {
    asientos: number;
    operaciones: number;
    volumen: number;
    // null si no hay período anterior con datos con qué comparar.
    variacionVolumen: number | null;
    incompletos: number;
  };
  ritmo: {
    diasConMovimiento: number;
    diasDelPeriodo: number;
    promedioOperacionesPorDiaActivo: number;
    diaMasActivo: { fecha: string; operaciones: number } | null;
    ultimoRegistro: string | null;
  };
  mix: ItemConteo[];
  cuentas: { cuenta: string; importe: number; porcentaje: number }[];
  contrapartes: {
    clientes: { nombre: string; importe: number }[];
    proveedores: { nombre: string; importe: number }[];
  };
  calidad: { validados: number; pendientes: number; porcentajeValidado: number; manuales: number; automaticos: number };
};

const OPERACIONES_DE_VENTA = ['VENTA', 'COBRO'];
const OPERACIONES_DE_COMPRA = ['COMPRA', 'PAGO'];

function top(mapa: Map<string, number>, n: number) {
  return Array.from(mapa.entries())
    .map(([nombre, importe]) => ({ nombre, importe: redondear(importe) }))
    .sort((a, b) => b.importe - a.importe || a.nombre.localeCompare(b.nombre))
    .slice(0, n);
}

function sumarEn(mapa: Map<string, number>, clave: string | null | undefined, importe: number) {
  if (!clave) return;
  mapa.set(clave, (mapa.get(clave) ?? 0) + importe);
}

function diasEntre(desde: string, hasta: string): number {
  const ms = new Date(`${hasta}T12:00:00`).getTime() - new Date(`${desde}T12:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

// `periodoFilas` = las filas del período; `anterior` = las del período previo (para la variación).
export function calcularIndicadores(
  periodoFilas: FilaLibro[],
  anterior: FilaLibro[] | null,
  rango: RangoFechas | null,
  hoy: string
): IndicadoresLibro {
  const volumen = redondear(periodoFilas.reduce((s, f) => s + f.importe, 0));
  const volumenPrevio = anterior ? anterior.reduce((s, f) => s + f.importe, 0) : 0;
  const operaciones = new Set(periodoFilas.map((f) => f.id_operacion)).size;

  const operacionesPorDia = new Map<string, Set<string>>();
  for (const f of periodoFilas) {
    const d = dia(f.fecha);
    if (!operacionesPorDia.has(d)) operacionesPorDia.set(d, new Set());
    operacionesPorDia.get(d)!.add(f.id_operacion);
  }
  const dias = Array.from(operacionesPorDia.entries()).sort((a, b) => b[1].size - a[1].size || b[0].localeCompare(a[0]));
  const fechas = periodoFilas.map((f) => dia(f.fecha)).sort();

  // En el mes en curso solo cuentan los días ya transcurridos.
  const hastaDias = rango ? (hoy < rango.hasta && hoy >= rango.desde ? hoy : rango.hasta) : fechas[fechas.length - 1];
  const desdeDias = rango ? rango.desde : fechas[0];
  const diasDelPeriodo = desdeDias && hastaDias ? diasEntre(desdeDias, hastaDias) : 0;

  const mixMapa = new Map<string, ItemConteo>();
  const cuentasMapa = new Map<string, number>();
  const clientes = new Map<string, number>();
  const proveedores = new Map<string, number>();

  for (const f of periodoFilas) {
    const item = mixMapa.get(f.operacion) ?? { clave: f.operacion, cantidad: 0, importe: 0 };
    item.cantidad += 1;
    item.importe += f.importe;
    mixMapa.set(f.operacion, item);

    sumarEn(cuentasMapa, f.cuenta_debito, f.importe);
    sumarEn(cuentasMapa, f.cuenta_credito, f.importe);

    if (f.tipo_registro === 'OPERACION') {
      if (OPERACIONES_DE_VENTA.includes(f.operacion)) sumarEn(clientes, f.cliente_proveedor, f.importe);
      else if (OPERACIONES_DE_COMPRA.includes(f.operacion)) sumarEn(proveedores, f.cliente_proveedor, f.importe);
    }
  }

  const movimientoTotal = volumen * 2;
  const validados = periodoFilas.filter(esValidado).length;
  const automaticos = periodoFilas.filter((f) => f.tipo_registro === 'AUTOMATICO').length;

  return {
    movimiento: {
      asientos: periodoFilas.length,
      operaciones,
      volumen,
      variacionVolumen: anterior && volumenPrevio > 0 ? redondear(((volumen - volumenPrevio) / volumenPrevio) * 100) : null,
      incompletos: periodoFilas.filter((f) => !f.cuenta_debito || !f.cuenta_credito || !(f.importe > 0)).length,
    },
    ritmo: {
      diasConMovimiento: operacionesPorDia.size,
      diasDelPeriodo,
      promedioOperacionesPorDiaActivo: operacionesPorDia.size ? redondear(operaciones / operacionesPorDia.size) : 0,
      diaMasActivo: dias.length ? { fecha: dias[0][0], operaciones: dias[0][1].size } : null,
      ultimoRegistro: fechas.length ? fechas[fechas.length - 1] : null,
    },
    mix: Array.from(mixMapa.values())
      .map((i) => ({ ...i, importe: redondear(i.importe) }))
      .sort((a, b) => b.cantidad - a.cantidad || a.clave.localeCompare(b.clave)),
    cuentas: top(cuentasMapa, 3).map((c) => ({
      cuenta: c.nombre,
      importe: c.importe,
      porcentaje: movimientoTotal > 0 ? redondear((c.importe / movimientoTotal) * 100) : 0,
    })),
    contrapartes: { clientes: top(clientes, 1), proveedores: top(proveedores, 1) },
    calidad: {
      validados,
      pendientes: periodoFilas.length - validados,
      porcentajeValidado: periodoFilas.length ? Math.round((validados / periodoFilas.length) * 100) : 0,
      manuales: periodoFilas.length - automaticos,
      automaticos,
    },
  };
}
