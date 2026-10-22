// lib/visao3d.ts
//
// Visão Financeira 3D — "La empresa por dentro": arma, a partir del plan de cuentas y los
// asientos VALIDADOS (los mismos que usa Informes → Balance), el árbol que representa el edificio:
// Empresa → Ativo / Passivo / Patrimônio Líquido → rubros → cuentas.
//
// Reglas contables (las mismas del Balance de Informes):
//   - Solo las cuentas HOJA tienen saldo propio; los rubros y grupos suman a sus hijas, así que
//     nunca se cuenta un padre y sus hijos como importes independientes.
//   - Cada saldo va en la dirección de su grupo (Activo: deudora; Pasivo y Patrimonio: acreedora);
//     una cuenta "contra" (ej. Retiro Personal) resta en vez de sumar.
//   - El Patrimonio incluye el resultado del ejercicio todavía sin cerrar, como línea
//     sintética, para que Activo = Pasivo + Patrimonio cierre.
// Solo lectura: no toca el motor ni consulta nada.

export type CuentaPlan = {
  id: string;
  codigo: string;
  nombre: string;
  cuenta_padre_id: string | null;
  tipo_saldo: string | null;
  naturaleza: string | null;
  saldo_inicial: number | string | null;
};

export type AsientoVisao = {
  id_operacion: string | null;
  fecha: string;
  descripcion: string;
  debito: string | null;
  credito: string | null;
  importe: number;
};

export type GrupoId = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO';

export type NodoEdificio = {
  id: string;
  codigo: string | null;
  nombre: string;
  grupo: GrupoId;
  // 0 = empresa, 1 = grupo, 2 = rubro / cuenta de primer nivel…
  nivel: number;
  saldo: number;
  saldoAnterior: number | null;
  variacion: number | null;
  variacionPct: number | null;
  // % sobre el saldo de su padre (null si el padre está en cero o negativo).
  participacion: number | null;
  hijos: NodoEdificio[];
  esHoja: boolean;
  // Línea que no es una cuenta del plan (resultado del ejercicio sin cerrar).
  sintetico: boolean;
  // Cuentas hoja que cuelgan de este nodo.
  cuentasDependientes: number;
  // Nombre de la cuenta en los asientos (solo hojas reales), para listar sus movimientos.
  cuentaNombre: string | null;
};

export type Edificio = {
  raiz: NodoEdificio;
  // Activo − (Pasivo + Patrimonio con resultado). Debería ser 0.
  diferencia: number;
};

export type EtiquetasGrupo = { empresa: string; ACTIVO: string; PASIVO: string; PATRIMONIO: string; resultado: string };

const redondear = (n: number) => Math.round(n * 100) / 100;

const GRUPOS: GrupoId[] = ['ACTIVO', 'PASIVO', 'PATRIMONIO'];
const NATURALEZA_DEL_GRUPO: Record<GrupoId, 'DEUDORA' | 'ACREEDORA'> = { ACTIVO: 'DEUDORA', PASIVO: 'ACREEDORA', PATRIMONIO: 'ACREEDORA' };

// 'YYYY-MM' → último día incluido, comparable como texto con 'YYYY-MM-DD'.
const finDeMes = (mes: string) => `${mes}-31`;

export function mesAnterior(mes: string): string {
  const [anio, m] = mes.split('-').map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, '0')}`;
}

export function mesesDisponibles(asientos: Pick<AsientoVisao, 'fecha'>[]): string[] {
  return Array.from(new Set(asientos.map((a) => a.fecha.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))).sort((a, b) => b.localeCompare(a));
}

type Acumulado = Map<string, { debe: number; haber: number }>;

function acumular(asientos: AsientoVisao[], hasta: string | null): Acumulado {
  const mapa: Acumulado = new Map();
  const sumar = (nombre: string | null, lado: 'debe' | 'haber', importe: number) => {
    if (!nombre) return;
    const actual = mapa.get(nombre) ?? { debe: 0, haber: 0 };
    actual[lado] += importe;
    mapa.set(nombre, actual);
  };

  for (const a of asientos) {
    if (hasta && a.fecha.slice(0, 10) > hasta) continue;
    sumar(a.debito, 'debe', a.importe);
    sumar(a.credito, 'haber', a.importe);
  }

  return mapa;
}

// Saldo de una hoja, ya en la dirección de su grupo.
function saldoDeHoja(cuenta: CuentaPlan, grupo: GrupoId, acumulado: Acumulado): number {
  const { debe, haber } = acumulado.get(cuenta.nombre) ?? { debe: 0, haber: 0 };
  const inicial = Number(cuenta.saldo_inicial ?? 0);
  const propio = cuenta.naturaleza === 'ACREEDORA' ? inicial + haber - debe : inicial + debe - haber;
  return propio * (cuenta.naturaleza === NATURALEZA_DEL_GRUPO[grupo] ? 1 : -1);
}

// Resultado del ejercicio todavía sin cerrar: ingresos − costos − gastos (saldos en su propia dirección).
function resultadoDelEjercicio(hojas: CuentaPlan[], acumulado: Acumulado): number {
  let resultado = 0;
  for (const c of hojas) {
    const { debe, haber } = acumulado.get(c.nombre) ?? { debe: 0, haber: 0 };
    const inicial = Number(c.saldo_inicial ?? 0);
    const propio = c.naturaleza === 'ACREEDORA' ? inicial + haber - debe : inicial + debe - haber;
    if (c.tipo_saldo === 'INGRESO') resultado += propio;
    else if (c.tipo_saldo === 'COSTO' || c.tipo_saldo === 'GASTO') resultado -= propio;
  }
  return resultado;
}

type Borrador = Omit<NodoEdificio, 'participacion' | 'variacion' | 'variacionPct' | 'hijos'> & { hijos: Borrador[] };

function cerrarNodo(b: Borrador, padreSaldo: number | null): NodoEdificio {
  const variacion = b.saldoAnterior === null ? null : redondear(b.saldo - b.saldoAnterior);
  return {
    ...b,
    hijos: b.hijos.map((h) => cerrarNodo(h, b.saldo)),
    variacion,
    variacionPct: variacion === null || !b.saldoAnterior ? null : redondear((variacion / Math.abs(b.saldoAnterior)) * 100),
    participacion: padreSaldo !== null && padreSaldo > 0 ? redondear((b.saldo / padreSaldo) * 100) : null,
  };
}

// `mesCierre` = 'YYYY-MM' (saldos al cierre de ese mes) o null (todo lo registrado).
// `traducir` solo cambia el nombre que se muestra; los movimientos se siguen buscando por el nombre real.
export function construirEdificio(cuentas: CuentaPlan[], asientos: AsientoVisao[], mesCierre: string | null, etiquetas: EtiquetasGrupo, traducir: (nombre: string) => string = (n) => n): Edificio {
  const actual = acumular(asientos, mesCierre ? finDeMes(mesCierre) : null);
  const previo = mesCierre ? acumular(asientos, finDeMes(mesAnterior(mesCierre))) : null;

  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const hijosDe = new Map<string, CuentaPlan[]>();
  const raices: CuentaPlan[] = [];

  for (const c of cuentas) {
    if (c.cuenta_padre_id && porId.has(c.cuenta_padre_id)) {
      hijosDe.set(c.cuenta_padre_id, [...(hijosDe.get(c.cuenta_padre_id) ?? []), c]);
    } else {
      raices.push(c);
    }
  }

  const ordenar = (lista: CuentaPlan[]) => lista.slice().sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

  function armarCuenta(cuenta: CuentaPlan, grupo: GrupoId, nivel: number): Borrador {
    const hijas = ordenar(hijosDe.get(cuenta.id) ?? []).filter((h) => h.tipo_saldo === grupo);

    if (hijas.length === 0) {
      const saldo = redondear(saldoDeHoja(cuenta, grupo, actual));
      const saldoAnterior = previo ? redondear(saldoDeHoja(cuenta, grupo, previo)) : null;
      return { id: cuenta.id, codigo: cuenta.codigo, nombre: traducir(cuenta.nombre), grupo, nivel, saldo, saldoAnterior, hijos: [], esHoja: true, sintetico: false, cuentasDependientes: 0, cuentaNombre: cuenta.nombre };
    }

    return agrupar({ id: cuenta.id, codigo: cuenta.codigo, nombre: traducir(cuenta.nombre), grupo, nivel, esHoja: false, sintetico: false, cuentaNombre: null }, hijas.map((h) => armarCuenta(h, grupo, nivel + 1)));
  }

  function agrupar(base: Pick<Borrador, 'id' | 'codigo' | 'nombre' | 'grupo' | 'nivel' | 'esHoja' | 'sintetico' | 'cuentaNombre'>, hijos: Borrador[]): Borrador {
    return {
      ...base,
      hijos,
      saldo: redondear(hijos.reduce((s, h) => s + h.saldo, 0)),
      saldoAnterior: hijos.some((h) => h.saldoAnterior === null) ? null : redondear(hijos.reduce((s, h) => s + (h.saldoAnterior ?? 0), 0)),
      cuentasDependientes: hijos.reduce((s, h) => s + (h.esHoja ? 1 : h.cuentasDependientes), 0),
    };
  }

  const hojas = cuentas.filter((c) => !(hijosDe.get(c.id)?.length));

  const grupos: Borrador[] = GRUPOS.map((grupo) => {
    const raicesDelGrupo = ordenar(raices.filter((r) => r.tipo_saldo === grupo));
    // Con una única cuenta raíz del grupo (ej. "ACTIVO") sus hijas son los rubros: no se repite el título.
    const rubros =
      raicesDelGrupo.length === 1 && (hijosDe.get(raicesDelGrupo[0].id)?.length ?? 0) > 0
        ? ordenar(hijosDe.get(raicesDelGrupo[0].id)!.filter((h) => h.tipo_saldo === grupo)).map((h) => armarCuenta(h, grupo, 2))
        : raicesDelGrupo.map((r) => armarCuenta(r, grupo, 2));

    if (grupo === 'PATRIMONIO') {
      const saldo = redondear(resultadoDelEjercicio(hojas, actual));
      const saldoAnterior = previo ? redondear(resultadoDelEjercicio(hojas, previo)) : null;
      rubros.push({ id: 'sintetico:resultado', codigo: null, nombre: etiquetas.resultado, grupo, nivel: 2, saldo, saldoAnterior, hijos: [], esHoja: true, sintetico: true, cuentasDependientes: 0, cuentaNombre: null });
    }

    return agrupar({ id: `grupo:${grupo}`, codigo: null, nombre: etiquetas[grupo], grupo, nivel: 1, esHoja: false, sintetico: false, cuentaNombre: null }, rubros);
  });

  const [activo, pasivo, patrimonio] = grupos;
  const raiz = agrupar({ id: 'empresa', codigo: null, nombre: etiquetas.empresa, grupo: 'ACTIVO', nivel: 0, esHoja: false, sintetico: false, cuentaNombre: null }, grupos);

  // La empresa no "suma" Activo + Pasivo + Patrimonio: su saldo de referencia es el total del Activo
  // (= Pasivo + Patrimonio cuando cuadra). Así los porcentajes de grupo tienen una base clara.
  raiz.saldo = activo.saldo;
  raiz.saldoAnterior = activo.saldoAnterior;

  return {
    raiz: cerrarNodo(raiz, null),
    diferencia: redondear(activo.saldo - (pasivo.saldo + patrimonio.saldo)),
  };
}

export type MovimientoCuenta = { id_operacion: string | null; fecha: string; descripcion: string; esDebe: boolean; importe: number };

// Últimos movimientos de una cuenta hoja hasta el cierre elegido (más recientes primero).
export function movimientosDeCuenta(nombre: string, asientos: AsientoVisao[], mesCierre: string | null, limite = 30): MovimientoCuenta[] {
  const hasta = mesCierre ? finDeMes(mesCierre) : null;

  return asientos
    .filter((a) => (a.debito === nombre || a.credito === nombre) && (!hasta || a.fecha.slice(0, 10) <= hasta))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.id_operacion ?? '').localeCompare(a.id_operacion ?? ''))
    .slice(0, limite)
    .map((a) => ({ id_operacion: a.id_operacion, fecha: a.fecha.slice(0, 10), descripcion: a.descripcion, esDebe: a.debito === nombre, importe: a.importe }));
}

export function buscarNodo(raiz: NodoEdificio, id: string): NodoEdificio | null {
  if (raiz.id === id) return raiz;
  for (const h of raiz.hijos) {
    const encontrado = buscarNodo(h, id);
    if (encontrado) return encontrado;
  }
  return null;
}

// Camino desde la empresa hasta el nodo (para el "Empresa → Ativo → …").
export function caminoHasta(raiz: NodoEdificio, id: string): NodoEdificio[] {
  if (raiz.id === id) return [raiz];
  for (const h of raiz.hijos) {
    const camino = caminoHasta(h, id);
    if (camino.length) return [raiz, ...camino];
  }
  return [];
}

// Alturas de los pisos: proporcionales al valor pero acotadas, para que una cuenta chica siga siendo
// visible/seleccionable y una enorme no aplaste al resto. Los negativos usan su valor absoluto
// (la etiqueta lo marca en rojo); no hay geometría "hacia abajo".
export function alturasProporcionales(valores: number[], alturaTotal: number, minimo: number): number[] {
  if (valores.length === 0) return [];
  const absolutos = valores.map((v) => Math.abs(v));
  const suma = absolutos.reduce((s, v) => s + v, 0);
  const crudas = absolutos.map((v) => (suma > 0 ? (v / suma) * alturaTotal : alturaTotal / valores.length));
  const conMinimo = crudas.map((h) => Math.max(h, minimo));
  const exceso = conMinimo.reduce((s, h) => s + h, 0) - alturaTotal;
  if (exceso <= 0) return conMinimo;

  // Se descuenta el exceso de los pisos que están por encima del mínimo, a prorrata.
  const holgura = conMinimo.map((h) => h - minimo);
  const holguraTotal = holgura.reduce((s, h) => s + h, 0);
  return conMinimo.map((h, i) => (holguraTotal > 0 ? h - (holgura[i] / holguraTotal) * exceso : h));
}
