// lib/auditoriaCuentas.ts
//
// REGLA DURA: toda cuenta del plan de cuentas (maestro o de una empresa) tiene
// que tener AL MENOS una operación que la use. La consulta vive en la base
// (funciones cuentas_sin_operacion y maestro_cuentas_sin_operacion); acá solo
// se clasifica lo que devuelve, para distinguir lo conocido de lo nuevo:
//
//   ESTRUCTURAL  — no se opera a mano (se mueve solo al cerrar resultados).
//   PENDIENTE    — decidido que se resuelve más adelante, con fecha límite.
//   NUEVA        — incumple la regla y nadie lo había visto: hay que resolverla.
//
// Cuando una cuenta pendiente se resuelve, se saca de PENDIENTES_FIN_DE_MES.

export type CuentaSinOperacion = {
  nombre: string;
  tipo_saldo: string | null;
  rol_contable?: string | null;
};

export type EstadoCuentaSinOperacion = 'ESTRUCTURAL' | 'PENDIENTE' | 'NUEVA';

// Se cierra contra el resultado del ejercicio, no se opera directo.
export const CUENTAS_ESTRUCTURALES = ['Resultados Acumulados'];

// Punto 6 del análisis de paridad de perfiles (17/10/2026): resolver antes de
// fin de octubre de 2026 (ver memory.md → "PENDIENTE").
export const PENDIENTES_FIN_DE_MES = [
  'Depreciación Acumulada',
  'Anticipo a Proveedores',
  'IVA Crédito Fiscal',
  'IVA Débito Fiscal',
  'Impuestos a Pagar',
  'Ingresos Brutos a Pagar',
  'Simples Nacional a Pagar',
  'INSS a Pagar',
  'FGTS a Pagar',
  'Sueldos a Pagar',
  'Cargas Sociales a Pagar',
  'Alquiler a Pagar',
  'Servicios a Pagar',
];

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function clasificarCuentaSinOperacion(cuenta: CuentaSinOperacion): EstadoCuentaSinOperacion {
  const nombre = normalizar(cuenta.nombre);
  if (CUENTAS_ESTRUCTURALES.some((c) => normalizar(c) === nombre)) return 'ESTRUCTURAL';
  if (PENDIENTES_FIN_DE_MES.some((c) => normalizar(c) === nombre)) return 'PENDIENTE';
  return 'NUEVA';
}

export function resumenAuditoria(cuentas: CuentaSinOperacion[]): Record<EstadoCuentaSinOperacion, number> {
  const resumen = { ESTRUCTURAL: 0, PENDIENTE: 0, NUEVA: 0 };
  for (const cuenta of cuentas) resumen[clasificarCuentaSinOperacion(cuenta)] += 1;
  return resumen;
}
