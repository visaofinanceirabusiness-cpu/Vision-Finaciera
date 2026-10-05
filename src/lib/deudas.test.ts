import { describe, expect, it } from 'vitest';
import { armarDeudas, type CuentaPasivo, type VencimientoDeuda } from './deudas';

const hoy = '2026-10-05';
const cuentas: CuentaPasivo[] = [
  { id: 'tarjeta', nombre: 'Tarjeta Nu', saldo: 344, esCompromiso: false },
  { id: 'prestamo', nombre: 'Prestamo Santander', saldo: 1200.5, esCompromiso: false },
  { id: 'alquiler', nombre: 'Alquiler a pagar', saldo: 800, esCompromiso: true },
  { id: 'cero', nombre: 'Naranja X', saldo: 0, esCompromiso: false },
  { id: 'centavos', nombre: 'Préstamo viejo', saldo: 0.49, esCompromiso: false },
  { id: 'favor', nombre: 'Otra', saldo: -20, esCompromiso: false },
];

describe('armarDeudas', () => {
  it('separa compromisos de deudas, oculta lo que está en cero o a favor y ordena por saldo', () => {
    const r = armarDeudas(cuentas, [], hoy);
    expect(r.deudas.map((d) => d.nombre)).toEqual(['Prestamo Santander', 'Tarjeta Nu']);
    expect(r.compromisos.map((d) => d.nombre)).toEqual(['Alquiler a pagar']);
    expect(r.totalDeudas).toBe(1544.5);
    expect(r.totalCompromisos).toBe(800);
    expect(r.total).toBe(2344.5);
  });

  it('toma el próximo vencimiento, cuenta lo pendiente y marca lo vencido', () => {
    const venc: VencimientoDeuda[] = [
      { cuentaId: 'prestamo', fecha: '2026-12-10', monto: 100 },
      { cuentaId: 'prestamo', fecha: '2026-11-10', monto: 100 },
      { cuentaId: 'alquiler', fecha: '2026-10-01', monto: 800 },
    ];
    const r = armarDeudas(cuentas, venc, hoy);
    const prestamo = r.deudas.find((d) => d.cuentaId === 'prestamo');
    expect(prestamo).toMatchObject({ pendientes: 2, montoPendiente: 200, proximoVencimiento: '2026-11-10', vencida: false });
    expect(r.compromisos[0]).toMatchObject({ proximoVencimiento: '2026-10-01', vencida: true });
  });

  it('suma lo que vence dentro de 30 días, incluido lo ya vencido', () => {
    const venc: VencimientoDeuda[] = [
      { cuentaId: 'alquiler', fecha: '2026-10-01', monto: 800 },
      { cuentaId: 'tarjeta', fecha: '2026-11-04', monto: 50 },
      { cuentaId: 'tarjeta', fecha: '2026-11-06', monto: 70 },
    ];
    expect(armarDeudas(cuentas, venc, hoy).venceEn30Dias).toBe(850);
  });

  it('un vencimiento de una cuenta sin deuda no cuenta', () => {
    expect(armarDeudas(cuentas, [{ cuentaId: 'cero', fecha: '2026-10-06', monto: 99 }], hoy).venceEn30Dias).toBe(0);
  });
});
