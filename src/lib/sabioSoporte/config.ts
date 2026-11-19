// lib/sabioSoporte/config.ts
//
// SABIO SOPORTE — plan de crecimiento y palancas de la empresa demo. Todo editable desde Panel Maestro → Sabio Soporte; lo que no se
// toca queda en los valores por defecto de acá. Guardado en sabio_soporte_config.config (jsonb): se mezcla siempre con los defaults, así
// agregar una palanca nueva no rompe lo guardado.

export type Curva = 'COMPUESTA' | 'LINEAL' | 'ESCALONADA' | 'S';

export type GastoFijo = {
  categoria: string; // categoría de PAGO de la matriz (p. ej. «Aluguel»)
  monto: number; // monto del primer mes (después sube con la inflación de costos)
  dia: number; // día del mes en que corresponde pagarlo (si ese día no se pudo, se paga el primero posible)
  medio: string; // forma de pago
  proveedor: string; // a quién se le paga (nombre de un proveedor de la empresa; vacío = ninguno)
  activo: boolean;
};

export type ConfigSabio = {
  semilla: number;
  // Desde cuándo se rellena la historia (primer día). Antes de esta fecha nunca se carga nada.
  inicio: string;
  plan: {
    ventasBaseMensual: number; // ventas del mes de inicio (R$)
    crecimientoMensualPct: number; // % de crecimiento mes a mes
    curva: Curva;
    estacionalidad: number[]; // 12 multiplicadores (enero…diciembre)
    margenBrutoObjetivoPct: number; // solo informativo: contra qué se compara el margen real en el panel
  };
  ritmo: {
    opsMin: number; // operaciones por día hábil
    opsMax: number;
    // Peso de cada día de la semana (domingo…sábado): reparte la meta del mes y la cantidad de operaciones (0 = sin actividad).
    pesoDiaSemana: number[];
    topeDiario: number; // nunca se superan estas operaciones en un día
    // Un día nunca vende más que este múltiplo de lo «normal» (meta del mes repartida): evita recuperar de golpe un mes atrasado con ventas exageradas.
    maxPresupuestoDiarioX: number;
  };
  ventas: {
    mixServiciosPct: number; // % de las ventas (en monto) que son servicios
    ticketServicios: number;
    ticketMaximoProductos: number; // una venta de productos no pasa de este monto (salvo que una sola unidad ya lo supere)
    margenProductosPct: number; // recargo sobre el costo promedio
    variacionPrecioPct: number; // ± de variación aleatoria del precio
    categoriasProducto: string[]; // categorías de producto que se compran y se venden
    medios: Record<string, number>; // peso de cada medio de cobro
  };
  compras: {
    comprasPorSemana: number;
    inflacionCostosMensualPct: number;
    costoBaseCategoria: Record<string, number>; // costo unitario de referencia por categoría (R$)
  };
  gastos: {
    fijos: GastoFijo[];
    variablesPctVentas: number; // % de las ventas que se va en gastos variables
    categoriasVariables: string[];
    impuestoPctVentas: number; // % de las ventas del mes anterior que se paga como impuesto el día 20
    categoriaImpuesto: string;
  };
  capital: {
    aporteInicial: number;
    colchonMinimoCaja: number; // si un medio se queda por debajo de esto, un aporte de socios lo repone
    aporteMinimo: number;
    medioAporte: string;
    retiroSociosPctVentas: number; // % de las ventas del mes que se retira el último día hábil (0 = sin retiros)
  };
  transferencias: {
    efectivoQueSeDepositaPct: number; // del efectivo acumulado por encima del umbral, se deposita este % al banco
    umbralEfectivo: number;
    medioBanco: string;
    medioEfectivo: string;
  };
};

export const MEDIOS_PLATA = ['Banco', 'Dinheiro', 'Carteira Digital'];

export const CONFIG_POR_DEFECTO: ConfigSabio = {
  semilla: 2026,
  inicio: '2026-01-01',
  plan: {
    ventasBaseMensual: 8000,
    crecimientoMensualPct: 10,
    curva: 'COMPUESTA',
    // Más ventas en el fin de año (Black Friday, Natal) y en el día de las madres; enero y febrero flojos.
    estacionalidad: [0.9, 0.9, 1, 1, 1.12, 1, 1, 1.02, 1.05, 1.08, 1.2, 1.35],
    margenBrutoObjetivoPct: 38,
  },
  ritmo: { opsMin: 4, opsMax: 6, pesoDiaSemana: [0, 1, 1, 1, 1, 1.25, 0.6], topeDiario: 9, maxPresupuestoDiarioX: 1.6 },
  ventas: {
    mixServiciosPct: 25,
    ticketServicios: 380,
    ticketMaximoProductos: 700,
    margenProductosPct: 45,
    variacionPrecioPct: 8,
    categoriasProducto: ['Calçados', 'Perfumaria', 'Roupas', 'Eletrônicos', 'Madeireira'],
    medios: { Banco: 40, Dinheiro: 25, 'Carteira Digital': 35 },
  },
  compras: {
    comprasPorSemana: 2,
    inflacionCostosMensualPct: 1,
    costoBaseCategoria: { Calçados: 95, Perfumaria: 70, Roupas: 60, Eletrônicos: 140, Madeireira: 85 },
  },
  gastos: {
    fijos: [
      { categoria: 'Aluguel', monto: 1800, dia: 5, medio: 'Banco', proveedor: 'CS Imoveis', activo: true },
      { categoria: 'Salários Administrativos', monto: 2500, dia: 5, medio: 'Banco', proveedor: '', activo: true },
      { categoria: 'Sistemas e Software', monto: 150, dia: 8, medio: 'Banco', proveedor: '', activo: true },
      { categoria: 'Internet', monto: 120, dia: 10, medio: 'Banco', proveedor: '', activo: true },
      { categoria: 'Energia Elétrica', monto: 210, dia: 12, medio: 'Banco', proveedor: '', activo: true },
      { categoria: 'Água', monto: 65, dia: 12, medio: 'Banco', proveedor: 'Casan', activo: true },
      { categoria: 'Serviços Contábeis', monto: 380, dia: 15, medio: 'Banco', proveedor: '', activo: true },
    ],
    variablesPctVentas: 5,
    categoriasVariables: ['Marketing e Publicidade', 'Fretes e Entregas', 'Material de Escritório', 'Limpeza'],
    impuestoPctVentas: 6,
    categoriaImpuesto: 'Simples Nacional / MEI',
  },
  capital: { aporteInicial: 25000, colchonMinimoCaja: 2500, aporteMinimo: 3000, medioAporte: 'Banco', retiroSociosPctVentas: 0 },
  transferencias: { efectivoQueSeDepositaPct: 70, umbralEfectivo: 1500, medioBanco: 'Banco', medioEfectivo: 'Dinheiro' },
};

function mezclar<T>(base: T, cambios: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(cambios) ? cambios : base) as T;
  if (base && typeof base === 'object') {
    const salida: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    if (cambios && typeof cambios === 'object' && !Array.isArray(cambios)) {
      for (const [k, v] of Object.entries(cambios as Record<string, unknown>)) {
        if (k in salida) salida[k] = mezclar(salida[k], v);
      }
    }
    return salida as T;
  }
  return (typeof cambios === typeof base && cambios !== null && !Number.isNaN(cambios as number) ? cambios : base) as T;
}

// Lo guardado manda; lo que falte sale de los valores por defecto.
export function configCompleta(guardada: unknown): ConfigSabio {
  return mezclar(CONFIG_POR_DEFECTO, guardada);
}

// Rechaza lo que rompería la ejecución (no corrige en silencio): devuelve el primer problema o null.
export function validarConfig(c: ConfigSabio): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.inicio)) return 'La fecha de inicio tiene que ser AAAA-MM-DD.';
  if (!(c.plan.ventasBaseMensual > 0)) return 'Las ventas base del mes tienen que ser mayores a 0.';
  if (c.plan.crecimientoMensualPct < -50 || c.plan.crecimientoMensualPct > 100) return 'El crecimiento mensual tiene que estar entre −50 % y 100 %.';
  if (c.plan.estacionalidad.length !== 12 || c.plan.estacionalidad.some((x) => !(x > 0))) return 'La estacionalidad necesita 12 multiplicadores mayores a 0.';
  if (c.ritmo.opsMin < 0 || c.ritmo.opsMax < c.ritmo.opsMin) return 'Las operaciones por día: el máximo no puede ser menor que el mínimo.';
  if (c.ritmo.topeDiario < c.ritmo.opsMax) return 'El tope diario no puede ser menor que el máximo de operaciones por día.';
  if (c.ritmo.pesoDiaSemana.length !== 7 || c.ritmo.pesoDiaSemana.every((x) => !(x > 0))) return 'Algún día de la semana tiene que tener actividad.';
  if (c.ritmo.maxPresupuestoDiarioX < 1) return 'El tope de presupuesto diario tiene que ser 1 o más (múltiplo de lo normal).';
  if (c.ventas.ticketMaximoProductos <= 0) return 'El ticket máximo de productos tiene que ser mayor a 0.';
  if (c.ventas.mixServiciosPct < 0 || c.ventas.mixServiciosPct > 100) return 'El mix de servicios va de 0 a 100 %.';
  if (c.ventas.margenProductosPct < 0) return 'El margen de productos no puede ser negativo.';
  if (c.ventas.categoriasProducto.length === 0) return 'Hace falta al menos una categoría de producto.';
  if (Object.values(c.ventas.medios).every((x) => !(x > 0))) return 'Algún medio de cobro tiene que tener peso.';
  if (c.gastos.fijos.some((g) => g.dia < 1 || g.dia > 28)) return 'El día de un gasto fijo tiene que ir de 1 a 28.';
  return null;
}
