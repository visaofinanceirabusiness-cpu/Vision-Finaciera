// app/configuracoes/i18n.ts
//
// Diccionario de textos de CONFIGURAÇÕES. Por ahora cubre el marco de
// la pantalla (header + pestañas) y la pestaña "Datos de la Empresa"
// (la que tiene el selector de idioma). Las otras 5 pestañas se van
// sumando de a una — ver lib/i18n.ts para la mecánica general.

import type { Diccionario } from '@/lib/i18n';

export type ClaveConfiguracoes =
  | 'preparando'
  | 'noSePudoCargar'
  | 'volver'
  | 'eyebrow'
  | 'titulo'
  | 'subtitulo'
  | 'tabEmpresa'
  | 'tabCategorias'
  | 'tabPlan'
  | 'tabInicializacion'
  | 'tabObjetivos'
  | 'tabFacturacion'
  | 'cargandoDatosEmpresa'
  | 'noSeEncontroEmpresa'
  | 'clienteNumero'
  | 'campoNombreEmpresa'
  | 'campoRubro'
  | 'campoTelefono'
  | 'campoEmail'
  | 'campoDireccion'
  | 'campoIdentificacionFiscal'
  | 'campoLogo'
  | 'subiendoLogo'
  | 'campoMoneda'
  | 'campoIdioma'
  | 'campoPerfilEmpresa'
  | 'sinDefinir'
  | 'avisoPerfilYaInicializado'
  | 'avisoPerfilLoDefineAdmin'
  | 'preguntaMixto'
  | 'ayudaMixto'
  | 'mixtoComercial'
  | 'mixtoServicios'
  | 'mixtoProduccion'
  | 'guardando'
  | 'guardarCambios'
  | 'errorLogoPesado'
  | 'errorSubidaLogo'
  | 'errorLogoNoGuardado'
  | 'mensajeLogoActualizado'
  | 'errorGuardarCambios'
  | 'mensajeGuardadoConInicializacion'
  | 'mensajeGuardadoOk'
  | 'errorNoSeIdentificoEmpresa'
  // Pestaña 2 — Categorías y Formas de Pago
  | 'cargandoCategorias'
  | 'sinPlanCuentasTitulo'
  | 'sinPlanCuentasAyuda'
  | 'tituloCategoriasIngreso'
  | 'tituloCategoriasServicio'
  | 'subtituloCategoriasCobro'
  | 'subtituloCategoriasVentaServicio'
  | 'tituloSocios'
  | 'subtituloSocios'
  | 'placeholderSocio'
  | 'tituloCategoriaProducto'
  | 'subtituloCategoriaProducto'
  | 'placeholderCategoriaProducto'
  | 'placeholderCategoriaServicio'
  | 'tituloCategoriaGasto'
  | 'subtituloCategoriaGasto'
  | 'placeholderCategoriaGasto'
  | 'tituloFormasPago'
  | 'subtituloFormasPago'
  | 'placeholderFormaPago'
  | 'opcionCuentaContable'
  | 'opcionCuentaNueva'
  | 'placeholderCuentaNueva'
  | 'opcionActivo'
  | 'opcionPasivo'
  | 'botonAgregarFormaPago'
  | 'botonAgregar'
  | 'sinItems'
  | 'activa'
  | 'inactiva'
  | 'eliminarTitulo'
  | 'errorInesperado';

export const diccionarioConfiguracoes: Diccionario<ClaveConfiguracoes> = {
  ES: {
    preparando: 'Preparando la configuración...',
    noSePudoCargar: 'No se pudo cargar.',
    volver: '← Volver a Mi Negocio',
    eyebrow: 'CONFIGURACIÓN',
    titulo: 'Dejá tu empresa lista',
    subtitulo: 'Configurá → Generá → Tu sistema queda listo para operar.',
    tabEmpresa: '🏢 Datos de la Empresa',
    tabCategorias: '🗂️ Categorías y Formas de Pago',
    tabPlan: '📒 Plan de Cuentas',
    tabInicializacion: '🚀 Inicialización del Sistema',
    tabObjetivos: '🎯 Objetivos',
    tabFacturacion: '💳 Facturación',
    cargandoDatosEmpresa: 'Cargando datos de la empresa...',
    noSeEncontroEmpresa: 'No se encontró la empresa.',
    clienteNumero: 'Cliente Nº',
    campoNombreEmpresa: 'Nombre de la empresa *',
    campoRubro: 'Rubro',
    campoTelefono: 'Teléfono',
    campoEmail: 'Email',
    campoDireccion: 'Dirección',
    campoIdentificacionFiscal: 'Identificación fiscal (CUIT / CNPJ / etc.)',
    campoLogo: 'Logo',
    subiendoLogo: 'Subiendo logo...',
    campoMoneda: 'Moneda',
    campoIdioma: 'Idioma de trabajo',
    campoPerfilEmpresa: 'Perfil de empresa',
    sinDefinir: 'Sin definir',
    avisoPerfilYaInicializado: 'Ya existe un Plan de Cuentas cargado — cambiarlo acá no lo regenera, solo actualiza la etiqueta.',
    avisoPerfilLoDefineAdmin: 'El perfil lo define un administrador de la plataforma.',
    preguntaMixto: '¿Qué combina este negocio Mixto?',
    ayudaMixto: 'Elegí los componentes que aplican — determina qué categorías se ofrecen en la pestaña siguiente.',
    mixtoComercial: 'Comercial (compra/venta de mercadería)',
    mixtoServicios: 'Servicios (venta sin stock)',
    mixtoProduccion: 'Producción (transforma insumos)',
    guardando: 'Guardando...',
    guardarCambios: 'Guardar cambios',
    errorLogoPesado: 'El logo pesa demasiado — subí una imagen de hasta 3 MB.',
    errorSubidaLogo: 'No se pudo subir el logo.',
    errorLogoNoGuardado: 'El logo se subió pero no se pudo guardar en la empresa.',
    mensajeLogoActualizado: 'Logo actualizado — ya se ve en el lobby.',
    errorGuardarCambios: 'No se pudieron guardar los cambios.',
    mensajeGuardadoConInicializacion: 'Datos guardados y Plano de Contas inicializado — ya podés cargar categorías en la pestaña siguiente.',
    mensajeGuardadoOk: 'Datos guardados correctamente.',
    errorNoSeIdentificoEmpresa: 'No se pudo identificar la empresa del usuario.',
    cargandoCategorias: 'Cargando categorías...',
    sinPlanCuentasTitulo: 'Todavía no hay un Plano de Contas cargado',
    sinPlanCuentasAyuda: 'Asigná un perfil de empresa en la pestaña "Datos de la Empresa" para poder crear categorías acá.',
    tituloCategoriasIngreso: '💰 Categorías de Ingreso',
    tituloCategoriasServicio: '🧑‍💼 Categorías de Servicio',
    subtituloCategoriasCobro: 'Habilitan la operación Cobro (sueldo, otros ingresos). Cada una genera su propia cuenta de ingreso.',
    subtituloCategoriasVentaServicio: 'Habilitan la venta de un servicio (sin stock). Cada una genera su propia cuenta de ingreso.',
    tituloSocios: '🤝 Socios/as',
    subtituloSocios: "Quiénes pueden aparecer como 'a quién' en Inversión (aporte), Extracción (retiro) y Pérdida. No hace falta que tengan usuario propio para entrar al sistema.",
    placeholderSocio: 'Nombre del socio/a (ej. Ezequiel)',
    tituloCategoriaProducto: '🛍️ Categorías de Producto',
    subtituloCategoriaProducto: 'Habilitan Compra, Venta y Pérdida. Cada una genera su cuenta de Stock, Venta y Costo automáticamente.',
    placeholderCategoriaProducto: 'Nombre de la categoría (ej. Perfumería)',
    placeholderCategoriaServicio: 'Nombre (ej. Sueldo, Consultoría)',
    tituloCategoriaGasto: '🧾 Categorías de Gasto',
    subtituloCategoriaGasto: 'Habilitan la operación Pago (si el nombre ya existe en el plan, se reutiliza esa cuenta en vez de duplicar).',
    placeholderCategoriaGasto: 'Nombre del gasto (ej. Alquiler del local)',
    tituloFormasPago: '💳 Formas de Pago',
    subtituloFormasPago: 'Cada una se vincula a una cuenta contable existente (o nueva) y a las operaciones donde se puede usar.',
    placeholderFormaPago: 'Nombre (ej. Mercado Pago)',
    opcionCuentaContable: 'Cuenta contable...',
    opcionCuentaNueva: '➕ La cuenta no existe — crear una nueva',
    placeholderCuentaNueva: 'Nombre de la cuenta nueva (ej. Billetera Mercado Pago)',
    opcionActivo: 'Activo (tengo esa plata)',
    opcionPasivo: 'Pasivo (debo esa plata)',
    botonAgregarFormaPago: '+ Agregar forma de pago',
    botonAgregar: '+ Agregar',
    sinItems: 'Todavía no hay ninguna cargada.',
    activa: 'Activa',
    inactiva: 'Inactiva',
    eliminarTitulo: 'Eliminar',
    errorInesperado: 'Ocurrió un error inesperado.',
  },
  PT: {
    preparando: 'Preparando a configuração...',
    noSePudoCargar: 'Não foi possível carregar.',
    volver: '← Voltar para Meu Negócio',
    eyebrow: 'CONFIGURAÇÃO',
    titulo: 'Deixe sua empresa pronta',
    subtitulo: 'Configure → Gere → Seu sistema fica pronto para operar.',
    tabEmpresa: '🏢 Dados da Empresa',
    tabCategorias: '🗂️ Categorias e Formas de Pagamento',
    tabPlan: '📒 Plano de Contas',
    tabInicializacion: '🚀 Inicialização do Sistema',
    tabObjetivos: '🎯 Objetivos',
    tabFacturacion: '💳 Faturamento',
    cargandoDatosEmpresa: 'Carregando dados da empresa...',
    noSeEncontroEmpresa: 'Empresa não encontrada.',
    clienteNumero: 'Cliente Nº',
    campoNombreEmpresa: 'Nome da empresa *',
    campoRubro: 'Ramo',
    campoTelefono: 'Telefone',
    campoEmail: 'Email',
    campoDireccion: 'Endereço',
    campoIdentificacionFiscal: 'Identificação fiscal (CNPJ / CUIT / etc.)',
    campoLogo: 'Logo',
    subiendoLogo: 'Enviando logo...',
    campoMoneda: 'Moeda',
    campoIdioma: 'Idioma de trabalho',
    campoPerfilEmpresa: 'Perfil da empresa',
    sinDefinir: 'Não definido',
    avisoPerfilYaInicializado: 'Já existe um Plano de Contas carregado — alterá-lo aqui não o regenera, só atualiza o rótulo.',
    avisoPerfilLoDefineAdmin: 'O perfil é definido por um administrador da plataforma.',
    preguntaMixto: 'O que este negócio Misto combina?',
    ayudaMixto: 'Escolha os componentes que se aplicam — determina quais categorias são oferecidas na próxima aba.',
    mixtoComercial: 'Comercial (compra/venda de mercadoria)',
    mixtoServicios: 'Serviços (venda sem estoque)',
    mixtoProduccion: 'Produção (transforma insumos)',
    guardando: 'Salvando...',
    guardarCambios: 'Salvar alterações',
    errorLogoPesado: 'O logo está muito pesado — envie uma imagem de até 3 MB.',
    errorSubidaLogo: 'Não foi possível enviar o logo.',
    errorLogoNoGuardado: 'O logo foi enviado mas não foi possível salvá-lo na empresa.',
    mensajeLogoActualizado: 'Logo atualizado — já aparece no lobby.',
    errorGuardarCambios: 'Não foi possível salvar as alterações.',
    mensajeGuardadoConInicializacion: 'Dados salvos e Plano de Contas inicializado — já pode cadastrar categorias na próxima aba.',
    mensajeGuardadoOk: 'Dados salvos com sucesso.',
    errorNoSeIdentificoEmpresa: 'Não foi possível identificar a empresa do usuário.',
    cargandoCategorias: 'Carregando categorias...',
    sinPlanCuentasTitulo: 'Ainda não há um Plano de Contas carregado',
    sinPlanCuentasAyuda: 'Atribua um perfil de empresa na aba "Dados da Empresa" para poder criar categorias aqui.',
    tituloCategoriasIngreso: '💰 Categorias de Receita',
    tituloCategoriasServicio: '🧑‍💼 Categorias de Serviço',
    subtituloCategoriasCobro: 'Habilitam a operação Recebimento (salário, outras receitas). Cada uma gera sua própria conta de receita.',
    subtituloCategoriasVentaServicio: 'Habilitam a venda de um serviço (sem estoque). Cada uma gera sua própria conta de receita.',
    tituloSocios: '🤝 Sócios/as',
    subtituloSocios: 'Quem pode aparecer como "para quem" em Investimento (aporte), Retirada (saque) e Perda. Não precisam ter usuário próprio para entrar no sistema.',
    placeholderSocio: 'Nome do sócio/a (ex.: Ezequiel)',
    tituloCategoriaProducto: '🛍️ Categorias de Produto',
    subtituloCategoriaProducto: 'Habilitam Compra, Venda e Perda. Cada uma gera sua conta de Estoque, Venda e Custo automaticamente.',
    placeholderCategoriaProducto: 'Nome da categoria (ex.: Perfumaria)',
    placeholderCategoriaServicio: 'Nome (ex.: Salário, Consultoria)',
    tituloCategoriaGasto: '🧾 Categorias de Despesa',
    subtituloCategoriaGasto: 'Habilitam a operação Pagamento (se o nome já existe no plano, reutiliza essa conta em vez de duplicar).',
    placeholderCategoriaGasto: 'Nome da despesa (ex.: Aluguel do local)',
    tituloFormasPago: '💳 Formas de Pagamento',
    subtituloFormasPago: 'Cada uma se vincula a uma conta contábil existente (ou nova) e às operações em que pode ser usada.',
    placeholderFormaPago: 'Nome (ex.: Mercado Pago)',
    opcionCuentaContable: 'Conta contábil...',
    opcionCuentaNueva: '➕ A conta não existe — criar uma nova',
    placeholderCuentaNueva: 'Nome da conta nova (ex.: Carteira Mercado Pago)',
    opcionActivo: 'Ativo (tenho esse dinheiro)',
    opcionPasivo: 'Passivo (devo esse dinheiro)',
    botonAgregarFormaPago: '+ Adicionar forma de pagamento',
    botonAgregar: '+ Adicionar',
    sinItems: 'Ainda não há nenhuma cadastrada.',
    activa: 'Ativa',
    inactiva: 'Inativa',
    eliminarTitulo: 'Excluir',
    errorInesperado: 'Ocorreu um erro inesperado.',
  },
};

// Mensajes con datos interpolados (nombre de la categoría, etc.) — se
// resuelven directo por idioma, sin pasar por crearTraductor(), porque
// llevan una parte variable que no encaja en el diccionario de claves
// fijas de arriba.
const esPT = (idioma: string | null | undefined) => idioma === 'PT';

export function msgCategoriaCreada(idioma: string, nombre: string) {
  return esPT(idioma) ? `Categoria "${nombre}" criada com suas contas.` : `Categoría "${nombre}" creada con sus cuentas.`;
}

export function msgCategoriaActualizada(idioma: string) {
  return esPT(idioma) ? 'Categoria atualizada.' : 'Categoría actualizada.';
}

export function msgCategoriaEliminada(idioma: string, nombre: string) {
  return esPT(idioma) ? `Categoria "${nombre}" excluída.` : `Categoría "${nombre}" eliminada.`;
}

export function msgFormaPagoCreada(idioma: string, nombre: string) {
  return esPT(idioma) ? `Forma de pagamento "${nombre}" criada.` : `Forma de pago "${nombre}" creada.`;
}

export function msgFormaPagoActualizada(idioma: string) {
  return esPT(idioma) ? 'Forma de pagamento atualizada.' : 'Forma de pago actualizada.';
}

export function msgFormaPagoEliminada(idioma: string, nombre: string) {
  return esPT(idioma) ? `Forma de pagamento "${nombre}" excluída.` : `Forma de pago "${nombre}" eliminada.`;
}

export function msgSocioAgregado(idioma: string, nombre: string) {
  return esPT(idioma) ? `"${nombre}" adicionado/a.` : `"${nombre}" agregado/a.`;
}

export function msgSocioActualizado(idioma: string) {
  return esPT(idioma) ? 'Atualizado.' : 'Actualizado.';
}

export function msgSocioEliminado(idioma: string, nombre: string) {
  return esPT(idioma) ? `"${nombre}" excluído/a.` : `"${nombre}" eliminado/a.`;
}

export function confirmEliminarItem(idioma: string, nombre: string) {
  return esPT(idioma)
    ? `Excluir "${nombre}"? Isso não apaga a conta contábil, só a categoria/forma de pagamento e suas regras.`
    : `¿Eliminar "${nombre}"? Esto no borra la cuenta contable, solo la categoría/forma de pago y sus reglas.`;
}
