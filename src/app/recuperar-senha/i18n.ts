import type { Diccionario } from '@/lib/i18n';

type Clave =
  | 'titulo'
  | 'subtitulo'
  | 'email'
  | 'enviarEnlace'
  | 'enviando'
  | 'mensajeEnviado'
  | 'errorGenerico'
  | 'volverAlLogin';

export const diccionarioRecuperarSenha: Diccionario<Clave> = {
  ES: {
    titulo: 'Recuperar contraseña',
    subtitulo: 'Ingresá tu email y te mandamos un link para elegir una nueva.',
    email: 'Email',
    enviarEnlace: 'Enviar enlace',
    enviando: 'Enviando...',
    mensajeEnviado:
      'Si ese email tiene una cuenta con nosotros, te mandamos un link para restablecer tu contraseña — revisá tu casilla (y la carpeta de spam).',
    errorGenerico: 'No pudimos procesar el pedido. Probá de nuevo en unos minutos.',
    volverAlLogin: '← Volver a iniciar sesión',
  },
  PT: {
    titulo: 'Recuperar senha',
    subtitulo: 'Digite seu email e enviaremos um link para escolher uma nova.',
    email: 'Email',
    enviarEnlace: 'Enviar link',
    enviando: 'Enviando...',
    mensajeEnviado:
      'Se esse email tiver uma conta conosco, enviamos um link para redefinir sua senha — verifique sua caixa de entrada (e a pasta de spam).',
    errorGenerico: 'Não conseguimos processar o pedido. Tente novamente em alguns minutos.',
    volverAlLogin: '← Voltar para entrar',
  },
};
