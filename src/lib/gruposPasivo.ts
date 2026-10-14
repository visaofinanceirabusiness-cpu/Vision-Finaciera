// lib/gruposPasivo.ts
//
// Lo mismo que gruposActivo.ts pero para el Pasivo: Tarjetas de crédito,
// Deudas y préstamos, Cuentas a pagar (alquileres, suscripciones, compromisos),
// Deudas a largo plazo y Otros. Lógica pura, apoyada en el nombre de la cuenta
// y en el de sus grupos padre.

import { normalizar, type CuentaDeActivo, type GrupoComposicion } from './gruposActivo';

export type GrupoPasivoId = 'TARJETAS' | 'DEUDAS' | 'CUENTAS_PAGAR' | 'LARGO_PLAZO' | 'OTROS';

export type CuentaDePasivo = Omit<CuentaDeActivo, 'esMedio' | 'esPorCobrar'>;

export function grupoDeCuentaPasivo(cuenta: Omit<CuentaDePasivo, 'valor'>): GrupoPasivoId {
  const nombre = normalizar(cuenta.nombre);
  const padres = cuenta.ancestros.map(normalizar);

  if (/TARJETA|CARTAO|CREDITO A PAGAR|T\. DE CRED/.test(nombre) || padres.some((p) => /TARJETA|CARTAO/.test(p))) return 'TARJETAS';
  if (padres.some((p) => p.includes('NO CORRIENTE'))) return 'LARGO_PLAZO';
  if (/PRESTAMO|EMPRESTIMO|FINANCIA|HIPOTEC|DEUDA|DIVIDA/.test(nombre)) return 'DEUDAS';
  if (/ A PAGAR$|^A PAGAR|POR PAGAR|CONTAS A PAGAR|CUENTAS A PAGAR/.test(nombre) || padres.some((p) => /A PAGAR$/.test(p))) return 'CUENTAS_PAGAR';

  return 'OTROS';
}

export function agruparPasivo(cuentas: CuentaDePasivo[]): GrupoComposicion[] {
  const grupos = new Map<string, GrupoComposicion>();

  for (const cuenta of cuentas) {
    if (!(cuenta.valor > 0)) continue;

    const id = grupoDeCuentaPasivo(cuenta);
    const grupo = grupos.get(id) ?? { id, total: 0, cuentas: [] };
    grupo.total += cuenta.valor;
    grupo.cuentas.push({ nombre: cuenta.nombre, valor: cuenta.valor });
    grupos.set(id, grupo);
  }

  return Array.from(grupos.values())
    .map((g) => ({ ...g, cuentas: [...g.cuentas].sort((a, b) => b.valor - a.valor) }))
    .sort((a, b) => b.total - a.total);
}
