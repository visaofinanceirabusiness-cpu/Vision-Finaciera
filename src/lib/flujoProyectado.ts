// lib/flujoProyectado.ts
//
// FLUJO PROYECTADO — de la plata disponible hoy, cuánto va a quedar al final
// de cada mes si se cobra y se paga lo ya comprometido (cuotas, compromisos
// y recurrentes). Es solo una vista: no crea asientos. NO incluye ventas ni
// gastos que todavía nadie planeó, solo lo que ya tiene fecha.

export type TipoFlujo = 'COBRO' | 'PAGO';
export type OrigenFlujo = 'CUOTA' | 'COMPROMISO' | 'RECURRENTE';

export type EventoFlujo = {
  fecha: string; // 'YYYY-MM-DD'
  monto: number;
  tipo: TipoFlujo;
  origen: OrigenFlujo;
  nombre: string;
};

export type MesFlujo = {
  periodo: string; // 'YYYY-MM-01'
  saldoInicial: number;
  cobros: number;
  pagos: number;
  saldoFinal: number;
  eventos: EventoFlujo[];
};

export type Flujo = {
  meses: MesFlujo[];
  totalCobros: number;
  totalPagos: number;
  saldoFinal: number;
  // Primer mes que cierra con saldo negativo (la plata no alcanza), si lo hay.
  mesCritico: MesFlujo | null;
};

export const MESES_FLUJO = [3, 6, 12] as const;

function periodoDe(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

function sumar(eventos: EventoFlujo[], tipo: TipoFlujo): number {
  // Redondeo a centavos: sumar montos decimales acumula error de coma flotante.
  return Math.round(eventos.filter((e) => e.tipo === tipo).reduce((suma, e) => suma + e.monto, 0) * 100) / 100;
}

// Lo que ya venció y sigue sin cobrarse/pagarse se cuenta en el mes en curso:
// la plata todavía no se movió, así que "ocurre" a partir de hoy.
export function construirFlujo(saldoInicial: number, hoy: string, meses: number, eventos: EventoFlujo[]): Flujo {
  const [anio, mes] = hoy.split('-').map(Number);
  const periodos = Array.from({ length: meses }, (_, i) => {
    const fecha = new Date(anio, mes - 1 + i, 1);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const porPeriodo = new Map<string, EventoFlujo[]>(periodos.map((p) => [p, []]));

  for (const evento of eventos) {
    if (evento.monto <= 0) continue;
    const periodo = evento.fecha < hoy ? periodoDe(hoy) : periodoDe(evento.fecha);
    porPeriodo.get(periodo)?.push(evento);
  }

  let saldo = saldoInicial;
  const resultado: MesFlujo[] = periodos.map((periodo) => {
    const delMes = (porPeriodo.get(periodo) ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const cobros = sumar(delMes, 'COBRO');
    const pagos = sumar(delMes, 'PAGO');
    const inicial = saldo;
    saldo = Math.round((saldo + cobros - pagos) * 100) / 100;
    return { periodo, saldoInicial: inicial, cobros, pagos, saldoFinal: saldo, eventos: delMes };
  });

  return {
    meses: resultado,
    totalCobros: Math.round(resultado.reduce((s, m) => s + m.cobros, 0) * 100) / 100,
    totalPagos: Math.round(resultado.reduce((s, m) => s + m.pagos, 0) * 100) / 100,
    saldoFinal: saldo,
    mesCritico: resultado.find((m) => m.saldoFinal < 0) ?? null,
  };
}

export type PlantillaFlujo = {
  id: string;
  nombre: string;
  monto_habitual: number | string;
  dia_mes: number;
  activo: boolean;
  devengar: boolean;
};

// Plantillas del flujo viejo (sin devengo): el sistema genera de a un
// recordatorio, así que de los meses siguientes al último existente solo hay
// la plantilla. Las que devengan mes a mes ya traen sus 12 filas reales.
export function proyectarPlantillasSinDevengo(
  plantillas: PlantillaFlujo[],
  ultimoPeriodoPorPlantilla: Map<string, string>,
  hoy: string,
  meses: number,
  tipo: TipoFlujo
): EventoFlujo[] {
  const [anio, mes] = hoy.split('-').map(Number);
  const eventos: EventoFlujo[] = [];

  for (const plantilla of plantillas) {
    if (!plantilla.activo || plantilla.devengar) continue;

    const ultimo = ultimoPeriodoPorPlantilla.get(plantilla.id);

    for (let i = 0; i < meses; i++) {
      const fecha = new Date(anio, mes - 1 + i, 1);
      const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;

      if (ultimo && periodo <= ultimo) continue;

      eventos.push({
        fecha: `${periodo.slice(0, 8)}${String(plantilla.dia_mes).padStart(2, '0')}`,
        monto: Number(plantilla.monto_habitual),
        tipo,
        origen: 'RECURRENTE',
        nombre: plantilla.nombre,
      });
    }
  }

  return eventos;
}

export type RecordatorioFlujo = {
  gastoOIngresoId: string;
  nombre: string;
  periodo: string;
  fecha_vencimiento: string;
  registrado: boolean;
  estado: 'PROGRAMADA' | 'DEVENGANDO' | 'POR_CONFIRMAR' | 'DEVENGADA' | 'SALDADA' | null;
  // Lo que falta pagar/cobrar de ese recordatorio.
  saldo: number;
};

// Una fila ya saldada no es plata futura. Una programada o por confirmar solo
// cuenta si su plantilla sigue activa (si se dio de baja, esas filas sobran);
// una devengada es una deuda/cobro real y cuenta siempre.
export function eventosDeRecordatorios(
  recordatorios: RecordatorioFlujo[],
  idsPlantillasActivas: Set<string>,
  tipo: TipoFlujo
): EventoFlujo[] {
  return recordatorios
    .filter((r) => !r.registrado && r.estado !== 'SALDADA')
    .filter((r) => r.estado === 'DEVENGADA' || r.estado === null || idsPlantillasActivas.has(r.gastoOIngresoId))
    .map((r) => ({ fecha: r.fecha_vencimiento, monto: r.saldo, tipo, origen: r.estado === null ? 'RECURRENTE' : 'COMPROMISO', nombre: r.nombre }));
}
