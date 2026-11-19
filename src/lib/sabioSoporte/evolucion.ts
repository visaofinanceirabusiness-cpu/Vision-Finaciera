// lib/sabioSoporte/evolucion.ts — EVOLUCIÓN DE CUENTAS (pura, con tests).
// Del plan de cuentas y los asientos arma, día por día, el saldo de CADA cuenta (en su sentido natural: una cuenta deudora suma el débito, una
// acreedora el crédito) y el de las cuentas padre (suma de sus hijas, con signo). Además calcula unas series derivadas que dan el cuadro
// completo: Resultado acumulado (ingresos − costos − gastos), Patrimonio neto total (patrimonio + resultado) y Disponibilidades.
// Sirve para la tabla y el gráfico de Panel Maestro → Sabio Soporte.

export type GrupoCuenta = 'RESUMEN' | 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'COSTO' | 'GASTO';

export type CuentaPlan = { id: string; codigo: string; nombre: string; padreId: string | null; naturaleza: string; tipo: string; saldoInicial: number; rol?: string | null };
export type AsientoSimple = { fecha: string; debito: string | null; credito: string | null; importe: number };

export type SerieCuenta = {
  clave: string; // estable: código de la cuenta, o RES:… para las derivadas
  nombre: string;
  codigo: string;
  grupo: GrupoCuenta;
  esPadre: boolean;
  nivel: number; // 0 = raíz
  valores: number[]; // un valor por fecha
};

export type Evolucion = { fechas: string[]; series: SerieCuenta[]; porClave: Map<string, SerieCuenta> };

export const GRUPOS: Array<{ grupo: GrupoCuenta; nombre: string }> = [
  { grupo: 'RESUMEN', nombre: 'Resumen' },
  { grupo: 'ACTIVO', nombre: 'Activo' },
  { grupo: 'PASIVO', nombre: 'Pasivo' },
  { grupo: 'PATRIMONIO', nombre: 'Patrimonio neto' },
  { grupo: 'INGRESO', nombre: 'Ingresos' },
  { grupo: 'COSTO', nombre: 'Costos' },
  { grupo: 'GASTO', nombre: 'Gastos' },
];

export function diasEntreFechas(desde: string, hasta: string): string[] {
  const salida: string[] = [];
  for (let d = new Date(`${desde}T12:00:00Z`); d.toISOString().slice(0, 10) <= hasta; d.setUTCDate(d.getUTCDate() + 1)) salida.push(d.toISOString().slice(0, 10));
  return salida;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

// `disponibles`: ids de las cuentas que son plata de verdad (caja, bancos, billeteras: las que son medio de pago y no «a cobrar»). Sin eso se usa el
// prefijo de código de la plantilla (1.1.1.).
export type OpcionesEvolucion = { disponibles?: Set<string> };

export function calcularEvolucion(cuentas: CuentaPlan[], asientos: AsientoSimple[], hasta: string, opciones: OpcionesEvolucion = {}): Evolucion {
  if (asientos.length === 0) return { fechas: [], series: [], porClave: new Map() };

  const desde = asientos.reduce((min, a) => (a.fecha < min ? a.fecha : min), asientos[0].fecha);
  const fechas = diasEntreFechas(desde, hasta < desde ? desde : hasta);
  const indice = new Map(fechas.map((f, i) => [f, i]));
  const porNombre = new Map(cuentas.map((c) => [c.nombre, c]));

  // Movimiento diario de cada cuenta, en su sentido natural.
  const delta = new Map<string, number[]>(cuentas.map((c) => [c.id, new Array(fechas.length).fill(0)]));
  for (const a of asientos) {
    const i = indice.get(a.fecha);
    if (i === undefined) continue;
    for (const [nombre, lado] of [[a.debito, 'D'], [a.credito, 'C']] as const) {
      const c = nombre ? porNombre.get(nombre) : undefined;
      if (!c) continue;
      const natural = (c.naturaleza === 'DEUDORA' && lado === 'D') || (c.naturaleza !== 'DEUDORA' && lado === 'C');
      delta.get(c.id)![i] += natural ? a.importe : -a.importe;
    }
  }

  const propias = new Map<string, number[]>();
  for (const c of cuentas) {
    let acum = c.saldoInicial;
    propias.set(c.id, delta.get(c.id)!.map((d) => (acum += d)));
  }

  const hijas = new Map<string, CuentaPlan[]>();
  for (const c of cuentas) if (c.padreId) hijas.set(c.padreId, [...(hijas.get(c.padreId) ?? []), c]);

  // Una cuenta padre vale lo suyo más la suma de sus hijas; una hija de signo contrario (p. ej. la depreciación dentro del activo) resta.
  const totales = new Map<string, number[]>();
  const total = (c: CuentaPlan): number[] => {
    const memo = totales.get(c.id);
    if (memo) return memo;
    const valores = [...propias.get(c.id)!];
    for (const h of hijas.get(c.id) ?? []) {
      const signo = h.naturaleza === c.naturaleza ? 1 : -1;
      total(h).forEach((v, i) => (valores[i] += signo * v));
    }
    totales.set(c.id, valores);
    return valores;
  };

  const nivelDe = (c: CuentaPlan): number => {
    let n = 0;
    for (let p = c.padreId ? cuentas.find((x) => x.id === c.padreId) : undefined; p; p = p.padreId ? cuentas.find((x) => x.id === p!.padreId) : undefined) n++;
    return n;
  };
  const grupoDe = (tipo: string): GrupoCuenta => (['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO'].includes(tipo) ? (tipo as GrupoCuenta) : 'GASTO');

  const series: SerieCuenta[] = cuentas
    .filter((c) => c.codigo)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
    .map((c) => ({ clave: c.codigo, nombre: c.nombre, codigo: c.codigo, grupo: grupoDe(c.tipo), esPadre: (hijas.get(c.id)?.length ?? 0) > 0, nivel: nivelDe(c), valores: total(c).map(redondear) }));

  // Totales por tipo (suma de las raíces de ese tipo) para las series derivadas.
  const raices = (tipo: string) => cuentas.filter((c) => c.tipo === tipo && !c.padreId);
  const sumaDeTipo = (tipo: string): number[] => {
    const v = new Array(fechas.length).fill(0);
    for (const r of raices(tipo)) total(r).forEach((x, i) => (v[i] += x));
    return v;
  };
  const sumaCuentas = (lista: CuentaPlan[]): number[] => {
    const v = new Array(fechas.length).fill(0);
    for (const c of lista) propias.get(c.id)!.forEach((x, i) => (v[i] += x));
    return v;
  };
  const hojas = (cond: (c: CuentaPlan) => boolean) => cuentas.filter((c) => cond(c) && !(hijas.get(c.id)?.length));

  const ingresos = sumaDeTipo('INGRESO');
  const costos = sumaDeTipo('COSTO');
  const gastos = sumaDeTipo('GASTO');
  const resultado = ingresos.map((x, i) => x - costos[i] - gastos[i]);
  const patrimonio = sumaDeTipo('PATRIMONIO');

  const derivada = (clave: string, nombre: string, valores: number[]): SerieCuenta => ({ clave, nombre, codigo: '', grupo: 'RESUMEN', esPadre: true, nivel: 0, valores: valores.map(redondear) });
  const descendienteDe = (c: CuentaPlan, ancestroId: string): boolean => {
    for (let p = c.padreId ? cuentas.find((x) => x.id === c.padreId) : undefined; p; p = p.padreId ? cuentas.find((x) => x.id === p!.padreId) : undefined) if (p.id === ancestroId) return true;
    return false;
  };

  const derivadas = [
    derivada('RES:RESULTADO', 'Resultado acumulado', resultado),
    derivada('RES:PN_TOTAL', 'Patrimonio neto total (con resultado)', patrimonio.map((x, i) => x + resultado[i])),
  ];
  const disponibles = opciones.disponibles && opciones.disponibles.size > 0 ? hojas((c) => opciones.disponibles!.has(c.id)) : hojas((c) => c.codigo.startsWith('1.1.1.'));
  if (disponibles.length > 0) derivadas.push(derivada('RES:DISPONIBLE', 'Disponibilidades (caja, bancos y billeteras)', sumaCuentas(disponibles)));
  // Mercaderías: lo que cuelga del contenedor de stock (si la empresa maneja mercadería).
  const contenedorStock = cuentas.find((c) => c.rol === 'CONTENEDOR_STOCK');
  const stock = contenedorStock ? hojas((c) => c.id !== contenedorStock.id && descendienteDe(c, contenedorStock.id)) : hojas((c) => c.codigo.startsWith('1.1.3.'));
  if (stock.length > 0) derivadas.push(derivada('RES:MERCADERIAS', 'Mercaderías (stock)', sumaCuentas(stock)));

  const todas = [...derivadas, ...series];
  return { fechas, series: todas, porClave: new Map(todas.map((s) => [s.clave, s])) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Agrupar por período (mes, semana) quedándose con el cierre de cada uno.
// ---------------------------------------------------------------------------------------------------------------------

export type Granularidad = 'DIA' | 'SEMANA' | 'MES';

export function indicesDeCierre(fechas: string[], g: Granularidad): number[] {
  if (g === 'DIA') return fechas.map((_, i) => i);
  const clave = (f: string) => {
    if (g === 'MES') return f.slice(0, 7);
    const d = new Date(`${f}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // lunes de esa semana
    return d.toISOString().slice(0, 10);
  };
  const cierres: number[] = [];
  fechas.forEach((f, i) => {
    if (i === fechas.length - 1 || clave(fechas[i + 1]) !== clave(f)) cierres.push(i);
  });
  return cierres;
}

export function valorAlCierreDelMes(ev: Evolucion, clave: string, mes: string): number | null {
  const s = ev.porClave.get(clave);
  if (!s) return null;
  let ultimo = -1;
  ev.fechas.forEach((f, i) => {
    if (f.slice(0, 7) <= mes) ultimo = i;
  });
  return ultimo >= 0 && ev.fechas[ultimo].slice(0, 7) === mes ? s.valores[ultimo] : null;
}
