// app/mensajes/i18n.ts
//
// Diccionario de textos de Mensajes (página src/app/mensajes/page.tsx).
// Misma mecánica que app/i18n.ts / app/configuracoes/i18n.ts — ver lib/i18n.ts.
//
// El CONTENIDO de los mensajes de Sabio (MENSAJES_ENCANTO, hoy escritos a
// mano) no se traduce acá: es contenido de prueba que va a ser reemplazado
// por generación automática (ver comentario en page.tsx). Esto traduce
// solo el "chrome" de la pantalla — títulos, botones, estados de carga.

import type { Diccionario } from '@/lib/i18n';

export type ClaveMensajes =
  | 'cargandoMensajes'
  | 'errorTitulo'
  | 'volverAlInicio'
  | 'volverAlInicioBoton'
  | 'marcaVisaoFinanceira'
  | 'mensajesPara'
  | 'tituloPagina'
  | 'subtituloPagina'
  | 'mensajeNumero'
  | 'pieMensajes'
  | 'sinMensajesTitulo'
  | 'sinMensajesTexto';

export const diccionarioMensajes: Diccionario<ClaveMensajes> = {
  ES: {
    cargandoMensajes: 'Cargando mensajes...',
    errorTitulo: 'No pudimos cargar tus mensajes',
    volverAlInicio: '← Volver al inicio',
    volverAlInicioBoton: 'Volver al inicio',
    marcaVisaoFinanceira: 'Visão Financeira',
    mensajesPara: 'Mensajes para',
    tituloPagina: 'Lo que tus números están diciendo',
    subtituloPagina:
      'Sabio analizó la información de tu negocio y separó algunos puntos importantes para que puedas tomar mejores decisiones.',
    mensajeNumero: 'MENSAJE',
    pieMensajes: '🦉 Sabio estará aquí cuando quieras entender mejor tus números.',
    sinMensajesTitulo: 'Todavía no hay mensajes para vos',
    sinMensajesTexto: 'En cuanto tengas más movimientos registrados, Sabio va a empezar a dejarte análisis acá.',
  },
  PT: {
    cargandoMensajes: 'Carregando suas mensagens...',
    errorTitulo: 'Não conseguimos carregar suas mensagens',
    volverAlInicio: '← Voltar ao início',
    volverAlInicioBoton: 'Voltar ao início',
    marcaVisaoFinanceira: 'Visão Financeira',
    mensajesPara: 'Mensagens para',
    tituloPagina: 'O que os seus números estão dizendo',
    subtituloPagina:
      'Sabio analisou as informações do seu negócio e separou alguns pontos importantes para que você tome melhores decisões.',
    mensajeNumero: 'MENSAGEM',
    pieMensajes: '🦉 Sabio estará aqui quando você quiser entender melhor os seus números.',
    sinMensajesTitulo: 'Ainda não há mensagens para você',
    sinMensajesTexto: 'Assim que você tiver mais movimentos registrados, Sabio vai começar a deixar análises aqui.',
  },
};
