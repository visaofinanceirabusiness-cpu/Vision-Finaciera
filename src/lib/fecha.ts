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
