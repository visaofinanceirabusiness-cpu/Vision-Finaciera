// lib/informes/mayorArbol.ts — Libro Mayor en forma de árbol del plan de cuentas (Informes → Mayor): saldo inicial, debe, haber y saldo
// final de cada cuenta en un período, con los totales de las cuentas título sumados desde sus hijas. Solo lectura sobre asientos ya cargados.

export type CuentaArbol = {
  id: string;
  codigo: string;
  nombre: string;
  cuenta_padre_id: string | null;
  naturaleza: string | null;
  tipo_saldo: string | null;
  saldo_inicial?: number | string | null;
};
export type AsientoArbol = { fecha: string; debito: string | null; credito: string | null; importe: number };

export type NodoMayor = {
  cuenta: CuentaArbol;
  nivel: number;
  hijos: NodoMayor[];
  esHoja: boolean;
  saldoInicial: number;
  debe: number;
  haber: number;
  saldoFinal: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// `periodo` = 'TODOS' o 'AAAA-MM'. Con un mes, el saldo inicial es lo que traía la cuenta al empezar ese mes.
export function arbolMayor(
  cuentas: CuentaArbol[],
  asientos: AsientoArbol[],
  periodo: string,
  // Balancete: con un mes puntual, las cuentas de resultado (ingresos, costos, gastos) arrancan en cero cada mes: se mira el resultado DEL mes.
  reiniciarResultados = false
): { raices: NodoMayor[]; totalDebe: number; totalHaber: number } {
  const hijosDe = new Map<string | null, CuentaArbol[]>();
  for (const c of cuentas) {
    const lista = hijosDe.get(c.cuenta_padre_id) ?? [];
    lista.push(c);
    hijosDe.set(c.cuenta_padre_id, lista);
  }
  const ordenar = (l: CuentaArbol[]) => l.slice().sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

  // Movimiento por nombre de cuenta, partido en «antes del período» y «dentro del período».
  const antes = new Map<string, { d: number; h: number }>();
  const dentro = new Map<string, { d: number; h: number }>();
  const suma = (m: Map<string, { d: number; h: number }>, nombre: string, lado: 'd' | 'h', v: number) => {
    const a = m.get(nombre) ?? { d: 0, h: 0 };
    a[lado] += v;
    m.set(nombre, a);
  };
  for (const a of asientos) {
    const mes = a.fecha.slice(0, 7);
    const destino = periodo === 'TODOS' || mes === periodo ? dentro : mes < periodo ? antes : null;
    if (!destino) continue;
    if (a.debito) suma(destino, a.debito, 'd', a.importe);
    if (a.credito) suma(destino, a.credito, 'h', a.importe);
  }

  let totalDebe = 0;
  let totalHaber = 0;

  const construir = (c: CuentaArbol, nivel: number): NodoMayor => {
    const hijas = ordenar(hijosDe.get(c.id) ?? []);
    if (hijas.length === 0) {
      const acreedora = c.naturaleza === 'ACREEDORA';
      const previo = antes.get(c.nombre) ?? { d: 0, h: 0 };
      const mov = dentro.get(c.nombre) ?? { d: 0, h: 0 };
      const reinicia = reiniciarResultados && periodo !== 'TODOS' && ['INGRESO', 'COSTO', 'GASTO'].includes(c.tipo_saldo ?? '');
      const inicial = reinicia ? 0 : Number(c.saldo_inicial ?? 0) + (acreedora ? previo.h - previo.d : previo.d - previo.h);
      totalDebe += mov.d;
      totalHaber += mov.h;
      return { cuenta: c, nivel, hijos: [], esHoja: true, saldoInicial: r2(inicial), debe: r2(mov.d), haber: r2(mov.h), saldoFinal: r2(inicial + (acreedora ? mov.h - mov.d : mov.d - mov.h)) };
    }
    const nodos = hijas.map((h) => construir(h, nivel + 1));
    // Una hija «contra» (naturaleza opuesta, como Retiro Personal dentro de Patrimonio) resta del título.
    const signo = (n: NodoMayor) => (n.cuenta.naturaleza === c.naturaleza ? 1 : -1);
    return {
      cuenta: c,
      nivel,
      hijos: nodos,
      esHoja: false,
      saldoInicial: r2(nodos.reduce((s, n) => s + n.saldoInicial * signo(n), 0)),
      debe: r2(nodos.reduce((s, n) => s + n.debe, 0)),
      haber: r2(nodos.reduce((s, n) => s + n.haber, 0)),
      saldoFinal: r2(nodos.reduce((s, n) => s + n.saldoFinal * signo(n), 0)),
    };
  };

  const raices = ordenar(hijosDe.get(null) ?? []).map((c) => construir(c, 1));
  return { raices, totalDebe: r2(totalDebe), totalHaber: r2(totalHaber) };
}

export const estaEnCero = (n: NodoMayor) => Math.round(n.saldoInicial) === 0 && Math.round(n.debe) === 0 && Math.round(n.haber) === 0 && Math.round(n.saldoFinal) === 0;

// Saca las ramas sin ningún movimiento ni saldo (una cuenta título se queda si alguna hija se queda).
export function sinCeros(nodos: NodoMayor[]): NodoMayor[] {
  return nodos
    .map((n) => (n.esHoja ? n : { ...n, hijos: sinCeros(n.hijos) }))
    .filter((n) => (n.esHoja ? !estaEnCero(n) : n.hijos.length > 0));
}

export function profundidadMaxima(nodos: NodoMayor[]): number {
  return nodos.reduce((m, n) => Math.max(m, n.nivel, profundidadMaxima(n.hijos)), 0);
}

// Ids de una cuenta y todos sus ancestros (para abrir el árbol hasta una cuenta puntual).
export function rutaHastaCuenta(cuentas: CuentaArbol[], nombre: string): string[] {
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const destino = cuentas.find((c) => c.nombre === nombre);
  const ruta: string[] = [];
  for (let c = destino; c; c = c.cuenta_padre_id ? porId.get(c.cuenta_padre_id) : undefined) ruta.push(c.id);
  return ruta;
}
