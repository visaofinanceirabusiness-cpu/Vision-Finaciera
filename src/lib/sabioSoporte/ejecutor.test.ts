import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// El motor contable y la lectura de saldos se simulan: acá se prueba la LÓGICA de Sabio (orden, aportes, reposición, pausa, reserva del día).
const formularios: Array<Record<string, unknown>> = [];
const filtrosDeFecha: string[] = [];
vi.mock('../motor', () => ({
  registrarOperacion: vi.fn(async (_empresa: string, form: Record<string, unknown>) => {
    formularios.push(form);
    return { idOperacion: `OP-${formularios.length}`, total: 0 };
  }),
  traerTodo: async <T,>(pagina: (d: number, h: number) => PromiseLike<{ data: T[] | null }>) => ((await pagina(0, 999)).data ?? []) as T[],
}));
vi.mock('../saldoCuenta', () => ({ saldosDeMedios: vi.fn(async () => ({ Banco: 0, Dinheiro: 0, 'Carteira Digital': 0 })) }));
vi.mock('../miniJuego', () => ({ obtenerCategoriasJuego: vi.fn(async () => [{ nombre: 'Consultoria Empresarial', stock: 'NO' }, { nombre: 'Calçados', stock: 'SI' }]) }));
vi.mock('../supabase', () => ({ usarClienteDeServicio: vi.fn(), supabase: {} }));

import { ejecutarDia } from './ejecutor';

type Tablas = Record<string, Array<Record<string, unknown>>>;

function fakeAdmin(tablas: Tablas, opciones: { diaYaReservado?: boolean; counts?: Record<string, number> } = {}) {
  const insertados: Array<{ tabla: string; filas: unknown }> = [];
  const constructor = (tabla: string) => {
    const b: Record<string, unknown> = {};
    const encadenable = ['select', 'eq', 'order', 'range', 'in', 'update', 'delete'];
    for (const m of encadenable) b[m] = () => b;
    // Las fechas de los filtros tienen que existir de verdad: la base rechaza «2026-02-31» y el día entero falla.
    for (const m of ['gte', 'lte']) {
      b[m] = (columna: string, valor: unknown) => {
        if (columna === 'fecha') filtrosDeFecha.push(String(valor));
        return b;
      };
    }
    b.insert = (filas: unknown) => {
      insertados.push({ tabla, filas });
      return Promise.resolve({ error: tabla === 'sabio_soporte_dias' && opciones.diaYaReservado ? { message: 'duplicate key' } : null });
    };
    b.upsert = (filas: unknown) => {
      insertados.push({ tabla, filas });
      return Promise.resolve({ error: null });
    };
    b.maybeSingle = () => Promise.resolve({ data: tablas[tabla]?.[0] ?? null, error: null });
    b.then = (ok: (v: unknown) => unknown) => ok({ data: tablas[tabla] ?? [], error: null, count: opciones.counts?.[tabla] ?? (tablas[tabla]?.length ?? 0) });
    return b;
  };
  return { admin: { from: constructor } as unknown as SupabaseClient, insertados };
}

const productos = [
  { id: 'p1', nombre: 'Bota', categoria: 'Calçados', tipo_producto: 'TERMINADO' },
  { id: 'p2', nombre: 'Sandália', categoria: 'Calçados', tipo_producto: 'TERMINADO' },
];
const base = (extra: Tablas = {}): Tablas => ({
  sabio_soporte_config: [{ activo: true, pausado: false, config: {} }],
  productos,
  clientes: [{ nombre: 'Ariel' }, { nombre: 'Camila' }],
  proveedores: [{ nombre: 'Maisa' }],
  movimientos_stock: [],
  registro_operaciones: [],
  ...extra,
});

beforeEach(() => {
  formularios.length = 0;
  filtrosDeFecha.length = 0;
});

describe('ejecutarDia', () => {
  it('nunca consulta con una fecha que no existe (febrero, abril, noviembre…)', async () => {
    for (const fecha of ['2026-03-02', '2026-04-15', '2026-05-04', '2026-07-01', '2026-11-19', '2028-03-01']) {
      const { admin } = fakeAdmin(base());
      await ejecutarDia(admin, 'e', fecha, { hoy: '2029-12-31', simular: true });
    }
    expect(filtrosDeFecha.length).toBeGreaterThan(0);
    for (const f of filtrosDeFecha) {
      const d = new Date(`${f}T12:00:00Z`);
      expect(Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== f, f).toBe(false);
    }
  });

  it('no hace nada si está pausado, antes del inicio o en el futuro', async () => {
    const pausado = fakeAdmin(base({ sabio_soporte_config: [{ activo: true, pausado: true, config: {} }] }));
    expect((await ejecutarDia(pausado.admin, 'e', '2026-03-04', { hoy: '2026-11-19' })).omitido).toBe('PAUSADO');
    const ok = fakeAdmin(base());
    expect((await ejecutarDia(ok.admin, 'e', '2025-12-31', { hoy: '2026-11-19' })).omitido).toBe('ANTES_DEL_INICIO');
    expect((await ejecutarDia(ok.admin, 'e', '2027-01-01', { hoy: '2026-11-19' })).omitido).toBe('FUTURO');
    expect(formularios).toHaveLength(0);
  });

  it('no repite un día ya ejecutado', async () => {
    const { admin } = fakeAdmin(base(), { diaYaReservado: true });
    expect((await ejecutarDia(admin, 'e', '2026-03-04', { hoy: '2026-11-19' })).omitido).toBe('YA_EJECUTADO');
    expect(formularios).toHaveLength(0);
  });

  it('un día hábil sin plata empieza con el aporte de socios y de ahí compra y vende, con operaciones válidas', async () => {
    const { admin, insertados } = fakeAdmin(base(), { counts: { registro_operaciones: 0 } });
    const r = await ejecutarDia(admin, 'e', '2026-01-02', { hoy: '2026-11-19' });
    expect(r.ok).toBeGreaterThanOrEqual(3);
    expect(formularios[0]).toMatchObject({ operacion: 'INVERSION', categoria: 'Aporte de Sócios' });
    for (const f of formularios) {
      expect(f.fecha).toBe('2026-01-02');
      const lineas = f.lineas as Array<{ cantidad: number; monto: number }>;
      expect(lineas.length).toBeGreaterThan(0);
      expect(lineas.every((l) => l.cantidad > 0 && l.monto > 0)).toBe(true);
    }
    // Nada se vende antes de tener stock: la primera venta con producto viene después de una compra.
    const iCompra = formularios.findIndex((f) => f.operacion === 'COMPRA');
    const iVentaProd = formularios.findIndex((f) => f.operacion === 'VENTA' && (f.lineas as Array<{ producto: string }>)[0].producto !== '');
    if (iVentaProd >= 0) expect(iCompra).toBeGreaterThanOrEqual(0), expect(iCompra).toBeLessThan(iVentaProd);
    // Y el día queda anotado.
    expect(insertados.some((x) => x.tabla === 'sabio_soporte_dias')).toBe(true);
    expect(insertados.some((x) => x.tabla === 'sabio_soporte_registro')).toBe(true);
  });

  it('la simulación no carga nada en el motor ni en las tablas de Sabio', async () => {
    const { admin, insertados } = fakeAdmin(base());
    const r = await ejecutarDia(admin, 'e', '2026-01-02', { hoy: '2026-11-19', simular: true });
    expect(r.simulado).toBe(true);
    expect(r.ok).toBeGreaterThan(0);
    expect(formularios).toHaveLength(0);
    expect(insertados).toHaveLength(0);
    expect(r.registro.every((x) => x.tipo === 'INFO')).toBe(true);
  });

  it('el domingo no hay actividad', async () => {
    const { admin } = fakeAdmin(base(), { counts: { registro_operaciones: 5 } });
    const r = await ejecutarDia(admin, 'e', '2026-01-04', { hoy: '2026-11-19' });
    expect(r.ok).toBe(0);
    expect(formularios).toHaveLength(0);
  });

  it('es repetible: la misma semilla y el mismo día arman las mismas operaciones', async () => {
    const a = fakeAdmin(base());
    await ejecutarDia(a.admin, 'e', '2026-02-10', { hoy: '2026-11-19', simular: true });
    const r1 = await ejecutarDia(a.admin, 'e', '2026-02-10', { hoy: '2026-11-19', simular: true });
    const r2 = await ejecutarDia(fakeAdmin(base()).admin, 'e', '2026-02-10', { hoy: '2026-11-19', simular: true });
    expect(r1.registro.map((x) => x.detalle)).toEqual(r2.registro.map((x) => x.detalle));
  });
});
