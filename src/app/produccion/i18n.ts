import type { Diccionario } from '@/lib/i18n';

type Clave =
  | 'volver'
  | 'eyebrow'
  | 'titulo'
  | 'subtitulo'
  | 'asistidoPor'
  | 'eyebrowNueva'
  | 'prepararProduccion'
  | 'moduloActivo'
  | 'productoTerminado'
  | 'seleccionarProducto'
  | 'cantidadAProducir'
  | 'cantidadPlaceholder'
  | 'producto'
  | 'unidad'
  | 'calculando'
  | 'calcularConsumo'
  | 'eyebrowResultado'
  | 'consumoEstimado'
  | 'cantidad'
  | 'receta'
  | 'rinde'
  | 'multiplicador'
  | 'insumoHeader'
  | 'necesarioHeader'
  | 'disponibleHeader'
  | 'estadoHeader'
  | 'disponible'
  | 'proximoPaso'
  | 'proximoPasoTexto'
  | 'cargandoProduccion'
  | 'errorPerfilEmpresa'
  | 'errorSinEmpresa'
  | 'errorProductosTerminados'
  | 'errorSinEmpresaCalcular'
  | 'errorSeleccionarProducto'
  | 'errorCantidadInvalida'
  | 'errorCalcular';

export const diccionarioProduccion: Diccionario<Clave> = {
  ES: {
    volver: 'Volver a Mi Negocio',
    eyebrow: 'GESTIÓN DE PRODUCCIÓN',
    titulo: 'Producción',
    subtitulo: 'Calculá los insumos necesarios para fabricar tus productos.',
    asistidoPor: 'ASISTIDO POR',
    eyebrowNueva: 'NUEVA PRODUCCIÓN',
    prepararProduccion: 'Preparar producción',
    moduloActivo: 'Módulo activo',
    productoTerminado: 'Producto terminado',
    seleccionarProducto: 'Seleccionar producto...',
    cantidadAProducir: 'Cantidad a producir',
    cantidadPlaceholder: 'Ej.: 20',
    producto: 'Producto',
    unidad: 'Unidad',
    calculando: 'Calculando...',
    calcularConsumo: 'Calcular consumo',
    eyebrowResultado: 'RESULTADO',
    consumoEstimado: 'Consumo estimado',
    cantidad: 'Cantidad',
    receta: 'Receta',
    rinde: 'Rinde',
    multiplicador: 'Multiplicador',
    insumoHeader: 'Insumo',
    necesarioHeader: 'Necesario',
    disponibleHeader: 'Disponible',
    estadoHeader: 'Estado',
    disponible: 'Disponible',
    proximoPaso: 'Próximo paso',
    proximoPasoTexto:
      'La producción todavía no modifica stock. Primero validamos que el cálculo de receta y consumo sea correcto. Luego conectaremos el botón de producción con el motor.',
    cargandoProduccion: 'Cargando Producción...',
    errorPerfilEmpresa: 'No se pudo obtener el perfil de la empresa.',
    errorSinEmpresa: 'Tu usuario todavía no tiene una empresa asignada.',
    errorProductosTerminados: 'No se pudieron cargar los productos terminados.',
    errorSinEmpresaCalcular: 'No se pudo identificar la empresa.',
    errorSeleccionarProducto: 'Seleccioná un producto terminado.',
    errorCantidadInvalida: 'La cantidad a producir debe ser mayor que cero.',
    errorCalcular: 'No se pudo calcular la producción.',
  },
  PT: {
    volver: 'Voltar para Meu Negócio',
    eyebrow: 'GESTÃO DE PRODUÇÃO',
    titulo: 'Produção',
    subtitulo: 'Calcule os insumos necessários para fabricar seus produtos.',
    asistidoPor: 'ASSISTIDO POR',
    eyebrowNueva: 'NOVA PRODUÇÃO',
    prepararProduccion: 'Preparar produção',
    moduloActivo: 'Módulo ativo',
    productoTerminado: 'Produto terminado',
    seleccionarProducto: 'Selecionar produto...',
    cantidadAProducir: 'Quantidade a produzir',
    cantidadPlaceholder: 'Ex.: 20',
    producto: 'Produto',
    unidad: 'Unidade',
    calculando: 'Calculando...',
    calcularConsumo: 'Calcular consumo',
    eyebrowResultado: 'RESULTADO',
    consumoEstimado: 'Consumo estimado',
    cantidad: 'Quantidade',
    receta: 'Receita',
    rinde: 'Rende',
    multiplicador: 'Multiplicador',
    insumoHeader: 'Insumo',
    necesarioHeader: 'Necessário',
    disponibleHeader: 'Disponível',
    estadoHeader: 'Situação',
    disponible: 'Disponível',
    proximoPaso: 'Próximo passo',
    proximoPasoTexto:
      'A produção ainda não altera o estoque. Primeiro validamos que o cálculo de receita e consumo esteja correto. Depois conectaremos o botão de produção com o motor.',
    cargandoProduccion: 'Carregando Produção...',
    errorPerfilEmpresa: 'Não foi possível obter o perfil da empresa.',
    errorSinEmpresa: 'Seu usuário ainda não tem uma empresa atribuída.',
    errorProductosTerminados: 'Não foi possível carregar os produtos terminados.',
    errorSinEmpresaCalcular: 'Não foi possível identificar a empresa.',
    errorSeleccionarProducto: 'Selecione um produto terminado.',
    errorCantidadInvalida: 'A quantidade a produzir deve ser maior que zero.',
    errorCalcular: 'Não foi possível calcular a produção.',
  },
};

const esPT = (idioma: string | null | undefined) => idioma === 'PT';

export function msgStockSuficiente(idioma: string | null | undefined): string {
  return esPT(idioma)
    ? 'Sabio confirma que há estoque suficiente para produzir.'
    : 'Sabio confirma que hay stock suficiente para producir.';
}

export function msgStockFaltante(idioma: string | null | undefined): string {
  return esPT(idioma)
    ? 'Sabio detectou que faltam alguns insumos.'
    : 'Sabio detectó que faltan algunos insumos.';
}

export function msgFaltan(idioma: string | null | undefined, cantidad: string, unidad: string): string {
  return esPT(idioma) ? `Faltam ${cantidad} ${unidad}` : `Faltan ${cantidad} ${unidad}`;
}

export function msgHayStockSuficiente(
  idioma: string | null | undefined,
  cantidad: number,
  nombreProducto: string
): string {
  return esPT(idioma)
    ? `✓ Há estoque suficiente para produzir ${cantidad} ${nombreProducto}.`
    : `✓ Hay stock suficiente para producir ${cantidad} ${nombreProducto}.`;
}

export function msgNoHayStockSuficiente(idioma: string | null | undefined): string {
  return esPT(idioma)
    ? '⚠ Não há estoque suficiente para realizar esta produção.'
    : '⚠ No hay stock suficiente para realizar esta producción.';
}

// Tips de Sabio para esta pantalla — rotan en el widget permanente.
export const FRASES_SABIO_PRODUCCION: Record<'ES' | 'PT', string[]> = {
  ES: [
    'Cada producción descuenta del stock los insumos según la receta cargada.',
    'Si falta stock de un insumo, Sabio te avisa antes de confirmar la producción.',
    'El costo de un producto terminado se arma con el costo promedio de cada insumo que lleva.',
    'Revisá tus recetas de vez en cuando — un insumo mal cargado desajusta todo el costo.',
  ],
  PT: [
    'Cada produção desconta do estoque os insumos conforme a receita cadastrada.',
    'Se faltar estoque de um insumo, Sabio avisa antes de confirmar a produção.',
    'O custo de um produto acabado é formado pelo custo médio de cada insumo que ele leva.',
    'Revise suas receitas de vez em quando — um insumo mal cadastrado desajusta todo o custo.',
  ],
};

export function frasesSabioProduccion(idioma: string | null | undefined): string[] {
  return FRASES_SABIO_PRODUCCION[idioma === 'PT' ? 'PT' : 'ES'];
}
