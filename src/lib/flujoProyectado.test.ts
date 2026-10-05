import { describe, expect, it } from 'vitest';
import {
  construirFlujo,
  eventosDeRecordatorios,
  proyectarPlantillasSinDevengo,
  type EventoFlujo,
  type RecordatorioFlujo,
} from './flujoProyectado';

const hoy = '2026-10-05';
const pago = (fecha: string, monto: number): EventoFlujo => ({ fecha, monto, tipo: 'PAGO', origen: 'COMPROMISO', nombre: 'x' });
const cobro = (fecha: string, monto: number): EventoFlujo => ({ fecha, monto, tipo: 'COBRO', origen: 'COMPROMISO', nombre: 'y' });

describe('construirFlujo', () => {
  it('arranca del saldo de hoy y arrastra el saldo mes a mes', () => {
    const flujo = construirFlujo(1000, hoy, 3, [cobro('2026-10-20', 500), pago('2026-10-25', 300), pago('2026-11-10', 400)]);
    expect(flujo.meses.map((m) => m.periodo)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
    expect(flujo.meses[0]).toMatchObject({ saldoInicial: 1000, cobros: 500, pagos: 300, saldoFinal: 1200 });
    expect(flujo.meses[1]).toMatchObject({ saldoInicial: 1200, saldoFinal: 800 });
    expect(flujo.saldoFinal).toBe(800);
    expect(flujo.totalCobros).toBe(500);
    expect(flujo.totalPagos).toBe(700);
  });

  it('lo vencido y sin saldar cuenta en el mes en curso', () => {
    const flujo = construirFlujo(0, hoy, 2, [pago('2026-09-10', 200)]);
    expect(flujo.meses[0].pagos).toBe(200);
  });

  it('ignora lo que cae después del horizonte y los montos en cero', () => {
    const flujo = construirFlujo(100, hoy, 2, [pago('2027-03-01', 999), pago('2026-10-30', 0)]);
    expect(flujo.totalPagos).toBe(0);
    expect(flujo.saldoFinal).toBe(100);
  });

  it('marca el primer mes que cierra en negativo', () => {
    const flujo = construirFlujo(100, hoy, 3, [pago('2026-11-05', 300), pago('2026-12-05', 50)]);
    expect(flujo.mesCritico?.periodo).toBe('2026-11-01');
  });

  it('sin meses negativos no hay mes crítico', () => {
    expect(construirFlujo(100, hoy, 2, [cobro('2026-10-10', 10)]).mesCritico).toBeNull();
  });

  it('suma decimales sin arrastrar error de coma flotante', () => {
    const flujo = construirFlujo(0, hoy, 1, [pago('2026-10-10', 0.1), pago('2026-10-11', 0.2)]);
    expect(flujo.totalPagos).toBe(0.3);
  });
});

describe('proyectarPlantillasSinDevengo', () => {
  const plantillas = [
    { id: 'a', nombre: 'Internet', monto_habitual: '100', dia_mes: 10, activo: true, devengar: false },
    { id: 'b', nombre: 'Netflix', monto_habitual: 45, dia_mes: 5, activo: true, devengar: true },
    { id: 'c', nombre: 'Gym', monto_habitual: 30, dia_mes: 1, activo: false, devengar: false },
  ];

  it('proyecta solo las activas sin devengo, desde el mes siguiente al último recordatorio', () => {
    const eventos = proyectarPlantillasSinDevengo(plantillas, new Map([['a', '2026-10-01']]), hoy, 3, 'PAGO');
    expect(eventos.map((e) => e.fecha)).toEqual(['2026-11-10', '2026-12-10']);
    expect(eventos[0]).toMatchObject({ monto: 100, nombre: 'Internet', origen: 'RECURRENTE' });
  });

  it('sin recordatorios previos arranca en el mes en curso', () => {
    const eventos = proyectarPlantillasSinDevengo(plantillas, new Map(), hoy, 2, 'COBRO');
    expect(eventos.map((e) => e.fecha)).toEqual(['2026-10-10', '2026-11-10']);
  });
});

describe('eventosDeRecordatorios', () => {
  const base: RecordatorioFlujo = { gastoOIngresoId: 'g', nombre: 'Alquiler', periodo: '2026-10-01', fecha_vencimiento: '2026-10-10', registrado: false, estado: 'DEVENGADA', saldo: 800 };

  it('cuenta lo devengado aunque la plantilla ya no esté activa', () => {
    expect(eventosDeRecordatorios([base], new Set(), 'PAGO')).toHaveLength(1);
  });

  it('no cuenta lo saldado ni lo ya registrado', () => {
    expect(eventosDeRecordatorios([{ ...base, estado: 'SALDADA' }, { ...base, registrado: true }], new Set(['g']), 'PAGO')).toEqual([]);
  });

  it('una programada de una plantilla dada de baja no cuenta', () => {
    const programada = { ...base, estado: 'PROGRAMADA' as const };
    expect(eventosDeRecordatorios([programada], new Set(), 'PAGO')).toEqual([]);
    expect(eventosDeRecordatorios([programada], new Set(['g']), 'PAGO')).toHaveLength(1);
  });
});
