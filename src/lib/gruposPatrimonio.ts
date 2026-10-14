// lib/gruposPatrimonio.ts
//
// Lo mismo que gruposActivo.ts / gruposPasivo.ts para el Patrimonio: Capital y
// aportes, Resultados acumulados, Patrimonio familiar (retiros, préstamos
// otorgados y lo que no encaja). Lógica pura, por el nombre de la cuenta.

import { normalizar, type GrupoComposicion } from './gruposActivo';

export type GrupoPatrimonioId = 'APORTES' | 'RESULTADOS' | 'FAMILIAR';

export type CuentaDePatrimonio = { nombre: string; codigo: string | null; valor: number };

export function grupoDeCuentaPatrimonio(cuenta: Omit<CuentaDePatrimonio, 'valor'>): GrupoPatrimonioId {
  const nombre = normalizar(cuenta.nombre);

  if (/RESULTADO|LUCRO|GANANCIA|UTILIDAD/.test(nombre)) return 'RESULTADOS';
  if (/APORTE|CAPITAL|AYUDA|INTEGRALIZ/.test(nombre)) return 'APORTES';

  return 'FAMILIAR';
}

export function agruparPatrimonio(cuentas: CuentaDePatrimonio[]): GrupoComposicion[] {
  const grupos = new Map<string, GrupoComposicion>();

  for (const cuenta of cuentas) {
    if (!(cuenta.valor > 0)) continue;

    const id = grupoDeCuentaPatrimonio(cuenta);
    const grupo = grupos.get(id) ?? { id, total: 0, cuentas: [] };
    grupo.total += cuenta.valor;
    grupo.cuentas.push({ nombre: cuenta.nombre, valor: cuenta.valor });
    grupos.set(id, grupo);
  }

  return Array.from(grupos.values())
    .map((g) => ({ ...g, cuentas: [...g.cuentas].sort((a, b) => b.valor - a.valor) }))
    .sort((a, b) => b.total - a.total);
}
