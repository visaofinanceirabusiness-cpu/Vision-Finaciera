// lib/mensajesTutorial.ts
//
// TUTORIALES DE BIENVENIDA
// =====================================================
//
// Primer "paquete" de mensajes que recibe toda empresa nueva en
// Mensajes (ver src/app/mensajes/page.tsx): un mensaje por cada
// herramienta que la empresa tiene activa, explicando cómo usarla.
//
// Qué herramientas recibe cada empresa:
//   - Panel de Control, Informes y Configuraciones: siempre.
//   - Mercadería: solo si empresaManejaMercaderia(empresaId).
//   - Producción: solo si empresaTieneModulo(empresaId, 'PRODUCCION').
//   - Contabilidad y Recursos Humanos: siempre, pero con un texto
//     distinto según el perfil (Familia usa "Fuente de ingreso /
//     Destino de pago / Socio-a" en vez de "Cliente / Proveedor").
//
// El idioma del texto sigue empresas.idioma (ES o PT) — igual que el
// resto de la plataforma. Los NOMBRES de operación que se mencionan
// (Venta, Compra, Cobro, Pago...) van traducidos con
// nombreOperacionDisplay (lib/i18n.ts), igual que en el desplegable
// real de Operação — el dato guardado en la tabla "operaciones" sigue
// en español siempre, esto solo ajusta lo que se muestra.

import { supabase } from './supabase';
import { empresaManejaMercaderia, empresaTieneModulo } from './perfilCapacidades';
import { nombreOperacionDisplay, perfilEmpresaDisplay } from './i18n';

type CodigoTutorial =
  | 'PANEL'
  | 'CONTAB_STD'
  | 'CONTAB_FAM'
  | 'MERCADERIA'
  | 'INFORMES'
  | 'PRODUCCION'
  | 'RRHH_STD'
  | 'RRHH_FAM'
  | 'CONFIG';

type TextoTutorial = { titulo: string; texto: string };

const TEXTOS: Record<'ES' | 'PT', Record<CodigoTutorial, TextoTutorial>> = {
  ES: {
    PANEL: {
      titulo: 'Así se ve tu Panel de Control',
      texto: `¡Hola! 👋

Este es el primero de una serie de mensajes para ayudarte a sacarle todo el jugo al sistema. Empezamos por el Panel de Control, porque es la puerta de entrada a tu negocio.

Ahí vas a encontrar:

📊 Tu negocio hoy: cuánto tenés en caja, cuánto debés y cuál es tu patrimonio — actualizado en tiempo real, sin que tengas que calcular nada.

📈 Resumen ejecutivo: ingresos, gastos y resultado del período que elijas arriba (podés cambiar el mes o ver "Todos los períodos").

🎯 Objetivos: metas que podés seguir mes a mes — de a poco vas a ver si estás cumpliendo lo que te propusiste.

🏆 Tu nivel: a medida que cargás operaciones vas subiendo de nivel — es una forma de ver que el sistema te acompaña en tu progreso.

💡 Mi recomendación: entrá acá primero cada vez que quieras saber "¿cómo viene mi negocio?", antes de meterte en el detalle de cada herramienta.

Un abrazo,
Sabio 🦉`,
    },
    CONTAB_STD: {
      titulo: 'Cómo registrar tus operaciones en Contabilidad',
      texto: `¡Hola! 👋

Contabilidad es el corazón del sistema: ahí cargás cada movimiento de tu negocio y yo me encargo de que quede bien asentado en tu Libro Diario, sin que necesites saber de partida doble.

Para registrar una operación elegís, en este orden:

1️⃣ Operación: qué tipo de movimiento es (Venta, Compra, Cobro, Pago, Inversión, Extracción o Transferencia).
2️⃣ Categoría: a qué corresponde (por ejemplo, qué producto vendiste o en qué gastaste).
3️⃣ Forma de pago: con qué medio se movió la plata (Efectivo, Tarjeta, Transferencia...).
4️⃣ A quién: tu cliente, tu proveedor, o quién corresponda.

Con esos 4 datos y el monto, yo resuelvo automáticamente qué cuentas contables debitar y acreditar.

💡 Mi recomendación: cargá las operaciones el mismo día que pasan — así tu Panel de Control y tus Informes siempre reflejan la realidad, y no tenés que reconstruir la memoria a fin de mes.

Un abrazo,
Sabio 🦉`,
    },
    CONTAB_FAM: {
      titulo: 'Cómo registrar los movimientos de tu familia',
      texto: `¡Hola! 👋

Contabilidad es donde vas a cargar cada movimiento de plata de tu familia: un ingreso, un gasto, un aporte, un retiro, o una transferencia hacia un ahorro.

Para registrar un movimiento elegís, en este orden:

1️⃣ Operación: Cobro (un ingreso), Pago (un gasto), Inversión (un aporte de un socio/a), Extracción (un retiro), o Transferencia (mover plata entre tus propias cuentas, por ejemplo hacia un Plazo Fijo).
2️⃣ Categoría: a qué corresponde (Sueldo, Alimentación, Transporte, etc.).
3️⃣ Forma de pago: con qué medio se movió la plata.
4️⃣ Según la operación: la Fuente de ingreso, el Destino de pago, o el Socio/a que corresponda.

💡 Un detalle importante: si estás ahorrando o invirtiendo para una meta (como un viaje), usá siempre "Transferencia" — así el progreso de tu meta en "Objetivos familiares" se actualiza solo.

Cargá los movimientos apenas pasen — así tu Panel de Control siempre va a mostrar la foto real de tu economía familiar.

Un abrazo,
Sabio 🦉`,
    },
    MERCADERIA: {
      titulo: 'Así controlás tu stock en Mercadería',
      texto: `¡Hola! 👋

Mercadería te muestra, en tiempo real, cuánto stock tenés y cuánto vale.

Tiene dos pestañas:

📦 Saldo Mercadería: el catálogo de tus productos, con saldo disponible, costo promedio y valor de inventario. Desde acá también das de alta productos nuevos con el botón "+ Nuevo producto".

🔁 Movimientos de Mercadería: el historial de entradas (compras) y salidas (ventas), generado automáticamente cuando cargaste operaciones en Contabilidad.

💡 Mi recomendación: cada vez que compres mercadería, cargala como "Compra" en Contabilidad eligiendo el producto — así el stock y el costo se actualizan solos, sin que tengas que tocar nada acá a mano.

Un abrazo,
Sabio 🦉`,
    },
    INFORMES: {
      titulo: 'Lo que podés ver en Informes',
      texto: `¡Hola! 👋

Informes es donde tu contabilidad se transforma en reportes que un contador reconocería al toque. No hace falta que entiendas de contabilidad para leerlos, pero están ahí si algún día los necesitás mostrar.

Vas a encontrar:

📋 Sumas y Saldos: el resumen de todas tus cuentas — sirve para chequear que todo esté cuadrado.
📖 Mayor: el detalle de movimientos de cada cuenta, una por una.
📈 Estado de Resultado: cuánto ganaste (o perdiste) en el período, y de qué se compone ese resultado.
💵 Flujo de Caja: por dónde entró y salió tu dinero.
⚖️ Balance Patrimonial: la foto completa de qué tenés, qué debés y qué es realmente tuyo.

💡 Mi recomendación: revisá el Estado de Resultado al cerrar cada mes — es el que mejor responde a "¿me fue bien este mes?".

Un abrazo,
Sabio 🦉`,
    },
    PRODUCCION: {
      titulo: 'Cómo registrar lo que producís',
      texto: `¡Hola! 👋

Producción te permite convertir insumos en productos terminados, y que el sistema calcule solo cuánto te costó producir cada cosa.

Los pasos son:

1️⃣ Cargá una Receta: qué insumos (y en qué cantidad) se necesitan para hacer un producto terminado.
2️⃣ Registrá una Producción: cuánto fabricaste y en qué fecha. El sistema descuenta automáticamente los insumos consumidos según la receta, y da de alta el stock del producto terminado con su costo real.

💡 Mi recomendación: mantené tus recetas actualizadas si cambian las cantidades o los insumos — así el costo de tus productos terminados siempre refleja la realidad, no una foto vieja.

Un abrazo,
Sabio 🦉`,
    },
    RRHH_STD: {
      titulo: 'Así gestionás tus Clientes y Proveedores',
      texto: `¡Hola! 👋

Recursos Humanos es donde cargás a las personas y empresas con las que trabajás — no es de "empleados", es tu agenda de contactos comerciales.

Tiene dos pestañas:

👥 Clientes: quiénes te compran. Cargalos acá para poder elegirlos después al registrar una Venta o un Cobro.
🏢 Proveedores: a quiénes les comprás. Cargalos acá para elegirlos al registrar una Compra o un Pago.

💡 Mi recomendación: cargá un cliente o proveedor la primera vez que trabajes con él — así después, al registrar operaciones, solo tenés que elegirlo de una lista en vez de escribirlo de nuevo.

Un abrazo,
Sabio 🦉`,
    },
    RRHH_FAM: {
      titulo: 'Así organizás tus fuentes de ingreso y destinos de pago',
      texto: `¡Hola! 👋

Esta herramienta es donde cargás con quién se relaciona la plata que entra y sale de tu familia.

Tiene dos pestañas:

💰 Fuentes de ingreso: de dónde viene la plata (tu empleador, un cliente particular, un marketplace...). Cargalas acá para poder elegirlas después al registrar un Cobro.
🏪 Destinos de pago: a quién le pagás (el súper, la inmobiliaria, el gimnasio...). Cargalos acá para elegirlos al registrar un Pago.

💡 Mi recomendación: cargá una fuente o destino la primera vez que aparezca — así la próxima vez solo lo elegís de una lista.

Un abrazo,
Sabio 🦉`,
    },
    CONFIG: {
      titulo: 'Configuraciones: la caja de herramientas de tu sistema',
      texto: `¡Hola! 👋

Configuraciones es donde se ajustan las reglas de fondo del sistema — normalmente entrás acá una vez para dejar todo armado, y después casi no hace falta volver.

Ahí podés:

🏷️ Cargar tus categorías (de gasto, de producto, de servicio) y decidir a qué cuenta contable corresponde cada una.
💳 Definir tus formas de pago (Efectivo, Tarjeta, Transferencia...) y a qué cuenta se asocia cada una.
🎯 Editar tus Objetivos: cambiar metas, crear nuevas, o desactivar las que no te sirvan.
👪 (Si tu perfil es Familia) Administrar tus Socios/as.

💡 Mi recomendación: si alguna vez Contabilidad te dice "falta asignar la cuenta para esta categoría", es en Configuraciones donde se resuelve.

Un abrazo,
Sabio 🦉`,
    },
  },

  PT: {
    PANEL: {
      titulo: 'Assim está o seu Painel de Controle',
      texto: `Olá! 👋

Esta é a primeira de uma série de mensagens para te ajudar a aproveitar tudo o que o sistema oferece. Vamos começar pelo Painel de Controle, porque é a porta de entrada do seu negócio.

Lá você vai encontrar:

📊 Seu negócio hoje: quanto você tem em caixa, quanto deve e qual é o seu patrimônio — atualizado em tempo real, sem precisar calcular nada.

📈 Resumo executivo: receitas, despesas e resultado do período que você escolher acima (dá para trocar o mês ou ver "Todos os períodos").

🎯 Objetivos: metas que você pode acompanhar mês a mês — aos poucos você vai ver se está cumprindo o que se propôs.

🏆 Seu nível: à medida que você registra operações, vai subindo de nível — é uma forma de ver que o sistema está acompanhando o seu progresso.

💡 Minha recomendação: entre aqui primeiro sempre que quiser saber "como está indo o meu negócio?", antes de entrar no detalhe de cada ferramenta.

Um abraço,
Sabio 🦉`,
    },
    CONTAB_STD: {
      titulo: 'Como registrar suas operações em Contabilidade',
      texto: `Olá! 👋

Contabilidade é o coração do sistema: é ali que você registra cada movimento do seu negócio, e eu cuido para que fique bem lançado no seu Livro Diário, sem que você precise entender de partida dobrada.

Para registrar uma operação, escolha nesta ordem:

1️⃣ Operação: que tipo de movimento é (Compra, Venda, Recebimento, Pagamento, Investimento, Retirada, ou Transferência — para mover dinheiro entre suas próprias contas).
2️⃣ Categoria: a que corresponde (por exemplo, qual produto você vendeu ou em que gastou).
3️⃣ Forma de pagamento: por qual meio o dinheiro se movimentou.
4️⃣ Com quem: seu cliente, seu fornecedor, ou quem corresponder.

Com esses 4 dados e o valor, eu resolvo automaticamente quais contas contábeis debitar e creditar.

💡 Minha recomendação: registre as operações no mesmo dia em que acontecem — assim o seu Painel de Controle e seus Relatórios sempre refletem a realidade.

Um abraço,
Sabio 🦉`,
    },
    CONTAB_FAM: {
      titulo: 'Como registrar as movimentações da sua família',
      texto: `Olá! 👋

Contabilidade é onde você registra cada movimentação de dinheiro da sua família: uma receita, uma despesa, um aporte, uma retirada, ou uma transferência para uma poupança.

Para registrar uma movimentação, escolha nesta ordem:

1️⃣ Operação: Recebimento (uma receita), Pagamento (uma despesa), Investimento (um aporte de um sócio/a), Retirada (uma retirada), ou Transferência (mover dinheiro entre suas próprias contas, por exemplo para uma aplicação).
2️⃣ Categoria: a que corresponde (Salário, Alimentação, Transporte, etc.).
3️⃣ Forma de pagamento: por qual meio o dinheiro se movimentou.
4️⃣ Conforme a operação: a Fonte de renda, o Destino do pagamento, ou o Sócio/a correspondente.

💡 Um detalhe importante: se você está guardando ou investindo para uma meta (como uma viagem), use sempre "Transferência" — assim o progresso da sua meta em "Objetivos familiares" se atualiza sozinho.

Registre as movimentações assim que acontecerem — assim o seu Painel de Controle sempre mostra a foto real da economia da sua família.

Um abraço,
Sabio 🦉`,
    },
    MERCADERIA: {
      titulo: 'Assim você controla seu estoque em Mercadoria',
      texto: `Olá! 👋

Mercadoria mostra, em tempo real, quanto estoque você tem e quanto ele vale.

Tem duas abas:

📦 Saldo de Mercadoria: o catálogo dos seus produtos, com saldo disponível, custo médio e valor de estoque. É aqui também que você cadastra produtos novos, no botão "+ Novo produto".

🔁 Movimentos de Mercadoria: o histórico de entradas (compras) e saídas (vendas), gerado automaticamente quando você registra operações em Contabilidade.

💡 Minha recomendação: toda vez que comprar mercadoria, registre como "Compra" em Contabilidade escolhendo o produto — assim o estoque e o custo se atualizam sozinhos, sem precisar mexer aqui manualmente.

Um abraço,
Sabio 🦉`,
    },
    INFORMES: {
      titulo: 'O que você encontra em Relatórios',
      texto: `Olá! 👋

Relatórios é onde a sua contabilidade vira relatórios que um contador reconheceria na hora. Você não precisa entender de contabilidade para lê-los, mas eles estão ali caso um dia precise mostrar para alguém.

Você vai encontrar:

📋 Somas e Saldos: o resumo de todas as suas contas — serve para conferir se tudo está batendo.
📖 Razão: o detalhe dos movimentos de cada conta, uma por uma.
📈 Demonstração de Resultado: quanto você ganhou (ou perdeu) no período, e do que esse resultado é composto.
💵 Fluxo de Caixa: por onde entrou e saiu o seu dinheiro.
⚖️ Balanço Patrimonial: a foto completa do que você tem, do que deve e do que é realmente seu.

💡 Minha recomendação: revise a Demonstração de Resultado ao fechar cada mês — é a que melhor responde "como foi meu mês?".

Um abraço,
Sabio 🦉`,
    },
    PRODUCCION: {
      titulo: 'Como registrar o que você produz',
      texto: `Olá! 👋

Produção permite transformar insumos em produtos acabados, com o sistema calculando sozinho quanto custou produzir cada item.

Os passos são:

1️⃣ Cadastre uma Receita: quais insumos (e em que quantidade) são necessários para fazer um produto acabado.
2️⃣ Registre uma Produção: quanto você fabricou e em que data. O sistema desconta automaticamente os insumos consumidos conforme a receita, e dá entrada no estoque do produto acabado com o custo real.

💡 Minha recomendação: mantenha suas receitas atualizadas se as quantidades ou os insumos mudarem — assim o custo dos seus produtos acabados sempre reflete a realidade.

Um abraço,
Sabio 🦉`,
    },
    RRHH_STD: {
      titulo: 'Assim você organiza seus Clientes e Fornecedores',
      texto: `Olá! 👋

Recursos Humanos é onde você cadastra as pessoas e empresas com quem trabalha — não é sobre "funcionários", é a sua agenda de contatos comerciais.

Tem duas abas:

👥 Clientes: quem compra de você. Cadastre aqui para poder escolhê-los depois ao registrar uma Venda ou um Recebimento.
🏢 Fornecedores: de quem você compra. Cadastre aqui para escolhê-los ao registrar uma Compra ou um Pagamento.

💡 Minha recomendação: cadastre um cliente ou fornecedor na primeira vez que trabalhar com ele — assim depois, ao registrar operações, você só precisa escolher da lista.

Um abraço,
Sabio 🦉`,
    },
    RRHH_FAM: {
      titulo: 'Assim você organiza suas fontes de renda e destinos de pagamento',
      texto: `Olá! 👋

Esta ferramenta é onde você cadastra com quem se relaciona o dinheiro que entra e sai da sua família.

Tem duas abas:

💰 Fontes de renda: de onde vem o dinheiro (seu empregador, um cliente particular, um marketplace...). Cadastre aqui para poder escolhê-las depois ao registrar um Recebimento.
🏪 Destinos de pagamento: para quem você paga (o mercado, a imobiliária, a academia...). Cadastre aqui para escolhê-los ao registrar um Pagamento.

💡 Minha recomendação: cadastre uma fonte ou destino na primeira vez que aparecer — assim da próxima vez você só escolhe da lista.

Um abraço,
Sabio 🦉`,
    },
    CONFIG: {
      titulo: 'Configurações: a caixa de ferramentas do seu sistema',
      texto: `Olá! 👋

Configurações é onde se ajustam as regras de base do sistema — normalmente você entra aqui uma vez para deixar tudo pronto, e depois quase não precisa voltar.

Lá você pode:

🏷️ Cadastrar suas categorias (de despesa, de produto, de serviço) e decidir a qual conta contábil cada uma corresponde.
💳 Definir suas formas de pagamento e a qual conta cada uma está associada.
🎯 Editar seus Objetivos: mudar metas, criar novas, ou desativar as que não servem mais.

💡 Minha recomendação: se em algum momento Contabilidade disser "falta atribuir a conta para esta categoria", é em Configurações que isso se resolve.

Um abraço,
Sabio 🦉`,
    },
  },
};

function primerDiaDelMes(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
}

// Se llama una sola vez, al dar de alta una empresa nueva (mismo
// momento que crearObjetivosModelo en lib/objetivos.ts) — ver
// inicializarEmpresaDesdePerfil en lib/perfiles.ts.
export async function crearMensajesTutorialModelo(
  empresaId: string,
  perfilCodigo: string | undefined,
  idioma: string | null | undefined
) {
  const idiomaFinal = idioma === 'PT' ? 'PT' : 'ES';
  const textos = TEXTOS[idiomaFinal];
  const esFamiliar = perfilCodigo === 'FAMILIAR';

  const [manejaMercaderia, tieneProduccion] = await Promise.all([
    empresaManejaMercaderia(empresaId),
    empresaTieneModulo(empresaId, 'PRODUCCION'),
  ]);

  const codigos: CodigoTutorial[] = [
    'PANEL',
    esFamiliar ? 'CONTAB_FAM' : 'CONTAB_STD',
    ...(manejaMercaderia ? (['MERCADERIA'] as CodigoTutorial[]) : []),
    'INFORMES',
    ...(tieneProduccion ? (['PRODUCCION'] as CodigoTutorial[]) : []),
    esFamiliar ? 'RRHH_FAM' : 'RRHH_STD',
    'CONFIG',
  ];

  const periodo = primerDiaDelMes();

  const filas = codigos.map((codigo) => ({
    empresa_id: empresaId,
    periodo,
    titulo: textos[codigo].titulo,
    texto: textos[codigo].texto,
    leido: false,
  }));

  const { error } = await supabase.from('mensajes_financieros').insert(filas);

  if (error) {
    throw error;
  }
}

// ==========================================================
// MENSAJE DE BIENVENIDA DEL ONBOARDING GUIADO
// ==========================================================
//
// Primer mensaje que ve una empresa nueva (empresas.onboarding_
// completado = false) — se inserta DESPUÉS del paquete de tutoriales
// de arriba, con su propio timestamp, para quedar arriba de todo en
// Mensagens (que ordena por creado_en descendente). Explica el
// perfil asignado y lista las operaciones reales que va a tener,
// leyéndolas de la tabla "operaciones" de la empresa en vez de
// asumir una lista fija por perfil — así nunca queda desactualizado
// si el plan maestro de un perfil cambia.
function textoBienvenidaOnboarding(
  idioma: 'ES' | 'PT',
  nombrePerfil: string,
  nombresOperaciones: string[]
): TextoTutorial {
  const lista = nombresOperaciones.map((nombre) => `• ${nombre}`).join('\n');

  if (idioma === 'PT') {
    return {
      titulo: 'Bem-vindo(a) à Visão Financeira! 🎉',
      texto: `Olá! 👋 Eu sou o Sabio, seu companheiro financeiro.

Sua conta foi aprovada e seu sistema já está configurado com o perfil ${nombrePerfil}.

Com esse perfil você vai poder registrar estas operações:

${lista}

Antes de começar a operar, precisamos completar juntos a configuração inicial — suas categorias, alguns contatos e seus primeiros produtos. É rápido, e eu vou te guiar passo a passo.

Vamos lá?`,
    };
  }

  return {
    titulo: '¡Bienvenido/a a Visão Financeira! 🎉',
    texto: `¡Hola! 👋 Soy Sabio, tu compañero financiero.

Tu cuenta fue aprobada y tu sistema ya está configurado con el perfil ${nombrePerfil}.

Con este perfil vas a poder registrar estas operaciones:

${lista}

Antes de empezar a operar, tenemos que completar juntos la configuración inicial — tus categorías, algunos contactos y tus primeros productos. Es rápido, y te voy a guiar paso a paso.

¿Arrancamos?`,
  };
}

// Se llama una sola vez, al dar de alta una empresa nueva — ver
// inicializarEmpresaDesdePerfil en lib/perfiles.ts, justo después de
// crearMensajesTutorialModelo.
export async function crearMensajeBienvenidaOnboarding(
  empresaId: string,
  perfilCodigo: string | undefined,
  perfilNombre: string | undefined,
  idioma: string | null | undefined
) {
  const idiomaFinal: 'ES' | 'PT' = idioma === 'PT' ? 'PT' : 'ES';

  const { data: operacionesData, error: errorOperaciones } = await supabase
    .from('operaciones')
    .select('nombre')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .order('nombre');

  if (errorOperaciones) {
    throw errorOperaciones;
  }

  const nombresOperaciones = (operacionesData ?? []).map((fila) =>
    nombreOperacionDisplay(idiomaFinal, fila.nombre)
  );

  const { nombre: nombrePerfilTraducido } = perfilEmpresaDisplay(
    idiomaFinal,
    perfilCodigo ?? '',
    perfilNombre ?? perfilCodigo ?? ''
  );

  const contenido = textoBienvenidaOnboarding(idiomaFinal, nombrePerfilTraducido, nombresOperaciones);

  const { error } = await supabase.from('mensajes_financieros').insert({
    empresa_id: empresaId,
    periodo: primerDiaDelMes(),
    titulo: contenido.titulo,
    texto: contenido.texto,
    leido: false,
  });

  if (error) {
    throw error;
  }
}
