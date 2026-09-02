// components/panel/i18n.ts
//
// Diccionario compartido de SabioHero y PieVisao (los dos componentes
// que arma el Lobby, src/app/page.tsx). Misma mecánica que
// app/configuracoes/i18n.ts — ver lib/i18n.ts.

import type { Diccionario } from '@/lib/i18n';

export type ClavePanel =
  // SabioHero
  | 'miNegocioEyebrow'
  | 'progresoNegocio'
  | 'nivel'
  | 'operacionesRegistradas'
  | 'progreso'
  | 'mision'
  | 'faltan'
  | 'faltanCero'
  | 'operacionesPalabra'
  | 'enElSistema'
  | 'sabioEyebrow'
  | 'companeroFinanciero'
  | 'tocaParaOtroConsejo'
  // PieVisao
  | 'lemaParte1'
  | 'lemaDestacado1'
  | 'lemaParte2'
  | 'lemaDestacado2'
  | 'parrafoTransformamos1'
  | 'parrafoTransformamosDestacado1'
  | 'parrafoTransformamos2'
  | 'parrafoTransformamosDestacado2'
  | 'parrafoTransformamos3'
  | 'nuestroProposito'
  | 'parrafoProposito'
  | 'seguinosInstagram'
  | 'pieDeMarca'
  | 'pilarInformacionTitulo'
  | 'pilarInformacionBajada'
  | 'pilarDecisionesTitulo'
  | 'pilarDecisionesBajada'
  | 'pilarControlTitulo'
  | 'pilarControlBajada'
  | 'pilarEstrategiasTitulo'
  | 'pilarEstrategiasBajada'
  | 'pilarAcompanamientoTitulo'
  | 'pilarAcompanamientoBajada'
  | 'valorClaridadTitulo'
  | 'valorClaridadBajada'
  | 'valorSeguridadTitulo'
  | 'valorSeguridadBajada'
  | 'valorCrecimientoTitulo'
  | 'valorCrecimientoBajada';

export const diccionarioPanel: Diccionario<ClavePanel> = {
  ES: {
    miNegocioEyebrow: 'MI NEGOCIO',
    progresoNegocio: 'PROGRESO DE TU NEGOCIO',
    nivel: 'Nivel',
    operacionesRegistradas: 'operaciones registradas',
    progreso: 'Progreso',
    mision: 'Misión',
    faltan: 'Faltan',
    faltanCero: '0 operaciones',
    operacionesPalabra: 'operaciones',
    enElSistema: 'en el sistema',
    sabioEyebrow: 'SABIO',
    companeroFinanciero: 'Tu compañero financiero',
    tocaParaOtroConsejo: '👆 Tocá para otro consejo',
    lemaParte1: 'CLARIDAD PARA',
    lemaDestacado1: 'DECIDIR',
    lemaParte2: 'SEGURIDAD PARA',
    lemaDestacado2: 'CRECER',
    parrafoTransformamos1: 'Transformamos información financiera en',
    parrafoTransformamosDestacado1: 'claridad',
    parrafoTransformamos2: 'para que tomes mejores decisiones y hagas crecer tu negocio con',
    parrafoTransformamosDestacado2: 'seguridad',
    parrafoTransformamos3: '.',
    nuestroProposito: 'NUESTRO PROPÓSITO',
    parrafoProposito: 'Ser tu aliado estratégico en la gestión financiera para que tu negocio crezca más, mejor y con visión.',
    seguinosInstagram: 'Seguinos en Instagram',
    pieDeMarca: 'Visão Financeira · Plataforma de gestión financiera',
    pilarInformacionTitulo: 'Información',
    pilarInformacionBajada: 'que aclara',
    pilarDecisionesTitulo: 'Decisiones',
    pilarDecisionesBajada: 'que impulsan',
    pilarControlTitulo: 'Control',
    pilarControlBajada: 'que da seguridad',
    pilarEstrategiasTitulo: 'Estrategias',
    pilarEstrategiasBajada: 'que generan valor',
    pilarAcompanamientoTitulo: 'Acompañamiento',
    pilarAcompanamientoBajada: 'que hace crecer',
    valorClaridadTitulo: 'Claridad',
    valorClaridadBajada: 'para entender tu negocio.',
    valorSeguridadTitulo: 'Seguridad',
    valorSeguridadBajada: 'para tomar decisiones.',
    valorCrecimientoTitulo: 'Crecimiento',
    valorCrecimientoBajada: 'para alcanzar tus objetivos.',
  },
  PT: {
    miNegocioEyebrow: 'MEU NEGÓCIO',
    progresoNegocio: 'PROGRESSO DO SEU NEGÓCIO',
    nivel: 'Nível',
    operacionesRegistradas: 'operações registradas',
    progreso: 'Progresso',
    mision: 'Missão',
    faltan: 'Faltam',
    faltanCero: '0 operações',
    operacionesPalabra: 'operações',
    enElSistema: 'no sistema',
    sabioEyebrow: 'SABIO',
    companeroFinanciero: 'Seu companheiro financeiro',
    tocaParaOtroConsejo: '👆 Toque para outra dica',
    lemaParte1: 'CLAREZA PARA',
    lemaDestacado1: 'DECIDIR',
    lemaParte2: 'SEGURANÇA PARA',
    lemaDestacado2: 'CRESCER',
    parrafoTransformamos1: 'Transformamos informação financeira em',
    parrafoTransformamosDestacado1: 'clareza',
    parrafoTransformamos2: 'para que você tome melhores decisões e faça seu negócio crescer com',
    parrafoTransformamosDestacado2: 'segurança',
    parrafoTransformamos3: '.',
    nuestroProposito: 'NOSSO PROPÓSITO',
    parrafoProposito: 'Ser seu aliado estratégico na gestão financeira para que seu negócio cresça mais, melhor e com visão.',
    seguinosInstagram: 'Siga-nos no Instagram',
    pieDeMarca: 'Visão Financeira · Plataforma de gestão financeira',
    pilarInformacionTitulo: 'Informação',
    pilarInformacionBajada: 'que esclarece',
    pilarDecisionesTitulo: 'Decisões',
    pilarDecisionesBajada: 'que impulsionam',
    pilarControlTitulo: 'Controle',
    pilarControlBajada: 'que dá segurança',
    pilarEstrategiasTitulo: 'Estratégias',
    pilarEstrategiasBajada: 'que geram valor',
    pilarAcompanamientoTitulo: 'Acompanhamento',
    pilarAcompanamientoBajada: 'que faz crescer',
    valorClaridadTitulo: 'Clareza',
    valorClaridadBajada: 'para entender seu negócio.',
    valorSeguridadTitulo: 'Segurança',
    valorSeguridadBajada: 'para tomar decisões.',
    valorCrecimientoTitulo: 'Crescimento',
    valorCrecimientoBajada: 'para alcançar seus objetivos.',
  },
};

// Las 10 frases rotativas del globo de Sabio — se traducen aparte
// porque son un array de strings, no claves fijas.
export const FRASES_SABIO_POR_IDIOMA: Record<'ES' | 'PT', string[]> = {
  ES: [
    'El Activo es todo lo que tu negocio tiene y le pertenece.',
    'El Pasivo es todo lo que tu negocio debe a otros.',
    'El Patrimonio es lo que te queda a vos después de pagar todas las deudas.',
    'Registrar cada operación el mismo día evita dolores de cabeza a fin de mes.',
    'El CMV es el costo de lo que realmente vendiste, no de lo que compraste.',
    'Un asiento contable siempre tiene un Debe y un Haber que se equilibran.',
    'La liquidez mide si podés pagar tus deudas de corto plazo con lo que tenés a mano.',
    'El flujo de caja te dice si entra más plata de la que sale, mes a mes.',
    'Validar tus operaciones a tiempo mantiene tus informes confiables.',
    'La rentabilidad muestra qué porcentaje de tus ventas se convierte en ganancia.',
  ],
  PT: [
    'O Ativo é tudo o que seu negócio tem e lhe pertence.',
    'O Passivo é tudo o que seu negócio deve a terceiros.',
    'O Patrimônio é o que sobra para você depois de pagar todas as dívidas.',
    'Registrar cada operação no mesmo dia evita dores de cabeça no fim do mês.',
    'O CMV é o custo do que você realmente vendeu, não do que comprou.',
    'Um lançamento contábil sempre tem um Débito e um Crédito que se equilibram.',
    'A liquidez mede se você pode pagar suas dívidas de curto prazo com o que tem em mãos.',
    'O fluxo de caixa mostra se entra mais dinheiro do que sai, mês a mês.',
    'Validar suas operações em dia mantém seus relatórios confiáveis.',
    'A rentabilidade mostra qual porcentagem das suas vendas vira lucro.',
  ],
};
