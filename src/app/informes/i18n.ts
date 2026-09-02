import type { Diccionario } from '@/lib/i18n';

type Clave =
  | 'volver'
  | 'eyebrow'
  | 'titulo'
  | 'subtitulo'
  | 'tabMayor'
  | 'tabFlujo'
  | 'tabResultado'
  | 'tabSumas'
  | 'tabBalance'
  | 'cargandoInformes'
  | 'errorEmpresa'
  | 'buscarCuenta'
  | 'codigoHeader'
  | 'cuentaHeader'
  | 'saldoInicialHeader'
  | 'debeHeader'
  | 'haberHeader'
  | 'saldoFinalHeader'
  | 'sinCuentas'
  | 'total'
  | 'debeHaberCierran'
  | 'cuentaLabel'
  | 'seleccionarCuenta'
  | 'saldoActualLabel'
  | 'elegirCuentaMovimiento'
  | 'fechaHeader'
  | 'operacionHeader'
  | 'descripcionHeader'
  | 'saldoHeader'
  | 'saldoInicialItalic'
  | 'sinMovimientosValidados'
  | 'periodoLabel'
  | 'todosLosPeriodos'
  | 'ingresosTitulo'
  | 'costosTitulo'
  | 'gastosTitulo'
  | 'sinMovimientoPeriodo'
  | 'rentabilidadLabel'
  | 'tendenciaResultadoTitulo'
  | 'panoramaGeneral'
  | 'tendenciaSubtitulo'
  | 'sinHistorialTendencia'
  | 'cajaDisponibleHoy'
  | 'entradasDeCaja'
  | 'salidasDeCaja'
  | 'tendenciaCajaTitulo'
  | 'resultadoEjercicioSinCerrar'
  | 'resultadoEjercicioDescripcion'
  | 'activoTitulo'
  | 'pasivoTitulo'
  | 'patrimonioTitulo'
  | 'sinCuentasMovimiento'
  | 'resultadoEjercicioNoCerrado'
  | 'ocultarCerosEnCero'
  | 'mostrarCerosEnCero'
  | 'otro';

export const diccionarioInformes: Diccionario<Clave> = {
  ES: {
    volver: '← Volver a Mi Negocio',
    eyebrow: 'GESTIÓN FINANCIERA',
    titulo: 'Informes',
    subtitulo:
      'Mayor, Flujo de Caja, Estado de Resultado, Sumas y Saldos y Balance Patrimonial — armados solo con asientos validados.',
    tabMayor: '📘 Mayor',
    tabFlujo: '💧 Flujo de Caja',
    tabResultado: '📈 Estado de Resultado',
    tabSumas: '🧮 Sumas y Saldos',
    tabBalance: '🏛️ Balance Patrimonial',
    cargandoInformes: 'Cargando informes...',
    errorEmpresa: 'No se pudo identificar la empresa del usuario.',
    buscarCuenta: 'Buscar cuenta por código o nombre...',
    codigoHeader: 'Código',
    cuentaHeader: 'Cuenta',
    saldoInicialHeader: 'Saldo Inicial',
    debeHeader: 'Debe',
    haberHeader: 'Haber',
    saldoFinalHeader: 'Saldo Final',
    sinCuentas: 'No se encontraron cuentas.',
    total: 'Total',
    debeHaberCierran: '✓ El Debe y el Haber cierran iguales.',
    cuentaLabel: 'Cuenta',
    seleccionarCuenta: 'Seleccionar cuenta...',
    saldoActualLabel: 'SALDO ACTUAL',
    elegirCuentaMovimiento: 'Elegí una cuenta para ver su movimiento.',
    fechaHeader: 'Fecha',
    operacionHeader: 'Operación',
    descripcionHeader: 'Descripción',
    saldoHeader: 'Saldo',
    saldoInicialItalic: 'Saldo inicial',
    sinMovimientosValidados: 'Esta cuenta todavía no tiene movimientos validados.',
    periodoLabel: 'Período',
    todosLosPeriodos: 'Todos los períodos',
    ingresosTitulo: 'Ingresos',
    costosTitulo: 'Costos',
    gastosTitulo: 'Gastos',
    sinMovimientoPeriodo: 'Sin movimiento en este período.',
    rentabilidadLabel: 'Rentabilidad',
    tendenciaResultadoTitulo: 'Tendencia del Resultado',
    panoramaGeneral: 'PANORAMA GENERAL',
    tendenciaSubtitulo: 'Todo el histórico, mes a mes — no cambia con el período elegido arriba.',
    sinHistorialTendencia: 'Todavía no hay historial suficiente para mostrar una tendencia.',
    cajaDisponibleHoy: 'CAJA DISPONIBLE HOY',
    entradasDeCaja: 'Entradas de caja',
    salidasDeCaja: 'Salidas de caja',
    tendenciaCajaTitulo: 'Tendencia de Caja',
    resultadoEjercicioSinCerrar: 'RESULTADO DEL EJERCICIO (SIN CERRAR)',
    resultadoEjercicioDescripcion:
      'Lo que ganó o perdió el negocio hasta hoy, todavía no volcado a Lucros Acumulados. Ya está incluido en el Patrimonio de abajo.',
    activoTitulo: 'Activo',
    pasivoTitulo: 'Pasivo',
    patrimonioTitulo: 'Patrimonio',
    sinCuentasMovimiento: 'Sin cuentas con movimiento.',
    resultadoEjercicioNoCerrado: 'Resultado del Ejercicio (no cerrado)',
    ocultarCerosEnCero: 'Ocultar cuentas en cero',
    mostrarCerosEnCero: 'Mostrar cuentas en cero',
    otro: 'Otro',
  },
  PT: {
    volver: '← Voltar para Meu Negócio',
    eyebrow: 'GESTÃO FINANCEIRA',
    titulo: 'Relatórios',
    subtitulo:
      'Razão, Fluxo de Caixa, Demonstração de Resultado, Balancete e Balanço Patrimonial — montados apenas com lançamentos validados.',
    tabMayor: '📘 Razão',
    tabFlujo: '💧 Fluxo de Caixa',
    tabResultado: '📈 Demonstração de Resultado',
    tabSumas: '🧮 Balancete',
    tabBalance: '🏛️ Balanço Patrimonial',
    cargandoInformes: 'Carregando relatórios...',
    errorEmpresa: 'Não foi possível identificar a empresa do usuário.',
    buscarCuenta: 'Buscar conta por código ou nome...',
    codigoHeader: 'Código',
    cuentaHeader: 'Conta',
    saldoInicialHeader: 'Saldo Inicial',
    debeHeader: 'Débito',
    haberHeader: 'Crédito',
    saldoFinalHeader: 'Saldo Final',
    sinCuentas: 'Nenhuma conta encontrada.',
    total: 'Total',
    debeHaberCierran: '✓ O Débito e o Crédito fecham iguais.',
    cuentaLabel: 'Conta',
    seleccionarCuenta: 'Selecionar conta...',
    saldoActualLabel: 'SALDO ATUAL',
    elegirCuentaMovimiento: 'Escolha uma conta para ver sua movimentação.',
    fechaHeader: 'Data',
    operacionHeader: 'Operação',
    descripcionHeader: 'Descrição',
    saldoHeader: 'Saldo',
    saldoInicialItalic: 'Saldo inicial',
    sinMovimientosValidados: 'Esta conta ainda não tem movimentações validadas.',
    periodoLabel: 'Período',
    todosLosPeriodos: 'Todos os períodos',
    ingresosTitulo: 'Receitas',
    costosTitulo: 'Custos',
    gastosTitulo: 'Despesas',
    sinMovimientoPeriodo: 'Sem movimentação neste período.',
    rentabilidadLabel: 'Rentabilidade',
    tendenciaResultadoTitulo: 'Tendência do Resultado',
    panoramaGeneral: 'PANORAMA GERAL',
    tendenciaSubtitulo: 'Todo o histórico, mês a mês — não muda com o período escolhido acima.',
    sinHistorialTendencia: 'Ainda não há histórico suficiente para mostrar uma tendência.',
    cajaDisponibleHoy: 'CAIXA DISPONÍVEL HOJE',
    entradasDeCaja: 'Entradas de caixa',
    salidasDeCaja: 'Saídas de caixa',
    tendenciaCajaTitulo: 'Tendência de Caixa',
    resultadoEjercicioSinCerrar: 'RESULTADO DO EXERCÍCIO (NÃO FECHADO)',
    resultadoEjercicioDescripcion:
      'O que o negócio ganhou ou perdeu até hoje, ainda não transferido para Lucros Acumulados. Já está incluído no Patrimônio abaixo.',
    activoTitulo: 'Ativo',
    pasivoTitulo: 'Passivo',
    patrimonioTitulo: 'Patrimônio',
    sinCuentasMovimiento: 'Sem contas com movimentação.',
    resultadoEjercicioNoCerrado: 'Resultado do Exercício (não fechado)',
    ocultarCerosEnCero: 'Ocultar contas em zero',
    mostrarCerosEnCero: 'Mostrar contas em zero',
    otro: 'Outro',
  },
};

const esPT = (idioma: string | null | undefined) => idioma === 'PT';

export function formatearPeriodo(clave: string, idioma: string | null | undefined): string {
  const [anio, mes] = clave.split('-').map(Number);

  if (!anio || !mes) return clave;

  return new Date(anio, mes - 1, 1).toLocaleDateString(esPT(idioma) ? 'pt-BR' : 'es-AR', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatearPeriodoCorto(clave: string, idioma: string | null | undefined): string {
  const [anio, mes] = clave.split('-').map(Number);
  if (!anio || !mes) return clave;

  const nombre = new Date(anio, mes - 1, 1).toLocaleDateString(esPT(idioma) ? 'pt-BR' : 'es-AR', {
    month: 'short',
  });
  return `${nombre.replace('.', '')} ${String(anio).slice(2)}`;
}

export function msgDebeHaberNoCierran(idioma: string | null | undefined, diferencia: string): string {
  return esPT(idioma)
    ? `⚠ O Débito e o Crédito não fecham — diferença de ${diferencia}.`
    : `⚠ El Debe y el Haber no cierran — diferencia de ${diferencia}.`;
}

export function msgResultadoLabel(idioma: string | null | undefined, esTodos: boolean, periodoEtiqueta: string): string {
  if (esTodos) {
    return esPT(idioma) ? 'RESULTADO (histórico)' : 'RESULTADO (histórico)';
  }
  return `RESULTADO — ${periodoEtiqueta}`;
}

export function msgFlujoNetoLabel(idioma: string | null | undefined, esTodos: boolean, periodoEtiqueta: string): string {
  if (esTodos) {
    return 'FLUJO NETO (histórico)';
  }
  return `FLUJO NETO — ${periodoEtiqueta}`;
}

export function msgEcuacionCierra(idioma: string | null | undefined, activo: string, pasivoPatrimonio: string): string {
  return esPT(idioma)
    ? `✓ Ativo (${activo}) = Passivo + Patrimônio (${pasivoPatrimonio}).`
    : `✓ Activo (${activo}) = Pasivo + Patrimonio (${pasivoPatrimonio}).`;
}

export function msgEcuacionNoCierra(
  idioma: string | null | undefined,
  diferencia: string,
  activo: string,
  pasivoPatrimonio: string
): string {
  return esPT(idioma)
    ? `⚠ A equação não fecha por ${diferencia}. Ativo: ${activo} — Passivo + Patrimônio: ${pasivoPatrimonio}.`
    : `⚠ La ecuación no cierra por ${diferencia}. Activo: ${activo} — Pasivo + Patrimonio: ${pasivoPatrimonio}.`;
}
