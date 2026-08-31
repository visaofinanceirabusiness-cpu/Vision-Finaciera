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
