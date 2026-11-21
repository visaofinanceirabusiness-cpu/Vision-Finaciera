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

// ---- Totales del balance a una fecha (para la evolución patrimonial) ----
export type CuentaBalance = { nombre: string; naturaleza: string | null; tipo_saldo: string | null; saldo_inicial?: number | string | null };
export type AsientoBalance = { debito: string | null; credito: string | null; importe: number };

export type TotalesBalance = { activo: number; pasivo: number; patrimonio: number; resultado: number };

// Misma regla que el Balance Patrimonial: cada saldo se lleva a la dirección de su grupo (una cuenta «contra», como Retiro Personal,
// resta del patrimonio) y el resultado todavía no cerrado se suma al patrimonio.
export function totalesBalance(hojas: CuentaBalance[], asientos: AsientoBalance[]): TotalesBalance {
  const saldoPropio = (c: CuentaBalance) => {
    let debe = 0;
    let haber = 0;
    for (const a of asientos) {
      if (a.debito === c.nombre) debe += a.importe;
      if (a.credito === c.nombre) haber += a.importe;
    }
    const inicial = Number(c.saldo_inicial ?? 0);
    return c.naturaleza === 'ACREEDORA' ? inicial + haber - debe : inicial + debe - haber;
  };
  const enGrupo = (tipo: string) => {
    const naturalezaGrupo = tipo === 'PASIVO' || tipo === 'PATRIMONIO' ? 'ACREEDORA' : 'DEUDORA';
    return hojas.filter((c) => c.tipo_saldo === tipo).reduce((s, c) => s + saldoPropio(c) * (c.naturaleza === naturalezaGrupo ? 1 : -1), 0);
  };
  const resultadoTipo = (tipo: string) => hojas.filter((c) => c.tipo_saldo === tipo).reduce((s, c) => s + saldoPropio(c), 0);
  const resultado = resultadoTipo('INGRESO') - resultadoTipo('COSTO') - resultadoTipo('GASTO');
  return { activo: enGrupo('ACTIVO'), pasivo: enGrupo('PASIVO'), patrimonio: enGrupo('PATRIMONIO') + resultado, resultado };
}
