// lib/libroDiario.ts
//
// Cuentas puras del Libro Diario (components/contabilidad/LibroDiarioTab.tsx): el buscador global, el resumen de los últimos
// 3 días y los grupos de tipo de operación. Solo lectura sobre las filas que ya muestra la pestaña: no consulta nada ni toca el
// motor contable ni las reglas de Debe y Haber.

import { nombreOperacionDisplay, estadoDisplay } from './i18n';
import type { FilaLibro } from './indicadoresLibroDiario';

export type FilaBuscable = FilaLibro & {
  historico?: string | null;
  categoria?: string | null;
  forma_pago?: string | null;
};

// Sin tildes ni mayúsculas, para que «accion» encuentre «Acción».
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Todo lo que se puede buscar de una fila, también lo que la tabla no muestra: ID, fecha (en varios formatos), operación (código y
// nombre), histórico, cuentas, importe (crudo y con formato), categoría, forma de pago, contraparte, estado y origen.
export function textoBuscable(fila: FilaBuscable, idioma: string | null, esFamiliar: boolean): string {
  const [anio, mes, dia] = fila.fecha.slice(0, 10).split('-');
  const importe = Number(fila.importe ?? 0);
  const partes: Array<string | number | null | undefined> = [
    fila.id_operacion,
    fila.fecha,
    `${dia}/${mes}/${anio}`,
    `${dia}-${mes}-${anio}`,
    `${dia}/${mes}`,
    fila.operacion,
    nombreOperacionDisplay(idioma, fila.operacion, esFamiliar),
    fila.historico,
    fila.cuenta_debito,
    fila.cuenta_credito,
    importe,
    importe.toFixed(2),
    String(importe).replace('.', ','),
    importe.toLocaleString(idioma === 'PT' ? 'pt-BR' : 'es-AR'),
    fila.categoria,
    fila.forma_pago,
    fila.cliente_proveedor,
    fila.estado,
    fila.estado ? estadoDisplay(idioma, fila.estado) : 'pendiente',
    fila.tipo_registro,
    fila.tipo_registro === 'AUTOMATICO' ? 'automatico automático sistema' : 'operacion operación manual',
  ];
  return normalizarTexto(partes.filter((p) => p !== null && p !== undefined && p !== '').join(' | '));
}

// Cada palabra escrita tiene que aparecer en algún campo (Y entre palabras): «venta caja» encuentra ventas con la cuenta Caja.
export function coincideBusqueda(fila: FilaBuscable, consulta: string, idioma: string | null, esFamiliar: boolean): boolean {
  const palabras = normalizarTexto(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const texto = textoBuscable(fila, idioma, esFamiliar);
  return palabras.every((p) => texto.includes(p));
}

export type GrupoTipo = 'TODOS' | 'INGRESOS' | 'EGRESOS' | 'TRANSFERENCIAS';

const OPERACIONES_POR_GRUPO: Record<Exclude<GrupoTipo, 'TODOS'>, string[]> = {
  INGRESOS: ['VENTA', 'COBRO'],
  EGRESOS: ['COMPRA', 'PAGO'],
  TRANSFERENCIAS: ['TRANSFERENCIA'],
};

export function coincideGrupoTipo(operacion: string, grupo: GrupoTipo): boolean {
  return grupo === 'TODOS' || OPERACIONES_POR_GRUPO[grupo].includes(operacion);
}

// Color y símbolo de cada tipo de operación (verde entra plata, rojo sale, azul se mueve entre cuentas propias).
export function estiloDeOperacion(operacion: string): { flecha: string; fondo: string; color: string } {
  if (OPERACIONES_POR_GRUPO.INGRESOS.includes(operacion)) return { flecha: '↑', fondo: '#dcfce7', color: '#166534' };
  if (OPERACIONES_POR_GRUPO.EGRESOS.includes(operacion)) return { flecha: '↓', fondo: '#fee2e2', color: '#b91c1c' };
  if (operacion === 'TRANSFERENCIA') return { flecha: '⇄', fondo: '#dbeafe', color: '#1d4ed8' };
  return { flecha: '•', fondo: '#f1f5f9', color: '#475569' };
}

export type EtiquetaDia = 'HOY' | 'AYER' | 'HACE_2';

export type ResumenDia = {
  etiqueta: EtiquetaDia;
  fecha: string;
  operaciones: number;
  // Hasta 3, de lo más reciente a lo más viejo.
  movimientos: Array<{ id_operacion: string; operacion: string; historico: string | null; importe: number }>;
  // Lo que no entra en las 3 líneas.
  restantes: number;
};

export function restarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

const numeroDeId = (id: string) => parseInt(String(id).replace(/\D/g, ''), 10) || 0;

// Hoy, ayer y anteayer: operaciones cargadas por la persona (no los asientos automáticos del sistema) de esos días.
export function ultimosTresDias(filas: FilaBuscable[], hoy: string): ResumenDia[] {
  const etiquetas: EtiquetaDia[] = ['HOY', 'AYER', 'HACE_2'];
  return etiquetas.map((etiqueta, i) => {
    const fecha = restarDias(hoy, i);
    const delDia = filas.filter((f) => f.tipo_registro === 'OPERACION' && f.fecha.slice(0, 10) === fecha);
    const ordenadas = [...delDia].sort((a, b) => numeroDeId(b.id_operacion) - numeroDeId(a.id_operacion));
    return {
      etiqueta,
      fecha,
      operaciones: new Set(delDia.map((f) => f.id_operacion)).size,
      movimientos: ordenadas.slice(0, 3).map((f) => ({ id_operacion: f.id_operacion, operacion: f.operacion, historico: f.historico ?? null, importe: Number(f.importe ?? 0) })),
      restantes: Math.max(0, ordenadas.length - 3),
    };
  });
}
