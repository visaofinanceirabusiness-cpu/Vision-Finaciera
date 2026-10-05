import type { Diccionario } from '@/lib/i18n';

type Clave = 'volver' | 'eyebrow' | 'titulo' | 'subtitulo' | 'tabCompromisos' | 'tabFlujo' | 'tabDeudas';

export const diccionarioFinanzas: Diccionario<Clave> = {
  ES: {
    volver: '← Volver a Mi Negocio',
    eyebrow: 'GESTIÓN FINANCIERA',
    titulo: 'Finanzas',
    subtitulo: 'Lo que tenés por cobrar y por pagar, hoy y en los próximos meses.',
    tabCompromisos: '🤝 Compromisos',
    tabFlujo: '📈 Flujo proyectado',
    tabDeudas: '🏦 Deudas y préstamos',
  },
  PT: {
    volver: '← Voltar para Meu Negócio',
    eyebrow: 'GESTÃO FINANCEIRA',
    titulo: 'Finanças',
    subtitulo: 'O que você tem a receber e a pagar, hoje e nos próximos meses.',
    tabCompromisos: '🤝 Compromissos',
    tabFlujo: '📈 Fluxo projetado',
    tabDeudas: '🏦 Dívidas e empréstimos',
  },
};

export const FRASES_SABIO_FINANZAS: Record<'ES' | 'PT', string[]> = {
  ES: [
    'Acá cargás lo que vas a cobrar y a pagar; yo te aviso cuando se acerque un vencimiento.',
    'Con "Mes a mes", cada compromiso se reconoce en su período y se salda cuando lo cobrás o pagás.',
    'Los meses que vienen quedan programados: no suman al balance hasta que llegan.',
    'En Flujo proyectado ves cuánta plata te queda cada mes si cobrás y pagás lo comprometido.',
  ],
  PT: [
    'Aqui você registra o que vai receber e pagar; eu aviso quando um vencimento se aproximar.',
    'Com "Mês a mês", cada compromisso é reconhecido no seu período e quitado quando você recebe ou paga.',
    'Os meses seguintes ficam programados: não entram no balanço até chegarem.',
    'Em Fluxo projetado você vê quanto dinheiro sobra a cada mês se receber e pagar o que está comprometido.',
  ],
};

export function frasesSabioFinanzas(idioma: string | null | undefined): string[] {
  return FRASES_SABIO_FINANZAS[idioma === 'PT' ? 'PT' : 'ES'];
}
