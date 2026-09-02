import type { Diccionario } from '@/lib/i18n';

type Clave =
  | 'volver'
  | 'eyebrow'
  | 'titulo'
  | 'subtituloFamiliar'
  | 'subtituloNegocio'
  | 'buscar'
  | 'cargandoRegistros'
  | 'codigoHeader'
  | 'nombreHeader'
  | 'telefonoHeader'
  | 'direccionHeader'
  | 'fechaAltaHeader'
  | 'accionesHeader'
  | 'editar'
  | 'nombre'
  | 'nombrePlaceholder'
  | 'telefono'
  | 'telefonoPlaceholder'
  | 'direccion'
  | 'direccionPlaceholder'
  | 'fechaAlta'
  | 'codigoAutomatico'
  | 'cancelar'
  | 'guardando'
  | 'guardarCambios'
  | 'crearRegistro'
  | 'editarRegistro'
  | 'nuevoRegistro'
  | 'sinResultadosBusqueda'
  | 'errorEmpresa'
  | 'errorEmpresaGuardar'
  | 'errorNombreObligatorio'
  | 'errorActualizar'
  | 'errorCrear';

export const diccionarioRecursosHumanos: Diccionario<Clave> = {
  ES: {
    volver: '← Volver a Mi Negocio',
    eyebrow: 'GESTIÓN FINANCIERA',
    titulo: 'Recursos Humanos',
    subtituloFamiliar: 'Administrá quién te paga y a quién le pagás.',
    subtituloNegocio: 'Administrá clientes y proveedores de tu negocio.',
    buscar: 'Buscar código, nombre, teléfono o dirección...',
    cargandoRegistros: 'Cargando registros...',
    codigoHeader: 'Código',
    nombreHeader: 'Nombre',
    telefonoHeader: 'Teléfono',
    direccionHeader: 'Dirección',
    fechaAltaHeader: 'Fecha alta',
    accionesHeader: 'Acciones',
    editar: 'Editar',
    nombre: 'Nombre *',
    nombrePlaceholder: 'Nombre o razón social',
    telefono: 'Teléfono',
    telefonoPlaceholder: 'Teléfono',
    direccion: 'Dirección',
    direccionPlaceholder: 'Dirección',
    fechaAlta: 'Fecha de alta',
    codigoAutomatico: 'El código se genera automáticamente.',
    cancelar: 'Cancelar',
    guardando: 'Guardando...',
    guardarCambios: 'Guardar cambios',
    crearRegistro: 'Crear registro',
    editarRegistro: 'EDITAR REGISTRO',
    nuevoRegistro: 'NUEVO REGISTRO',
    sinResultadosBusqueda: 'No se encontraron registros con esa búsqueda.',
    errorEmpresa: 'No se pudo identificar la empresa del usuario.',
    errorEmpresaGuardar: 'No se pudo identificar la empresa.',
    errorNombreObligatorio: 'El nombre es obligatorio.',
    errorActualizar: 'No se pudo actualizar el registro.',
    errorCrear: 'No se pudo crear el registro.',
  },
  PT: {
    volver: '← Voltar para Meu Negócio',
    eyebrow: 'GESTÃO FINANCEIRA',
    titulo: 'Recursos Humanos',
    subtituloFamiliar: 'Administre quem te paga e a quem você paga.',
    subtituloNegocio: 'Administre clientes e fornecedores do seu negócio.',
    buscar: 'Buscar código, nome, telefone ou endereço...',
    cargandoRegistros: 'Carregando registros...',
    codigoHeader: 'Código',
    nombreHeader: 'Nome',
    telefonoHeader: 'Telefone',
    direccionHeader: 'Endereço',
    fechaAltaHeader: 'Data de cadastro',
    accionesHeader: 'Ações',
    editar: 'Editar',
    nombre: 'Nome *',
    nombrePlaceholder: 'Nome ou razão social',
    telefono: 'Telefone',
    telefonoPlaceholder: 'Telefone',
    direccion: 'Endereço',
    direccionPlaceholder: 'Endereço',
    fechaAlta: 'Data de cadastro',
    codigoAutomatico: 'O código é gerado automaticamente.',
    cancelar: 'Cancelar',
    guardando: 'Salvando...',
    guardarCambios: 'Salvar alterações',
    crearRegistro: 'Criar registro',
    editarRegistro: 'EDITAR REGISTRO',
    nuevoRegistro: 'NOVO REGISTRO',
    sinResultadosBusqueda: 'Nenhum registro encontrado com essa busca.',
    errorEmpresa: 'Não foi possível identificar a empresa do usuário.',
    errorEmpresaGuardar: 'Não foi possível identificar a empresa.',
    errorNombreObligatorio: 'O nome é obrigatório.',
    errorActualizar: 'Não foi possível atualizar o registro.',
    errorCrear: 'Não foi possível criar o registro.',
  },
};

// ==========================================================
// ETIQUETAS — depende de perfil (Familiar u otro) e idioma. Ver
// nota original en page.tsx: "Clientes"/"Proveedores" no tiene
// sentido para el perfil Familiar.
// ==========================================================

export type Etiquetas = {
  emoji: string;
  plural: string;
  singular: string;
  femenino: boolean;
};

export function obtenerEtiquetas(
  tipo: 'clientes' | 'proveedores',
  esFamiliar: boolean,
  idioma: string | null | undefined
): Etiquetas {
  const esPT = idioma === 'PT';

  if (esFamiliar) {
    if (tipo === 'clientes') {
      return esPT
        ? { emoji: '💰', plural: 'Fontes de renda', singular: 'fonte de renda', femenino: true }
        : { emoji: '💰', plural: 'Fuentes de ingreso', singular: 'fuente de ingreso', femenino: true };
    }

    return esPT
      ? { emoji: '🏪', plural: 'Destinos de pagamento', singular: 'destino de pagamento', femenino: false }
      : { emoji: '🏪', plural: 'Destinos de pago', singular: 'destino de pago', femenino: false };
  }

  if (tipo === 'clientes') {
    return { emoji: '👥', plural: esPT ? 'Clientes' : 'Clientes', singular: 'cliente', femenino: false };
  }

  return esPT
    ? { emoji: '🏢', plural: 'Fornecedores', singular: 'fornecedor', femenino: false }
    : { emoji: '🏢', plural: 'Proveedores', singular: 'proveedor', femenino: false };
}

const esPT = (idioma: string | null | undefined) => idioma === 'PT';

export function tituloNuevo(idioma: string | null | undefined, etiquetas: Etiquetas): string {
  if (esPT(idioma)) {
    return `+ ${etiquetas.femenino ? 'Nova' : 'Novo'} ${etiquetas.singular}`;
  }
  return `+ ${etiquetas.femenino ? 'Nueva' : 'Nuevo'} ${etiquetas.singular}`;
}

export function tituloEditarOAgregar(
  idioma: string | null | undefined,
  editando: boolean,
  etiquetas: Etiquetas
): string {
  if (esPT(idioma)) {
    return editando ? `Editar ${etiquetas.singular}` : `Adicionar ${etiquetas.singular}`;
  }
  return editando ? `Editar ${etiquetas.singular}` : `Agregar ${etiquetas.singular}`;
}

export function contadorRegistros(idioma: string | null | undefined, cantidad: number): string {
  if (esPT(idioma)) {
    return `${cantidad} ${cantidad === 1 ? 'registro' : 'registros'}`;
  }
  return `${cantidad} ${cantidad === 1 ? 'registro' : 'registros'}`;
}

export function mensajeSinRegistros(idioma: string | null | undefined, etiquetas: Etiquetas): string {
  if (esPT(idioma)) {
    return `Ainda não há ${etiquetas.plural.toLowerCase()} ${etiquetas.femenino ? 'registradas' : 'registrados'}.`;
  }
  return `Todavía no hay ${etiquetas.plural.toLowerCase()} ${etiquetas.femenino ? 'registradas' : 'registrados'}.`;
}

// Tips de Sabio para esta pantalla — rotan en el widget permanente.
export const FRASES_SABIO_RECURSOS_HUMANOS: Record<'ES' | 'PT', string[]> = {
  ES: [
    'Cargar bien tus proveedores y clientes evita errores al registrar una operación.',
    'Un cliente o proveedor con datos incompletos igual se puede usar — podés completarlos después.',
    'Solo se puede eliminar un registro si todavía no tiene movimientos cargados.',
    'Cuantos más clientes y proveedores tengas cargados, más rápido vas a registrar cada operación.',
  ],
  PT: [
    'Cadastrar bem seus fornecedores e clientes evita erros ao registrar uma operação.',
    'Um cliente ou fornecedor com dados incompletos ainda pode ser usado — você pode completá-los depois.',
    'Só é possível excluir um cadastro se ele ainda não tiver movimentações registradas.',
    'Quanto mais clientes e fornecedores você tiver cadastrados, mais rápido vai registrar cada operação.',
  ],
};

export function frasesSabioRecursosHumanos(idioma: string | null | undefined): string[] {
  return FRASES_SABIO_RECURSOS_HUMANOS[idioma === 'PT' ? 'PT' : 'ES'];
}
