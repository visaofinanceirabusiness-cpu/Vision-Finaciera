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
  | 'errorNoSeIdentificoEmpresa';

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
  },
};
