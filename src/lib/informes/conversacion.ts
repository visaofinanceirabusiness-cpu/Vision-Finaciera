// lib/informes/conversacion.ts — Informes → Interpretación en formato conversación: el Sabio habla con la persona (saludo, qué pasó,
// cómo se llegó, tendencia, recomendaciones y un resumen). Mismo motor por reglas (sin IA externa ni costo) y las mismas cifras de los
// informes: cada frase sale de una regla con un número real y nunca se inventa una tendencia ni una conclusión.
// Las **marcas** señalan lo que se muestra en negrita.

import { armarInterpretacion, type DatosInterpretacion, type Fila, type SeccionInterpretacion, type Tono } from './interpretacion';
import { variacionPct } from './dre';
import { porcentaje } from './balance';

export type BloqueConversacion = { clave: 'inicio' | 'como' | 'tendencia' | 'recomiendo'; emoji: string; titulo?: string; parrafos: string[] };

export type Conversacion = {
  saludo: { titulo: string; texto: string };
  bloques: BloqueConversacion[];
  resumen: string;
  tono: Tono;
  // El detalle por informe (lo mismo, en forma de ficha) para quien quiera ir al número de cada informe.
  detalle: SeccionInterpretacion[];
};

const pct1 = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;
const negrita = (s: string) => `**${s}**`;

export const sinMarcas = (s: string) => s.replace(/\*\*/g, '');

function unir(filas: Fila[], n: number, y: string): string {
  return filas.slice(0, n).map((f) => f.nombre).join(` ${y} `);
}

// Cómo se movió una serie en los últimos meses: 'sube', 'baja' o 'irregular' (necesita al menos 3 puntos).
export function direccionDeSerie(valores: number[]): 'sube' | 'baja' | 'irregular' {
  if (valores.length < 3) return 'irregular';
  const sube = valores.every((v, i) => i === 0 || v > valores[i - 1]);
  const baja = valores.every((v, i) => i === 0 || v < valores[i - 1]);
  return sube ? 'sube' : baja ? 'baja' : 'irregular';
}

export function armarConversacion(d: DatosInterpretacion, quien: { nombre: string; empresa: string }): Conversacion {
  const { pt } = d;
  const t = (es: string, po: string) => (pt ? po : es);
  const y = t('y', 'e');
  const detalle = armarInterpretacion(d);
  const saludo = {
    titulo: t(`¡Hola, ${quien.nombre}! 👋`, `Olá, ${quien.nombre}! 👋`),
    texto: t(`Estuve analizando los datos de ${quien.empresa} en ${d.periodo} y preparé un panorama completo para vos. ¿Lo vemos juntos? 😊`, `Estive analisando os dados de ${quien.empresa} em ${d.periodo} e preparei um panorama completo para você. Vamos ver juntos? 😊`),
  };

  if (!d.hayMovimientos) {
    return {
      saludo,
      bloques: [{ clave: 'inicio', emoji: '🌱', parrafos: [t(`Todavía no hay movimientos en ${d.periodo}, así que no tengo nada para contarte. Cuando cargues operaciones, acá vas a encontrar la historia del mes. ¡Te espero! 😉`, `Ainda não há movimentos em ${d.periodo}, então não tenho nada para contar. Quando você lançar operações, aqui vai encontrar a história do mês. Estarei esperando! 😉`)] }],
      resumen: '',
      tono: 'neutro',
      detalle,
    };
  }

  const r = d.resultado;
  const f = d.flujo;
  const b = d.balance;
  const salidas = r.costos + r.gastos;
  const quienEs = d.esFamiliar ? t('tu familia', 'sua família') : t('tu negocio', 'seu negócio');
  const margen = r.ingresos > 0 ? (r.resultado / r.ingresos) * 100 : 0;
  const vIng = r.anterior ? variacionPct(r.ingresos, r.anterior.ingresos) : null;
  const vSal = r.anterior ? variacionPct(salidas, r.anterior.costos + r.anterior.gastos) : null;
  const vRes = r.anterior && r.anterior.resultado > 0 ? variacionPct(r.resultado, r.anterior.resultado) : null;
  const cajaSube = f.saldoFinal >= f.saldoInicial;
  const mesesDeCaja = f.salidas > 0 ? f.saldoFinal / f.salidas : null;
  const deuda = porcentaje(b.pasivo, b.activo);
  const mesAnt = d.mesAnterior;

  // ---- 1. Cómo cerró el mes ----
  const inicio: string[] = [];
  if (r.resultado >= 0) {
    inicio.push(
      t(
        `Este mes cerraste con un resultado ${negrita('positivo')} de ${negrita(d.dinero(r.resultado))}${vRes !== null && mesAnt ? `, ${vRes >= 0 ? 'un crecimiento' : 'una caída'} de ${negrita(pct1(Math.abs(vRes)))} frente a ${mesAnt}` : ''}.`,
        `Este mês você fechou com um resultado ${negrita('positivo')} de ${negrita(d.dinero(r.resultado))}${vRes !== null && mesAnt ? `, ${vRes >= 0 ? 'um crescimento' : 'uma queda'} de ${negrita(pct1(Math.abs(vRes)))} em relação a ${mesAnt}` : ''}.`
      )
    );
  } else {
    inicio.push(
      t(
        `Este mes cerraste con un resultado ${negrita('negativo')} de ${negrita(d.dinero(Math.abs(r.resultado)))}${r.anterior && mesAnt ? ` (${r.resultado > r.anterior.resultado ? 'mejor' : 'peor'} que en ${mesAnt}, cuando fue de ${d.dinero(r.anterior.resultado)})` : ''}. No es lo ideal, pero tranquilo: veamos por qué pasó y qué podés hacer. 💪`,
        `Este mês você fechou com um resultado ${negrita('negativo')} de ${negrita(d.dinero(Math.abs(r.resultado)))}${r.anterior && mesAnt ? ` (${r.resultado > r.anterior.resultado ? 'melhor' : 'pior'} que em ${mesAnt}, quando foi de ${d.dinero(r.anterior.resultado)})` : ''}. Não é o ideal, mas fique tranquilo: vamos ver por que aconteceu e o que você pode fazer. 💪`
      )
    );
  }
  inicio.push(
    t(
      `Tu plata disponible ${cajaSube ? 'subió' : 'bajó'} de ${d.dinero(f.saldoInicial)} a ${negrita(d.dinero(f.saldoFinal))} y tu patrimonio neto quedó en ${negrita(d.dinero(b.patrimonio))}.`,
      `Seu dinheiro disponível ${cajaSube ? 'subiu' : 'caiu'} de ${d.dinero(f.saldoInicial)} para ${negrita(d.dinero(f.saldoFinal))} e seu patrimônio líquido ficou em ${negrita(d.dinero(b.patrimonio))}.`
    )
  );

  // ---- 2. Cómo llegamos ----
  const como: string[] = [];
  const ingTxt = vIng === null ? t('sumaron', 'somaram') : vIng >= 5 ? t(`crecieron ${negrita(pct1(vIng))} y sumaron`, `cresceram ${negrita(pct1(vIng))} e somaram`) : vIng <= -5 ? t(`cayeron ${negrita(pct1(Math.abs(vIng)))} y sumaron`, `caíram ${negrita(pct1(Math.abs(vIng)))} e somaram`) : t('se mantuvieron parecidos al mes anterior y sumaron', 'ficaram parecidas com as do mês anterior e somaram');
  como.push(
    t(`Los ingresos ${ingTxt} ${negrita(d.dinero(r.ingresos))}${r.topIngresos.length ? `, sobre todo por ${unir(r.topIngresos, 2, y)}` : ''}.`, `As receitas ${ingTxt} ${negrita(d.dinero(r.ingresos))}${r.topIngresos.length ? `, principalmente por ${unir(r.topIngresos, 2, y)}` : ''}.`)
  );
  const salTxt = vSal === null ? t('fueron de', 'foram de') : vSal >= 5 ? t(`subieron ${negrita(pct1(vSal))} hasta`, `subiram ${negrita(pct1(vSal))} até`) : vSal <= -5 ? t(`bajaron ${negrita(pct1(Math.abs(vSal)))} hasta`, `caíram ${negrita(pct1(Math.abs(vSal)))} até`) : t('se mantuvieron estables en', 'ficaram estáveis em');
  const peso = r.topSalidas.length && salidas > 0 ? porcentaje(r.topSalidas[0].valor, salidas) : null;
  como.push(
    t(
      `Al mismo tiempo, las salidas ${salTxt} ${negrita(d.dinero(salidas))}${r.topSalidas.length && peso !== null ? `, con el mayor peso en ${r.topSalidas[0].nombre} (${pct1(peso)} del total)${r.topSalidas.length > 1 ? ` y después ${r.topSalidas[1].nombre}` : ''}` : ''}. Así, el margen quedó en ${negrita(pct1(margen))}.`,
      `Ao mesmo tempo, as saídas ${salTxt} ${negrita(d.dinero(salidas))}${r.topSalidas.length && peso !== null ? `, com o maior peso em ${r.topSalidas[0].nombre} (${pct1(peso)} do total)${r.topSalidas.length > 1 ? ` e depois ${r.topSalidas[1].nombre}` : ''}` : ''}. Assim, a margem ficou em ${negrita(pct1(margen))}.`
    )
  );
  if (d.cuentasMovidas.length > 0) {
    como.push(t(`Las cuentas que más se movieron fueron ${d.cuentasMovidas.slice(0, 3).map((c) => c.nombre).join(', ')}.`, `As contas que mais se movimentaram foram ${d.cuentasMovidas.slice(0, 3).map((c) => c.nombre).join(', ')}.`));
  }
  if (d.esFamiliar && f.ahorro !== null && f.ahorro !== 0) {
    como.push(t(`Además ahorraste ${negrita(d.dinero(f.ahorro))}${f.tasaAhorro !== null ? ` (${pct1(f.tasaAhorro)} de tus ingresos)` : ''}. ¡Eso suma! 🐷`, `Além disso você poupou ${negrita(d.dinero(f.ahorro))}${f.tasaAhorro !== null ? ` (${pct1(f.tasaAhorro)} da sua renda)` : ''}. Isso conta! 🐷`));
  }
  como.push(
    d.sumas.cuadra
      ? t('También revisé que todo cuadre: el Debe y el Haber coinciden. ✅', 'Também conferi se tudo fecha: o Débito e o Crédito coincidem. ✅')
      : t(`Ojo: el Debe (${d.dinero(d.sumas.totalDebe)}) y el Haber (${d.dinero(d.sumas.totalHaber)}) no coinciden. Conviene revisarlo. ⚠️`, `Atenção: o Débito (${d.dinero(d.sumas.totalDebe)}) e o Crédito (${d.dinero(d.sumas.totalHaber)}) não coincidem. Convém revisar. ⚠️`)
  );

  // ---- 3. Tendencia ----
  const tendencia: string[] = [];
  const serie = d.tendencia ?? [];
  const ultimos = serie.slice(-3);
  if (ultimos.length >= 3) {
    const dir = direccionDeSerie(ultimos.map((x) => x.resultado));
    const lista = ultimos.map((x) => d.dinero(x.resultado));
    const dirIng = direccionDeSerie(ultimos.map((x) => x.ingresos));
    tendencia.push(
      dir === 'sube'
        ? t(`En los últimos 3 meses el resultado fue ${lista.join(', ')}: viene ${negrita('mejorando')} de a poco. 📈`, `Nos últimos 3 meses o resultado foi ${lista.join(', ')}: vem ${negrita('melhorando')} aos poucos. 📈`)
        : dir === 'baja'
          ? t(`En los últimos 3 meses el resultado fue ${lista.join(', ')}: viene ${negrita('bajando')} y conviene prestarle atención. 📉`, `Nos últimos 3 meses o resultado foi ${lista.join(', ')}: vem ${negrita('caindo')} e convém prestar atenção. 📉`)
          : t(`En los últimos 3 meses el resultado fue ${lista.join(', ')}: fue ${negrita('irregular')}, sin una dirección clara todavía.`, `Nos últimos 3 meses o resultado foi ${lista.join(', ')}: foi ${negrita('irregular')}, sem uma direção clara ainda.`)
    );
    if (dirIng !== 'irregular') tendencia.push(dirIng === 'sube' ? t('Los ingresos vienen creciendo mes a mes. 👏', 'As receitas vêm crescendo mês a mês. 👏') : t('Los ingresos vienen cayendo mes a mes: es el punto a mirar de cerca.', 'As receitas vêm caindo mês a mês: é o ponto a olhar de perto.'));
  } else if (ultimos.length === 2) {
    const [a, c] = ultimos;
    tendencia.push(t(`Frente a ${a.etiqueta}, el resultado pasó de ${d.dinero(a.resultado)} a ${d.dinero(c.resultado)}. Con un mes más voy a poder hablarte de una tendencia de verdad. 😉`, `Em relação a ${a.etiqueta}, o resultado passou de ${d.dinero(a.resultado)} para ${d.dinero(c.resultado)}. Com mais um mês poderei falar de uma tendência de verdade. 😉`));
  } else {
    tendencia.push(t('Todavía no tengo suficientes meses cargados para hablar de tendencias. Con un mes más voy a poder compararte mejor. 😉', 'Ainda não tenho meses suficientes para falar de tendências. Com mais um mês poderei comparar melhor. 😉'));
  }
  if (b.anterior) tendencia.push(t(`Tu patrimonio neto pasó de ${d.dinero(b.anterior.patrimonio)} a ${d.dinero(b.patrimonio)}.`, `Seu patrimônio líquido passou de ${d.dinero(b.anterior.patrimonio)} para ${d.dinero(b.patrimonio)}.`));

  // ---- 4. Recomendaciones ----
  const recomiendo: string[] = [];
  if (r.resultado < 0 && r.topSalidas.length > 0) recomiendo.push(t(`Revisá con calma las salidas de mayor impacto (${unir(r.topSalidas, 2, y)}): ahí está la mayor oportunidad de ajuste.`, `Revise com calma as saídas de maior impacto (${unir(r.topSalidas, 2, y)}): ali está a maior oportunidade de ajuste.`));
  else if (vSal !== null && vSal >= 10 && r.topSalidas.length > 0) recomiendo.push(t(`Las salidas vienen creciendo más rápido de lo habitual: prestale atención a ${unir(r.topSalidas, 2, y)}.`, `As saídas vêm crescendo mais rápido que o habitual: preste atenção a ${unir(r.topSalidas, 2, y)}.`));
  if (vIng !== null && vIng <= -5) recomiendo.push(t('Los ingresos cayeron: pensá cómo reforzarlos el mes que viene sin comprometer el margen.', 'As receitas caíram: pense em como reforçá-las no próximo mês sem comprometer a margem.'));
  if (mesesDeCaja !== null && mesesDeCaja < 1) recomiendo.push(t('Cuidá la liquidez: lo que tenés disponible no llega a cubrir un mes de salidas.', 'Cuide da liquidez: o que você tem disponível não chega a cobrir um mês de saídas.'));
  if (b.activo > 0 && deuda >= 60) recomiendo.push(t('Las obligaciones pesan mucho sobre tus activos: priorizá bajar deudas.', 'As obrigações pesam muito sobre seus ativos: priorize reduzir dívidas.'));
  if (!d.sumas.cuadra) recomiendo.push(t('Antes de seguir, revisá por qué no cuadran el Debe y el Haber.', 'Antes de seguir, revise por que o Débito e o Crédito não fecham.'));
  if (d.esFamiliar && f.tasaAhorro !== null && f.tasaAhorro < 10) recomiendo.push(t('Probá llegar a ahorrar al menos el 10% de tus ingresos.', 'Tente poupar pelo menos 10% da sua renda.'));
  if (recomiendo.length === 0) recomiendo.push(t('Mantené este ritmo y seguí cargando tus operaciones al día: así cada mes puedo contarte mejor la historia. 🙌', 'Mantenha este ritmo e continue lançando suas operações em dia: assim a cada mês posso contar melhor a história. 🙌'));

  // ---- Resumen ----
  const tono: Tono = r.resultado >= 0 && cajaSube ? 'bien' : r.resultado < 0 && !cajaSube ? 'atencion' : 'neutro';
  const resumen =
    tono === 'bien'
      ? t(`${negrita('En resumen:')} ${d.periodo} fue un buen paso para ${quienEs}, con resultado positivo y la plata disponible creciendo. ¡Vamos a seguir por este camino! 🚀`, `${negrita('Em resumo:')} ${d.periodo} foi um bom passo para ${quienEs}, com resultado positivo e o dinheiro disponível crescendo. Vamos seguir por esse caminho! 🚀`)
      : tono === 'atencion'
        ? t(`${negrita('En resumen:')} ${d.periodo} fue un mes exigente para ${quienEs}: resultado en rojo y menos plata disponible. Con los ajustes que vimos podés recuperar el rumbo, y yo te acompaño. 💪`, `${negrita('Em resumo:')} ${d.periodo} foi um mês exigente para ${quienEs}: resultado no vermelho e menos dinheiro disponível. Com os ajustes que vimos você pode retomar o rumo, e eu acompanho você. 💪`)
        : t(`${negrita('En resumen:')} ${d.periodo} fue un mes de transición para ${quienEs}: hay cosas para celebrar y otras para ajustar. Miremos juntos los puntos que te marqué. 🤝`, `${negrita('Em resumo:')} ${d.periodo} foi um mês de transição para ${quienEs}: há coisas para comemorar e outras para ajustar. Vamos olhar juntos os pontos que marquei. 🤝`);

  return {
    saludo,
    bloques: [
      { clave: 'inicio', emoji: r.resultado >= 0 ? '📈' : '📉', parrafos: inicio },
      { clave: 'como', emoji: '🎯', titulo: t('¿Cómo llegamos a este resultado?', 'Como chegamos a esse resultado?'), parrafos: como },
      { clave: 'tendencia', emoji: '📊', titulo: t('¿Y mirando la tendencia?', 'E olhando a tendência?'), parrafos: tendencia },
      { clave: 'recomiendo', emoji: '💡', titulo: t('¿Qué te recomiendo ahora?', 'O que eu recomendo agora?'), parrafos: recomiendo },
    ],
    resumen,
    tono,
    detalle,
  };
}

export function conversacionComoTexto(titulo: string, c: Conversacion): string {
  return [
    titulo,
    '',
    sinMarcas(c.saludo.titulo),
    sinMarcas(c.saludo.texto),
    '',
    ...c.bloques.flatMap((b) => [...(b.titulo ? [b.titulo] : []), ...b.parrafos.map(sinMarcas), '']),
    sinMarcas(c.resumen),
  ].join('\n').trim();
}

// Huella de los números que cuenta el relato: si cambia, hay movimientos nuevos desde que se generó.
export function huellaDeDatos(d: DatosInterpretacion): string {
  const n = (v: number) => Math.round(v * 100);
  return [d.resultado.ingresos, d.resultado.costos, d.resultado.gastos, d.flujo.saldoFinal, d.flujo.entradas, d.flujo.salidas, d.balance.activo, d.balance.pasivo, d.balance.patrimonio, d.sumas.totalDebe, d.sumas.totalHaber].map(n).join('|');
}
