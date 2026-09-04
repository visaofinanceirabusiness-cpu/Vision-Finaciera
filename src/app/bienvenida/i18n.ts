import type { Diccionario } from '@/lib/i18n';

type Clave =
  | 'eyebrow'
  | 'titulo'
  | 'subtitulo'
  | 'salir'
  | 'cargando'
  | 'errorSinEmpresa'
  | 'seccionCategoriaProductoTitulo'
  | 'seccionCategoriaProductoAyuda'
  | 'seccionCategoriaServicioTitulo'
  | 'seccionCategoriaServicioAyuda'
  | 'seccionSocioTitulo'
  | 'seccionSocioAyuda'
  | 'seccionProductoTitulo'
  | 'seccionProductoAyuda'
  | 'nombrePlaceholder'
  | 'categoriaPlaceholder'
  | 'agregar'
  | 'quitar'
  | 'sinCargar'
  | 'botonFinalizar'
  | 'procesando'
  | 'errorMinimoCategoria'
  | 'errorMinimoSocio'
  | 'errorMinimoProveedores'
  | 'errorMinimoClientes'
  | 'errorMinimoProducto'
  | 'errorSeleccionarCategoria'
  | 'errorMatriz';

export const diccionarioBienvenida: Diccionario<Clave> = {
  ES: {
    eyebrow: 'CONFIGURACIÓN INICIAL',
    titulo: 'Antes de arrancar',
    subtitulo:
      'Completá estos datos básicos para que tu sistema quede listo para operar. Después vas a poder agregar todo lo que quieras desde Configurações y Recursos Humanos.',
    salir: 'Salir / volver más tarde',
    cargando: 'Cargando...',
    errorSinEmpresa: 'No se pudo identificar la empresa del usuario.',
    seccionCategoriaProductoTitulo: '1. Categoría de producto',
    seccionCategoriaProductoAyuda: 'Ej.: "Indumentaria", "Bebidas", "Electrónica". Cargá al menos una.',
    seccionCategoriaServicioTitulo: '1. Categoría de servicio o ingreso',
    seccionCategoriaServicioAyuda: 'Ej.: "Consultoría", "Sueldo", "Honorarios". Cargá al menos una.',
    seccionSocioTitulo: '3. Socio/a',
    seccionSocioAyuda: 'Quién puede aportar o retirar dinero del negocio (podés ponerte a vos mismo/a). Cargá al menos uno/a.',
    seccionProductoTitulo: '2. Productos',
    seccionProductoAyuda: 'Al menos un producto, asignado a una de tus categorías.',
    nombrePlaceholder: 'Nombre',
    categoriaPlaceholder: 'Categoría...',
    agregar: '+ Agregar',
    quitar: 'Quitar',
    sinCargar: 'Todavía no cargaste ninguno.',
    botonFinalizar: 'Terminar configuración',
    procesando: 'Configurando tu sistema...',
    errorMinimoCategoria: 'Cargá al menos una categoría.',
    errorMinimoSocio: 'Cargá al menos un socio/a.',
    errorMinimoProveedores: 'Cargá al menos 2.',
    errorMinimoClientes: 'Cargá al menos 2.',
    errorMinimoProducto: 'Cargá al menos un producto.',
    errorSeleccionarCategoria: 'Elegí a qué categoría pertenece.',
    errorMatriz: 'Los datos se guardaron, pero no se pudo generar la matriz de operaciones.',
  },
  PT: {
    eyebrow: 'CONFIGURAÇÃO INICIAL',
    titulo: 'Antes de começar',
    subtitulo:
      'Preencha esses dados básicos para deixar seu sistema pronto para operar. Depois você vai poder adicionar tudo o que quiser em Configurações e Recursos Humanos.',
    salir: 'Sair / voltar depois',
    cargando: 'Carregando...',
    errorSinEmpresa: 'Não foi possível identificar a empresa do usuário.',
    seccionCategoriaProductoTitulo: '1. Categoria de produto',
    seccionCategoriaProductoAyuda: 'Ex.: "Vestuário", "Bebidas", "Eletrônicos". Cadastre pelo menos uma.',
    seccionCategoriaServicioTitulo: '1. Categoria de serviço ou receita',
    seccionCategoriaServicioAyuda: 'Ex.: "Consultoria", "Salário", "Honorários". Cadastre pelo menos uma.',
    seccionSocioTitulo: '3. Sócio/a',
    seccionSocioAyuda: 'Quem pode fazer aportes ou retiradas do negócio (pode ser você mesmo/a). Cadastre pelo menos um/a.',
    seccionProductoTitulo: '2. Produtos',
    seccionProductoAyuda: 'Pelo menos um produto, associado a uma das suas categorias.',
    nombrePlaceholder: 'Nome',
    categoriaPlaceholder: 'Categoria...',
    agregar: '+ Adicionar',
    quitar: 'Remover',
    sinCargar: 'Você ainda não cadastrou nenhum.',
    botonFinalizar: 'Concluir configuração',
    procesando: 'Configurando seu sistema...',
    errorMinimoCategoria: 'Cadastre pelo menos uma categoria.',
    errorMinimoSocio: 'Cadastre pelo menos um sócio/a.',
    errorMinimoProveedores: 'Cadastre pelo menos 2.',
    errorMinimoClientes: 'Cadastre pelo menos 2.',
    errorMinimoProducto: 'Cadastre pelo menos um produto.',
    errorSeleccionarCategoria: 'Escolha a qual categoria pertence.',
    errorMatriz: 'Os dados foram salvos, mas não foi possível gerar a matriz de operações.',
  },
};
