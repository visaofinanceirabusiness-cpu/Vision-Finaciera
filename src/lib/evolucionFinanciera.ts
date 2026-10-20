// lib/evolucionFinanciera.ts
//
// Cálculos del gráfico de evolución del Panel (Tendência / Comparar /
// Detalhes), todos sobre la serie MENSUAL que arma contabilidad.ts: agrupar
// por trimestre/semestre/año, recortar un rango propio de la tarjeta y
// comparar contra el período anterior. No consulta nada: es todo suma.

import { calcularEvolucion, type PuntoEvolucion, type PuntoEvolucionCalculado } from './evolucionResultado';

export type Granularidad = 'MES' | 'TRIMESTRE' | 'SEMESTRE' | 'ANIO';

export type RangoMeses = { desde: string; hasta: string }; // "YYYY-MM"

export type PuntoAgrupado = {
  clave: string; // "YYYY-MM" | "YYYY-T1" | "YYYY-S1" | "YYYY"
  ingresos: number;
  costos: number;
  gastos: number;
  gastosNoOperativos: number;
  resultado: number;
  margenBruto: number;
};

const aCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

function numeroDeMes(clave: string): number {
  const [anio, mes] = clave.split('-').map(Number);
  return anio * 12 + (mes - 1);
}

function claveDeNumero(numero: number): string {
  const anio = Math.floor(numero / 12);
  return `${anio}-${String((numero % 12) + 1).padStart(2, '0')}`;
}

// Los meses sin movimientos no vienen de la base: se completan en cero para
// que agrupar y comparar contra "el mes anterior" sea contra el mes calendario.
export function rellenarMeses(datos: PuntoEvolucion[]): PuntoEvolucionCalculado[] {
  if (datos.length === 0) return [];

  const porClave = new Map(datos.map((d) => [d.clave, d]));
  const claves = datos.map((d) => numeroDeMes(d.clave));
  const desde = Math.min(...claves);
  const hasta = Math.max(...claves);
  const completos: PuntoEvolucion[] = [];

  for (let n = desde; n <= hasta; n++) {
    const clave = claveDeNumero(n);
    completos.push(porClave.get(clave) ?? { mes: '', clave, ingresos: 0, gastos: 0, costos: 0, gastosNoOperativos: 0 });
  }

  return calcularEvolucion(completos);
}

export function filtrarRango<T extends { clave: string }>(datos: T[], rango: RangoMeses): T[] {
  return datos.filter((d) => d.clave >= rango.desde && d.clave <= rango.hasta);
}

function claveAgrupada(claveMes: string, granularidad: Granularidad): string {
  const [anio, mes] = claveMes.split('-');
  const m = Number(mes);

  if (granularidad === 'TRIMESTRE') return `${anio}-T${Math.ceil(m / 3)}`;
  if (granularidad === 'SEMESTRE') return `${anio}-S${m <= 6 ? 1 : 2}`;
  if (granularidad === 'ANIO') return anio;
  return claveMes;
}

export function agrupar(datos: PuntoEvolucionCalculado[], granularidad: Granularidad): PuntoAgrupado[] {
  const grupos = new Map<string, PuntoAgrupado>();

  for (const d of datos) {
    const clave = claveAgrupada(d.clave, granularidad);
    const actual = grupos.get(clave) ?? { clave, ingresos: 0, costos: 0, gastos: 0, gastosNoOperativos: 0, resultado: 0, margenBruto: 0 };

    actual.ingresos += d.ingresos;
    actual.costos += d.costos;
    actual.gastos += d.gastos;
    actual.gastosNoOperativos += d.gastosNoOperativos;
    actual.resultado += d.resultado;
    actual.margenBruto += d.margenBruto;
    grupos.set(clave, actual);
  }

  return Array.from(grupos.values())
    .sort((a, b) => a.clave.localeCompare(b.clave))
    .map((g) => ({
      ...g,
      ingresos: aCentavos(g.ingresos),
      costos: aCentavos(g.costos),
      gastos: aCentavos(g.gastos),
      gastosNoOperativos: aCentavos(g.gastosNoOperativos),
      resultado: aCentavos(g.resultado),
      margenBruto: aCentavos(g.margenBruto),
    }));
}

export function totalesDe(datos: PuntoEvolucionCalculado[]): Omit<PuntoAgrupado, 'clave'> {
  const t = agrupar(datos.map((d) => ({ ...d, clave: '2000-01' })), 'MES')[0];
  return t
    ? { ingresos: t.ingresos, costos: t.costos, gastos: t.gastos, gastosNoOperativos: t.gastosNoOperativos, resultado: t.resultado, margenBruto: t.margenBruto }
    : { ingresos: 0, costos: 0, gastos: 0, gastosNoOperativos: 0, resultado: 0, margenBruto: 0 };
}

// Rango de igual largo inmediatamente anterior (para "vs período anterior").
export function rangoAnterior(rango: RangoMeses): RangoMeses {
  const desde = numeroDeMes(rango.desde);
  const largo = numeroDeMes(rango.hasta) - desde + 1;
  return { desde: claveDeNumero(desde - largo), hasta: claveDeNumero(desde - 1) };
}

// Variación porcentual; null si no hay base de comparación (anterior en cero).
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return aCentavos(((actual - anterior) / Math.abs(anterior)) * 100);
}

export type PresetRango = 'ANIO_ACTUAL' | 'ULT12' | 'ULT6' | 'TODO' | `ANIO_${number}`;

export function rangoDePreset(preset: PresetRango, claves: string[], hoy: Date = new Date()): RangoMeses | null {
  if (claves.length === 0) return null;

  const primera = claves[0];
  const ultima = claves[claves.length - 1];

  if (preset === 'TODO') return { desde: primera, hasta: ultima };
  if (preset === 'ULT12') return { desde: claveDeNumero(Math.max(numeroDeMes(primera), numeroDeMes(ultima) - 11)), hasta: ultima };
  if (preset === 'ULT6') return { desde: claveDeNumero(Math.max(numeroDeMes(primera), numeroDeMes(ultima) - 5)), hasta: ultima };

  const anio = preset === 'ANIO_ACTUAL' ? hoy.getFullYear() : Number(preset.slice(5));
  const rango = { desde: `${anio}-01`, hasta: `${anio}-12` };
  const dentro = filtrarRango(claves.map((clave) => ({ clave })), rango);

  if (dentro.length > 0) return { desde: dentro[0].clave, hasta: dentro[dentro.length - 1].clave };

  // Sin datos en el año en curso: se muestra el último año que sí tiene.
  if (preset === 'ANIO_ACTUAL') return rangoDePreset(`ANIO_${ultima.slice(0, 4)}` as PresetRango, claves, hoy);
  return null;
}

const MESES_CORTOS = {
  ES: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  PT: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
};

const MESES_LARGOS = {
  ES: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  PT: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
};

// corta: etiqueta para el eje (con año si el rango abarca varios); larga: para
// el encabezado del panel lateral.
export function etiquetaPeriodo(clave: string, idioma: string | null | undefined, opciones: { larga?: boolean; conAnio?: boolean } = {}): string {
  const lang = idioma === 'PT' ? 'PT' : 'ES';
  const [anio, resto] = clave.split('-');

  if (resto === undefined) return anio;

  if (resto.startsWith('T')) {
    const n = resto.slice(1);
    const base = opciones.larga ? (lang === 'PT' ? `${n}º trimestre` : `${n}º trimestre`) : `T${n}`;
    return opciones.larga || opciones.conAnio ? `${base} ${anio}` : base;
  }

  if (resto.startsWith('S')) {
    const n = resto.slice(1);
    const base = opciones.larga ? (lang === 'PT' ? `${n}º semestre` : `${n}º semestre`) : `S${n}`;
    return opciones.larga || opciones.conAnio ? `${base} ${anio}` : base;
  }

  const indice = Number(resto) - 1;
  if (opciones.larga) return `${MESES_LARGOS[lang][indice]} ${anio}`;
  return opciones.conAnio ? `${MESES_CORTOS[lang][indice]} ${anio.slice(2)}` : MESES_CORTOS[lang][indice];
}
