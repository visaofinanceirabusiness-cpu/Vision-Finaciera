// lib/analisisMensual.ts
//
// ANÁLISIS MENSUAL AUTOMÁTICO — Fase A del plan (ver memory.md).
// Arma, a partir de las operaciones del mes recién cerrado, el mismo
// tipo de resumen que se venía mandando a mano por Mensajes
// (ingresos vs egresos, top categorías, actividad en el sistema).
//
// Es una función PURA a propósito — no importa lib/supabase ni toca
// la base. Quien la llama (api/analisis-mensual/generar) ya le trae
// las operaciones del período con su `tipo` real (de
// categorias_operacion), así se puede testear con datos de ejemplo
// sin mockear nada, y sirve para cualquier perfil de empresa.
//
// OJO (bug ya encontrado en producción, ver memory.md): ingreso/
// egreso se clasifican por `tipo` (INGRESO/GASTO/COSTO), NO por el
// nombre de la operación (COBRO/VENTA/PAGO/COMPRA) — mismo criterio
// que usa el DRE real (lib/contabilidad.ts). Un COBRO puede estar
// liquidando una Cuenta a Cobrar ya facturada (tipo ACTIVO, no
// INGRESO) y un PAGO puede estar pagando una deuda o Tarjeta (tipo
// PASIVO, no GASTO) o comprando un bien que se activa (tipo ACTIVO,
// no GASTO) — mirar solo el nombre de la operación los contaba como
// resultado del mes cuando en realidad son movimientos de balance.
// Aportes (INVERSION) y Extracciones (EXTRACCION) sí se identifican
// por operación — ahí no hay esa ambigüedad.

import { formatearMonto } from './moneda';

export type OperacionDelMes = {
  operacion: string;
  categoria: string;
  // Tipo real de la categoría (INGRESO/GASTO/COSTO/ACTIVO/PASIVO/
  // PATRIMONIO) — de categorias_operacion.tipo, no inferido del
  // nombre de la operación. Ver nota de arriba.
  tipo: string;
  total: number;
  fecha: string; // 'YYYY-MM-DD'
};

export type AnalisisMensual = {
  titulo: string;
  texto: string;
  modo: 'completo' | 'motivacional';
};

// Por debajo de este umbral, en vez de forzar un desglose pobre/vacío
// se manda un mensaje corto motivador — ver construirAnalisisMensual.
export const MINIMO_OPERACIONES_PARA_ANALISIS_COMPLETO = 10;
export const MINIMO_DIAS_CON_ACTIVIDAD_PARA_ANALISIS_COMPLETO = 5;

function esPT(idioma: string | null | undefined) {
  return idioma === 'PT';
}

function agruparPorCategoria(operaciones: OperacionDelMes[]): { categoria: string; total: number; cantidad: number }[] {
  const mapa = new Map<string, { total: number; cantidad: number }>();

  for (const op of operaciones) {
    const actual = mapa.get(op.categoria) ?? { total: 0, cantidad: 0 };
    actual.total += op.total;
    actual.cantidad += 1;
    mapa.set(op.categoria, actual);
  }

  return Array.from(mapa.entries())
    .map(([categoria, { total, cantidad }]) => ({ categoria, total, cantidad }))
    .sort((a, b) => b.total - a.total);
}

function listaCategorias(
  categorias: { categoria: string; total: number; cantidad: number }[],
  moneda: string | null | undefined,
  totalGeneral: number,
  limite = 6
): string {
  return categorias
    .slice(0, limite)
    .map((c, i) => {
      const porcentaje = totalGeneral > 0 ? Math.round((c.total / totalGeneral) * 100) : 0;
      return `${i + 1}. ${c.categoria} — ${formatearMonto(c.total, moneda)} (${c.cantidad}, ${porcentaje}%)`;
    })
    .join('\n');
}

export function construirAnalisisMensual(
  operaciones: OperacionDelMes[],
  opciones: { idioma: string | null | undefined; moneda: string | null | undefined; mesNombre: string }
): AnalisisMensual {
  const { idioma, moneda, mesNombre } = opciones;
  const pt = esPT(idioma);

  const titulo = `📊 ${pt ? 'Análise a fundo de' : 'Análisis a fondo de'} ${mesNombre}`;

  const diasConActividad = new Set(operaciones.map((o) => o.fecha)).size;
  const cantidadOperaciones = operaciones.length;

  const esPocoMovimiento =
    cantidadOperaciones < MINIMO_OPERACIONES_PARA_ANALISIS_COMPLETO ||
    diasConActividad < MINIMO_DIAS_CON_ACTIVIDAD_PARA_ANALISIS_COMPLETO;

  if (cantidadOperaciones === 0 || esPocoMovimiento) {
    const texto = pt
      ? `Olá! 👋 Sou o Sábio.\n\nEm ${mesNombre} você teve poucos movimentos carregados no sistema (${cantidadOperaciones} operações em ${diasConActividad} dia${diasConActividad === 1 ? '' : 's'}) — ainda não consigo montar uma análise completa com isso.\n\nSe foi um mês tranquilo, ótimo! Mas se falta carregar alguma coisa, é um bom momento para se colocar em dia — quanto mais dados eu tiver, melhor posso te ajudar a enxergar como está indo.\n\nE se quiser, também podemos combinar uma conversa com um assessor para revisar juntos suas finanças.\n\n— Sábio 🦉`
      : `¡Hola! 👋 Soy Sabio.\n\nEn ${mesNombre} tuviste pocos movimientos cargados en el sistema (${cantidadOperaciones} operaciones en ${diasConActividad} día${diasConActividad === 1 ? '' : 's'}) — todavía no llego a armar un análisis completo con eso.\n\nSi fue un mes tranquilo, ¡buenísimo! Pero si te falta cargar algo, es un buen momento para ponerte al día — cuantos más datos tenga, mejor te puedo ayudar a ver cómo te está yendo.\n\nY si querés, también podemos coordinar una charla con un asesor para repasar juntos tus finanzas.\n\n— Sabio 🦉`;

    return { titulo, texto, modo: 'motivacional' };
  }

  const ingresos = operaciones.filter((o) => o.tipo === 'INGRESO');
  const egresos = operaciones.filter((o) => o.tipo === 'GASTO' || o.tipo === 'COSTO');
  const aportes = operaciones.filter((o) => o.operacion === 'INVERSION');
  const extracciones = operaciones.filter((o) => o.operacion === 'EXTRACCION');

  const totalIngresos = ingresos.reduce((suma, o) => suma + o.total, 0);
  const totalEgresos = egresos.reduce((suma, o) => suma + o.total, 0);
  const totalAportes = aportes.reduce((suma, o) => suma + o.total, 0);
  const totalExtracciones = extracciones.reduce((suma, o) => suma + o.total, 0);

  const resultadoOperativo = totalIngresos - totalEgresos;
  const resultadoFinal = resultadoOperativo + totalAportes - totalExtracciones;
  const huboExtras = totalAportes > 0 || totalExtracciones > 0;

  const categoriasIngreso = agruparPorCategoria(ingresos);
  const categoriasEgreso = agruparPorCategoria(egresos);

  const lineas: string[] = [];

  lineas.push(pt ? `Olá! 👋 Sou o Sábio, aqui está a análise a fundo de ${mesNombre}.` : `¡Hola! 👋 Soy Sabio, te dejo el análisis a fondo de ${mesNombre}.`);
  lineas.push('');
  lineas.push(pt ? 'RESUMO DO MÊS' : 'RESUMEN DEL MES');
  lineas.push(`• ${pt ? 'Receitas' : 'Ingresos'}: ${formatearMonto(totalIngresos, moneda)}`);
  lineas.push(`• ${pt ? 'Despesas' : 'Egresos'}: ${formatearMonto(totalEgresos, moneda)}`);
  lineas.push(
    `• ${pt ? 'Resultado operacional' : 'Resultado operativo'}${huboExtras ? (pt ? ' (sem aportes extras)' : ' (sin aportes extra)') : ''}: ${resultadoOperativo >= 0 ? '+' : ''}${formatearMonto(resultadoOperativo, moneda)}`
  );

  if (totalAportes > 0) {
    lineas.push(`• ${pt ? 'Aportes recebidos' : 'Aportes recibidos'}: +${formatearMonto(totalAportes, moneda)}`);
  }
  if (totalExtracciones > 0) {
    lineas.push(`• ${pt ? 'Retiradas' : 'Extracciones'}: -${formatearMonto(totalExtracciones, moneda)}`);
  }
  if (huboExtras) {
    lineas.push(`• ${pt ? 'Resultado final do mês' : 'Resultado final del mes'}: ${resultadoFinal >= 0 ? '+' : ''}${formatearMonto(resultadoFinal, moneda)}`);
  }

  if (huboExtras && resultadoOperativo < 0 && resultadoFinal >= 0) {
    lineas.push('');
    lineas.push(
      pt
        ? `⚠️ Sem os aportes recebidos, ${mesNombre} teria fechado no vermelho: você gastou ${formatearMonto(Math.abs(resultadoOperativo), moneda)} a mais do que gerou com sua atividade regular.`
        : `⚠️ Sin los aportes recibidos, ${mesNombre} hubiera cerrado en rojo: gastaste ${formatearMonto(Math.abs(resultadoOperativo), moneda)} más de lo que generaste con tu actividad regular.`
    );
  }

  if (categoriasIngreso.length > 0) {
    lineas.push('');
    lineas.push(pt ? 'DE ONDE VEIO O DINHEIRO' : 'DE DÓNDE VINO LA PLATA');
    lineas.push(listaCategorias(categoriasIngreso, moneda, totalIngresos));
  }

  if (categoriasEgreso.length > 0) {
    lineas.push('');
    lineas.push(pt ? 'PARA ONDE FOI' : 'EN QUÉ SE FUE');
    lineas.push(listaCategorias(categoriasEgreso, moneda, totalEgresos));
  }

  lineas.push('');
  lineas.push(pt ? 'ATIVIDADE NO SISTEMA' : 'ACTIVIDAD EN EL SISTEMA');
  lineas.push(
    pt
      ? `Você registrou ${cantidadOperaciones} operações em ${diasConActividad} dos dias do mês.`
      : `Cargaste ${cantidadOperaciones} operaciones en ${diasConActividad} de los días del mes.`
  );

  lineas.push('');
  lineas.push('— Sabio 🦉');

  return { titulo, texto: lineas.join('\n'), modo: 'completo' };
}
