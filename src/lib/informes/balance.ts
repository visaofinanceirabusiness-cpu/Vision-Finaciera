// lib/informes/balance.ts — texto de Sabio para el Balance Patrimonial. Por reglas, solo con los números del propio balance.

export type DatosAnalisisBalance = {
  pt: boolean;
  activo: number;
  pasivo: number;
  patrimonio: number; // patrimonio líquido (ya con el resultado no cerrado)
  resultado: number;
  dinero: (n: number) => string;
};

export function porcentaje(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

export function analisisBalance(d: DatosAnalisisBalance): string[] {
  const { pt } = d;
  if (d.activo === 0 && d.pasivo === 0 && d.patrimonio === 0) return [pt ? 'Ainda não há saldos neste período.' : 'Todavía no hay saldos en este período.'];

  const pct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;
  const parrafos: string[] = [];

  if (d.patrimonio < 0) {
    parrafos.push(pt ? `Seu patrimônio líquido é negativo (${d.dinero(d.patrimonio)}): as dívidas superam o que você tem.` : `Tu patrimonio líquido es negativo (${d.dinero(d.patrimonio)}): las deudas superan lo que tenés.`);
  } else {
    const peso = porcentaje(d.patrimonio, d.activo);
    parrafos.push(
      pt
        ? `Seu patrimônio líquido é de ${d.dinero(d.patrimonio)}${d.activo > 0 ? `, representando ${pct(peso)} dos seus ativos` : ''}.`
        : `Tu patrimonio líquido es de ${d.dinero(d.patrimonio)}${d.activo > 0 ? `, representando el ${pct(peso)} de tus activos` : ''}.`
    );
  }

  const deuda = porcentaje(d.pasivo, d.activo);
  if (d.activo > 0 && d.patrimonio >= 0) {
    if (deuda < 30) parrafos.push(pt ? 'A estrutura patrimonial é muito sólida! 💪' : '¡La estructura patrimonial es muy sólida! 💪');
    else if (deuda < 60) parrafos.push(pt ? `As obrigações pesam ${pct(deuda)} dos ativos: equilibrado, mas vale acompanhar o nível de dívidas.` : `Las obligaciones pesan el ${pct(deuda)} de los activos: es equilibrado, pero conviene vigilar el nivel de deudas.`);
    else parrafos.push(pt ? `As obrigações pesam ${pct(deuda)} dos ativos: priorize reduzir as dívidas.` : `Las obligaciones pesan el ${pct(deuda)} de los activos: priorizá reducir las deudas.`);
  }

  if (d.resultado < 0) parrafos.push(pt ? 'O resultado do exercício está negativo e reduz o patrimônio.' : 'El resultado del ejercicio está negativo y reduce el patrimonio.');
  return parrafos;
}
