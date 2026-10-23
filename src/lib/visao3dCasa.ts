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
import { CAPACIDAD_CUARTO, planificarCasa, type PlanoCasa } from './visao3dCasaPlano';
import type { GrupoId, NodoEdificio } from './visao3d';

export const CAPACIDAD_SALA = CAPACIDAD_CUARTO;
// Mismo umbral que el Panel de Control: por debajo de 0,50 la cuenta se considera en cero.
export const UMBRAL_SALDO = 0.5;

// Id del cuarto del plano de la casa (ver visao3dCasaPlano.ts): 'garage', 'living', 'dormitorio', 'oficina', 'comedor' en la
// base y 'activo-4', 'pasivo-2'… los agregados al crecer; 'entrada' es el frente de la cochera (donde se estaciona el auto).
export type SalaId = string;

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
  fila: number; // siempre 0: lo que no entra en un cuarto pasa a un cuarto nuevo del plano, no a otra fila
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

type Candidato = Hoja & { tipo: TipoObjeto; grupoPanel: string };
type Clasificado = { zona: GrupoId; piezas: ObjetoCasa[]; enPlinto: Candidato[] };

function clasificar(raiz: NodoEdificio): Clasificado[] {
  const grupos: Clasificado[] = [];

  for (const grupo of raiz.hijos) {
    const zona = grupo.grupo;
    const con: Candidato[] = hojasConRuta(grupo)
      .filter((h) => Math.abs(h.nodo.saldo) >= UMBRAL_SALDO)
      .map((h) => {
        const tipo = tipoObjeto(h.nodo.nombre, h.nodo.sintetico);
        return { ...h, tipo, grupoPanel: grupoPanelDe(zona, h, tipo) };
      });

    // Orden del Panel: los grupos de mayor a menor total; dentro de cada grupo, la cuenta de mayor saldo primero.
    const totales = new Map<string, number>();
    con.forEach((h) => totales.set(h.grupoPanel, (totales.get(h.grupoPanel) ?? 0) + Math.abs(h.nodo.saldo)));
    con.sort((a, b) => (totales.get(b.grupoPanel)! - totales.get(a.grupoPanel)!) || a.grupoPanel.localeCompare(b.grupoPanel) || Math.abs(b.nodo.saldo) - Math.abs(a.nodo.saldo));

    let autos = 0;
    let haySofa = false;
    let hayTv = false;
    const enPlinto: Candidato[] = [];
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
    grupos.push({ zona, piezas, enPlinto });
  }

  return grupos;
}

// El auto, el sofá y la TV tienen sitio propio y no ocupan lugar en un cuarto: solo cuentan los objetos sobre pilar.
function planoDeGrupos(grupos: Clasificado[]): PlanoCasa {
  const conteo: Record<GrupoId, number> = { ACTIVO: 0, PASIVO: 0, PATRIMONIO: 0 };
  grupos.forEach((g) => {
    conteo[g.zona] += g.enPlinto.length;
  });
  return planificarCasa(conteo);
}

// Mismo plano a partir de los objetos ya armados (es lo que recibe la escena).
export function planoDeObjetos(objetos: ObjetoCasa[]): PlanoCasa {
  const conteo: Record<GrupoId, number> = { ACTIVO: 0, PASIVO: 0, PATRIMONIO: 0 };
  objetos.forEach((o) => {
    if (o.modo === 'plinto') conteo[o.zona] += 1;
  });
  return planificarCasa(conteo);
}

export function construirObjetosCasa(raiz: NodoEdificio): ObjetoCasa[] {
  const grupos = clasificar(raiz);
  const plano = planoDeGrupos(grupos);
  const resultado: ObjetoCasa[] = [];

  for (const { zona, piezas, enPlinto } of grupos) {
    // Llenado corrido: 5 por cuarto en el orden de los cuartos del grupo; si hacen falta más, el plano agrega cuartos.
    const cuartos = plano.cuartosDe(zona);
    const colocados: ObjetoCasa[] = enPlinto.map((h, i) => ({
      id: h.nodo.id, nodo: h.nodo, zona, grupoPanel: h.grupoPanel, tipo: h.tipo, modo: 'plinto',
      sala: cuartos[Math.floor(i / CAPACIDAD_SALA)].id, fila: 0, indice: i % CAPACIDAD_SALA, enFila: 1,
    }));
    const porSala = new Map<string, ObjetoCasa[]>();
    colocados.forEach((o) => porSala.set(o.sala, [...(porSala.get(o.sala) ?? []), o]));
    porSala.forEach((lista) => lista.forEach((o) => { o.enFila = lista.length; }));

    resultado.push(...piezas, ...colocados);
  }

  return resultado;
}

// Para resaltar en la casa el objeto de una cuenta elegida en el panel.
export function objetoDeCuenta(objetos: ObjetoCasa[], cuentaId: string): ObjetoCasa | null {
  return objetos.find((o) => o.id === cuentaId) ?? null;
}
