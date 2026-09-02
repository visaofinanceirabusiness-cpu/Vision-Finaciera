// app/i18n.ts
//
// Diccionario de textos del Lobby (página de inicio, src/app/page.tsx).
// Misma mecánica que app/configuracoes/i18n.ts — ver lib/i18n.ts.

import type { Diccionario } from '@/lib/i18n';

export type ClaveInicio =
  | 'cargandoNegocio'
  | 'solicitudPendienteTitulo'
  | 'solicitudRechazadaTitulo'
  | 'solicitudPendienteTexto'
  | 'solicitudRechazadaTexto'
  | 'cerrarSesion'
  | 'volverAMiPanel'
  | 'gestionFinancieraDefault'
  | 'miNegocioDefault'
  | 'subtituloDefault'
  | 'eyebrowGestion'
  | 'tusHerramientas'
  | 'herramientaPanelControl'
  | 'herramientaContabilidad'
  | 'herramientaMercaderia'
  | 'herramientaInformes'
  | 'herramientaProduccion'
  | 'herramientaRecursosHumanos'
  | 'herramientaConfiguracoes'
  | 'indicadorVentasDelMes'
  | 'indicadorComprasDelMes'
  | 'indicadorOperacionesRegistradas'
  | 'indicadorValorInventario'
  | 'indicadorPublicaciones'
  | 'indicadorHistorias'
  | 'indicadorNuevosSeguidores'
  | 'indicadorMensajes';

export const diccionarioInicio: Diccionario<ClaveInicio> = {
  ES: {
    cargandoNegocio: 'Cargando tu negocio...',
    solicitudPendienteTitulo: 'Tu cuenta está esperando aprobación',
    solicitudRechazadaTitulo: 'Tu solicitud fue rechazada',
    solicitudPendienteTexto: 'Un administrador todavía tiene que revisar tu solicitud de alta. En cuanto la apruebe, vas a poder entrar acá mismo con tu email y contraseña.',
    solicitudRechazadaTexto: 'Ponete en contacto con el administrador si creés que esto es un error.',
    cerrarSesion: 'Cerrar sesión',
    volverAMiPanel: '🔱 Volver a mi Panel',
    gestionFinancieraDefault: 'Gestión financiera',
    miNegocioDefault: 'Mi Negocio',
    subtituloDefault: 'Tu negocio, tus números y tus próximos objetivos.',
    eyebrowGestion: 'GESTIÓN',
    tusHerramientas: 'Tus herramientas',
    herramientaPanelControl: '📊 Panel de Control',
    herramientaContabilidad: '🧾 Contabilidad',
    herramientaMercaderia: '📦 Mercadería',
    herramientaInformes: '📈 Informes',
    herramientaProduccion: '🏭 Producción',
    herramientaRecursosHumanos: '👥 Recursos Humanos',
    herramientaConfiguracoes: '⚙️ Configuraciones',
    indicadorVentasDelMes: 'Ventas del mes',
    indicadorComprasDelMes: 'Compras del mes',
    indicadorOperacionesRegistradas: 'Operaciones registradas',
    indicadorValorInventario: 'Valor del inventario',
    indicadorPublicaciones: 'Publicaciones',
    indicadorHistorias: 'Historias',
    indicadorNuevosSeguidores: 'Nuevos seguidores',
    indicadorMensajes: 'Mensajes',
  },
  PT: {
    cargandoNegocio: 'Carregando o seu negócio...',
    solicitudPendienteTitulo: 'Sua conta está aguardando aprovação',
    solicitudRechazadaTitulo: 'Sua solicitação foi rejeitada',
    solicitudPendienteTexto: 'Um administrador ainda precisa revisar sua solicitação de cadastro. Assim que ele aprovar, você vai poder entrar aqui mesmo com seu email e senha.',
    solicitudRechazadaTexto: 'Entre em contato com o administrador se achar que isso é um engano.',
    cerrarSesion: 'Sair',
    volverAMiPanel: '🔱 Voltar ao meu Painel',
    gestionFinancieraDefault: 'Gestão financeira',
    miNegocioDefault: 'Meu Negócio',
    subtituloDefault: 'Seu negócio, seus números e seus próximos objetivos.',
    eyebrowGestion: 'GESTÃO',
    tusHerramientas: 'Suas ferramentas',
    herramientaPanelControl: '📊 Painel de Controle',
    herramientaContabilidad: '🧾 Contabilidade',
    herramientaMercaderia: '📦 Mercadoria',
    herramientaInformes: '📈 Relatórios',
    herramientaProduccion: '🏭 Produção',
    herramientaRecursosHumanos: '👥 Recursos Humanos',
    herramientaConfiguracoes: '⚙️ Configurações',
    indicadorVentasDelMes: 'Vendas do mês',
    indicadorComprasDelMes: 'Compras do mês',
    indicadorOperacionesRegistradas: 'Operações registradas',
    indicadorValorInventario: 'Valor do estoque',
    indicadorPublicaciones: 'Publicações',
    indicadorHistorias: 'Stories',
    indicadorNuevosSeguidores: 'Novos seguidores',
    indicadorMensajes: 'Mensagens',
  },
};
