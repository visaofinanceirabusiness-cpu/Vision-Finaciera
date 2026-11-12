// lib/openFinance/bancos.ts
//
// Bancos de Brasil previstos para Open Finance. La lista de bancos que realmente se pueden conectar la define el proveedor
// (agregador); este catálogo solo da nombre, emoji y las palabras con las que se reconoce al banco en una conexión.

export type BancoOpenFinance = { codigo: string; nombre: string; emoji: string; palabras: string[] };

export const BANCOS_OPEN_FINANCE: BancoOpenFinance[] = [
  { codigo: 'santander', nombre: 'Santander', emoji: '🔴', palabras: ['santander'] },
  { codigo: 'nubank', nombre: 'Nubank', emoji: '🟣', palabras: ['nubank', 'nu pagamentos', 'nu '] },
  { codigo: 'infinitepay', nombre: 'InfinitePay', emoji: '🟢', palabras: ['infinitepay', 'infinite pay', 'cloudwalk'] },
  { codigo: 'bradesco', nombre: 'Bradesco', emoji: '🔴', palabras: ['bradesco'] },
  { codigo: 'caixa', nombre: 'Caixa Econômica Federal', emoji: '🔵', palabras: ['caixa'] },
];

// A qué banco del catálogo corresponde el nombre que informa el proveedor (null: banco fuera de la lista, igual se puede conectar).
export function bancoDeNombre(nombre: string | null | undefined): BancoOpenFinance | null {
  const n = (nombre ?? '').toLowerCase();
  if (!n.trim()) return null;
  return BANCOS_OPEN_FINANCE.find((b) => b.palabras.some((p) => n.includes(p))) ?? null;
}
