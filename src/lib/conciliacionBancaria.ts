// lib/conciliacionBancaria.ts
//
// CONCILIACIÓN BANCARIA — parte pura (se prueba en conciliacionBancaria.test.ts; la lectura y escritura de la base van en
// conciliacionBancariaDatos.ts). Compara lo que informa el banco con lo cargado en Visão y PROPONE: nada se registra sin que la persona
// apruebe, y al aprobar se usa el motor contable de siempre (partida doble, saldos no negativos).
//
// Cada movimiento del banco queda en uno de tres lugares:
//   1. EMPAREJADO con una operación ya cargada (mismo monto y signo, fecha cercana) → conciliado, no hace falta hacer nada.
//   2. SIN OPERACIÓN en Visão → se propone una operación nueva (PAGO si salió plata, COBRO si entró) para aprobar, editar o ignorar.
//   3. Lo que está en Visão y no aparece en el banco → se muestra aparte («no aparece en el extracto»).

import { aCentavos } from './centavos';

export type MovBanco = { id: string; fecha: string; monto: number; descripcion: string; contraparte: string | null };

// Efecto de una operación ya cargada sobre la cuenta del banco, con signo (+ entra, − sale).
export type OpVisao = { idOperacion: string; fecha: string; monto: number; texto: string; operacion: string; categoria: string };

export type Emparejamiento = { movId: string; idOperacion: string; puntaje: number };

export const DIAS_DE_TOLERANCIA = 3;

function dias(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000));
}

const PALABRAS_VACIAS = new Set(['pix', 'ted', 'doc', 'de', 'da', 'do', 'para', 'por', 'em', 'a', 'o', 'e', 'enviado', 'recebido', 'compra', 'pagamento', 'transferencia', 'transferência', 'debito', 'débito', 'credito', 'crédito', 'ltda', 'sa', 'me', 'epp']);

export function palabrasClave(texto: string): string[] {
  return [...new Set(
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 3 && !PALABRAS_VACIAS.has(p) && !/^\d+$/.test(p))
  )];
}

function similitud(a: string, b: string): number {
  const pa = palabrasClave(a);
  const pb = new Set(palabrasClave(b));
  if (pa.length === 0 || pb.size === 0) return 0;
  return pa.filter((p) => pb.has(p)).length / Math.min(pa.length, pb.size);
}

// Empareja uno a uno: mismo importe y signo, a no más de DIAS_DE_TOLERANCIA días; entre varias candidatas gana la más cercana y la que
// más se parece en el texto. Cada operación se usa una sola vez.
export function emparejar(movs: MovBanco[], ops: OpVisao[], tolerancia = DIAS_DE_TOLERANCIA): Emparejamiento[] {
  const candidatos: Emparejamiento[] = [];
  for (const m of movs) {
    for (const o of ops) {
      if (aCentavos(m.monto) !== aCentavos(o.monto)) continue;
      const d = dias(m.fecha, o.fecha);
      if (d > tolerancia) continue;
      const puntaje = 100 - d * 10 + Math.round(similitud(`${m.descripcion} ${m.contraparte ?? ''}`, o.texto) * 20);
      candidatos.push({ movId: m.id, idOperacion: o.idOperacion, puntaje });
    }
  }
  candidatos.sort((a, b) => b.puntaje - a.puntaje);

  const movUsados = new Set<string>();
  const opUsadas = new Set<string>();
  const salida: Emparejamiento[] = [];
  for (const c of candidatos) {
    if (movUsados.has(c.movId) || opUsadas.has(c.idOperacion)) continue;
    movUsados.add(c.movId);
    opUsadas.add(c.idOperacion);
    salida.push(c);
  }
  return salida;
}

export type Resultado = { emparejados: Emparejamiento[]; sinOperacion: MovBanco[]; sinBanco: OpVisao[] };

export function conciliar(movs: MovBanco[], ops: OpVisao[], tolerancia = DIAS_DE_TOLERANCIA): Resultado {
  const emparejados = emparejar(movs, ops, tolerancia);
  const movsOk = new Set(emparejados.map((e) => e.movId));
  const opsOk = new Set(emparejados.map((e) => e.idOperacion));
  return { emparejados, sinOperacion: movs.filter((m) => !movsOk.has(m.id)), sinBanco: ops.filter((o) => !opsOk.has(o.idOperacion)) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Propuesta de operación nueva para un movimiento sin operación.
// ---------------------------------------------------------------------------------------------------------------------

export type Propuesta = { operacion: 'PAGO' | 'COBRO'; categoria: string | null; contacto: string; detalle: string; motivo: string };

// `historial`: operaciones que la persona ya cargó (texto = detalle + proveedor/cliente, categoría usada). Aprende de ellas: si el texto del
// banco se parece a uno ya cargado, propone la misma categoría.
export function proponerOperacion(mov: MovBanco, historial: Array<{ texto: string; categoria: string; operacion: string }>): Propuesta {
  const operacion: 'PAGO' | 'COBRO' = mov.monto < 0 ? 'PAGO' : 'COBRO';
  const texto = `${mov.descripcion} ${mov.contraparte ?? ''}`;

  let mejor: { categoria: string; puntaje: number } | null = null;
  const votos = new Map<string, number>();
  for (const h of historial) {
    if (h.operacion !== operacion) continue;
    const s = similitud(texto, h.texto);
    if (s < 0.5) continue;
    votos.set(h.categoria, (votos.get(h.categoria) ?? 0) + s);
  }
  for (const [categoria, puntaje] of votos) if (!mejor || puntaje > mejor.puntaje) mejor = { categoria, puntaje };

  return {
    operacion,
    categoria: mejor?.categoria ?? null,
    contacto: (mov.contraparte ?? '').trim(),
    detalle: mov.descripcion.trim() || (mov.contraparte ?? '').trim(),
    motivo: mejor ? 'Se parece a operaciones que ya cargaste.' : 'No hay operaciones parecidas: elegí la categoría.',
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Saldos
// ---------------------------------------------------------------------------------------------------------------------

export type EstadoSaldos = { diferencia: number; coincide: boolean; coincidiriaAlAprobar: boolean; faltaPorAprobar: number };

// `saldoVisao`: el de la cuenta vinculada. `pendientes`: movimientos del banco sin operación (con signo). Si aprobar todos deja los saldos
// iguales, se avisa; si no, la diferencia restante viene de un saldo inicial o de movimientos anteriores al período importado.
export function estadoDeSaldos(saldoBanco: number, saldoVisao: number, pendientes: Array<{ monto: number }>): EstadoSaldos {
  const diferencia = aCentavos(saldoBanco - saldoVisao);
  const faltaPorAprobar = aCentavos(pendientes.reduce((s, p) => s + p.monto, 0));
  return { diferencia, coincide: diferencia === 0, coincidiriaAlAprobar: diferencia !== 0 && diferencia === faltaPorAprobar, faltaPorAprobar };
}
