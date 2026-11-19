import { describe, expect, it } from 'vitest';
import { CONFIG_POR_DEFECTO, configCompleta, validarConfig, type ConfigSabio } from './config';
import { metaVentasMes, presupuestoVentasDia, diasDelMes, factorInflacion } from './plan';
import { crearRng, semillaDelDia } from './rng';
import { planificarDia, precioDeVenta, resolverCompra, resolverVentaProducto, type EntradaDia, type ProductoEstado } from './agenda';

const base: ConfigSabio = { ...CONFIG_POR_DEFECTO, plan: { ...CONFIG_POR_DEFECTO.plan, estacionalidad: Array(12).fill(1) } };

describe('configCompleta / validarConfig', () => {
  it('mezcla lo guardado con los valores por defecto', () => {
    const c = configCompleta({ plan: { crecimientoMensualPct: 15 }, ritmo: { opsMax: 7 }, inventada: 1 });
    expect(c.plan.crecimientoMensualPct).toBe(15);
    expect(c.plan.ventasBaseMensual).toBe(8000);
    expect(c.ritmo.opsMax).toBe(7);
    expect(c.ritmo.opsMin).toBe(4);
    expect('inventada' in c).toBe(false);
  });
  it('ignora valores del tipo equivocado', () => {
    expect(configCompleta({ plan: { ventasBaseMensual: 'mucho' } }).plan.ventasBaseMensual).toBe(8000);
  });
  it('rechaza configuraciones que romperían la ejecución', () => {
    expect(validarConfig(CONFIG_POR_DEFECTO)).toBeNull();
    expect(validarConfig({ ...CONFIG_POR_DEFECTO, ritmo: { ...CONFIG_POR_DEFECTO.ritmo, opsMin: 7, opsMax: 5 } })).toContain('máximo');
    expect(validarConfig({ ...CONFIG_POR_DEFECTO, plan: { ...CONFIG_POR_DEFECTO.plan, ventasBaseMensual: 0 } })).toContain('ventas');
    expect(validarConfig({ ...CONFIG_POR_DEFECTO, inicio: '1/1/2026' })).toContain('inicio');
  });
});

describe('plan de crecimiento', () => {
  it('crece 10 % por mes (curva compuesta) desde el mes de inicio', () => {
    expect(metaVentasMes(base, '2026-01')).toBe(8000);
    expect(metaVentasMes(base, '2026-02')).toBe(8800);
    expect(metaVentasMes(base, '2026-03')).toBe(9680);
  });
  it('la curva lineal suma siempre lo mismo y la escalonada sube de a trimestre', () => {
    const lineal = { ...base, plan: { ...base.plan, curva: 'LINEAL' as const } };
    expect(metaVentasMes(lineal, '2026-03')).toBe(9600);
    const esc = { ...base, plan: { ...base.plan, curva: 'ESCALONADA' as const } };
    expect(metaVentasMes(esc, '2026-03')).toBe(8000);
    expect(metaVentasMes(esc, '2026-04')).toBe(10648);
  });
  it('aplica la estacionalidad del mes', () => {
    const c = { ...base, plan: { ...base.plan, estacionalidad: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5] } };
    expect(metaVentasMes(c, '2026-12')).toBe(Math.round(8000 * Math.pow(1.1, 11) * 1.5 * 100) / 100);
  });
  it('el presupuesto del día corrige el atraso del mes y nunca es negativo', () => {
    const atrasado = presupuestoVentasDia(base, '2026-01-12', 0);
    const alDia = presupuestoVentasDia(base, '2026-01-12', 3000);
    expect(atrasado).toBeGreaterThan(alDia);
    expect(presupuestoVentasDia(base, '2026-01-12', 99999)).toBe(0);
    expect(presupuestoVentasDia(base, '2026-01-11', 0)).toBe(0); // domingo
  });
  it('repartir el mes día por día suma la meta', () => {
    let vendido = 0;
    for (const d of diasDelMes('2026-02')) vendido += presupuestoVentasDia(base, d, vendido);
    expect(Math.round(vendido)).toBe(8800);
  });
  it('la inflación de costos se acumula mes a mes', () => {
    expect(factorInflacion(base, '2026-01-20')).toBe(1);
    expect(factorInflacion(base, '2026-03-02')).toBeCloseTo(1.0201, 4);
  });
});

const entrada = (extra: Partial<EntradaDia> = {}, fecha = '2026-03-04'): EntradaDia => ({
  config: base,
  fecha,
  rng: crearRng(semillaDelDia(1, fecha)),
  presupuestoVentas: 400,
  fijosPendientes: [],
  impuestoPendiente: null,
  retiroPendiente: null,
  aporteInicialPendiente: false,
  opsExistentesHoy: 0,
  ...extra,
});

describe('planificarDia', () => {
  it('es repetible: mismo día y semilla, misma agenda', () => {
    expect(planificarDia(entrada())).toEqual(planificarDia(entrada()));
  });
  it('un día hábil tiene entre 4 y 6 operaciones y respeta el tope', () => {
    for (let d = 1; d <= 28; d++) {
      const fecha = `2026-04-${String(d).padStart(2, '0')}`;
      const n = planificarDia(entrada({ presupuestoVentas: 800 }, fecha)).length;
      const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay();
      if (dow === 0) expect(n).toBe(0);
      else expect(n).toBeLessThanOrEqual(base.ritmo.topeDiario);
    }
  });
  it('el domingo no hay actividad', () => {
    expect(planificarDia(entrada({}, '2026-03-08'))).toEqual([]);
  });
  it('primero entra plata y después se paga: el aporte inicial va antes que los gastos fijos', () => {
    const r = planificarDia(entrada({ aporteInicialPendiente: true, fijosPendientes: [base.gastos.fijos[0]] }));
    expect(r[0].tipo).toBe('APORTE');
    expect(r[1].tipo).toBe('PAGO_FIJO');
  });
  it('los gastos fijos pendientes siempre se incluyen, ajustados por inflación', () => {
    const r = planificarDia(entrada({ fijosPendientes: [base.gastos.fijos[0]] }, '2026-05-06'));
    const fijo = r.find((x) => x.tipo === 'PAGO_FIJO');
    expect(fijo && fijo.tipo === 'PAGO_FIJO' ? fijo.monto : 0).toBeCloseTo(1800 * Math.pow(1.01, 4), -1);
  });
  it('sin presupuesto de ventas no hay ventas; con operaciones ya cargadas se descuentan', () => {
    expect(planificarDia(entrada({ presupuestoVentas: 0 })).some((x) => x.tipo.startsWith('VENTA'))).toBe(false);
    const sinExtra = planificarDia(entrada()).length;
    expect(planificarDia(entrada({ opsExistentesHoy: 3 })).length).toBeLessThanOrEqual(sinExtra);
  });
});

const productos: ProductoEstado[] = [
  { id: 'a', nombre: 'Bota', categoria: 'Calçados', cantidad: 10, costoMedio: 100 },
  { id: 'b', nombre: 'Sandália', categoria: 'Calçados', cantidad: 3, costoMedio: 60 },
  { id: 'c', nombre: 'Auto', categoria: 'Automóveis', cantidad: 1, costoMedio: 40000 },
  { id: 'd', nombre: 'Agotado', categoria: 'Roupas', cantidad: 0, costoMedio: 30 },
];

describe('resolverVentaProducto', () => {
  it('nunca vende por debajo del costo, sin pasarse del stock ni fuera de las categorías permitidas', () => {
    for (let i = 0; i < 200; i++) {
      const r = resolverVentaProducto(300, productos, base, crearRng(i));
      expect(r).not.toBeNull();
      expect(r!.categoria).toBe('Calçados');
      for (const l of r!.lineas) {
        const p = productos.find((x) => x.id === l.producto)!;
        expect(l.precio).toBeGreaterThan(p.costoMedio);
        expect(l.cantidad).toBeLessThanOrEqual(p.cantidad);
        expect(l.cantidad).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it('sin stock vendible devuelve null', () => {
    expect(resolverVentaProducto(300, productos.filter((p) => p.cantidad === 0), base, crearRng(1))).toBeNull();
  });
  it('el precio incluye el recargo configurado', () => {
    const sinVariacion = { ...base, ventas: { ...base.ventas, variacionPrecioPct: 0 } };
    expect(precioDeVenta(100, sinVariacion, crearRng(1))).toBe(145);
  });
});

describe('resolverCompra', () => {
  const catalogo = [
    { id: 'a', nombre: 'Bota', categoria: 'Calçados' },
    { id: 'b', nombre: 'Sandália', categoria: 'Calçados' },
    { id: 'p', nombre: 'Perfume', categoria: 'Perfumaria' },
  ];
  it('compra una sola categoría y un mínimo de 2 unidades por línea', () => {
    for (let i = 0; i < 50; i++) {
      const r = resolverCompra(1500, catalogo, base, crearRng(i), '2026-03-02')!;
      expect(new Set(r.lineas.map((l) => catalogo.find((p) => p.id === l.producto)!.categoria)).size).toBe(1);
      expect(r.lineas.every((l) => l.cantidad >= 2 && l.costo > 0)).toBe(true);
    }
  });
  it('sin productos de las categorías permitidas devuelve null', () => {
    expect(resolverCompra(1000, [{ id: 'x', nombre: 'Auto', categoria: 'Automóveis' }], base, crearRng(1), '2026-03-02')).toBeNull();
  });
});
