// lib/visao3dObjetos.ts
//
// Qué objeto 3D representa a cada cuenta dentro del edificio (un auto para Vehículos, una casa para
// Inmuebles, una mesa para Muebles, billetes para Efectivo…) y de qué color se ve. Se decide por el
// nombre de la cuenta (en español o portugués, sin acentos) para que valga con cualquier plan de
// cuentas; lo que no se reconoce cae en una caja genérica. Lógica pura y testeada.

import type { GrupoId } from './visao3d';

export type TipoObjeto = 'auto' | 'casa' | 'mesa' | 'equipo' | 'mercaderia' | 'banco' | 'ahorro' | 'billetes' | 'documento' | 'capital' | 'resultado' | 'caja';

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// El orden importa: lo primero que coincide gana (ej. "Alquiler a cobrar" es un documento, no una casa).
const REGLAS: Array<[TipoObjeto, string[]]> = [
  ['documento', ['a cobrar', 'a pagar', 'a receber', 'cuota', 'parcela', 'prestamo', 'emprestimo', 'deuda', 'divida', 'tarjeta', 'cartao', 'credito', 'financiamiento', 'financiamento', 'proveedor', 'fornecedor', 'cliente', 'suscripc', 'assinatura', 'impuesto', 'imposto', 'tributo', 'sueldo', 'salario']],
  ['auto', ['vehicul', 'veiculo', 'auto', 'carro', 'coche', 'moto', 'camion', 'caminhao', 'rodado', 'flota', 'frota']],
  ['casa', ['inmueble', 'imovel', 'imoveis', 'propiedad', 'propriedade', 'departamento', 'apartamento', 'casa', 'terreno', 'edificio', 'predio', 'local comercial']],
  // Una cuenta de stock es mercadería aunque el rubro suene a otra cosa ('Estoque Eletrônicos' no es un equipo): va antes que mesa/equipo.
  ['mercaderia', ['estoque', 'stock', 'inventar', 'mercadoria']],
  ['mesa', ['mueble', 'movel', 'moveis', 'mobili', 'util', 'escritorio', 'mesa']],
  ['equipo', ['electro', 'eletro', 'equipo', 'equipamento', 'computad', 'notebook', 'celular', 'maquin', 'tecnolog', 'herramient', 'ferrament', 'instalac']],
  ['mercaderia', ['mercader', 'mercadoria', 'estoque', 'stock', 'inventar', 'producto', 'produto', 'insumo', 'materia prima']],
  ['ahorro', ['caxinha', 'ahorro', 'poupanc', 'invers', 'investimento', 'providencia', 'previden', 'plazo fijo', 'reserva', 'fondo', 'fundo']],
  ['banco', ['banco', 'bank', 'cuenta corriente', 'conta corrente']],
  ['billetes', ['efectivo', 'dinheiro', 'caja', 'caixa', 'billetera', 'carteira', 'naranja', 'pix', 'wallet', 'cash', 'disponib']],
  ['capital', ['capital', 'aporte', 'patrimon', 'socio', 'retiro', 'distribuc', 'ajuste']],
  ['resultado', ['resultado', 'lucro', 'ganancia', 'utilidad', 'ejercicio', 'exercicio']],
];

export function tipoObjeto(nombre: string, sintetico = false): TipoObjeto {
  if (sintetico) return 'resultado';
  const n = sinAcentos(nombre);
  for (const [tipo, palabras] of REGLAS) {
    if (palabras.some((p) => n.includes(p))) return tipo;
  }
  return 'caja';
}

export const COLOR_SIN_SALDO = '#8b95a5';
export const COLOR_NEGATIVO = '#ef4444';

// Color del objeto: el del grupo cuando hay saldo, gris cuando la cuenta está en cero (el objeto "está"
// pero no hay nada) y rojo si el saldo es negativo.
export function colorDeSaldo(saldo: number, colorGrupo: string): string {
  if (Math.round(saldo) === 0) return COLOR_SIN_SALDO;
  return saldo < 0 ? COLOR_NEGATIVO : colorGrupo;
}
