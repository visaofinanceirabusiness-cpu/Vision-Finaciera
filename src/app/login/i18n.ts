import type { Diccionario } from '@/lib/i18n';

type Clave =
  | 'eslogan'
  | 'volverAlSitio'
  | 'email'
  | 'contrasena'
  | 'entrando'
  | 'entrar'
  | 'noTenesCuenta'
  | 'creaUnaAca'
  | 'errorEmailNoConfirmado'
  | 'errorCredenciales'
  | 'errorSinPerfil';

export const diccionarioLogin: Diccionario<Clave> = {
  ES: {
    eslogan: 'Claridad para decidir. Seguridad para crecer.',
    volverAlSitio: '← Volver al sitio',
    email: 'Email',
    contrasena: 'Contraseña',
    entrando: 'Entrando...',
    entrar: 'Entrar',
    noTenesCuenta: '¿Todavía no tenés cuenta?',
    creaUnaAca: 'Creá una acá',
    errorEmailNoConfirmado:
      'Todavía no confirmaste tu email — revisá tu casilla (y la carpeta de spam) y hacé clic en el link que te mandamos.',
    errorCredenciales: 'No pudimos iniciar sesión. Revisá tu email y contraseña.',
    errorSinPerfil: 'Esta cuenta ya no tiene una empresa activa. Contactá al administrador.',
  },
  PT: {
    eslogan: 'Clareza para decidir. Segurança para crescer.',
    volverAlSitio: '← Voltar para o site',
    email: 'Email',
    contrasena: 'Senha',
    entrando: 'Entrando...',
    entrar: 'Entrar',
    noTenesCuenta: 'Ainda não tem uma conta?',
    creaUnaAca: 'Crie uma aqui',
    errorEmailNoConfirmado:
      'Você ainda não confirmou seu email — verifique sua caixa de entrada (e a pasta de spam) e clique no link que enviamos.',
    errorCredenciales: 'Não foi possível entrar. Verifique seu email e senha.',
    errorSinPerfil: 'Esta conta não tem mais uma empresa ativa. Entre em contato com o administrador.',
  },
};
