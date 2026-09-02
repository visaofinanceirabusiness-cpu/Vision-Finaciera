// app/panel-de-control/i18n.ts
//
// Diccionario de textos del Panel de Control. Misma mecánica que
// app/configuracoes/i18n.ts — ver lib/i18n.ts.
//
// Fuera de alcance a propósito (igual que en Configurações →
// Objetivos): el texto de ayuda de cada indicador vive en
// CATALOGO_INDICADORES (lib/objetivos.ts), un catálogo aparte. Los
// componentes de gráfico (CategoryChart, StockChart, LucroChart,
// EvolucionFamiliarChart) tienen textos internos propios que tampoco
// se tocan acá — quedan para una iteración futura.

import type { Diccionario } from '@/lib/i18n';

export type ClavePanelControl =
  | 'cargando'
  | 'volver'
  | 'eyebrowGestionFinanciera'
  | 'titulo'
  | 'subtituloConEmpresa'
  | 'tuNegocioDefault'
  | 'eyebrowSituacionActual'
  | 'tuFamiliaHoy'
  | 'tuNegocioHoy'
  | 'ayudaSituacionActual'
  | 'dineroDisponible'
  | 'deudaTotal'
  | 'patrimonioNeto'
  | 'activo'
  | 'pasivo'
  | 'capital'
  | 'saldoEnCaja'
  | 'stockBajo'
  | 'productos'
  | 'eyebrowPeriodo'
  | 'ayudaPeriodo'
  | 'todosLosPeriodos'
  | 'eyebrowInformacionEjecutiva'
  | 'resumenEjecutivo'
  | 'ayudaResumenEjecutivo'
  | 'ingresosDelPeriodo'
  | 'gastosDelPeriodo'
  | 'ahorroDelPeriodo'
  | 'tasaDeAhorro'
  | 'ingresoOperativo'
  | 'cmv'
  | 'gastos'
  | 'lucro'
  | 'rentabilidad'
  | 'liquidezCorriente'
  | 'tituloDistribucionGastos'
  | 'subtituloDistribucionGastos'
  | 'vacioDistribucionGastos'
  | 'tituloDistribucionIngresos'
  | 'subtituloDistribucionIngresos'
  | 'vacioDistribucionIngresos'
  | 'eyebrowEquilibrio'
  | 'endeudamiento'
  | 'ayudaEndeudamiento'
  | 'endeudamientoSano'
  | 'endeudamientoModerado'
  | 'endeudamientoAlto'
  | 'eyebrowColchon'
  | 'fondoDeRespaldo'
  | 'ayudaFondoRespaldo'
  | 'meta'
  | 'fondoCompleto'
  | 'sinMetaFondoRespaldo'
  | 'eyebrowGestion'
  | 'objetivosFamiliares'
  | 'objetivosDelMes'
  | 'objetivosAcordados'
  | 'proximamenteMarketing'
  | 'sinObjetivos'
  | 'noAplicaTodosPeriodos'
  | 'ahora'
  | 'cumplido'
  | 'enCamino'
  | 'pendiente'
  | 'tope'
  | 'noventaDias'
  | 'nivelMaximo'
  | 'operacionesRegistradas'
  | 'vistaHistoricaTitulo'
  | 'vistaHistoricaTexto'
  | 'categoriaPrimerosPasos'
  | 'categoriaMetasFamiliares'
  | 'categoriaContables'
  | 'categoriaMercaderia'
  | 'categoriaFinancieros'
  | 'categoriaMarketing';

export const diccionarioPanelControl: Diccionario<ClavePanelControl> = {
  ES: {
    cargando: 'Cargando tu negocio...',
    volver: '← Volver a Mi Negocio',
    eyebrowGestionFinanciera: 'GESTIÓN FINANCIERA',
    titulo: 'Panel de Control',
    subtituloConEmpresa: 'Indicadores, objetivos y evolución de',
    tuNegocioDefault: 'tu negocio',
    eyebrowSituacionActual: 'SITUACIÓN ACTUAL',
    tuFamiliaHoy: 'Tu familia hoy',
    tuNegocioHoy: 'Tu negocio hoy',
    ayudaSituacionActual: 'Saldos acumulados a la fecha. No cambian con el período que elijas más abajo.',
    dineroDisponible: 'Dinero disponible',
    deudaTotal: 'Deuda total',
    patrimonioNeto: 'Patrimonio neto',
    activo: 'Activo',
    pasivo: 'Pasivo',
    capital: 'Capital',
    saldoEnCaja: 'Saldo en caja',
    stockBajo: 'Stock bajo',
    productos: 'productos',
    eyebrowPeriodo: 'PERÍODO DE ANÁLISIS',
    ayudaPeriodo: 'El dashboard utiliza este período para sus objetivos e indicadores.',
    todosLosPeriodos: 'Todos los períodos',
    eyebrowInformacionEjecutiva: 'INFORMACIÓN EJECUTIVA',
    resumenEjecutivo: 'Resumen Ejecutivo',
    ayudaResumenEjecutivo: 'Resultados del período seleccionado. La situación patrimonial acumulada está más arriba.',
    ingresosDelPeriodo: 'Ingresos del período',
    gastosDelPeriodo: 'Gastos del período',
    ahorroDelPeriodo: 'Ahorro del período',
    tasaDeAhorro: 'Tasa de ahorro',
    ingresoOperativo: 'Ingreso operativo',
    cmv: 'Costo de mercadería vendida',
    gastos: 'Gastos',
    lucro: 'Lucro',
    rentabilidad: 'Rentabilidad',
    liquidezCorriente: 'Liquidez corriente',
    tituloDistribucionGastos: '🧾 Distribución de gastos',
    subtituloDistribucionGastos: 'En qué se fue la plata este período',
    vacioDistribucionGastos: 'Todavía no hay gastos registrados en este período.',
    tituloDistribucionIngresos: '👥 Distribución de ingresos',
    subtituloDistribucionIngresos: 'Cuánto aportó cada socio/a este período',
    vacioDistribucionIngresos: 'Todavía no hay ingresos con socio/a asignado en este período.',
    eyebrowEquilibrio: 'EQUILIBRIO',
    endeudamiento: 'Endeudamiento',
    ayudaEndeudamiento: 'Cuánto de lo que tenés depende de deuda.',
    endeudamientoSano: 'Endeudamiento sano',
    endeudamientoModerado: 'Endeudamiento moderado',
    endeudamientoAlto: 'Endeudamiento alto',
    eyebrowColchon: 'COLCHÓN',
    fondoDeRespaldo: 'Fondo de respaldo',
    ayudaFondoRespaldo: 'Plata disponible aparte de lo que necesitás para el día a día.',
    meta: 'Meta',
    fondoCompleto: '¡Fondo completo!',
    sinMetaFondoRespaldo: 'Configurá una meta de "Fondo de Respaldo" en Objetivos para hacer seguimiento acá.',
    eyebrowGestion: 'GESTIÓN',
    objetivosFamiliares: 'Objetivos familiares',
    objetivosDelMes: 'Objetivos del mes',
    objetivosAcordados: 'Objetivos acordados',
    proximamenteMarketing: '🔒 Próximamente — objetivos conectados a Instagram/WhatsApp.',
    sinObjetivos: 'No hay objetivos configurados todavía.',
    noAplicaTodosPeriodos: 'No aplica para "Todos los períodos" — elegí un mes.',
    ahora: 'Ahora',
    cumplido: 'CUMPLIDO',
    enCamino: 'EN CAMINO',
    pendiente: 'PENDIENTE',
    tope: 'Tope',
    noventaDias: '90 días',
    nivelMaximo: '¡Nivel máximo alcanzado por ahora!',
    operacionesRegistradas: 'operaciones registradas',
    vistaHistoricaTitulo: '📊 Vista histórica',
    vistaHistoricaTexto: 'En esta vista se analizan todos los períodos. Los objetivos mensuales se muestran únicamente cuando seleccionás un período específico.',
    categoriaPrimerosPasos: 'Primeros pasos',
    categoriaMetasFamiliares: 'Metas familiares',
    categoriaContables: 'Contables',
    categoriaMercaderia: 'Mercadería',
    categoriaFinancieros: 'Financieros',
    categoriaMarketing: 'Marketing',
  },
  PT: {
    cargando: 'Carregando o seu negócio...',
    volver: '← Voltar para Meu Negócio',
    eyebrowGestionFinanciera: 'GESTÃO FINANCEIRA',
    titulo: 'Painel de Controle',
    subtituloConEmpresa: 'Indicadores, objetivos e evolução de',
    tuNegocioDefault: 'seu negócio',
    eyebrowSituacionActual: 'SITUAÇÃO ATUAL',
    tuFamiliaHoy: 'Sua família hoje',
    tuNegocioHoy: 'Seu negócio hoje',
    ayudaSituacionActual: 'Saldos acumulados até a data. Não mudam com o período que você escolher mais abaixo.',
    dineroDisponible: 'Dinheiro disponível',
    deudaTotal: 'Dívida total',
    patrimonioNeto: 'Patrimônio líquido',
    activo: 'Ativo',
    pasivo: 'Passivo',
    capital: 'Capital',
    saldoEnCaja: 'Saldo em caixa',
    stockBajo: 'Estoque baixo',
    productos: 'produtos',
    eyebrowPeriodo: 'PERÍODO DE ANÁLISE',
    ayudaPeriodo: 'O dashboard usa este período para seus objetivos e indicadores.',
    todosLosPeriodos: 'Todos os períodos',
    eyebrowInformacionEjecutiva: 'INFORMAÇÃO EXECUTIVA',
    resumenEjecutivo: 'Resumo Executivo',
    ayudaResumenEjecutivo: 'Resultados do período selecionado. A situação patrimonial acumulada está mais acima.',
    ingresosDelPeriodo: 'Receitas do período',
    gastosDelPeriodo: 'Despesas do período',
    ahorroDelPeriodo: 'Poupança do período',
    tasaDeAhorro: 'Taxa de poupança',
    ingresoOperativo: 'Receita operacional',
    cmv: 'Custo da mercadoria vendida',
    gastos: 'Despesas',
    lucro: 'Lucro',
    rentabilidad: 'Rentabilidade',
    liquidezCorriente: 'Liquidez corrente',
    tituloDistribucionGastos: '🧾 Distribuição de despesas',
    subtituloDistribucionGastos: 'Para onde foi o dinheiro neste período',
    vacioDistribucionGastos: 'Ainda não há despesas registradas neste período.',
    tituloDistribucionIngresos: '👥 Distribuição de receitas',
    subtituloDistribucionIngresos: 'Quanto cada sócio/a contribuiu neste período',
    vacioDistribucionIngresos: 'Ainda não há receitas com sócio/a atribuído neste período.',
    eyebrowEquilibrio: 'EQUILÍBRIO',
    endeudamiento: 'Endividamento',
    ayudaEndeudamiento: 'Quanto do que você tem depende de dívida.',
    endeudamientoSano: 'Endividamento saudável',
    endeudamientoModerado: 'Endividamento moderado',
    endeudamientoAlto: 'Endividamento alto',
    eyebrowColchon: 'COLCHÃO',
    fondoDeRespaldo: 'Fundo de reserva',
    ayudaFondoRespaldo: 'Dinheiro disponível além do que você precisa para o dia a dia.',
    meta: 'Meta',
    fondoCompleto: 'Fundo completo!',
    sinMetaFondoRespaldo: 'Configure uma meta de "Fundo de Reserva" em Objetivos para acompanhar aqui.',
    eyebrowGestion: 'GESTÃO',
    objetivosFamiliares: 'Objetivos familiares',
    objetivosDelMes: 'Objetivos do mês',
    objetivosAcordados: 'Objetivos combinados',
    proximamenteMarketing: '🔒 Em breve — objetivos conectados a Instagram/WhatsApp.',
    sinObjetivos: 'Ainda não há objetivos configurados.',
    noAplicaTodosPeriodos: 'Não se aplica para "Todos os períodos" — escolha um mês.',
    ahora: 'Agora',
    cumplido: 'CUMPRIDO',
    enCamino: 'A CAMINHO',
    pendiente: 'PENDENTE',
    tope: 'Teto',
    noventaDias: '90 dias',
    nivelMaximo: 'Nível máximo alcançado por enquanto!',
    operacionesRegistradas: 'operações registradas',
    vistaHistoricaTitulo: '📊 Vista histórica',
    vistaHistoricaTexto: 'Nesta vista são analisados todos os períodos. Os objetivos mensais são mostrados apenas quando você seleciona um período específico.',
    categoriaPrimerosPasos: 'Primeiros passos',
    categoriaMetasFamiliares: 'Metas familiares',
    categoriaContables: 'Contábeis',
    categoriaMercaderia: 'Mercadoria',
    categoriaFinancieros: 'Financeiros',
    categoriaMarketing: 'Marketing',
  },
};

const esPT = (idioma: string | null | undefined) => idioma === 'PT';

export function msgEcuacionNoCierra(idioma: string, simbolo: string, descuadre: string, activos: string): string {
  return esPT(idioma)
    ? `⚠️ A equação contábil não fecha por ${simbolo} ${descuadre}. Ativo (${activos}) não corresponde a Passivo + Patrimônio + Resultado. Revise os saldos iniciais do plano de contas.`
    : `⚠️ La ecuación contable no cierra por ${simbolo} ${descuadre}. Activo (${activos}) no coincide con Pasivo + Patrimonio + Resultado. Revisá los saldos iniciales del plan de cuentas.`;
}

export function msgSaludEndeudamiento(idioma: string, porcentaje: string): string {
  return esPT(idioma)
    ? `a dívida é ${porcentaje}% de dívida + patrimônio.`
    : `la deuda es el ${porcentaje}% de deuda + patrimonio.`;
}

export function msgFondoRespaldoProgreso(idioma: string, porcentaje: string): string {
  return esPT(idioma) ? `${porcentaje}% do fundo objetivo` : `${porcentaje}% del fondo objetivo`;
}

export function msgNivelBanner(idioma: string, emoji: string, nivel: number, nombre: string): string {
  return esPT(idioma) ? `${emoji} Nível ${nivel} — ${nombre}` : `${emoji} Nivel ${nivel} — ${nombre}`;
}

export function msgFaltanParaSubirNivel(idioma: string, faltan: number): string {
  return esPT(idioma)
    ? `Faltam ${faltan} operações para subir de nível.`
    : `Te faltan ${faltan} operaciones para subir de nivel.`;
}

// ==========================================================
// BIENVENIDA AL TERMINAR EL TUTORIAL GUIADO (Fase 3 del onboarding)
// ==========================================================

export function msgBienvenidaTutorialPanel(idioma: string | null | undefined): string {
  return esPT(idioma)
    ? '🎉 Muito bem! Aqui você acompanha seu negócio: quanto tem em caixa, quanto deve, e como estão seus objetivos e gráficos. Vá explorando — qualquer dúvida, é só clicar em mim de novo.'
    : '🎉 ¡Muy bien! Acá vas a seguir tu negocio: cuánto tenés en caja, cuánto debés, y cómo van tus objetivos y gráficos. Andá explorando — cualquier duda, hacé clic en mí de nuevo.';
}

export function msgCerrarTutorialPanel(idioma: string | null | undefined): string {
  return esPT(idioma) ? 'Entendi, fechar' : 'Entendido, cerrar';
}

// ==========================================================
// TIPS PERMANENTES DE SABIO EN EL PANEL DE CONTROLE
// ==========================================================

export const FRASES_SABIO_PANEL: Record<'ES' | 'PT', string[]> = {
  ES: [
    'Tu Caja Disponible es lo que tenés hoy en cuentas propias — no incluye lo que te deben ni lo que debés.',
    'El Patrimonio es lo que te queda si hoy cobraras todo y pagaras todas tus deudas.',
    'Si Activo no cierra con Pasivo + Patrimonio, casi siempre son los saldos iniciales del Plano de Contas.',
    'Los Objetivos se actualizan solos con cada operación — no hace falta que los toques a mano.',
    'El gráfico de Lucro compara Ingresos contra Costos y Gastos, período a período.',
    '¿Vas subiendo de nivel? Eso mide cuántas operaciones fuiste registrando — cuantas más cargues, más completo se ve tu negocio acá.',
  ],
  PT: [
    'Seu Caixa Disponível é o que você tem hoje em contas próprias — não inclui o que te devem nem o que você deve.',
    'O Patrimônio é o que sobra se hoje você recebesse tudo e pagasse todas as suas dívidas.',
    'Se o Ativo não fecha com Passivo + Patrimônio, quase sempre são os saldos iniciais do Plano de Contas.',
    'Os Objetivos se atualizam sozinhos a cada operação — não precisa mexer neles manualmente.',
    'O gráfico de Lucro compara Receitas contra Custos e Despesas, período a período.',
    'Está subindo de nível? Isso mede quantas operações você foi registrando — quanto mais carregar, mais completo seu negócio aparece aqui.',
  ],
};

export function frasesSabioPanel(idioma: string | null | undefined): string[] {
  return FRASES_SABIO_PANEL[idioma === 'PT' ? 'PT' : 'ES'];
}
