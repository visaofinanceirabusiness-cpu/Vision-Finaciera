import type { Diccionario } from '@/lib/i18n';

type Clave =
  | 'volver'
  | 'eyebrow'
  | 'titulo'
  | 'subtitulo'
  | 'tabSaldo'
  | 'tabMovimientos'
  | 'tituloSaldo'
  | 'tituloMovimientos'
  | 'nuevoProducto'
  | 'buscarSaldo'
  | 'buscarMovimientos'
  | 'editando'
  | 'nuevoRegistro'
  | 'editarProducto'
  | 'agregarProducto'
  | 'nombre'
  | 'nombrePlaceholder'
  | 'categoria'
  | 'sinCategoria'
  | 'tipoProducto'
  | 'unidadMedida'
  | 'proveedor'
  | 'sinProveedor'
  | 'fechaAlta'
  | 'codigoNoCambia'
  | 'codigoAutomatico'
  | 'cancelar'
  | 'guardando'
  | 'guardarCambios'
  | 'crearProducto'
  | 'cargandoDatos'
  | 'conSaldo'
  | 'sinSaldo'
  | 'sinProductosConSaldo'
  | 'sinProductosSinSaldo'
  | 'unidades'
  | 'valorInventarioEtiqueta'
  | 'saldoTotalEtiqueta'
  | 'codigoHeader'
  | 'productoHeader'
  | 'categoriaHeader'
  | 'saldoHeader'
  | 'costoPromedioHeader'
  | 'valorInventarioHeader'
  | 'estadoHeader'
  | 'accionesHeader'
  | 'editar'
  | 'eliminar'
  | 'editarTitle'
  | 'eliminarTitle'
  | 'sinStock'
  | 'bajoStock'
  | 'activo'
  | 'idRegistro'
  | 'fecha'
  | 'tipo'
  | 'cantidad'
  | 'montoUnitario'
  | 'total'
  | 'saldoAcumuladoHeader'
  | 'historico'
  | 'validadoHeader'
  | 'validadoBtn'
  | 'validarTitle'
  | 'sinMovimientos'
  | 'errorEmpresa'
  | 'errorEmpresaGuardar'
  | 'errorNombreObligatorio'
  | 'errorActualizar'
  | 'errorCrear'
  | 'errorValidar'
  | 'opcionSinEspecificar'
  | 'opcionInsumo'
  | 'opcionTerminado'
  | 'opcionUnidad'
  | 'opcionKg'
  | 'opcionG'
  | 'opcionL'
  | 'opcionMl'
  | 'tortaTitulo'
  | 'tortaSubtitulo'
  | 'porCantidad'
  | 'porValor'
  | 'tortaSinDatos';

export const diccionarioMercaderia: Diccionario<Clave> = {
  ES: {
    volver: '← Volver a Mi Negocio',
    eyebrow: 'GESTIÓN FINANCIERA',
    titulo: 'Mercadería',
    subtitulo: 'Administrá el saldo de tus productos y consultá los movimientos de mercadería.',
    tabSaldo: '📦 Saldo Mercadería',
    tabMovimientos: '🔁 Movimientos de Mercadería',
    tituloSaldo: 'Saldo Mercadería',
    tituloMovimientos: 'Movimientos de Mercadería',
    nuevoProducto: '+ Nuevo producto',
    buscarSaldo: 'Buscar código, nombre o categoría...',
    buscarMovimientos: 'Buscar ID, producto, tipo o categoría...',
    editando: 'EDITANDO',
    nuevoRegistro: 'NUEVO REGISTRO',
    editarProducto: 'Editar producto',
    agregarProducto: 'Agregar producto',
    nombre: 'Nombre *',
    nombrePlaceholder: 'Nombre del producto',
    categoria: 'Categoría',
    sinCategoria: 'Sin categoría',
    tipoProducto: 'Tipo de producto',
    unidadMedida: 'Unidad de medida',
    proveedor: 'Proveedor',
    sinProveedor: 'Sin proveedor',
    fechaAlta: 'Fecha de alta',
    codigoNoCambia: 'El código no se puede cambiar.',
    codigoAutomatico: 'El código se genera automáticamente.',
    cancelar: 'Cancelar',
    guardando: 'Guardando...',
    guardarCambios: 'Guardar cambios',
    crearProducto: 'Crear producto',
    cargandoDatos: 'Cargando datos...',
    conSaldo: 'Con saldo',
    sinSaldo: 'Sin saldo',
    sinProductosConSaldo: 'No hay productos con saldo disponible.',
    sinProductosSinSaldo: 'No hay productos sin saldo.',
    unidades: 'unidades',
    valorInventarioEtiqueta: 'Valor inventario:',
    saldoTotalEtiqueta: 'Saldo total:',
    codigoHeader: 'Código',
    productoHeader: 'Producto',
    categoriaHeader: 'Categoría',
    saldoHeader: 'Saldo',
    costoPromedioHeader: 'Costo promedio',
    valorInventarioHeader: 'Valor inventario',
    estadoHeader: 'Estado',
    accionesHeader: 'Acciones',
    editar: 'Editar',
    eliminar: 'Eliminar',
    editarTitle: 'Editar producto',
    eliminarTitle: 'Eliminar producto (solo si nunca tuvo movimiento)',
    sinStock: 'Sin stock',
    bajoStock: 'Bajo stock',
    activo: 'Activo',
    idRegistro: 'ID Registro',
    fecha: 'Fecha',
    tipo: 'Tipo',
    cantidad: 'Cantidad',
    montoUnitario: 'Monto unitario',
    total: 'Total',
    saldoAcumuladoHeader: 'Saldo',
    historico: 'Histórico',
    validadoHeader: 'Validado',
    validadoBtn: 'Validado',
    validarTitle: 'Validar este movimiento y el registro automático que generó en el Libro Diario',
    sinMovimientos: 'No se encontraron movimientos.',
    errorEmpresa: 'No se pudo identificar la empresa del usuario.',
    errorEmpresaGuardar: 'No se pudo identificar la empresa.',
    errorNombreObligatorio: 'El nombre es obligatorio.',
    errorActualizar: 'No se pudo actualizar el producto.',
    errorCrear: 'No se pudo crear el producto.',
    errorValidar: 'No se pudo validar el movimiento.',
    opcionSinEspecificar: 'Sin especificar',
    opcionInsumo: 'Insumo',
    opcionTerminado: 'Terminado',
    opcionUnidad: 'Unidad',
    opcionKg: 'Kg',
    opcionG: 'G',
    opcionL: 'L',
    opcionMl: 'Ml',
    tortaTitulo: '🥧 Distribuição por categoria',
    tortaSubtitulo: 'Cómo se reparte el stock disponible entre categorías',
    porCantidad: 'Por cantidad',
    porValor: 'Por valor',
    tortaSinDatos: 'Todavía no hay stock disponible para graficar.',
  },
  PT: {
    volver: '← Voltar para Meu Negócio',
    eyebrow: 'GESTÃO FINANCEIRA',
    titulo: 'Mercadoria',
    subtitulo: 'Administre o saldo dos seus produtos e consulte as movimentações de mercadoria.',
    tabSaldo: '📦 Saldo de Mercadoria',
    tabMovimientos: '🔁 Movimentações de Mercadoria',
    tituloSaldo: 'Saldo de Mercadoria',
    tituloMovimientos: 'Movimentações de Mercadoria',
    nuevoProducto: '+ Novo produto',
    buscarSaldo: 'Buscar código, nome ou categoria...',
    buscarMovimientos: 'Buscar ID, produto, tipo ou categoria...',
    editando: 'EDITANDO',
    nuevoRegistro: 'NOVO REGISTRO',
    editarProducto: 'Editar produto',
    agregarProducto: 'Adicionar produto',
    nombre: 'Nome *',
    nombrePlaceholder: 'Nome do produto',
    categoria: 'Categoria',
    sinCategoria: 'Sem categoria',
    tipoProducto: 'Tipo de produto',
    unidadMedida: 'Unidade de medida',
    proveedor: 'Fornecedor',
    sinProveedor: 'Sem fornecedor',
    fechaAlta: 'Data de cadastro',
    codigoNoCambia: 'O código não pode ser alterado.',
    codigoAutomatico: 'O código é gerado automaticamente.',
    cancelar: 'Cancelar',
    guardando: 'Salvando...',
    guardarCambios: 'Salvar alterações',
    crearProducto: 'Criar produto',
    cargandoDatos: 'Carregando dados...',
    conSaldo: 'Com saldo',
    sinSaldo: 'Sem saldo',
    sinProductosConSaldo: 'Não há produtos com saldo disponível.',
    sinProductosSinSaldo: 'Não há produtos sem saldo.',
    unidades: 'unidades',
    valorInventarioEtiqueta: 'Valor do estoque:',
    saldoTotalEtiqueta: 'Saldo total:',
    codigoHeader: 'Código',
    productoHeader: 'Produto',
    categoriaHeader: 'Categoria',
    saldoHeader: 'Saldo',
    costoPromedioHeader: 'Custo médio',
    valorInventarioHeader: 'Valor do estoque',
    estadoHeader: 'Situação',
    accionesHeader: 'Ações',
    editar: 'Editar',
    eliminar: 'Excluir',
    editarTitle: 'Editar produto',
    eliminarTitle: 'Excluir produto (só é possível se nunca teve movimentação)',
    sinStock: 'Sem estoque',
    bajoStock: 'Estoque baixo',
    activo: 'Ativo',
    idRegistro: 'ID Registro',
    fecha: 'Data',
    tipo: 'Tipo',
    cantidad: 'Quantidade',
    montoUnitario: 'Valor unitário',
    total: 'Total',
    saldoAcumuladoHeader: 'Saldo',
    historico: 'Histórico',
    validadoHeader: 'Validado',
    validadoBtn: 'Validado',
    validarTitle: 'Validar esta movimentação e o registro automático que ela gerou no Livro Diário',
    sinMovimientos: 'Nenhuma movimentação encontrada.',
    errorEmpresa: 'Não foi possível identificar a empresa do usuário.',
    errorEmpresaGuardar: 'Não foi possível identificar a empresa.',
    errorNombreObligatorio: 'O nome é obrigatório.',
    errorActualizar: 'Não foi possível atualizar o produto.',
    errorCrear: 'Não foi possível criar o produto.',
    errorValidar: 'Não foi possível validar a movimentação.',
    opcionSinEspecificar: 'Não especificado',
    opcionInsumo: 'Insumo',
    opcionTerminado: 'Terminado',
    opcionUnidad: 'Unidade',
    opcionKg: 'Kg',
    opcionG: 'G',
    opcionL: 'L',
    opcionMl: 'Ml',
    tortaTitulo: '🥧 Distribuição por categoria',
    tortaSubtitulo: 'Como o estoque disponível se reparte entre categorias',
    porCantidad: 'Por quantidade',
    porValor: 'Por valor',
    tortaSinDatos: 'Ainda não há estoque disponível para exibir no gráfico.',
  },
};

const esPT = (idioma: string | null | undefined) => idioma === 'PT';

export function msgConfirmarEliminarProducto(idioma: string | null | undefined, nombre: string): string {
  return esPT(idioma)
    ? `Excluir o produto "${nombre}"? Só é possível se nunca teve movimentação. Não pode ser desfeito.`
    : `¿Eliminar el producto "${nombre}"? Solo se puede si nunca tuvo movimiento. No se puede deshacer.`;
}

export function msgYaTieneMovimientos(idioma: string | null | undefined, nombre: string): string {
  return esPT(idioma)
    ? `"${nombre}" já tem movimentações registradas — não é possível excluir.`
    : `"${nombre}" ya tiene movimientos cargados — no se puede eliminar.`;
}

export function msgNoSePudoEliminar(idioma: string | null | undefined, nombre: string): string {
  return esPT(idioma)
    ? `Não foi possível excluir "${nombre}" — pode estar em uso em uma receita ou outra configuração.`
    : `No se pudo eliminar "${nombre}" — puede estar usado en una receta u otra configuración.`;
}

export function contadorProductos(idioma: string | null | undefined, cantidad: number): string {
  if (esPT(idioma)) {
    return `${cantidad} ${cantidad === 1 ? 'produto' : 'produtos'}`;
  }
  return `${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`;
}

export function contadorMovimientos(idioma: string | null | undefined, cantidad: number): string {
  if (esPT(idioma)) {
    return `${cantidad} ${cantidad === 1 ? 'movimentação' : 'movimentações'}`;
  }
  return `${cantidad} ${cantidad === 1 ? 'movimiento' : 'movimientos'}`;
}

// Tips de Sabio para esta pantalla — rotan en el widget permanente.
export const FRASES_SABIO_MERCADERIA: Record<'ES' | 'PT', string[]> = {
  ES: [
    'El costo promedio de un producto se recalcula solo con cada compra que registrás.',
    'Un movimiento de mercadería sin validar no impacta todavía en tu Libro Diario.',
    'El valor de inventario es la suma de cada producto multiplicado por su costo promedio.',
    'Cada venta genera automáticamente el CMV — el costo de lo que realmente sacaste del stock.',
    'Si un producto nunca tuvo movimiento, lo podés eliminar sin problema.',
  ],
  PT: [
    'O custo médio de um produto é recalculado sozinho a cada compra que você registra.',
    'Uma movimentação de mercadoria sem validar ainda não impacta no seu Livro Diário.',
    'O valor de estoque é a soma de cada produto multiplicado pelo seu custo médio.',
    'Cada venda gera automaticamente o CMV — o custo do que realmente saiu do estoque.',
    'Se um produto nunca teve movimentação, você pode excluí-lo sem problema.',
  ],
};

export function frasesSabioMercaderia(idioma: string | null | undefined): string[] {
  return FRASES_SABIO_MERCADERIA[idioma === 'PT' ? 'PT' : 'ES'];
}
