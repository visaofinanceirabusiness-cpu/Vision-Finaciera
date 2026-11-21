// lib/informes/interpretacion.ts — Informes → Interpretación: el Sabio cuenta el mes como un relato, informe por informe.
// Motor POR REGLAS (sin IA externa, sin costo): cada frase sale de una regla con una cifra que ya muestran los informes, nunca inventa.
// Puro: recibe los números ya calculados (ver interpretacionDatos.ts) y devuelve secciones de texto en español o portugués.

import { variacionPct } from './dre';
import { analisisBalance, porcentaje } from './balance';

export type Fila = { nombre: string; valor: number };

export type DatosInterpretacion = {
  pt: boolean;
  esFamiliar: boolean;
  periodo: string; // etiqueta, p. ej. «noviembre de 2026»
  dinero: (n: number) => string;
  hayMovimientos: boolean;
  resultado: {
    ingresos: number;
    costos: number;
    gastos: number;
    resultado: number;
    anterior: { ingresos: number; costos: number; gastos: number; resultado: number } | null;
    topIngresos: Fila[];
    topSalidas: Fila[];
  };
  flujo: {
    saldoInicial: number;
    entradas: number;
    salidas: number;
    saldoFinal: number;
    topEntradas: Fila[];
    topSalidas: Fila[];
    ahorro: number | null;
    tasaAhorro: number | null;
  };
  balance: { activo: number; pasivo: number; patrimonio: number; resultado: number; anterior: { activo: number; pasivo: number; patrimonio: number } | null };
  cuentasMovidas: { nombre: string; variacion: number; saldoFinal: number }[];
  gruposVariacion: { nombre: string; variacion: number }[] | null;
  sumas: { cuadra: boolean; totalDebe: number; totalHaber: number };
};

export type Tono = 'bien' | 'atencion' | 'neutro';
export type SeccionInterpretacion = { clave: 'panorama' | 'resultado' | 'flujo' | 'balance' | 'cuentas' | 'sumas' | 'cierre'; titulo: string; tono: Tono; lineas: string[] };

const pct1 = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;
const signo = (n: number) => (n >= 0 ? '+' : '−');

export function armarInterpretacion(d: DatosInterpretacion): SeccionInterpretacion[] {
  const { pt } = d;
  const t = (es: string, po: string) => (pt ? po : es);
  const quien = d.esFamiliar ? t('tu familia', 'sua família') : t('tu negocio', 'seu negócio');

  if (!d.hayMovimientos) {
    return [{ clave: 'panorama', titulo: t('Panorama del mes', 'Panorama do mês'), tono: 'neutro', lineas: [t(`Todavía no hay movimientos en ${d.periodo}. Cuando cargues operaciones, acá vas a encontrar la historia del mes contada por informe.`, `Ainda não há movimentos em ${d.periodo}. Quando você lançar operações, aqui vai encontrar a história do mês contada por relatório.`)] }];
  }

  const r = d.resultado;
  const f = d.flujo;
  const b = d.balance;
  const salidasTotal = r.costos + r.gastos;
  const margen = r.ingresos > 0 ? (r.resultado / r.ingresos) * 100 : 0;
  const vIngresos = r.anterior ? variacionPct(r.ingresos, r.anterior.ingresos) : null;
  const vGastos = r.anterior ? variacionPct(salidasTotal, r.anterior.costos + r.anterior.gastos) : null;
  const deuda = porcentaje(b.pasivo, b.activo);
  const mesesDeCaja = f.salidas > 0 ? f.saldoFinal / f.salidas : null;
  const cajaSube = f.saldoFinal >= f.saldoInicial;
  const nombres = (filas: Fila[], n: number) => filas.slice(0, n).map((x) => x.nombre).join(t(' y ', ' e '));

  // ---------- Panorama ----------
  const bueno = r.resultado >= 0 && cajaSube;
  const malo = r.resultado < 0 && !cajaSube;
  const panorama: string[] = [
    t(
      `En ${d.periodo}, ${quien} tuvo ingresos por ${d.dinero(r.ingresos)} y salidas por ${d.dinero(salidasTotal)}: el resultado fue ${r.resultado >= 0 ? 'positivo' : 'negativo'}, de ${d.dinero(Math.abs(r.resultado))}.`,
      `Em ${d.periodo}, ${quien} teve receitas de ${d.dinero(r.ingresos)} e saídas de ${d.dinero(salidasTotal)}: o resultado foi ${r.resultado >= 0 ? 'positivo' : 'negativo'}, de ${d.dinero(Math.abs(r.resultado))}.`
    ),
    t(
      `La plata disponible ${cajaSube ? 'subió' : 'bajó'} de ${d.dinero(f.saldoInicial)} a ${d.dinero(f.saldoFinal)}, y el patrimonio neto quedó en ${d.dinero(b.patrimonio)}.`,
      `O dinheiro disponível ${cajaSube ? 'subiu' : 'caiu'} de ${d.dinero(f.saldoInicial)} para ${d.dinero(f.saldoFinal)}, e o patrimônio líquido ficou em ${d.dinero(b.patrimonio)}.`
    ),
  ];
  if (vIngresos !== null && Math.abs(vIngresos) >= 5) {
    panorama.push(vIngresos > 0 ? t(`Frente al mes anterior, los ingresos crecieron ${pct1(vIngresos)}.`, `Em relação ao mês anterior, as receitas cresceram ${pct1(vIngresos)}.`) : t(`Frente al mes anterior, los ingresos cayeron ${pct1(Math.abs(vIngresos))}.`, `Em relação ao mês anterior, as receitas caíram ${pct1(Math.abs(vIngresos))}.`));
  }

  // ---------- Estado de Resultado ----------
  const resultadoLineas: string[] = [
    t(
      `Entraron ${d.dinero(r.ingresos)}${vIngresos !== null ? ` (${signo(vIngresos)}${pct1(Math.abs(vIngresos))} vs. mes anterior)` : ''} y salieron ${d.dinero(salidasTotal)}${vGastos !== null ? ` (${signo(vGastos)}${pct1(Math.abs(vGastos))})` : ''}. Resultado: ${d.dinero(r.resultado)}, un margen de ${pct1(margen)}.`,
      `Entraram ${d.dinero(r.ingresos)}${vIngresos !== null ? ` (${signo(vIngresos)}${pct1(Math.abs(vIngresos))} vs. mês anterior)` : ''} e saíram ${d.dinero(salidasTotal)}${vGastos !== null ? ` (${signo(vGastos)}${pct1(Math.abs(vGastos))})` : ''}. Resultado: ${d.dinero(r.resultado)}, uma margem de ${pct1(margen)}.`
    ),
  ];
  if (r.topIngresos.length > 0) resultadoLineas.push(t(`Tus ingresos vienen sobre todo de ${nombres(r.topIngresos, 2)}.`, `Suas receitas vêm principalmente de ${nombres(r.topIngresos, 2)}.`));
  if (r.topSalidas.length > 0 && salidasTotal > 0) {
    const peso = porcentaje(r.topSalidas[0].valor, salidasTotal);
    resultadoLineas.push(t(`El mayor peso de las salidas está en ${r.topSalidas[0].nombre} (${pct1(peso)} del total)${r.topSalidas.length > 1 ? `, seguido de ${r.topSalidas[1].nombre}` : ''}.`, `O maior peso das saídas está em ${r.topSalidas[0].nombre} (${pct1(peso)} do total)${r.topSalidas.length > 1 ? `, seguido de ${r.topSalidas[1].nombre}` : ''}.`));
  }
  if (!d.esFamiliar && r.costos > 0 && r.ingresos > 0) resultadoLineas.push(t(`Después de los costos queda un resultado bruto de ${d.dinero(r.ingresos - r.costos)} (${pct1(((r.ingresos - r.costos) / r.ingresos) * 100)} de las ventas).`, `Depois dos custos sobra um resultado bruto de ${d.dinero(r.ingresos - r.costos)} (${pct1(((r.ingresos - r.costos) / r.ingresos) * 100)} das vendas).`));

  // ---------- Flujo de Caja ----------
  const flujoLineas: string[] = [
    t(
      `Arrancaste con ${d.dinero(f.saldoInicial)}, entraron ${d.dinero(f.entradas)}, salieron ${d.dinero(f.salidas)} y cerraste con ${d.dinero(f.saldoFinal)}.`,
      `Você começou com ${d.dinero(f.saldoInicial)}, entraram ${d.dinero(f.entradas)}, saíram ${d.dinero(f.salidas)} e fechou com ${d.dinero(f.saldoFinal)}.`
    ),
  ];
  if (f.topEntradas.length > 0) flujoLineas.push(t(`La plata entró sobre todo por ${nombres(f.topEntradas, 2)}.`, `O dinheiro entrou principalmente por ${nombres(f.topEntradas, 2)}.`));
  if (f.topSalidas.length > 0) flujoLineas.push(t(`Las salidas de caja fueron sobre todo para ${nombres(f.topSalidas, 2)}.`, `As saídas de caixa foram principalmente para ${nombres(f.topSalidas, 2)}.`));
  if (mesesDeCaja !== null) {
    flujoLineas.push(
      mesesDeCaja >= 1
        ? t(`Con lo que tenés disponible cubrirías ${mesesDeCaja.toFixed(1).replace('.', ',')} meses de salidas al ritmo de este mes.`, `Com o que você tem disponível cobriria ${mesesDeCaja.toFixed(1).replace('.', ',')} meses de saídas no ritmo deste mês.`)
        : t(`Lo disponible cubre menos de un mes de salidas al ritmo de este mes: conviene cuidar la liquidez.`, `O disponível cobre menos de um mês de saídas no ritmo deste mês: convém cuidar da liquidez.`)
    );
  }
  if (d.esFamiliar && f.ahorro !== null && f.ahorro !== 0) {
    flujoLineas.push(t(`Ahorraste ${d.dinero(f.ahorro)}${f.tasaAhorro !== null ? ` (${pct1(f.tasaAhorro)} de tus ingresos)` : ''}.`, `Você poupou ${d.dinero(f.ahorro)}${f.tasaAhorro !== null ? ` (${pct1(f.tasaAhorro)} da sua renda)` : ''}.`));
  }

  // ---------- Balance ----------
  const balanceLineas: string[] = analisisBalance({ pt, activo: b.activo, pasivo: b.pasivo, patrimonio: b.patrimonio, resultado: b.resultado, dinero: d.dinero });
  if (b.anterior) {
    const vAct = variacionPct(b.activo, b.anterior.activo);
    const vPas = variacionPct(b.pasivo, b.anterior.pasivo);
    if (vAct !== null && Math.abs(vAct) >= 1) balanceLineas.push(t(`Los activos ${vAct > 0 ? 'crecieron' : 'bajaron'} ${pct1(Math.abs(vAct))} frente al mes anterior.`, `Os ativos ${vAct > 0 ? 'cresceram' : 'caíram'} ${pct1(Math.abs(vAct))} em relação ao mês anterior.`));
    if (vPas !== null && Math.abs(vPas) >= 1) balanceLineas.push(t(`Las deudas ${vPas > 0 ? 'aumentaron' : 'bajaron'} ${pct1(Math.abs(vPas))}.`, `As dívidas ${vPas > 0 ? 'aumentaram' : 'caíram'} ${pct1(Math.abs(vPas))}.`));
  }

  // ---------- Cuentas ----------
  const cuentasLineas: string[] = [];
  if (d.cuentasMovidas.length === 0) cuentasLineas.push(t('Ninguna cuenta tuvo movimientos relevantes este mes.', 'Nenhuma conta teve movimentos relevantes neste mês.'));
  else {
    cuentasLineas.push(t(`Las cuentas que más se movieron fueron ${d.cuentasMovidas.slice(0, 3).map((c) => `${c.nombre} (${signo(c.variacion)}${d.dinero(Math.abs(c.variacion))})`).join(', ')}.`, `As contas que mais se movimentaram foram ${d.cuentasMovidas.slice(0, 3).map((c) => `${c.nombre} (${signo(c.variacion)}${d.dinero(Math.abs(c.variacion))})`).join(', ')}.`));
    for (const c of d.cuentasMovidas.slice(0, 3)) cuentasLineas.push(t(`${c.nombre} cerró el mes en ${d.dinero(c.saldoFinal)}.`, `${c.nombre} fechou o mês em ${d.dinero(c.saldoFinal)}.`));
  }

  // ---------- Sumas y Saldos ----------
  const sumasLineas: string[] = [
    d.sumas.cuadra
      ? t(`Todo cuadra: el Debe y el Haber suman ${d.dinero(d.sumas.totalDebe)} en las dos columnas.`, `Tudo fecha: o Débito e o Crédito somam ${d.dinero(d.sumas.totalDebe)} nas duas colunas.`)
      : t(`Atención: el Debe (${d.dinero(d.sumas.totalDebe)}) y el Haber (${d.dinero(d.sumas.totalHaber)}) no coinciden. Conviene revisar los asientos del período.`, `Atenção: o Débito (${d.dinero(d.sumas.totalDebe)}) e o Crédito (${d.dinero(d.sumas.totalHaber)}) não coincidem. Convém revisar os lançamentos do período.`),
  ];
  if (d.gruposVariacion && d.gruposVariacion.length > 0) {
    const g = [...d.gruposVariacion].sort((a, c) => Math.abs(c.variacion) - Math.abs(a.variacion))[0];
    if (Math.abs(g.variacion) >= 0.5) sumasLineas.push(t(`El grupo que más cambió frente al mes anterior fue ${g.nombre} (${signo(g.variacion)}${d.dinero(Math.abs(g.variacion))}).`, `O grupo que mais mudou em relação ao mês anterior foi ${g.nombre} (${signo(g.variacion)}${d.dinero(Math.abs(g.variacion))}).`));
  }

  // ---------- Cierre: qué mirar ----------
  const cierre: string[] = [];
  if (r.resultado < 0 && r.topSalidas.length > 0) cierre.push(t(`El resultado fue negativo: revisá las salidas de mayor impacto (${nombres(r.topSalidas, 2)}).`, `O resultado foi negativo: revise as saídas de maior impacto (${nombres(r.topSalidas, 2)}).`));
  if (vIngresos !== null && vIngresos <= -5) cierre.push(t('Los ingresos cayeron: pensá cómo reforzarlos el mes que viene.', 'As receitas caíram: pense em como reforçá-las no próximo mês.'));
  if (mesesDeCaja !== null && mesesDeCaja < 1) cierre.push(t('Cuidá la liquidez: lo disponible no llega a cubrir un mes de salidas.', 'Cuide da liquidez: o disponível não chega a cobrir um mês de saídas.'));
  if (b.activo > 0 && deuda >= 60) cierre.push(t('Las obligaciones pesan mucho sobre los activos: priorizá bajar deudas.', 'As obrigações pesam muito sobre os ativos: priorize reduzir dívidas.'));
  if (!d.sumas.cuadra) cierre.push(t('Revisá por qué no cuadran el Debe y el Haber antes de seguir.', 'Revise por que o Débito e o Crédito não fecham antes de seguir.'));
  if (d.esFamiliar && f.tasaAhorro !== null && f.tasaAhorro < 10) cierre.push(t('Probá llegar a ahorrar al menos el 10% de tus ingresos.', 'Tente poupar pelo menos 10% da sua renda.'));
  if (cierre.length === 0) cierre.push(t('Fue un buen mes: mantené el ritmo y seguí cargando tus operaciones al día.', 'Foi um bom mês: mantenha o ritmo e continue lançando suas operações em dia.'));

  const hayAtencion = cierre.length > 0 && !(cierre.length === 1 && cierre[0].startsWith(t('Fue un buen mes', 'Foi um bom mês')));

  return [
    { clave: 'panorama', titulo: t('Panorama del mes', 'Panorama do mês'), tono: bueno ? 'bien' : malo ? 'atencion' : 'neutro', lineas: panorama },
    { clave: 'resultado', titulo: d.esFamiliar ? t('Estado de Resultado: ingresos y gastos', 'Demonstração de Resultado: receitas e despesas') : t('Estado de Resultado', 'Demonstração de Resultado (DRE)'), tono: r.resultado >= 0 ? 'bien' : 'atencion', lineas: resultadoLineas },
    { clave: 'flujo', titulo: t('Flujo de Caja', 'Fluxo de Caixa'), tono: cajaSube ? 'bien' : 'atencion', lineas: flujoLineas },
    { clave: 'balance', titulo: t('Balance Patrimonial', 'Balanço Patrimonial'), tono: b.patrimonio >= 0 && deuda < 60 ? 'bien' : 'atencion', lineas: balanceLineas },
    { clave: 'cuentas', titulo: t('Mayor: las cuentas que se movieron', 'Razão: as contas que se movimentaram'), tono: 'neutro', lineas: cuentasLineas },
    { clave: 'sumas', titulo: t('Sumas y Saldos', 'Balancete'), tono: d.sumas.cuadra ? 'bien' : 'atencion', lineas: sumasLineas },
    { clave: 'cierre', titulo: t('Qué mirar el mes que viene', 'O que olhar no próximo mês'), tono: hayAtencion ? 'atencion' : 'bien', lineas: cierre },
  ];
}

// Texto plano del relato completo (para copiar).
export function relatoComoTexto(titulo: string, secciones: SeccionInterpretacion[]): string {
  return [titulo, '', ...secciones.flatMap((s) => [s.titulo.toUpperCase(), ...s.lineas, ''])].join('\n').trim();
}
