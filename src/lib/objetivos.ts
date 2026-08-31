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

export type CategoriaObjetivo = 'CONTABLE' | 'MERCADERIA' | 'FINANCIERO' | 'MARKETING' | 'ACTIVIDAD' | 'METAS';

export type IndicadorCodigo =
  | 'CAJA_MINIMA'
  | 'VENTAS_10PCT'
  | 'GASTOS_CONTROLADOS'
  | 'STOCK_ESTANCADO'
  | 'VALOR_INVENTARIO'
  | 'COMPRAS_CONTROLADAS'
  | 'RENTABILIDAD'
  | 'VOLUMEN_VENTAS'
  | 'FONDO_EMERGENCIA'
  | 'PRIMERAS_VENTAS'
  | 'PRIMEROS_INGRESOS'
  | 'PRIMEROS_GASTOS'
  | 'PRIMEROS_CLIENTES'
  | 'PRIMEROS_PROVEEDORES'
  | 'META_AHORRO_LIBRE';

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
    ayuda: 'Que los gastos del período no superen lo que ingresó a Caja en ese mismo período — así evitás quedarte con flujo de caja negativo.',
    inverso: true,
  },
  STOCK_ESTANCADO: {
    categoria: 'MERCADERIA',
    nombreDefault: 'Productos Estancados',
    unidadDefault: 'R$',
    objetivoDefault: 0,
    ayuda: 'Valor en R$ de la mercadería con más de 90 días sin moverse. Cumplido cuando no hay nada estancado — si aparece un valor, conviene liquidar esos productos (promoción, descuento) antes de que sigan sumando.',
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
  VOLUMEN_VENTAS: {
    categoria: 'FINANCIERO',
    nombreDefault: 'Volumen de Ventas',
    unidadDefault: 'R$',
    objetivoDefault: 2000,
    ayuda: 'Alcanzar al menos este monto de ventas en el período.',
    inverso: false,
  },
  FONDO_EMERGENCIA: {
    categoria: 'FINANCIERO',
    nombreDefault: 'Fondo de Emergencia',
    unidadDefault: 'R$',
    objetivoDefault: 2000,
    ayuda: 'Tener siempre disponible al menos este monto en Caja/Banco, aparte de lo que necesitás para operar — un colchón para un mes flojo o un imprevisto.',
    inverso: false,
  },
  PRIMERAS_VENTAS: {
    categoria: 'ACTIVIDAD',
    nombreDefault: 'Primeras Ventas',
    unidadDefault: 'unidades',
    objetivoDefault: 5,
    ayuda: 'Registrá tus primeras 5 ventas para empezar a ver el sistema funcionando con tus propios datos.',
    inverso: false,
  },
  PRIMEROS_INGRESOS: {
    categoria: 'ACTIVIDAD',
    nombreDefault: 'Primeros Ingresos',
    unidadDefault: 'unidades',
    objetivoDefault: 5,
    ayuda: 'Registrá tus primeros 5 ingresos.',
    inverso: false,
  },
  PRIMEROS_GASTOS: {
    categoria: 'ACTIVIDAD',
    nombreDefault: 'Primeros Gastos',
    unidadDefault: 'unidades',
    objetivoDefault: 5,
    ayuda: 'Registrá tus primeros 5 gastos.',
    inverso: false,
  },
  PRIMEROS_CLIENTES: {
    categoria: 'ACTIVIDAD',
    nombreDefault: 'Primeros Clientes',
    unidadDefault: 'unidades',
    objetivoDefault: 5,
    ayuda: 'Cargá tus primeros 5 contactos en Recursos Humanos.',
    inverso: false,
  },
  PRIMEROS_PROVEEDORES: {
    categoria: 'ACTIVIDAD',
    nombreDefault: 'Primeros Proveedores',
    unidadDefault: 'unidades',
    objetivoDefault: 5,
    ayuda: 'Cargá tus primeros 5 proveedores en Recursos Humanos.',
    inverso: false,
  },
  META_AHORRO_LIBRE: {
    categoria: 'METAS',
    nombreDefault: 'Meta de Ahorro',
    unidadDefault: 'R$',
    objetivoDefault: 0,
    ayuda: 'Vos elegís el monto que necesitás juntar. Se mide contra lo acumulado en Plazo Fijo + Inversiones — cada vez que guardes plata para esta meta, registrá una operación de Transferencia hacia esa cuenta en Contabilidad. Si no registrás la transferencia, el progreso no se actualiza.',
    inverso: false,
  },
};

// Renombres amigables por perfil — el catálogo de arriba define el
// dato y el cálculo (una sola vez, sin duplicar el motor), pero el
// TEXTO que ve cada usuario puede cambiar según su perfil. Por ahora
// solo Familia tiene renombres propios; el resto usa nombreDefault.
const NOMBRES_POR_PERFIL: Partial<Record<string, Partial<Record<IndicadorCodigo, string>>>> = {
  FAMILIAR: {
    CAJA_MINIMA: 'Dinero Mínimo Disponible',
    VENTAS_10PCT: 'Ingresos +10%',
    RENTABILIDAD: 'Tasa de Ahorro',
    VOLUMEN_VENTAS: 'Volumen de Ingresos',
    FONDO_EMERGENCIA: 'Fondo de Respaldo',
    PRIMEROS_INGRESOS: 'Primeros Ingresos Registrados',
    PRIMEROS_GASTOS: 'Primeros Gastos Registrados',
    PRIMEROS_CLIENTES: 'Fuentes de Ingreso Cargadas',
    PRIMEROS_PROVEEDORES: 'Destinos de Pago Cargados',
  },
};

function nombrePorPerfil(indicador: IndicadorCodigo, perfilCodigo: string | undefined): string {
  const renombre = perfilCodigo ? NOMBRES_POR_PERFIL[perfilCodigo]?.[indicador] : undefined;
  return renombre ?? CATALOGO_INDICADORES[indicador].nombreDefault;
}

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

// Umbral fijo: a partir de 90 días sin movimiento, un producto con
// saldo se considera "estancado" (plata inmovilizada que conviene
// liquidar). No es configurable por objetivo — es una convención.
const DIAS_ESTANCAMIENTO = 90;

type ItemInventario = {
  productoId: string;
  saldo: number;
  costoPromedio: number;
  diasSinMovimiento: number | null;
};

async function obtenerInventarioConAntiguedad(empresaId: string): Promise<ItemInventario[]> {
  const [{ data: saldos }, { data: movimientos }] = await Promise.all([
    supabase.from('saldo_stock').select('producto_id, saldo').eq('empresa_id', empresaId),
    supabase
      .from('movimientos_stock')
      .select('producto_id, fecha, tipo, cantidad, costo_unitario')
      .eq('empresa_id', empresaId),
  ]);

  const ultimaFechaPorProducto = new Map<string, string>();
  const costoPorProducto = new Map<string, { cantidad: number; valor: number }>();

  for (const m of movimientos ?? []) {
    const fechaActual = ultimaFechaPorProducto.get(m.producto_id);
    if (!fechaActual || m.fecha > fechaActual) {
      ultimaFechaPorProducto.set(m.producto_id, m.fecha);
    }

    if (m.tipo === 'ENTRADA') {
      const actual = costoPorProducto.get(m.producto_id) ?? { cantidad: 0, valor: 0 };
      actual.cantidad += Number(m.cantidad ?? 0);
      actual.valor += Number(m.cantidad ?? 0) * Number(m.costo_unitario ?? 0);
      costoPorProducto.set(m.producto_id, actual);
    }
  }

  const hoy = new Date();

  return (saldos ?? []).map((s) => {
    const costo = costoPorProducto.get(s.producto_id);
    const costoPromedio = costo && costo.cantidad > 0 ? costo.valor / costo.cantidad : 0;
    const ultima = ultimaFechaPorProducto.get(s.producto_id);

    const diasSinMovimiento = ultima
      ? Math.floor((hoy.getTime() - new Date(`${ultima}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      productoId: s.producto_id,
      saldo: Number(s.saldo ?? 0),
      costoPromedio,
      diasSinMovimiento,
    };
  });
}

// Conteos "primeras N" — a diferencia del resto de los objetivos, no
// dependen del período elegido: son un hito acumulado (ej. "ya cargué
// 5 gastos alguna vez"), igual que Activo/Pasivo son saldos a la fecha.
type ConteosActividad = {
  ventas: number;
  ingresos: number;
  gastos: number;
  clientes: number;
  proveedores: number;
};

async function obtenerConteosActividad(empresaId: string): Promise<ConteosActividad> {
  const [ventas, ingresos, gastos, clientes, proveedores] = await Promise.all([
    supabase.from('registro_operaciones').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('operacion', 'VENTA'),
    supabase.from('registro_operaciones').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('operacion', 'COBRO'),
    supabase.from('registro_operaciones').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('operacion', 'PAGO'),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
    supabase.from('proveedores').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
  ]);

  return {
    ventas: ventas.count ?? 0,
    ingresos: ingresos.count ?? 0,
    gastos: gastos.count ?? 0,
    clientes: clientes.count ?? 0,
    proveedores: proveedores.count ?? 0,
  };
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

  const codigosActividad: IndicadorCodigo[] = [
    'PRIMERAS_VENTAS',
    'PRIMEROS_INGRESOS',
    'PRIMEROS_GASTOS',
    'PRIMEROS_CLIENTES',
    'PRIMEROS_PROVEEDORES',
  ];
  const necesitaActividad = codigosActividad.some((c) => codigos.has(c));

  const [indicadoresActuales, indicadoresAnteriores, inventario, comprasDelMes, conteosActividad] = await Promise.all([
    obtenerIndicadores(empresaId, periodo),
    codigos.has('VENTAS_10PCT')
      ? periodoAnterior
        ? obtenerIndicadores(empresaId, periodoAnterior)
        : Promise.resolve(null)
      : Promise.resolve(null),
    codigos.has('STOCK_ESTANCADO') || codigos.has('VALOR_INVENTARIO')
      ? obtenerInventarioConAntiguedad(empresaId)
      : Promise.resolve<ItemInventario[]>([]),
    codigos.has('COMPRAS_CONTROLADAS') ? obtenerComprasDelPeriodo(empresaId, periodo) : Promise.resolve(0),
    necesitaActividad ? obtenerConteosActividad(empresaId) : Promise.resolve<ConteosActividad | null>(null),
  ]);

  return activas.map((def) => {
    let resultado = 0;
    let metaResuelta = def.objetivo;
    let aplica = true;
    let porcentajeManual: number | null = null;

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
        // Que los gastos del período no superen lo que entró a caja
        // en ese mismo período — evita flujo de caja negativo.
        metaResuelta = indicadoresActuales.ingresos;
        resultado = indicadoresActuales.gastos;
        break;

      case 'STOCK_ESTANCADO': {
        const valorTotal = inventario.reduce((suma, item) => suma + item.saldo * item.costoPromedio, 0);

        const valorEstancado = inventario
          .filter((item) => item.saldo > 0 && (item.diasSinMovimiento ?? Infinity) >= DIAS_ESTANCAMIENTO)
          .reduce((suma, item) => suma + item.saldo * item.costoPromedio, 0);

        resultado = valorEstancado;
        metaResuelta = 0;
        // Va bajando gradualmente a medida que más valor cruza los
        // 90 días (proporción del inventario total), en vez de
        // saltar de golpe a 0% apenas aparece el primer producto
        // estancado.
        porcentajeManual = valorTotal > 0 ? Math.max(0, (1 - valorEstancado / valorTotal) * 100) : 100;
        break;
      }

      case 'VALOR_INVENTARIO':
        resultado = inventario.reduce((suma, item) => suma + item.saldo * item.costoPromedio, 0);
        break;

      case 'COMPRAS_CONTROLADAS':
        resultado = comprasDelMes;
        break;

      case 'RENTABILIDAD':
        resultado = indicadoresActuales.rentabilidad;
        break;

      case 'VOLUMEN_VENTAS':
        resultado = indicadoresActuales.ingresos;
        break;

      case 'FONDO_EMERGENCIA':
        resultado = indicadoresActuales.cajaDisponible;
        break;

      case 'PRIMERAS_VENTAS':
        resultado = conteosActividad?.ventas ?? 0;
        break;

      case 'PRIMEROS_INGRESOS':
        resultado = conteosActividad?.ingresos ?? 0;
        break;

      case 'PRIMEROS_GASTOS':
        resultado = conteosActividad?.gastos ?? 0;
        break;

      case 'PRIMEROS_CLIENTES':
        resultado = conteosActividad?.clientes ?? 0;
        break;

      case 'PRIMEROS_PROVEEDORES':
        resultado = conteosActividad?.proveedores ?? 0;
        break;

      case 'META_AHORRO_LIBRE':
        // Acumulado a la fecha (no depende del período elegido),
        // igual que Caja o Patrimonio — es "cuánto llevo juntado
        // hasta hoy para esta meta", no un movimiento del mes.
        resultado = indicadoresActuales.ahorroInversiones ?? 0;
        break;

      default:
        aplica = false;
    }

    const info = CATALOGO_INDICADORES[def.indicador];

    let porcentaje = 0;

    if (aplica) {
      if (porcentajeManual !== null) {
        porcentaje = porcentajeManual;
      } else if (info.inverso) {
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
//
// Dos ajustes según la empresa real (no todos los negocios son
// iguales):
//   - Moneda: el catálogo trae "R$" como default (el sistema arrancó
//     con un cliente brasileño), pero acá se reemplaza por el
//     símbolo real de la empresa (moneda ARS/USD/BRL).
//   - Mercadería: los 3 objetivos de esa categoría no tienen sentido
//     si la empresa no maneja stock (perfil Servicios o Familiar, o
//     Mixto sin componente Comercial/Producción) — se omiten en ese
//     caso.
export async function crearObjetivosModelo(empresaId: string) {
  const { data: empresa } = await supabase
    .from('empresas')
    .select('moneda, perfil_empresa_id, perfiles_empresa(codigo)')
    .eq('id', empresaId)
    .maybeSingle();

  const simboloMoneda =
    empresa?.moneda === 'ARS' ? '$' : empresa?.moneda === 'USD' ? 'US$' : 'R$';

  const perfilCodigo = (empresa as unknown as { perfiles_empresa?: { codigo: string } | null } | null)
    ?.perfiles_empresa?.codigo;

  let manejaMercaderia = perfilCodigo !== 'SERVICIOS' && perfilCodigo !== 'FAMILIAR';

  if (perfilCodigo === 'MIXTO') {
    const { data: componentes } = await supabase
      .from('empresa_mixto_componentes')
      .select('componente')
      .eq('empresa_id', empresaId);

    manejaMercaderia = (componentes ?? []).some(
      (c) => c.componente === 'COMERCIAL' || c.componente === 'PRODUCCION'
    );
  }

  const modelo: { categoria: CategoriaObjetivo; indicador: IndicadorCodigo; orden: number }[] = [
    { categoria: 'CONTABLE', indicador: 'CAJA_MINIMA', orden: 1 },
    { categoria: 'CONTABLE', indicador: 'VENTAS_10PCT', orden: 2 },
    { categoria: 'CONTABLE', indicador: 'GASTOS_CONTROLADOS', orden: 3 },
    ...(manejaMercaderia
      ? ([
          { categoria: 'MERCADERIA', indicador: 'STOCK_ESTANCADO', orden: 1 },
          { categoria: 'MERCADERIA', indicador: 'VALOR_INVENTARIO', orden: 2 },
          { categoria: 'MERCADERIA', indicador: 'COMPRAS_CONTROLADAS', orden: 3 },
        ] as { categoria: CategoriaObjetivo; indicador: IndicadorCodigo; orden: number }[])
      : []),
    { categoria: 'FINANCIERO', indicador: 'RENTABILIDAD', orden: 1 },
    { categoria: 'FINANCIERO', indicador: 'VOLUMEN_VENTAS', orden: 2 },
    { categoria: 'FINANCIERO', indicador: 'FONDO_EMERGENCIA', orden: 3 },
    // Objetivos de "primeros pasos" — hoy solo para Familia. Guían al
    // usuario nuevo a usar el sistema (en vez de metas en dinero, que
    // no tienen sentido hasta que ya cargó movimientos). Cuando se
    // extienda a otros perfiles, alcanza con sumar la condición acá.
    ...(perfilCodigo === 'FAMILIAR'
      ? ([
          { categoria: 'ACTIVIDAD', indicador: 'PRIMEROS_INGRESOS', orden: 1 },
          { categoria: 'ACTIVIDAD', indicador: 'PRIMEROS_GASTOS', orden: 2 },
          { categoria: 'ACTIVIDAD', indicador: 'PRIMEROS_CLIENTES', orden: 3 },
          { categoria: 'ACTIVIDAD', indicador: 'PRIMEROS_PROVEEDORES', orden: 4 },
        ] as { categoria: CategoriaObjetivo; indicador: IndicadorCodigo; orden: number }[])
      : []),
  ];

  const filas = modelo.map((m) => ({
    empresa_id: empresaId,
    categoria: m.categoria,
    indicador: m.indicador,
    nombre: nombrePorPerfil(m.indicador, perfilCodigo),
    objetivo: CATALOGO_INDICADORES[m.indicador].objetivoDefault,
    unidad: CATALOGO_INDICADORES[m.indicador].unidadDefault === 'R$' ? simboloMoneda : CATALOGO_INDICADORES[m.indicador].unidadDefault,
    orden: m.orden,
    activo: true,
  }));

  const { error } = await supabase.from('objetivos_empresa').insert(filas);

  if (error) {
    throw error;
  }
}
