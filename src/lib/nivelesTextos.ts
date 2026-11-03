// lib/nivelesTextos.ts
//
// TEXTOS AMPLIADOS DE CADA NIVEL Y ESCALÓN
// =====================================================
// Los nombres, emojis y la frase corta de cada nivel viven en la tabla
// niveles_gamificacion (nivel, nombre, mision, mensaje). Esto los
// complementa con el relato de la etapa, qué significa haberla alcanzado y un
// consejo para la siguiente, más el nombre de cada escalón de los objetivos
// escalonados. Se muestran en «ADN de la empresa». Se mantiene en código y no
// en la base porque lleva los dos idiomas y cambia junto con la pantalla.

import type { Idioma } from './i18n';

export type TextoNivel = {
  etapa: string; // en qué momento está el negocio
  significa: string; // qué dice de la empresa haber llegado acá
  consejo: string; // cómo empujar hacia el siguiente nivel
};

type Textos = Record<Idioma, TextoNivel>;

export const TEXTOS_NIVEL: Record<number, Textos> = {
  1: {
    ES: {
      etapa: 'Todo empieza con el primer registro. En esta etapa el sistema todavía te está conociendo y vos estás armando el hábito de anotar.',
      significa: 'Dejaste de llevar el negocio de memoria: cada operación cargada es un dato real que antes no existía.',
      consejo: 'No busques que sea perfecto: cargá lo que pasa, el mismo día, aunque sea de a poco. La constancia vale más que la cantidad.',
    },
    PT: {
      etapa: 'Tudo começa com o primeiro registro. Nesta etapa o sistema ainda está te conhecendo e você está criando o hábito de anotar.',
      significa: 'Você deixou de levar o negócio de cabeça: cada operação lançada é um dado real que antes não existia.',
      consejo: 'Não busque a perfeição: lance o que acontece, no mesmo dia, mesmo que aos poucos. A constância vale mais que a quantidade.',
    },
  },
  2: {
    ES: {
      etapa: 'Ya hay una base de registros. Empiezan a aparecer patrones: qué se repite, qué cuesta más y cuándo entra el dinero.',
      significa: 'El orden dejó de ser una intención y pasó a ser una rutina. Tu información ya se puede comparar con la de la semana anterior.',
      consejo: 'Probá usar categorías y formas de pago de forma consistente: así los informes se vuelven más claros sin esfuerzo extra.',
    },
    PT: {
      etapa: 'Já existe uma base de registros. Começam a aparecer padrões: o que se repete, o que custa mais e quando o dinheiro entra.',
      significa: 'A organização deixou de ser uma intenção e virou rotina. Sua informação já pode ser comparada com a da semana anterior.',
      consejo: 'Use categorias e formas de pagamento de modo consistente: assim os relatórios ficam mais claros sem esforço extra.',
    },
  },
  3: {
    ES: {
      etapa: 'Con 150 operaciones el negocio ya tiene historia propia. Podés mirar atrás y entender cómo se comportó.',
      significa: 'Empezaste a gestionar y no solo a registrar: lo cargado alcanza para detectar qué meses rinden más y cuáles pesan más.',
      consejo: 'Visitá el Panel de Control una vez por semana. Con tu volumen de datos las tendencias ya dicen cosas.',
    },
    PT: {
      etapa: 'Com 150 operações o negócio já tem história própria. Você pode olhar para trás e entender como ele se comportou.',
      significa: 'Você começou a gerir e não só a registrar: o que foi lançado já basta para ver quais meses rendem mais e quais pesam mais.',
      consejo: 'Visite o Painel de Controle uma vez por semana. Com o seu volume de dados as tendências já dizem coisas.',
    },
  },
  4: {
    ES: {
      etapa: 'La empresa gana estructura: hay rutinas de carga, responsables y un orden que se nota en cada pantalla.',
      significa: 'Tu negocio ya funciona con método. Lo que antes dependía de la memoria ahora queda respaldado por registros.',
      consejo: 'Es buen momento para sumar objetivos concretos y repartir la carga entre las personas del equipo.',
    },
    PT: {
      etapa: 'A empresa ganha estrutura: há rotinas de lançamento, responsáveis e uma ordem que se nota em cada tela.',
      significa: 'Seu negócio já funciona com método. O que antes dependia da memória agora fica amparado por registros.',
      consejo: 'É um bom momento para definir objetivos concretos e dividir a carga entre as pessoas da equipe.',
    },
  },
  5: {
    ES: {
      etapa: 'Mitad del camino: los datos dejan de ser un archivo y pasan a ser una herramienta para decidir.',
      significa: 'Ya no preguntás «¿cómo me fue?» sino «¿qué hago ahora?». Las decisiones empiezan a apoyarse en números.',
      consejo: 'Compará períodos y mirá qué cuentas más se mueven. Una decisión pequeña tomada con datos suma más que una grande a ciegas.',
    },
    PT: {
      etapa: 'Metade do caminho: os dados deixam de ser um arquivo e passam a ser uma ferramenta para decidir.',
      significa: 'Você já não pergunta «como fui?» e sim «o que faço agora?». As decisões começam a se apoiar em números.',
      consejo: 'Compare períodos e veja quais contas mais se movimentam. Uma decisão pequena tomada com dados soma mais que uma grande às cegas.',
    },
  },
  6: {
    ES: {
      etapa: 'La información acumulada ya cuenta una historia completa: estaciones, ritmos y hábitos del negocio.',
      significa: 'Podés explicar tu empresa con datos propios, a un socio, a un banco o a vos mismo.',
      consejo: 'Aprovechá los informes para leer la historia: dónde creció el negocio y qué quedó pendiente.',
    },
    PT: {
      etapa: 'A informação acumulada já conta uma história completa: estações, ritmos e hábitos do negócio.',
      significa: 'Você consegue explicar sua empresa com dados próprios, a um sócio, a um banco ou a você mesmo.',
      consejo: 'Aproveite os relatórios para ler a história: onde o negócio cresceu e o que ficou pendente.',
    },
  },
  7: {
    ES: {
      etapa: 'Con la base firme llega el momento de mirar hacia adelante: nuevas ventas, nuevos productos, nuevos mercados.',
      significa: 'Tu constancia te dio margen para explorar sin perder el control de lo que ya funciona.',
      consejo: 'Elegí una sola oportunidad de crecimiento por vez y usá tus objetivos para medir si valió la pena.',
    },
    PT: {
      etapa: 'Com a base firme chega a hora de olhar para a frente: novas vendas, novos produtos, novos mercados.',
      significa: 'Sua constância deu margem para explorar sem perder o controle do que já funciona.',
      consejo: 'Escolha uma única oportunidade de crescimento por vez e use seus objetivos para medir se valeu a pena.',
    },
  },
  8: {
    ES: {
      etapa: 'La disciplina ya es parte de la cultura de la empresa: se carga, se revisa y se corrige a tiempo.',
      significa: 'Tu negocio opera con control. Las sorpresas son raras porque los números se miran antes de que se vuelvan problemas.',
      consejo: 'Mantené el ritmo y documentá lo que funciona: es lo que hace que el negocio pueda crecer sin depender de una sola persona.',
    },
    PT: {
      etapa: 'A disciplina já é parte da cultura da empresa: lança-se, revisa-se e corrige-se a tempo.',
      significa: 'Seu negócio opera com controle. As surpresas são raras porque os números são vistos antes de virarem problemas.',
      consejo: 'Mantenha o ritmo e documente o que funciona: é o que permite ao negócio crescer sem depender de uma só pessoa.',
    },
  },
  9: {
    ES: {
      etapa: 'Dominás el sistema y el sistema ya es parte de cómo pensás el negocio. Casi no hay pantalla que no conozcas.',
      significa: 'Lideras con claridad: sabés dónde está cada dato y qué cuenta cada número.',
      consejo: 'Compartí lo que aprendiste con tu equipo: un negocio ordenado se sostiene cuando todos usan el mismo lenguaje.',
    },
    PT: {
      etapa: 'Você domina o sistema e o sistema já faz parte de como você pensa o negócio. Quase não há tela que você não conheça.',
      significa: 'Você lidera com clareza: sabe onde está cada dado e o que conta cada número.',
      consejo: 'Compartilhe o que aprendeu com a equipe: um negócio organizado se sustenta quando todos usam a mesma linguagem.',
    },
  },
  10: {
    ES: {
      etapa: 'Última etapa del camino y, a la vez, el comienzo de otro: ahora se trata de sostener la excelencia día a día.',
      significa: 'Tu empresa construye futuro con propósito. El hábito ya es tuyo y los datos trabajan a tu favor.',
      consejo: 'Seguí sumando trofeos y objetivos: la Leyenda no es un punto de llegada, es una forma de trabajar.',
    },
    PT: {
      etapa: 'Última etapa do caminho e, ao mesmo tempo, o começo de outro: agora trata-se de sustentar a excelência dia após dia.',
      significa: 'Sua empresa constrói futuro com propósito. O hábito já é seu e os dados trabalham a seu favor.',
      consejo: 'Continue somando troféus e objetivos: a Lenda não é um ponto de chegada, é uma forma de trabalhar.',
    },
  },
};

export function textoDelNivel(nivel: number, idioma: string | null | undefined): TextoNivel {
  const n = Math.min(Math.max(Math.round(nivel) || 1, 1), 10);
  return TEXTOS_NIVEL[n][idioma === 'PT' ? 'PT' : 'ES'];
}

// Los tres checkpoints de cada operación dentro de un nivel (ver lib/objetivosEscalonados.ts).
export const ESCALONES: Array<{ emoji: string; es: string; pt: string; esDetalle: string; ptDetalle: string }> = [
  { emoji: '🥾', es: 'Primer escalón: el arranque', pt: 'Primeiro degrau: a largada', esDetalle: 'Es el empujón inicial del nivel: lo más fácil de alcanzar y lo que marca el ritmo.', ptDetalle: 'É o empurrão inicial do nível: o mais fácil de alcançar e o que dá o ritmo.' },
  { emoji: '🧗', es: 'Segundo escalón: el ritmo', pt: 'Segundo degrau: o ritmo', esDetalle: 'A mitad de camino: demuestra que tomaste el hábito y que no fue solo un buen día.', ptDetalle: 'No meio do caminho: mostra que você pegou o hábito e que não foi só um bom dia.' },
  { emoji: '🏔️', es: 'Tercer escalón: la cima', pt: 'Terceiro degrau: o topo', esDetalle: 'Es lo más alto del nivel para esa operación: cumplirlo te deja listo para el siguiente.', ptDetalle: 'É o ponto mais alto do nível para essa operação: cumpri-lo deixa você pronto para o próximo.' },
];

export function escalon(indice: number) {
  return ESCALONES[Math.min(Math.max(indice, 0), ESCALONES.length - 1)];
}
