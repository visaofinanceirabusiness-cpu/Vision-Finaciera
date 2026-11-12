// lib/openFinance/proveedor.ts
//
// OPEN FINANCE (Brasil) — contrato con el agregador de datos bancarios.
// =====================================================================
// ARMADO PERO NO ACTIVO. La app no habla con ningún banco: habla con un «proveedor» (agregador regulado, p. ej. Pluggy) que
// implementa esta interfaz. Cambiar de proveedor es escribir otro archivo que cumpla ProveedorOpenFinance, sin tocar la conciliación.
//
// Reglas:
//  - Las credenciales del proveedor viven SOLO en el servidor (variables de entorno). Nunca llegan al navegador ni a la base.
//  - Nunca se guardan usuario ni clave del banco: el cliente autoriza en el banco (consentimiento) y el proveedor entrega los datos.
//  - Todo el uso pasa por /api/open-finance/*, que responde «no activado» mientras OPEN_FINANCE_ACTIVO no sea '1'.

export type CuentaExterna = { cuentaExternaId: string; nombre: string; numeroMascara: string | null; moneda: string; saldo: number };

export type MovimientoExterno = {
  idExterno: string;
  fecha: string; // YYYY-MM-DD
  monto: number; // con signo: + entra plata, − sale
  descripcion: string;
  contraparte: string | null;
};

export type ConexionExterna = { conexionExternaId: string; bancoNombre: string; estado: 'ACTIVA' | 'RENOVAR' | 'ERROR'; consentimientoVence: string | null };

export interface ProveedorOpenFinance {
  readonly nombre: string;
  // Token de corta vida para abrir el widget de conexión del proveedor en el navegador (la persona elige su banco y autoriza allá).
  crearTokenDeConexion(empresaId: string, conexionExternaId?: string): Promise<{ token: string }>;
  obtenerConexion(conexionExternaId: string): Promise<ConexionExterna>;
  listarCuentas(conexionExternaId: string): Promise<CuentaExterna[]>;
  listarMovimientos(cuentaExternaId: string, desde: string, hasta: string): Promise<MovimientoExterno[]>;
}

export class OpenFinanceNoActivado extends Error {
  constructor() {
    super('Open Finance todavía no está activado.');
    this.name = 'OpenFinanceNoActivado';
  }
}

export function openFinanceActivo(): boolean {
  return process.env.OPEN_FINANCE_ACTIVO === '1';
}
