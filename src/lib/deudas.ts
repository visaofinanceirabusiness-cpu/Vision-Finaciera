// lib/deudas.ts
//
// DEUDAS Y PRÉSTAMOS — todo lo que la empresa debe, en un solo lugar: el saldo
// de cada cuenta de Pasivo, con sus cuotas pendientes y el próximo
// vencimiento. Es solo una vista (no crea asientos). Los compromisos que se
// devengan mes a mes ("Alquiler a pagar") van en una sección aparte de las
// deudas "de fondo" (tarjetas, préstamos, impuestos…).

export type CuentaPasivo = {
  id: string;
  nombre: string;
  saldo: number;
  esCompromiso: boolean;
};

export type VencimientoDeuda = {
  cuentaId: string;
  fecha: string; // 'YYYY-MM-DD'
  monto: number;
};

export type DeudaFila = {
  cuentaId: string;
  nombre: string;
  saldo: number;
  esCompromiso: boolean;
  // Cuotas / meses devengados sin pagar de esta cuenta.
  pendientes: number;
  montoPendiente: number;
  proximoVencimiento: string | null;
  vencida: boolean;
};

export type Deudas = {
  compromisos: DeudaFila[];
  deudas: DeudaFila[];
  totalCompromisos: number;
  totalDeudas: number;
  total: number;
  // Lo que vence (o ya venció) dentro de los próximos 30 días.
  venceEn30Dias: number;
};

const DIAS_PROXIMOS = 30;

function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const f = new Date(anio, mes - 1, dia + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

export function armarDeudas(cuentas: CuentaPasivo[], vencimientos: VencimientoDeuda[], hoy: string): Deudas {
  const limite = sumarDias(hoy, DIAS_PROXIMOS);

  const filas: DeudaFila[] = cuentas
    // Una cuenta en cero, a favor o con centavos sueltos no es una deuda.
    .filter((c) => c.saldo >= 0.5)
    .map((c) => {
      const propios = vencimientos.filter((v) => v.cuentaId === c.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
      const proximo = propios[0]?.fecha ?? null;
      return {
        cuentaId: c.id,
        nombre: c.nombre,
        saldo: redondear(c.saldo),
        esCompromiso: c.esCompromiso,
        pendientes: propios.length,
        montoPendiente: redondear(propios.reduce((suma, v) => suma + v.monto, 0)),
        proximoVencimiento: proximo,
        vencida: proximo !== null && proximo < hoy,
      };
    })
    .sort((a, b) => b.saldo - a.saldo);

  const compromisos = filas.filter((f) => f.esCompromiso);
  const deudas = filas.filter((f) => !f.esCompromiso);
  const total = (lista: DeudaFila[]) => redondear(lista.reduce((suma, f) => suma + f.saldo, 0));

  const idsConSaldo = new Set(filas.map((f) => f.cuentaId));
  const venceEn30Dias = redondear(
    vencimientos.filter((v) => idsConSaldo.has(v.cuentaId) && v.fecha <= limite).reduce((suma, v) => suma + v.monto, 0)
  );

  return {
    compromisos,
    deudas,
    totalCompromisos: total(compromisos),
    totalDeudas: total(deudas),
    total: total(filas),
    venceEn30Dias,
  };
}
