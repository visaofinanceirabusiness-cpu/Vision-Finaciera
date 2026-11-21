// lib/informes/sumas.ts — utilidades del Balancete (Informes → Sumas y Saldos): variación contra otro período y exportación a CSV.

export type Variacion = { monto: number; pct: number | null };

export function variacion(actual: number, anterior: number): Variacion {
  const monto = Math.round((actual - anterior) * 100) / 100;
  return { monto, pct: Math.abs(anterior) < 0.005 ? null : (monto / Math.abs(anterior)) * 100 };
}

// CSV que Excel abre bien: separador «;» (configuración regional es/pt), comillas escapadas y BOM para los acentos.
export function aCsv(filas: (string | number)[][]): string {
  const celda = (v: string | number) => {
    const t = typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '\uFEFF' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
}
