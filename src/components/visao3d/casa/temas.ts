// Temas de la casa de Visão 3D: la misma casa (plano de cuartos, objetos por cuenta) con otro diseño estructural y otro decorado
// según el perfil de la empresa. Familia es el diseño original; el resto cambia fachada, techo, pintura, mobiliario y exterior.

import type { GrupoId } from '@/lib/visao3d';
import { createContext, useContext } from 'react';

export type TemaId = 'familia' | 'comercial' | 'servicios' | 'mixto' | 'produccion';
export type TipoFachada = 'ladrillo' | 'concreto' | 'vidrio';
export type TipoTecho = 'dosAguas' | 'plano' | 'sierra';
export type TipoMuebles = 'familia' | 'comercial' | 'oficina' | 'taller';

export type TemaCasa = {
  id: TemaId;
  fachada: TipoFachada;
  techo: TipoTecho;
  muebles: TipoMuebles;
  // Pintura de las paredes de cada cuarto (por grupo): fondo en pastel y vértices (cantos) algo más marcados.
  pared: Record<GrupoId, { fondo: string; vertice: string }>;
  toldo: string | null; // color del toldo a rayas sobre la planta baja
  cartel: boolean; // cartel con el nombre de la empresa sobre el techo
  pileta: boolean;
  jardin: boolean; // pasto con flores y arbustos (si no, patio de concreto)
  personas: boolean;
  fondoCartel: string;
};

const PARED_FAMILIA = {
  ACTIVO: { fondo: '#b3cdff', vertice: '#6f9cf2' },
  PASIVO: { fondo: '#ffcda0', vertice: '#ffa860' },
  PATRIMONIO: { fondo: '#d8bbf8', vertice: '#b985ee' },
};

// Tonos más sobrios (menos pastel) para los negocios.
const PARED_NEGOCIO = {
  ACTIVO: { fondo: '#c7d8ee', vertice: '#7f9cc4' },
  PASIVO: { fondo: '#f0d3b6', vertice: '#d79a62' },
  PATRIMONIO: { fondo: '#d9cdea', vertice: '#a48cc9' },
};

export const TEMAS: Record<TemaId, TemaCasa> = {
  familia: { id: 'familia', fachada: 'ladrillo', techo: 'dosAguas', muebles: 'familia', pared: PARED_FAMILIA, toldo: null, cartel: false, pileta: true, jardin: true, personas: true, fondoCartel: '#1f3a5f' },
  comercial: { id: 'comercial', fachada: 'concreto', techo: 'plano', muebles: 'comercial', pared: PARED_NEGOCIO, toldo: '#c2413a', cartel: true, pileta: false, jardin: false, personas: false, fondoCartel: '#7a1f1a' },
  servicios: { id: 'servicios', fachada: 'vidrio', techo: 'plano', muebles: 'oficina', pared: PARED_NEGOCIO, toldo: null, cartel: true, pileta: false, jardin: false, personas: false, fondoCartel: '#123d5c' },
  // Mixto es un negocio (local con taller o servicios): ladrillo a la vista pero techo plano, toldo verde y patio de concreto; el tejado a dos aguas con jardín y palmeras es de la casa de Familia.
  mixto: { id: 'mixto', fachada: 'ladrillo', techo: 'plano', muebles: 'comercial', pared: PARED_NEGOCIO, toldo: '#2f7d5b', cartel: true, pileta: false, jardin: false, personas: false, fondoCartel: '#1d5a40' },
  produccion: { id: 'produccion', fachada: 'concreto', techo: 'sierra', muebles: 'taller', pared: PARED_NEGOCIO, toldo: null, cartel: true, pileta: false, jardin: false, personas: false, fondoCartel: '#3a3f4a' },
};

export function temaDePerfil(codigo: string | null | undefined): TemaCasa {
  switch (codigo) {
    case 'COMERCIAL': return TEMAS.comercial;
    case 'SERVICIOS': return TEMAS.servicios;
    case 'MIXTO': return TEMAS.mixto;
    case 'PRODUCCION': return TEMAS.produccion;
    default: return TEMAS.familia;
  }
}

export const TemaCtx = createContext<TemaCasa>(TEMAS.familia);
export const useTema = () => useContext(TemaCtx);
