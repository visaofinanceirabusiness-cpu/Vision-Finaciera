// lib/simuladorCompra.ts
//
// SIMULADOR DE FINANCIAMIENTO — Nuestro Sueño → Propuestas de Compra
// =====================================================
//
// Sistema francés (cuota fija): dado el monto a financiar, una tasa
// de interés anual y un plazo en meses, calcula la cuota mensual y el
// detalle de cada pago (cuánto es capital y cuánto interés). Es la
// misma fórmula que usa cualquier banco para un préstamo hipotecario
// — no depende de datos de la empresa, por eso vive separado de
// cuotas.ts (que reparte un total ya conocido en cuotas iguales SIN
// interés, para pasivos).

export type ParametrosFinanciamiento = {
  precio: number;
  entradaPorcentaje: number; // 0-100
  tasaAnualPorcentaje: number; // 0-100
  plazoMeses: number;
};

export type CuotaAmortizacion = {
  numero: number;
  cuota: number;
  interes: number;
  capital: number;
  saldoRestante: number;
};

export type ResultadoFinanciamiento = {
  montoFinanciado: number;
  entradaMonto: number;
  cuotaMensual: number;
  totalIntereses: number;
  totalPagado: number;
  detalle: CuotaAmortizacion[];
};

export function calcularFinanciamiento(parametros: ParametrosFinanciamiento): ResultadoFinanciamiento | null {
  const { precio, entradaPorcentaje, tasaAnualPorcentaje, plazoMeses } = parametros;

  if (!(precio > 0) || !(plazoMeses > 0) || entradaPorcentaje < 0 || entradaPorcentaje > 100) {
    return null;
  }

  const entradaMonto = precio * (entradaPorcentaje / 100);
  const montoFinanciado = precio - entradaMonto;
  const tasaMensual = tasaAnualPorcentaje / 100 / 12;

  const cuotaMensual =
    tasaMensual > 0
      ? (montoFinanciado * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -plazoMeses))
      : montoFinanciado / plazoMeses;

  const detalle: CuotaAmortizacion[] = [];
  let saldo = montoFinanciado;

  for (let numero = 1; numero <= plazoMeses; numero++) {
    const interes = saldo * tasaMensual;
    const capital = cuotaMensual - interes;
    saldo = Math.max(0, saldo - capital);

    detalle.push({
      numero,
      cuota: Number(cuotaMensual.toFixed(2)),
      interes: Number(interes.toFixed(2)),
      capital: Number(capital.toFixed(2)),
      saldoRestante: Number(saldo.toFixed(2)),
    });
  }

  const totalPagado = cuotaMensual * plazoMeses;

  return {
    montoFinanciado: Number(montoFinanciado.toFixed(2)),
    entradaMonto: Number(entradaMonto.toFixed(2)),
    cuotaMensual: Number(cuotaMensual.toFixed(2)),
    totalIntereses: Number((totalPagado - montoFinanciado).toFixed(2)),
    totalPagado: Number(totalPagado.toFixed(2)),
    detalle,
  };
}

// Distancia en línea recta entre dos puntos (fórmula de Haversine) —
// no es distancia de manejo real (para eso hace falta la API paga de
// Google Distance Matrix), pero alcanza para comparar "qué tan cerca"
// está cada propiedad de un punto de referencia sin depender de
// ninguna clave de API.
export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Convierte un monto a pesos ARS usando la cotización real del día
// (ver lib/cotizaciones.ts) — para saber a cuánto equivale en pesos el
// financiamiento de una propiedad cargada en otra moneda. `tasas` es
// cuántos ARS vale 1 unidad de esa moneda (USD y BRL); ARS no
// necesita tasa, vale 1 a 1.
export type TasasARS = { USD: number | null; BRL: number | null };

// La moneda de una propuesta es texto libre (viene de la extracción
// del link, que trae códigos ISO como "BRL"/"USD", o de lo que la
// persona haya tipeado a mano) — se normaliza buscando estos patrones
// conocidos en vez de exigir un formato exacto.
export function normalizarMoneda(moneda: string | null): 'ARS' | 'USD' | 'BRL' | null {
  if (!moneda) return null;
  const m = moneda.trim().toUpperCase();
  if (m.includes('BRL') || m.includes('R$')) return 'BRL';
  if (m.includes('USD') || m.includes('U$S') || m.includes('US$')) return 'USD';
  if (m.includes('ARS') || m.includes('AR$') || m === '$') return 'ARS';
  return null;
}

export function convertirAPesos(monto: number, moneda: string | null, tasas: TasasARS): number | null {
  const normalizada = normalizarMoneda(moneda);
  if (normalizada === 'ARS') return Number(monto.toFixed(2));
  if (normalizada === 'USD' && tasas.USD) return Number((monto * tasas.USD).toFixed(2));
  if (normalizada === 'BRL' && tasas.BRL) return Number((monto * tasas.BRL).toFixed(2));
  return null;
}

export function urlGoogleMaps(direccion: string | null, lat: number | null, lng: number | null): string | null {
  if (lat !== null && lng !== null) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  if (direccion) {
    return `https://www.google.com/maps?q=${encodeURIComponent(direccion)}`;
  }
  return null;
}
