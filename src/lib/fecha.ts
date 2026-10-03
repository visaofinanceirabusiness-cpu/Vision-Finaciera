// lib/fecha.ts
//
// `new Date().toISOString()` da la fecha en UTC, no en la hora local
// del que está usando la app. Para alguien en Argentina o Brasil
// (UTC-3), pasadas cierta hora de la tarde/noche el "día en UTC" ya
// pasó a ser mañana — y cualquier default de fecha calculado con
// toISOString() queda un día adelantado. Esta función arma la fecha
// a partir de año/mes/día LOCALES, que es lo que corresponde para un
// selector de fecha en un formulario.

export function fechaLocalHoy(): string {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Diferencia en días de calendario completos entre dos fechas/horas
// ISO — ignora la hora, solo cuenta el cambio de día. Si no se pasa
// `fechaIsoFin`, se compara contra el momento actual. Se usa para
// medir atraso (ver lib/planAccion.ts: cuántos días lleva sin
// completarse el día activo del Plan de Acción).
export function diasEntre(fechaIsoInicio: string, fechaIsoFin?: string): number {
  const inicio = new Date(fechaIsoInicio);
  const fin = fechaIsoFin ? new Date(fechaIsoFin) : new Date();
  const soloFecha = (f: Date) => new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round((soloFecha(fin) - soloFecha(inicio)) / msPorDia);
}

// Selector de período compartido (Mis Ingresos, Mis Vencimientos,
// Salud de Caja) — "YYYY-MM-01" + N meses. No hace falta clampear el
// día porque siempre es 01.
export function sumarMesesPeriodo(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + meses, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
}

export function formatearPeriodo(valor: string, esPT: boolean): string {
  const [anio, mes] = valor.split('-').map(Number);
  if (!anio || !mes) return valor;
  return new Date(anio, mes - 1, 1).toLocaleDateString(esPT ? 'pt-BR' : 'es-AR', { month: 'long', year: 'numeric' });
}

// Rango fijo de períodos para elegir en el selector compartido: desde
// 2 meses atrás (por si queda algo atrasado sin resolver) hasta 3
// meses adelante (para poder planificar) — no depende de qué datos
// ya estén cargados, así los tres paneles (Ingresos/Vencimientos/
// Salud de Caja) siempre ofrecen exactamente las mismas opciones.
export function periodosDisponibles(hoy: string, esPT: boolean): { valor: string; etiqueta: string }[] {
  const periodoActual = `${hoy.slice(0, 7)}-01`;
  const valores: string[] = [];
  for (let i = -2; i <= 3; i++) {
    valores.push(sumarMesesPeriodo(periodoActual, i));
  }
  return valores.map((valor) => ({ valor, etiqueta: formatearPeriodo(valor, esPT) }));
}
