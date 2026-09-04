import type { Diccionario } from '@/lib/i18n';
export { perfilEmpresaDisplay } from '@/lib/i18n';

type Clave =
  | 'titulo'
  | 'subtitulo'
  | 'tuNombre'
  | 'tuNombrePlaceholder'
  | 'email'
  | 'emailPlaceholder'
  | 'contrasena'
  | 'contrasenaPlaceholder'
  | 'telefono'
  | 'numero'
  | 'nombreEmpresa'
  | 'nombreEmpresaPlaceholder'
  | 'rubro'
  | 'rubroPlaceholder'
  | 'monedaLabel'
  | 'comoFuncionaTuNegocio'
  | 'cargandoOpciones'
  | 'queCombinaTuNegocio'
  | 'enviarSolicitud'
  | 'enviando'
  | 'yaTenesCuenta'
  | 'solicitudEnviadaTitulo'
  | 'solicitudEnviadaTexto'
  | 'irAIniciarSesion'
  | 'errorCompletarCampos'
  | 'errorContrasenaCorta'
  | 'errorPerfilMixto'
  | 'errorCuentaExistente'
  | 'errorConfirmacionPendiente'
  | 'errorSolicitud'
  | 'errorNombreEmpresaDuplicado'
  | 'comercial'
  | 'servicios'
  | 'produccion';

export const diccionarioCrearCuenta: Diccionario<Clave> = {
  ES: {
    titulo: 'Crear cuenta',
    subtitulo:
      'Completá tus datos y los de tu negocio. Un administrador va a revisar y aprobar tu solicitud antes de que puedas empezar a operar.',
    tuNombre: 'Tu nombre *',
    tuNombrePlaceholder: 'Ej: Brenda',
    email: 'Email *',
    emailPlaceholder: 'tuemail@ejemplo.com',
    contrasena: 'Contraseña *',
    contrasenaPlaceholder: 'Al menos 6 caracteres',
    telefono: 'Teléfono *',
    numero: 'Número',
    nombreEmpresa: 'Nombre de tu empresa/negocio *',
    nombreEmpresaPlaceholder: 'Ej: Mi Negocio',
    rubro: 'Rubro *',
    rubroPlaceholder: 'Ej: Venta de ropa',
    monedaLabel: 'Moneda en la que operás *',
    comoFuncionaTuNegocio: '¿Cómo funciona tu negocio? *',
    cargandoOpciones: 'Cargando opciones...',
    queCombinaTuNegocio: '¿Qué combina tu negocio? *',
    enviarSolicitud: 'Enviar solicitud',
    enviando: 'Enviando...',
    yaTenesCuenta: '¿Ya tenés cuenta? Iniciá sesión',
    solicitudEnviadaTitulo: '¡Solicitud enviada!',
    solicitudEnviadaTexto:
      'Ya está registrada. Un administrador va a revisarla y aprobarla — en cuanto eso pase, vas a poder entrar con tu email y contraseña.',
    irAIniciarSesion: 'Ir a iniciar sesión →',
    errorCompletarCampos: 'Completá todos los campos — son todos obligatorios.',
    errorContrasenaCorta: 'La contraseña tiene que tener al menos 6 caracteres.',
    errorPerfilMixto: 'Para el perfil Mixto, elegí al menos un componente (Comercial, Servicios o Producción).',
    errorCuentaExistente: 'Ya existe una cuenta con ese email.',
    errorConfirmacionPendiente:
      'Ya existe una cuenta con ese email — probá iniciar sesión, o pedí que te reenvíen la confirmación.',
    errorSolicitud: 'La cuenta se creó pero no se pudo enviar la solicitud',
    errorNombreEmpresaDuplicado: 'Ya existe una empresa registrada con ese nombre. Cambiá el nombre para poder continuar.',
    comercial: 'Comercial (compra y venta de mercadería)',
    servicios: 'Servicios',
    produccion: 'Producción',
  },
  PT: {
    titulo: 'Criar conta',
    subtitulo:
      'Preencha seus dados e os do seu negócio. Um administrador vai revisar e aprovar sua solicitação antes que você possa começar a operar.',
    tuNombre: 'Seu nome *',
    tuNombrePlaceholder: 'Ex: Brenda',
    email: 'Email *',
    emailPlaceholder: 'seuemail@exemplo.com',
    contrasena: 'Senha *',
    contrasenaPlaceholder: 'Pelo menos 6 caracteres',
    telefono: 'Telefone *',
    numero: 'Número',
    nombreEmpresa: 'Nome da sua empresa/negócio *',
    nombreEmpresaPlaceholder: 'Ex: Meu Negócio',
    rubro: 'Ramo *',
    rubroPlaceholder: 'Ex: Venda de roupas',
    monedaLabel: 'Moeda em que você opera *',
    comoFuncionaTuNegocio: 'Como funciona o seu negócio? *',
    cargandoOpciones: 'Carregando opções...',
    queCombinaTuNegocio: 'O que seu negócio combina? *',
    enviarSolicitud: 'Enviar solicitação',
    enviando: 'Enviando...',
    yaTenesCuenta: 'Já tem uma conta? Entrar',
    solicitudEnviadaTitulo: 'Solicitação enviada!',
    solicitudEnviadaTexto:
      'Já está registrada. Um administrador vai revisá-la e aprová-la — assim que isso acontecer, você vai poder entrar com seu email e senha.',
    irAIniciarSesion: 'Ir para entrar →',
    errorCompletarCampos: 'Preencha todos os campos — todos são obrigatórios.',
    errorContrasenaCorta: 'A senha precisa ter pelo menos 6 caracteres.',
    errorPerfilMixto: 'Para o perfil Misto, escolha ao menos um componente (Comercial, Serviços ou Produção).',
    errorCuentaExistente: 'Já existe uma conta com esse email.',
    errorConfirmacionPendiente:
      'Já existe uma conta com esse email — tente entrar, ou peça o reenvio da confirmação.',
    errorSolicitud: 'A conta foi criada mas não foi possível enviar a solicitação',
    errorNombreEmpresaDuplicado: 'Já existe uma empresa cadastrada com esse nome. Altere o nome para continuar.',
    comercial: 'Comercial (compra e venda de mercadoria)',
    servicios: 'Serviços',
    produccion: 'Produção',
  },
};

export function msgErrorCrearCuenta(idioma: string, mensaje: string): string {
  return idioma === 'PT'
    ? `Não foi possível criar a conta: ${mensaje}.`
    : `No se pudo crear la cuenta: ${mensaje}.`;
}

