// lib/familiaUnida.ts
//
// FAMILIA UNIDA — vista consolidada de varias personas (perfiles Finanzas Personales)
// =====================================================
// Nada de esto copia ni mueve registros: cada persona sigue con sus propias
// operaciones y la familia es una SUMA de los indicadores que ya calcula el Panel
// de Control (lib/contabilidad.ts → obtenerIndicadores). La API del servidor
// (/api/familia-unida) calcula los de cada persona vinculada y devuelve solo
// totales y categorías; acá viven las cuentas puras de la suma y de la tendencia,
// que se prueban en familiaUnida.test.ts.
//
// Regla: "egresos" = ingresos − resultado. Así el resultado de la familia siempre
// cierra con sus ingresos y egresos, sin importar cómo clasifique cada persona.

import type { IndicadoresPanel, PuntoGrafico } from './contabilidad';

export type PuntoEvolucion = { clave: string; mes: string; ingresos: number; egresos: number; resultado: number };

export type PersonaFamilia = {
  empresaId: string;
  nombre: string;
  esYo: boolean;
  ingresos: number;
  egresos: number;
  resultado: number;
  activos: number;
  pasivos: number;
  evolucion: PuntoEvolucion[];
  gastosCategorias: PuntoGrafico[];
  ingresosCategorias: PuntoGrafico[];
};

export type EstadoFamilia =
  | { estado: 'SIN_FAMILIA'; invitacion: InvitacionFamilia | null }
  | { estado: 'ACTIVA'; periodo: string; moneda: string | null; personas: PersonaFamilia[]; invitacion: InvitacionFamilia | null; omitidas: string[] };

export type InvitacionFamilia = { codigo: string; expiraEn: string };

const redondear = (v: number) => Math.round(v * 100) / 100;

// Del resultado del Panel de Control a lo que necesita la familia (sin lógica contable nueva).
export function resumirPersona(empresaId: string, nombre: string, esYo: boolean, ind: IndicadoresPanel): PersonaFamilia {
  return {
    empresaId,
    nombre,
    esYo,
    ingresos: redondear(ind.ingresos),
    egresos: redondear(ind.ingresos - ind.lucro),
    resultado: redondear(ind.lucro),
    activos: redondear(ind.activos),
    pasivos: redondear(ind.pasivos),
    evolucion: ind.evolucionLucro.map((p) => ({
      clave: p.clave,
      mes: p.mes,
      ingresos: redondear(p.ingresos),
      egresos: redondear(p.costos + p.gastos),
      resultado: redondear(p.ingresos - p.costos - p.gastos),
    })),
    gastosCategorias: ind.gastosCategorias,
    ingresosCategorias: ind.ingresosCategorias,
  };
}

export function unirCategorias(listas: PuntoGrafico[][]): PuntoGrafico[] {
  const mapa = new Map<string, number>();
  for (const lista of listas) for (const c of lista) mapa.set(c.nombre, (mapa.get(c.nombre) ?? 0) + c.valor);
  return [...mapa.entries()]
    .map(([nombre, valor]) => ({ nombre, valor: redondear(valor) }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

export function unirEvolucion(listas: PuntoEvolucion[][]): PuntoEvolucion[] {
  const mapa = new Map<string, PuntoEvolucion>();
  for (const lista of listas) {
    for (const p of lista) {
      const actual = mapa.get(p.clave) ?? { clave: p.clave, mes: p.mes, ingresos: 0, egresos: 0, resultado: 0 };
      actual.ingresos = redondear(actual.ingresos + p.ingresos);
      actual.egresos = redondear(actual.egresos + p.egresos);
      actual.resultado = redondear(actual.resultado + p.resultado);
      mapa.set(p.clave, actual);
    }
  }
  return [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

export type TotalFamilia = {
  ingresos: number;
  egresos: number;
  resultado: number;
  activos: number;
  pasivos: number;
  patrimonioLiquido: number;
  evolucion: PuntoEvolucion[];
  gastosCategorias: PuntoGrafico[];
  ingresosCategorias: PuntoGrafico[];
};

export function consolidar(personas: PersonaFamilia[]): TotalFamilia {
  const suma = (f: (p: PersonaFamilia) => number) => redondear(personas.reduce((a, p) => a + f(p), 0));
  const activos = suma((p) => p.activos);
  const pasivos = suma((p) => p.pasivos);
  return {
    ingresos: suma((p) => p.ingresos),
    egresos: suma((p) => p.egresos),
    resultado: suma((p) => p.resultado),
    activos,
    pasivos,
    patrimonioLiquido: redondear(activos - pasivos),
    evolucion: unirEvolucion(personas.map((p) => p.evolucion)),
    gastosCategorias: unirCategorias(personas.map((p) => p.gastosCategorias)),
    ingresosCategorias: unirCategorias(personas.map((p) => p.ingresosCategorias)),
  };
}

export type Tendencia = {
  direccion: 'sube' | 'baja' | 'estable' | 'sin-datos';
  // Último mes con datos contra el anterior.
  actual: number | null;
  anterior: number | null;
  variacionPct: number | null;
  mesesSeguidos: number;
};

// Mira el resultado mensual: cuántos meses seguidos viene subiendo o bajando y cuánto cambió el último contra el anterior.
export function tendenciaDelResultado(evolucion: PuntoEvolucion[]): Tendencia {
  const conDatos = evolucion.filter((p) => p.ingresos !== 0 || p.egresos !== 0);
  if (conDatos.length < 2) return { direccion: 'sin-datos', actual: conDatos[0]?.resultado ?? null, anterior: null, variacionPct: null, mesesSeguidos: 0 };

  const actual = conDatos[conDatos.length - 1].resultado;
  const anterior = conDatos[conDatos.length - 2].resultado;
  const direccion: Tendencia['direccion'] = actual > anterior ? 'sube' : actual < anterior ? 'baja' : 'estable';

  let seguidos = 0;
  for (let i = conDatos.length - 1; i > 0; i--) {
    const sube = conDatos[i].resultado > conDatos[i - 1].resultado;
    const baja = conDatos[i].resultado < conDatos[i - 1].resultado;
    if ((direccion === 'sube' && sube) || (direccion === 'baja' && baja)) seguidos += 1;
    else break;
  }

  // Con un mes anterior en cero o negativo el porcentaje engaña: se muestra solo la dirección.
  const variacionPct = anterior > 0 ? redondear(((actual - anterior) / anterior) * 100) : null;
  return { direccion, actual, anterior, variacionPct, mesesSeguidos: seguidos };
}

// Participación de cada categoría en el total (suma 100 salvo redondeos); ignora lo que no suma.
export function participaciones(categorias: PuntoGrafico[]): Array<PuntoGrafico & { porcentaje: number }> {
  const total = categorias.reduce((a, c) => a + (c.valor > 0 ? c.valor : 0), 0);
  if (total <= 0) return [];
  return categorias.filter((c) => c.valor > 0).map((c) => ({ ...c, porcentaje: Math.round((c.valor / total) * 100) }));
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Sin caracteres ambiguos (0/O, 1/I): el código se pasa a mano o por mensaje.
export function generarCodigoFamilia(aleatorio: () => number = Math.random): string {
  let codigo = '';
  for (let i = 0; i < 8; i++) codigo += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
  return codigo;
}
