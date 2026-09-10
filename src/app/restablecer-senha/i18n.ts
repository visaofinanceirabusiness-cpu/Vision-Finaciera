import type { Diccionario } from '@/lib/i18n';

type Clave =
  | 'titulo'
  | 'subtitulo'
  | 'verificando'
  | 'contrasenaNueva'
  | 'confirmarContrasena'
  | 'guardarContrasena'
  | 'guardando'
  | 'errorContrasenaCorta'
  | 'errorNoCoincide'
  | 'errorGenerico'
  | 'errorLinkInvalido'
  | 'pedirLinkNuevo'
  | 'mensajeExito'
  | 'irAIniciarSesion';

export const diccionarioRestablecerSenha: Diccionario<Clave> = {
  ES: {
    titulo: 'Elegí tu nueva contraseña',
    subtitulo: 'Se aplica a partir de ahora, para volver a entrar.',
    verificando: 'Verificando el enlace...',
    contrasenaNueva: 'Contraseña nueva',
    confirmarContrasena: 'Confirmar contraseña',
    guardarContrasena: 'Guardar contraseña',
    guardando: 'Guardando...',
    errorContrasenaCorta: 'La contraseña tiene que tener al menos 6 caracteres.',
    errorNoCoincide: 'Las contraseñas no coinciden.',
    errorGenerico: 'No pudimos guardar la contraseña nueva. Probá de nuevo.',
    errorLinkInvalido:
      'Este enlace ya venció o no es válido — los enlaces de recuperación duran un tiempo limitado y solo sirven una vez.',
    pedirLinkNuevo: 'Pedir un enlace nuevo →',
    mensajeExito: 'Tu contraseña se actualizó. Ya podés iniciar sesión con la nueva.',
    irAIniciarSesion: 'Ir a iniciar sesión',
  },
  PT: {
    titulo: 'Escolha sua nova senha',
    subtitulo: 'Vale a partir de agora, para entrar de novo.',
    verificando: 'Verificando o link...',
    contrasenaNueva: 'Senha nova',
    confirmarContrasena: 'Confirmar senha',
    guardarContrasena: 'Salvar senha',
    guardando: 'Salvando...',
    errorContrasenaCorta: 'A senha precisa ter pelo menos 6 caracteres.',
    errorNoCoincide: 'As senhas não coincidem.',
    errorGenerico: 'Não conseguimos salvar a nova senha. Tente novamente.',
    errorLinkInvalido: 'Este link já venceu ou não é válido — os links de recuperação duram um tempo limitado e servem uma única vez.',
    pedirLinkNuevo: 'Pedir um link novo →',
    mensajeExito: 'Sua senha foi atualizada. Você já pode entrar com a nova.',
    irAIniciarSesion: 'Ir para entrar',
  },
};
