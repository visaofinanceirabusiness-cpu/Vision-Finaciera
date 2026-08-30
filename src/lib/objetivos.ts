// lib/objetivos.ts
//
// MOTOR DE OBJETIVOS
// =====================================================
//
// Los objetivos ya no son "una fila por mes" — son una DEFINICIÓN
// permanente (empresa_id + categoría + indicador + meta) que se
// calcula en vivo contra el período que el usuario tenga elegido en
// Panel de Control, reutilizando los mismos datos contables que ya
// usa `obtenerIndicadores` en lib/contabilidad.ts.
//
// Cuatro categorías: CONTABLE, MERCADERIA, FINANCIERO y MARKETING
// (esta última todavía sin indicadores calculables — es la puerta
// que se deja abierta para conectar Instagram/WhatsApp más
// adelante; por ahora CATALOGO_INDICADORES no tiene ninguno de esa
// categoría a propósito).

import { supabase } from './supabase';
import { obtenerIndicadores } from './contabilidad';

export type CategoriaObjetivo = 'CONTABLE' | 'MERCADERIA' | 'FINANCIERO' | 'MARKETING';

export type IndicadorCodigo =
  | 'CAJA_MINIMA'
  | 'VENTAS_10PCT'
  | 'GASTOS_CONTROLADOS'
  | 'STOCK_ESTANCADO'
  | 'VALOR_INVENTARIO'
  | 'COMPRAS_CONTROLADAS'
  | 'RENTABILIDAD'
  | 'LIQUIDEZ'
  | 'ROE';

export type ObjetivoDefinicion = {
  id: string;
  categoria: CategoriaObjetivo;
  indicador: IndicadorCodigo;
  nombre: string;
  objetivo: number;
  unidad: string;
  activo: boolean;
  orden: number;
};

export type ObjetivoCalculado = ObjetivoDefinicion & {
  resultado: number;
  metaResuelta: number;
  porcentaje: number;
  cumplido: boolean;
  aplica: boolean;
};

type InfoIndicador = {
  categoria: CategoriaObjetivo;
  nombreDefault: string;
  unidadDefault: string;
  objetivoDefault: number;
  ayuda: string;
  // Para indicadores donde MENOS es mejor (gastos, compras, productos
  // estancados) — cambia cómo se calcula el % de cumplimiento.
  inverso: boolean;
};

export const CATALOGO_INDICADORES: Record<IndicadorCodigo, InfoIndicador> = {
  CAJA_MINIMA: {
    categoria: 'CONTABLE',
    nombreDefault: 'Saldo en Caja',
    unidadDefault: 'R$',
    objetivoDefault: 1000,
    ayuda: 'Mantener al menos este saldo disponible en Caja/Banco/PIX.',
    inverso: false,
  },
  VENTAS_10PCT: {
    categoria: 'CONTABLE',
    nombreDefault: 'Ventas +10%',
    unidadDefault: '%',
    objetivoDefault: 10,
    ayuda: 'Vender al menos este % más que el mes anterior.',
    inverso: false,
  },
  GASTOS_CONTROLADOS: {
    categoria: 'CONTABLE',
    nombreDefault: 'Gastos Controlados',
    unidadDefault: 'R$',
    objetivoDefault: 0,
    ayuda: 'No gastar más que el mes anterior.',
    inverso: true,
  },
  STOCK_ESTANCADO: {
    categoria: 'MERCADERIA',
    nombreDefault: 'Productos Estancados',
    unidadDefault: 'días',
    objetivoDefault: 30,
    ayuda: 'Productos con saldo que no tuvieron movimiento hace más de este número de días (30/60/120).',
    inverso: true,
  },
  VALOR_INVENTARIO: {
    categoria: 'MERCADERIA',
    nombreDefault: 'Valor de Inventario',
    unidadDefault: 'R$',
    objetivoDefault: 1000,
    ayuda: 'Mantener al menos este valor de mercadería en stock.',
    inverso: false,
  },
  COMPRAS_CONTROLADAS: {
    categoria: 'MERCADERIA',
    nombreDefault: 'Compras Controladas',
    unidadDefault: 'R$',
    objetivoDefault: 500,
    ayuda: 'No comprar más que este monto en el mes.',
    inverso: true,
  },
  RENTABILIDAD: {
    categoria: 'FINANCIERO',
    nombreDefault: 'Rentabilidad',
    unidadDefault: '%',
    objetivoDefault: 10,
    ayuda: 'Lucro sobre los ingresos del período.',
    inverso: false,
  },
  LIQUIDEZ: {
    categoria: 'FINANCIERO',
    nombreDefault: 'Liquidez',
    unidadDefault: 'veces',
    objetivoDefault: 1.5,
    ayuda: 'Activo corriente sobre pasivo corriente.',
    inverso: false,
  },
  ROE: {
    categoria: 'FINANCIERO',
    nombreDefault: 'Retorno sobre el Patrimonio',
    unidadDefault: '%',
    objetivoDefault: 5,
    ayuda: 'Lucro del período sobre el Patrimonio total.',
    inverso: false,
  },
};

function rangoDelPeriodo(periodo: string): { desde: string; hasta: string } | null {
  if (!periodo || periodo === 'TODOS') {
    return null;
  }

  const [anio, mes] = periodo.split('-').map(Number);

  if (!anio || !mes) {
    return null;
  }

  const ultimoDia = new Date(anio, mes, 0).getDate();

  return {
    desde: `${periodo.slice(0, 7)}-01`,
    hasta: `${periodo.slice(0, 7)}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

function periodoAnteriorDe(periodo: string): string | null {
  if (!periodo || periodo === 'TODOS') {
    return null;
  }

  const [anio, mes] = periodo.split('-').map(Number);

  if (!anio || !mes) {
    return null;
  }

  const fecha = new Date(anio, mes - 2, 1);

  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
}

async function obtenerDiasSinMovimientoPorProducto(empresaId: string): Promise<Map<string, number>> {
  const [{ data: saldos }, { data: movimientos }] = await Promise.all([
    supabase.from('saldo_stock').select('producto_id, saldo').eq('empresa_id', empresaId),
    supabase.from('movimientos_stock').select('producto_id, fecha').eq('empresa_id', empresaId),
  ]);

  const ultimaFechaPorProducto = new Map<string, string>();

  for (const m of movimientos ?? []) {
    const actual = ultimaFechaPorProducto.get(m.producto_id);
    if (!actual || m.fecha > actual) {
      ultimaFechaPorProducto.set(m.producto_id, m.fecha);
    }
  }

  const hoy = new Date();
  const dias = new Map<string, number>();

  for (const s of saldos ?? []) {
    if (Number(s.saldo) <= 0) continue;

    const ultima = ultimaFechaPorProducto.get(s.producto_id);
    if (!ultima) continue;

    const diferenciaMs = hoy.getTime() - new Date(`${ultima}T12:00:00`).getTime();
    dias.set(s.producto_id, Math.floor(diferenciaMs / (1000 * 60 * 60 * 24)));
  }

  return dias;
}

async function obtenerValorInventario(empresaId: string): Promise<number> {
  const [{ data: saldos }, { data: entradas }] = await Promise.all([
    supabase.from('saldo_stock').select('producto_id, saldo').eq('empresa_id', empresaId),
    supabase
      .from('movimientos_stock')
      .select('producto_id, cantidad, costo_unitario')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'ENTRADA'),
  ]);

  const costoPorProducto = new Map<string, { cantidad: number; valor: number }>();

  for (const e of entradas ?? []) {
    const actual = costoPorProducto.get(e.producto_id) ?? { cantidad: 0, valor: 0 };
    actual.cantidad += Number(e.cantidad ?? 0);
    actual.valor += Number(e.cantidad ?? 0) * Number(e.costo_unitario ?? 0);
    costoPorProducto.set(e.producto_id, actual);
  }

  let total = 0;

  for (const s of saldos ?? []) {
    const costo = costoPorProducto.get(s.producto_id);
    const costoPromedio = costo && costo.cantidad > 0 ? costo.valor / costo.cantidad : 0;
    total += Number(s.saldo ?? 0) * costoPromedio;
  }

  return total;
}

async function obtenerComprasDelPeriodo(empresaId: string, periodo: string): Promise<number> {
  const rango = rangoDelPeriodo(periodo);

  let consulta = supabase
    .from('registro_operaciones')
    .select('total')
    .eq('empresa_id', empresaId)
    .eq('operacion', 'COMPRA');

  if (rango) {
    consulta = consulta.gte('fecha', rango.desde).lte('fecha', rango.hasta);
  }

  const { data } = await consulta;

  return (data ?? []).reduce((suma, fila) => suma + Number(fila.total ?? 0), 0);
}

export async function obtenerDefiniciones(empresaId: string): Promise<ObjetivoDefinicion[]> {
  const { data, error } = await supabase
    .from('objetivos_empresa')
    .select('id, categoria, indicador, nombre, objetivo, unidad, activo, orden')
    .eq('empresa_id', empresaId)
    .order('categoria', { ascending: true })
    .order('orden', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ObjetivoDefinicion[];
}

export async function calcularObjetivos(
  empresaId: string,
  periodo: string,
  definiciones: ObjetivoDefinicion[]
): Promise<ObjetivoCalculado[]> {
  const activas = definiciones.filter((d) => d.activo);

  if (activas.length === 0) {
    return [];
  }

  const codigos = new Set(activas.map((d) => d.indicador));
  const periodoAnterior = periodoAnteriorDe(periodo);

  const [indicadoresActuales, indicadoresAnteriores, diasSinMovimiento, valorInventario, comprasDelMes] =
    await Promise.all([
      obtenerIndicadores(empresaId, periodo),
      codigos.has('VENTAS_10PCT') || codigos.has('GASTOS_CONTROLADOS')
        ? periodoAnterior
          ? obtenerIndicadores(empresaId, periodoAnterior)
          : Promise.resolve(null)
        : Promise.resolve(null),
      codigos.has('STOCK_ESTANCADO') ? obtenerDiasSinMovimientoPorProducto(empresaId) : Promise.resolve(null),
      codigos.has('VALOR_INVENTARIO') ? obtenerValorInventario(empresaId) : Promise.resolve(0),
      codigos.has('COMPRAS_CONTROLADAS') ? obtenerComprasDelPeriodo(empresaId, periodo) : Promise.resolve(0),
    ]);

  return activas.map((def) => {
    let resultado = 0;
    let metaResuelta = def.objetivo;
    let aplica = true;

    switch (def.indicador) {
      case 'CAJA_MINIMA':
        resultado = indicadoresActuales.cajaDisponible;
        break;

      case 'VENTAS_10PCT':
        if (indicadoresAnteriores) {
          metaResuelta = indicadoresAnteriores.ingresos * (1 + def.objetivo / 100);
          resultado = indicadoresActuales.ingresos;
        } else {
          aplica = false;
        }
        break;

      case 'GASTOS_CONTROLADOS':
        if (indicadoresAnteriores) {
          metaResuelta = indicadoresAnteriores.gastos;
          resultado = indicadoresActuales.gastos;
        } else {
          aplica = false;
        }
        break;

      case 'STOCK_ESTANCADO': {
        const umbral = def.objetivo;
        let cantidad = 0;
        (diasSinMovimiento ?? new Map()).forEach((dias) => {
          if (dias >= umbral) cantidad += 1;
        });
        resultado = cantidad;
        metaResuelta = 0;
        break;
      }

      case 'VALOR_INVENTARIO':
        resultado = valorInventario;
        break;

      case 'COMPRAS_CONTROLADAS':
        resultado = comprasDelMes;
        break;

      case 'RENTABILIDAD':
        resultado = indicadoresActuales.rentabilidad;
        break;

      case 'LIQUIDEZ':
        resultado = indicadoresActuales.liquidez;
        break;

      case 'ROE':
        resultado = indicadoresActuales.patrimonio > 0 ? (indicadoresActuales.lucro / indicadoresActuales.patrimonio) * 100 : 0;
        break;

      default:
        aplica = false;
    }

    const info = CATALOGO_INDICADORES[def.indicador];

    let porcentaje = 0;

    if (aplica) {
      if (info.inverso) {
        porcentaje = metaResuelta > 0 ? Math.min(100, (metaResuelta / Math.max(resultado, 0.01)) * 100) : resultado <= 0 ? 100 : 0;
      } else {
        porcentaje = metaResuelta > 0 ? Math.min(100, Math.max(0, (resultado / metaResuelta) * 100)) : 0;
      }
    }

    const cumplido = aplica && (info.inverso ? resultado <= metaResuelta : resultado >= metaResuelta);

    return {
      ...def,
      resultado: Number(resultado.toFixed(2)),
      metaResuelta: Number(metaResuelta.toFixed(2)),
      porcentaje: Number(porcentaje.toFixed(2)),
      cumplido,
      aplica,
    };
  });
}

// =====================================================
// CRUD (admin, desde CONFIGURAÇÕES → Objetivos)
// =====================================================

export async function crearObjetivo(
  empresaId: string,
  datos: { categoria: CategoriaObjetivo; indicador: IndicadorCodigo; nombre: string; objetivo: number; unidad: string; orden: number }
) {
  const { error } = await supabase.from('objetivos_empresa').insert({
    empresa_id: empresaId,
    categoria: datos.categoria,
    indicador: datos.indicador,
    nombre: datos.nombre,
    objetivo: datos.objetivo,
    unidad: datos.unidad,
    orden: datos.orden,
    activo: true,
  });

  if (error) {
    throw error;
  }
}

export async function actualizarObjetivo(
  id: string,
  datos: { nombre: string; objetivo: number; unidad: string }
) {
  const { error } = await supabase
    .from('objetivos_empresa')
    .update({ nombre: datos.nombre, objetivo: datos.objetivo, unidad: datos.unidad })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function cambiarActivoObjetivo(id: string, activo: boolean) {
  const { error } = await supabase.from('objetivos_empresa').update({ activo }).eq('id', id);
  if (error) throw error;
}

export async function eliminarObjetivo(id: string) {
  const { error } = await supabase.from('objetivos_empresa').delete().eq('id', id);
  if (error) throw error;
}

// Los 9 objetivos "modelo" que arrancan activados para cualquier
// empresa nueva. El admin después puede editarlos, desactivarlos,
// borrarlos o agregar otros — esto es solo el punto de partida.
export async function crearObjetivosModelo(empresaId: string) {
  const modelo: { categoria: CategoriaObjetivo; indicador: IndicadorCodigo; orden: number }[] = [
    { categoria: 'CONTABLE', indicador: 'CAJA_MINIMA', orden: 1 },
    { categoria: 'CONTABLE', indicador: 'VENTAS_10PCT', orden: 2 },
    { categoria: 'CONTABLE', indicador: 'GASTOS_CONTROLADOS', orden: 3 },
    { categoria: 'MERCADERIA', indicador: 'STOCK_ESTANCADO', orden: 1 },
    { categoria: 'MERCADERIA', indicador: 'VALOR_INVENTARIO', orden: 2 },
    { categoria: 'MERCADERIA', indicador: 'COMPRAS_CONTROLADAS', orden: 3 },
    { categoria: 'FINANCIERO', indicador: 'RENTABILIDAD', orden: 1 },
    { categoria: 'FINANCIERO', indicador: 'LIQUIDEZ', orden: 2 },
    { categoria: 'FINANCIERO', indicador: 'ROE', orden: 3 },
  ];

  const filas = modelo.map((m) => ({
    empresa_id: empresaId,
    categoria: m.categoria,
    indicador: m.indicador,
    nombre: CATALOGO_INDICADORES[m.indicador].nombreDefault,
    objetivo: CATALOGO_INDICADORES[m.indicador].objetivoDefault,
    unidad: CATALOGO_INDICADORES[m.indicador].unidadDefault,
    orden: m.orden,
    activo: true,
  }));

  const { error } = await supabase.from('objetivos_empresa').insert(filas);

  if (error) {
    throw error;
  }
}
