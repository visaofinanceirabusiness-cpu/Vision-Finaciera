// lib/visao3dCasa.ts
//
// Visão 3D, modelo Familia ("la casa"): la casa ya viene con sus amenidades (auto en la cochera, sofá, TV, cama,
// escritorio, mesa del comedor, pileta…) y cada amenidad "se pinta" cuando la cuenta que la representa tiene saldo
// (gris si está en cero, rojo si es negativa). Acá se decide qué cuentas alimentan cada amenidad y se arman nodos
// resumen (uno por amenidad) para reutilizar el panel de información. Lógica pura y testeada.

import { tipoObjeto, type TipoObjeto } from './visao3dObjetos';
import type { GrupoId, NodoEdificio } from './visao3d';

export type SlotId =
  | 'auto' | 'inmueble' | 'muebles' | 'electro' | 'ahorro' | 'banco' | 'efectivo' | 'cobrar' | 'otros'
  | 'tarjeta' | 'prestamo' | 'apagar'
  | 'capital' | 'resultado';

export type SlotCasa = {
  id: SlotId;
  grupo: GrupoId;
  nombre: { es: string; pt: string };
  coincide: (nombre: string, tipo: TipoObjeto, sintetico: boolean) => boolean;
};

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tiene = (nombre: string, palabras: string[]) => palabras.some((p) => sinAcentos(nombre).includes(p));

// El orden dentro de cada grupo importa: el primero que coincide se queda con la cuenta; el último es el comodín.
export const SLOTS_CASA: SlotCasa[] = [
  { id: 'auto', grupo: 'ACTIVO', nombre: { es: 'Vehículos', pt: 'Veículos' }, coincide: (_n, t) => t === 'auto' },
  { id: 'inmueble', grupo: 'ACTIVO', nombre: { es: 'Inmuebles', pt: 'Imóveis' }, coincide: (_n, t) => t === 'casa' },
  { id: 'muebles', grupo: 'ACTIVO', nombre: { es: 'Muebles y útiles', pt: 'Móveis e utensílios' }, coincide: (_n, t) => t === 'mesa' },
  { id: 'electro', grupo: 'ACTIVO', nombre: { es: 'Electrodomésticos y equipos', pt: 'Eletrodomésticos e equipamentos' }, coincide: (_n, t) => t === 'equipo' },
  { id: 'ahorro', grupo: 'ACTIVO', nombre: { es: 'Ahorros e inversiones', pt: 'Poupança e investimentos' }, coincide: (_n, t) => t === 'ahorro' },
  { id: 'banco', grupo: 'ACTIVO', nombre: { es: 'Cuentas bancarias', pt: 'Contas bancárias' }, coincide: (_n, t) => t === 'banco' },
  { id: 'efectivo', grupo: 'ACTIVO', nombre: { es: 'Efectivo y billeteras', pt: 'Dinheiro e carteiras' }, coincide: (_n, t) => t === 'billetes' },
  // Solo lo que realmente se cobra: un activo como "Límite tarjeta" también es 'documento' por su nombre, pero no es plata que nos deban.
  { id: 'cobrar', grupo: 'ACTIVO', nombre: { es: 'Por cobrar', pt: 'A receber' }, coincide: (n, t) => t === 'documento' && tiene(n, ['cobrar', 'receber', 'cliente']) },
  { id: 'otros', grupo: 'ACTIVO', nombre: { es: 'Otros activos', pt: 'Outros ativos' }, coincide: () => true },
  { id: 'tarjeta', grupo: 'PASIVO', nombre: { es: 'Tarjetas de crédito', pt: 'Cartões de crédito' }, coincide: (n) => tiene(n, ['tarjeta', 'cartao', 'credito']) },
  { id: 'prestamo', grupo: 'PASIVO', nombre: { es: 'Préstamos y financiaciones', pt: 'Empréstimos e financiamentos' }, coincide: (n) => tiene(n, ['prestamo', 'emprestimo', 'financ']) },
  { id: 'apagar', grupo: 'PASIVO', nombre: { es: 'Cuentas por pagar', pt: 'Contas a pagar' }, coincide: () => true },
  { id: 'resultado', grupo: 'PATRIMONIO', nombre: { es: 'Resultado del ejercicio', pt: 'Resultado do exercício' }, coincide: (n, t, s) => s || t === 'resultado' },
  { id: 'capital', grupo: 'PATRIMONIO', nombre: { es: 'Capital y resultados acumulados', pt: 'Capital e resultados acumulados' }, coincide: () => true },
];

function hojasDe(nodo: NodoEdificio): NodoEdificio[] {
  return nodo.hijos.length === 0 ? [nodo] : nodo.hijos.flatMap(hojasDe);
}

const redondear = (n: number) => Math.round(n * 100) / 100;

// Un nodo resumen por amenidad: su saldo es la suma de las cuentas hoja que la alimentan (nunca se suma
// una cuenta y su rubro a la vez, porque solo se recorren hojas).
export function construirNodosCasa(raiz: NodoEdificio, esPT: boolean): Record<SlotId, NodoEdificio> {
  const resultado = {} as Record<SlotId, NodoEdificio>;

  for (const grupo of raiz.hijos) {
    const slots = SLOTS_CASA.filter((s) => s.grupo === grupo.grupo);
    const asignadas = new Map<SlotId, NodoEdificio[]>(slots.map((s) => [s.id, []]));

    for (const hoja of hojasDe(grupo)) {
      const tipo = tipoObjeto(hoja.nombre, hoja.sintetico);
      const destino = slots.find((s) => s.coincide(hoja.nombre, tipo, hoja.sintetico)) ?? slots[slots.length - 1];
      asignadas.get(destino.id)!.push(hoja);
    }

    for (const slot of slots) {
      const hojas = asignadas.get(slot.id)!.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
      const saldo = redondear(hojas.reduce((s, h) => s + h.saldo, 0));
      const anteriores = hojas.map((h) => h.saldoAnterior);
      const saldoAnterior = anteriores.some((s) => s === null) ? null : redondear(anteriores.reduce<number>((s, v) => s + (v ?? 0), 0));
      const variacion = saldoAnterior === null ? null : redondear(saldo - saldoAnterior);

      resultado[slot.id] = {
        id: `slot:${slot.id}`,
        codigo: null,
        nombre: esPT ? slot.nombre.pt : slot.nombre.es,
        grupo: slot.grupo,
        nivel: 2,
        saldo,
        saldoAnterior,
        variacion,
        variacionPct: variacion === null || !saldoAnterior ? null : redondear((variacion / Math.abs(saldoAnterior)) * 100),
        participacion: grupo.saldo > 0 ? redondear((saldo / grupo.saldo) * 100) : null,
        hijos: hojas,
        esHoja: false,
        sintetico: true,
        cuentasDependientes: hojas.length,
        cuentaNombre: null,
      };
    }
  }

  return resultado;
}

// Para resaltar en la casa la amenidad de una cuenta elegida en el panel.
export function slotDeCuenta(nodos: Record<SlotId, NodoEdificio>, cuentaId: string): SlotId | null {
  for (const slot of SLOTS_CASA) {
    if (nodos[slot.id]?.hijos.some((h) => h.id === cuentaId)) return slot.id;
  }
  return null;
}
