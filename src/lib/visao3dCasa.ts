// lib/visao3dCasa.ts
//
// Visão 3D, modelo Familia ("la casa"): UN objeto por cada cuenta con saldo, las mismas que muestra la "Composición" del
// Panel de Control (mismo umbral y mismas funciones de agrupación: gruposActivo / gruposPasivo / gruposPatrimonio), más
// el resultado del ejercicio sin cerrar como objeto de Patrimonio (para que Ativo = Passivo + PL cierre). Las cuentas en
// cero no se dibujan. Acá se decide qué objeto es cada cuenta y dónde va (llenado corrido: hasta 5 por habitación, en el
// orden de los grupos del Panel). Lógica pura y testeada.

import { grupoDeCuentaActivo, normalizar } from './gruposActivo';
import { grupoDeCuentaPasivo } from './gruposPasivo';
import { grupoDeCuentaPatrimonio } from './gruposPatrimonio';
import { tipoObjeto, type TipoObjeto } from './visao3dObjetos';
import type { GrupoId, NodoEdificio } from './visao3d';

export const CAPACIDAD_SALA = 5;
// Mismo umbral que el Panel de Control: por debajo de 0,50 la cuenta se considera en cero.
export const UMBRAL_SALDO = 0.5;

export type SalaId = 'garage' | 'living' | 'dormitorio' | 'oficina' | 'comedor' | 'entrada';

// Habitaciones de cada grupo en el orden en que se llenan (modelo base; más adelante crecen con cuartos al lado y pisos).
export const SALAS_POR_ZONA: Record<GrupoId, SalaId[]> = {
  ACTIVO: ['garage', 'living', 'dormitorio'],
  PASIVO: ['oficina'],
  PATRIMONIO: ['comedor'],
};

// 'plinto' = objeto sobre un pilar; los demás son piezas grandes que van en el piso (el auto en la entrada, el sofá y la TV en el living).
export type ModoObjeto = 'plinto' | 'auto' | 'sofa' | 'tv';

export type ObjetoCasa = {
  id: string; // id del nodo de la cuenta: sirve para seleccionarla y mostrar sus movimientos
  nodo: NodoEdificio;
  zona: GrupoId;
  grupoPanel: string; // DINERO, POR_COBRAR, AHORROS, BIENES… (los del Panel de Control)
  tipo: TipoObjeto;
  modo: ModoObjeto;
  sala: SalaId;
  fila: number; // 0 = al frente; más filas solo si se supera lo que entra en las habitaciones del grupo
  indice: number; // posición dentro de su fila
  enFila: number; // cuántos objetos tiene su fila (para centrarla)
};

type Hoja = { nodo: NodoEdificio; ancestros: string[] };

function hojasConRuta(nodo: NodoEdificio, ancestros: string[] = []): Hoja[] {
  if (nodo.hijos.length === 0) return [{ nodo, ancestros }];
  return nodo.hijos.flatMap((h) => hojasConRuta(h, [...ancestros, nodo.nombre]));
}

const esPorCobrar = (nombre: string) => /COBRAR|RECEBER|CLIENTE/.test(normalizar(nombre));

function grupoPanelDe(zona: GrupoId, { nodo, ancestros }: Hoja, tipo: TipoObjeto): string {
  if (zona === 'ACTIVO') {
    // El Panel sabe qué cuentas son medios de pago por las formas de pago; acá se aproxima por el tipo de objeto.
    return grupoDeCuentaActivo({ nombre: nodo.nombre, codigo: nodo.codigo, ancestros, esPorCobrar: esPorCobrar(nodo.nombre), esMedio: tipo === 'banco' || tipo === 'billetes' });
  }
  if (zona === 'PASIVO') return grupoDeCuentaPasivo({ nombre: nodo.nombre, codigo: nodo.codigo, ancestros });
  return grupoDeCuentaPatrimonio({ nombre: nodo.nombre, codigo: nodo.codigo });
}

export function construirObjetosCasa(raiz: NodoEdificio): ObjetoCasa[] {
  const resultado: ObjetoCasa[] = [];

  for (const grupo of raiz.hijos) {
    const zona = grupo.grupo;
    const con: Array<Hoja & { tipo: TipoObjeto; grupoPanel: string }> = hojasConRuta(grupo)
      .filter((h) => Math.abs(h.nodo.saldo) >= UMBRAL_SALDO)
      .map((h) => {
        const tipo = tipoObjeto(h.nodo.nombre, h.nodo.sintetico);
        return { ...h, tipo, grupoPanel: grupoPanelDe(zona, h, tipo) };
      });

    // Orden del Panel: los grupos de mayor a menor total; dentro de cada grupo, la cuenta de mayor saldo primero.
    const totales = new Map<string, number>();
    con.forEach((h) => totales.set(h.grupoPanel, (totales.get(h.grupoPanel) ?? 0) + Math.abs(h.nodo.saldo)));
    con.sort((a, b) => (totales.get(b.grupoPanel)! - totales.get(a.grupoPanel)!) || a.grupoPanel.localeCompare(b.grupoPanel) || Math.abs(b.nodo.saldo) - Math.abs(a.nodo.saldo));

    const salas = SALAS_POR_ZONA[zona];
    let autos = 0;
    let haySofa = false;
    let hayTv = false;
    const enPlinto: typeof con = [];
    const piezas: ObjetoCasa[] = [];

    for (const h of con) {
      const base = { id: h.nodo.id, nodo: h.nodo, zona, grupoPanel: h.grupoPanel, tipo: h.tipo, fila: 0, indice: 0, enFila: 1 };
      if (zona === 'ACTIVO' && h.tipo === 'auto') {
        piezas.push({ ...base, modo: 'auto', sala: 'entrada', indice: autos, enFila: 1 });
        autos += 1;
      } else if (zona === 'ACTIVO' && h.tipo === 'mesa' && !haySofa) {
        haySofa = true;
        piezas.push({ ...base, modo: 'sofa', sala: 'living' });
      } else if (zona === 'ACTIVO' && h.tipo === 'equipo' && !hayTv) {
        hayTv = true;
        piezas.push({ ...base, modo: 'tv', sala: 'living' });
      } else {
        enPlinto.push(h);
      }
    }

    // Llenado corrido: 5 por habitación en el orden de las habitaciones; lo que sobra pasa a filas de atrás de la última.
    const capacidadTotal = salas.length * CAPACIDAD_SALA;
    const colocados: ObjetoCasa[] = enPlinto.map((h, i) => {
      const dentro = i < capacidadTotal;
      const sala = dentro ? salas[Math.floor(i / CAPACIDAD_SALA)] : salas[salas.length - 1];
      const fila = dentro ? 0 : 1 + Math.floor((i - capacidadTotal) / CAPACIDAD_SALA);
      return { id: h.nodo.id, nodo: h.nodo, zona, grupoPanel: h.grupoPanel, tipo: h.tipo, modo: 'plinto', sala, fila, indice: 0, enFila: 1 };
    });
    const porFila = new Map<string, ObjetoCasa[]>();
    colocados.forEach((o) => {
      const clave = `${o.sala}|${o.fila}`;
      porFila.set(clave, [...(porFila.get(clave) ?? []), o]);
    });
    porFila.forEach((lista) => lista.forEach((o, i) => { o.indice = i; o.enFila = lista.length; }));

    resultado.push(...piezas, ...colocados);
  }

  return resultado;
}

// Para resaltar en la casa el objeto de una cuenta elegida en el panel.
export function objetoDeCuenta(objetos: ObjetoCasa[], cuentaId: string): ObjetoCasa | null {
  return objetos.find((o) => o.id === cuentaId) ?? null;
}
