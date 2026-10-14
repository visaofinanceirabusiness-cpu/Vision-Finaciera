// lib/gruposActivo.ts
//
// Agrupa las cuentas del Activo en grupos que se entienden de un vistazo
// (Dinero disponible, Por cobrar, Ahorros…) para "Composición del Activo" del
// Panel de Control. Lógica pura: se apoya en la estructura del plan de cuentas
// (el nombre de los grupos padre) y en si la cuenta es un medio de pago o algo
// por cobrar; no inventa saldos.

export type GrupoActivoId = 'DINERO' | 'POR_COBRAR' | 'INVENTARIO' | 'AHORROS' | 'BIENES' | 'NO_CORRIENTE' | 'OTROS';

export type CuentaDeActivo = {
  nombre: string;
  codigo: string | null;
  esMedio: boolean;
  esPorCobrar: boolean;
  // Nombres de sus cuentas padre, de la más cercana a la raíz.
  ancestros: string[];
  valor: number;
};

export type GrupoComposicion = {
  id: string;
  total: number;
  cuentas: Array<{ nombre: string; valor: number }>;
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

// Los grupos del plan mandan (una cuenta bajo "AHORROS E INVERSIONES" es un
// ahorro aunque sea una cuenta de banco); si no hay, decide si es dinero.
export function grupoDeCuentaActivo(cuenta: Omit<CuentaDeActivo, 'valor'>): GrupoActivoId {
  if (cuenta.esPorCobrar) return 'POR_COBRAR';

  const padres = cuenta.ancestros.map(normalizar);
  const contiene = (...claves: string[]) => padres.some((p) => claves.some((c) => p.includes(c)));

  if (contiene('MERCADER', 'INSUMO', 'INVENTAR', 'STOCK') || (cuenta.codigo ?? '').startsWith('1.1.3')) return 'INVENTARIO';
  if (contiene('AHORRO', 'INVERSION')) return 'AHORROS';
  if (contiene('BIENES', 'PROPIEDAD')) return 'BIENES';
  if (contiene('NO CORRIENTE')) return 'NO_CORRIENTE';
  if (cuenta.esMedio) return 'DINERO';

  return 'OTROS';
}

export function agruparActivo(cuentas: CuentaDeActivo[]): GrupoComposicion[] {
  const grupos = new Map<string, GrupoComposicion>();

  for (const cuenta of cuentas) {
    if (!(cuenta.valor > 0)) continue;

    const id = grupoDeCuentaActivo(cuenta);
    const grupo = grupos.get(id) ?? { id, total: 0, cuentas: [] };
    grupo.total += cuenta.valor;
    grupo.cuentas.push({ nombre: cuenta.nombre, valor: cuenta.valor });
    grupos.set(id, grupo);
  }

  return Array.from(grupos.values())
    .map((g) => ({ ...g, cuentas: [...g.cuentas].sort((a, b) => b.valor - a.valor) }))
    .sort((a, b) => b.total - a.total);
}
