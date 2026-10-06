// lib/devengo.ts
//
// DEVENGO MES A MES — reglas puras (sin Supabase), testeables. Un
// gasto recurrente con `devengar` activo no espera a que lo paguen
// para existir: el día 1 de cada mes se reconoce el gasto (Gasto /
// Cuentas a Pagar) y recién después se salda contra caja (Cuentas a
// Pagar / Banco). Ver lib/devengoGastos.ts para la parte con base de
// datos.

export type EstadoDevengo = 'PROGRAMADA' | 'DEVENGANDO' | 'POR_CONFIRMAR' | 'DEVENGADA' | 'SALDADA';

// 12 meses móviles: el mes en curso + los 11 siguientes.
export const MESES_VENTANA = 12;

// Un devengo que quedó "DEVENGANDO" más de esto se considera trabado
// (la pestaña se cerró en medio) y se puede reintentar.
export const MINUTOS_DEVENGO_TRABADO = 10;

export const ETIQUETA_ESTADO: Record<EstadoDevengo, { es: string; pt: string }> = {
  PROGRAMADA: { es: 'Programada', pt: 'Programada' },
  DEVENGANDO: { es: 'Registrando...', pt: 'Registrando...' },
  POR_CONFIRMAR: { es: 'Por confirmar', pt: 'A confirmar' },
  DEVENGADA: { es: 'Devengada', pt: 'Reconhecida' },
  SALDADA: { es: 'Saldada', pt: 'Quitada' },
};

function primerDiaDelMes(anio: number, mesIndice: number): string {
  const fecha = new Date(anio, mesIndice, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
}

// Períodos ('YYYY-MM-01') de la ventana móvil, empezando por el mes de `hoy`.
export function periodosVentana(hoy: string, meses: number = MESES_VENTANA): string[] {
  const [anio, mes] = hoy.split('-').map(Number);
  return Array.from({ length: meses }, (_, i) => primerDiaDelMes(anio, mes - 1 + i));
}

// Los períodos de la ventana que todavía no tienen su fila.
export function periodosFaltantes(existentes: string[], hoy: string, meses: number = MESES_VENTANA): string[] {
  const yaTiene = new Set(existentes);
  return periodosVentana(hoy, meses).filter((periodo) => !yaTiene.has(periodo));
}

// Vencimiento = día elegido de ese mes (las plantillas validan 1 a 28).
export function fechaVencimientoDe(periodo: string, diaMes: number): string {
  return `${periodo.slice(0, 8)}${String(diaMes).padStart(2, '0')}`;
}

// El devengo ocurre el día 1: si el período ya empezó, corresponde.
export function correspondeDevengar(periodo: string, hoy: string): boolean {
  return periodo <= hoy;
}

export function devengoTrabado(devengoIniciadoEn: string | null, ahora: Date = new Date()): boolean {
  if (!devengoIniciadoEn) return true;
  return ahora.getTime() - new Date(devengoIniciadoEn).getTime() > MINUTOS_DEVENGO_TRABADO * 60 * 1000;
}

// Qué estado queda tras un pago/cobro: SALDADA si ya no falta nada
// (tolerancia de un centavo, igual que registrarPagoParcial).
export function estadoTrasPago(montoDevengado: number, montoPagado: number): 'DEVENGADA' | 'SALDADA' {
  return montoDevengado - montoPagado <= 0.01 ? 'SALDADA' : 'DEVENGADA';
}

// Marca con la que se reconoce el asiento de devengo en el Libro
// Diario ("Alquiler — devengado 2026-10"): sirve para no duplicarlo
// si un reintento se cruza con uno que sí llegó a registrarse.
export function historicoDevengo(nombre: string, periodo: string): string {
  return `${nombre} — devengado ${periodo.slice(0, 7)}`;
}

export type AjusteDevengo =
  | { accion: 'SIN_CAMBIO' }
  | { accion: 'AJUSTAR' }
  // El monto nuevo es justo lo que ya se cobró/pagó: el mes queda saldado.
  | { accion: 'SALDAR' }
  | { accion: 'RECHAZAR'; motivo: 'MONTO_INVALIDO' | 'MENOR_A_LO_MOVIDO' };

// Qué hacer cuando se corrige el monto de un mes ya devengado (la plantilla
// subió o el monto real fue otro). Se puede ajustar mientras el nuevo monto no
// sea menor a lo que ya se cobró/pagó: esos movimientos son asientos aparte y
// no se tocan, solo cambia lo devengado.
export function resolverAjusteDevengo(montoDevengado: number, montoMovido: number, nuevoMonto: number): AjusteDevengo {
  if (!(nuevoMonto > 0)) return { accion: 'RECHAZAR', motivo: 'MONTO_INVALIDO' };
  if (Math.abs(nuevoMonto - montoDevengado) < 0.005) return { accion: 'SIN_CAMBIO' };
  if (nuevoMonto < montoMovido - 0.005) return { accion: 'RECHAZAR', motivo: 'MENOR_A_LO_MOVIDO' };
  if (montoMovido > 0 && nuevoMonto <= montoMovido + 0.01) return { accion: 'SALDAR' };
  return { accion: 'AJUSTAR' };
}
