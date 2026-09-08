// lib/fechasEspeciales.ts
//
// Fechas patrias, festejos populares y cambios de estación que se
// marcan como referencia visual en el Calendário Organizador — no son
// eventos de la empresa (no se editan ni se borran desde acá), solo
// contexto para que el calendario se sienta "del país" de cada
// emprendedor.
//
// El país no es un campo propio de la empresa todavía: se infiere de
// empresas.moneda (ARS → Argentina, BRL → Brasil), igual criterio que
// ya usa perfil_plan_cuentas_maestro.pais para elegir el Plano de
// Contas. Si en el futuro se agrega un campo país explícito, ajustar
// acá nomás.
//
// Los equinoccios/solsticios son las mismas fechas calendario en
// Argentina y Brasil (mismo hemisferio) — no dependen del país.

export type TipoFechaEspecial = 'PATRIA' | 'FIESTA' | 'ESTACION';

export type FechaEspecial = {
  mes: number; // 1-12
  dia: number;
  nombreEs: string;
  nombrePt: string;
  tipo: TipoFechaEspecial;
};

const ICONOS: Record<TipoFechaEspecial, string> = {
  PATRIA: '🏛️',
  FIESTA: '🎉',
  ESTACION: '🍃',
};

export function iconoFechaEspecial(tipo: TipoFechaEspecial): string {
  return ICONOS[tipo];
}

// Cambios de estación (hemisferio sur — Argentina y Brasil por igual).
// Fechas aproximadas, estables año a año (varían a lo sumo un día).
const ESTACIONES: FechaEspecial[] = [
  { mes: 3, dia: 20, nombreEs: 'Comienza el otoño', nombrePt: 'Começa o outono', tipo: 'ESTACION' },
  { mes: 6, dia: 21, nombreEs: 'Comienza el invierno', nombrePt: 'Começa o inverno', tipo: 'ESTACION' },
  { mes: 9, dia: 22, nombreEs: 'Comienza la primavera', nombrePt: 'Começa a primavera', tipo: 'ESTACION' },
  { mes: 12, dia: 21, nombreEs: 'Comienza el verano', nombrePt: 'Começa o verão', tipo: 'ESTACION' },
];

// Festejos y fiestas populares — comunes a ambos países (mismo día).
const FIESTAS_COMUNES: FechaEspecial[] = [
  { mes: 1, dia: 1, nombreEs: 'Año Nuevo', nombrePt: 'Ano Novo', tipo: 'FIESTA' },
  { mes: 2, dia: 14, nombreEs: 'San Valentín', nombrePt: 'Dia dos Namorados (Valentine)', tipo: 'FIESTA' },
  { mes: 6, dia: 12, nombreEs: 'Día de los Enamorados', nombrePt: 'Dia dos Namorados', tipo: 'FIESTA' },
  { mes: 12, dia: 24, nombreEs: 'Nochebuena', nombrePt: 'Véspera de Natal', tipo: 'FIESTA' },
  { mes: 12, dia: 25, nombreEs: 'Navidad', nombrePt: 'Natal', tipo: 'FIESTA' },
  { mes: 12, dia: 31, nombreEs: 'Fin de Año', nombrePt: 'Véspera de Ano Novo', tipo: 'FIESTA' },
];

// Argentina — feriados nacionales fijos + festejos.
const ARGENTINA: FechaEspecial[] = [
  { mes: 3, dia: 24, nombreEs: 'Día de la Memoria', nombrePt: 'Dia da Memória (AR)', tipo: 'PATRIA' },
  { mes: 4, dia: 2, nombreEs: 'Día del Veterano y de los Caídos en Malvinas', nombrePt: 'Dia dos Veteranos de Malvinas (AR)', tipo: 'PATRIA' },
  { mes: 5, dia: 1, nombreEs: 'Día del Trabajador', nombrePt: 'Dia do Trabalhador', tipo: 'FIESTA' },
  { mes: 5, dia: 25, nombreEs: 'Día de la Revolución de Mayo', nombrePt: 'Revolução de Maio (AR)', tipo: 'PATRIA' },
  { mes: 6, dia: 20, nombreEs: 'Día de la Bandera', nombrePt: 'Dia da Bandeira (AR)', tipo: 'PATRIA' },
  { mes: 7, dia: 9, nombreEs: 'Día de la Independencia', nombrePt: 'Dia da Independência (AR)', tipo: 'PATRIA' },
  { mes: 8, dia: 17, nombreEs: 'Paso a la Inmortalidad del Gral. San Martín', nombrePt: 'Dia de San Martín (AR)', tipo: 'PATRIA' },
  { mes: 10, dia: 12, nombreEs: 'Día del Respeto a la Diversidad Cultural', nombrePt: 'Dia da Diversidade Cultural (AR)', tipo: 'PATRIA' },
  { mes: 11, dia: 20, nombreEs: 'Día de la Soberanía Nacional', nombrePt: 'Dia da Soberania Nacional (AR)', tipo: 'PATRIA' },
  { mes: 8, dia: 17, nombreEs: 'Día del Niño', nombrePt: 'Dia das Crianças (AR)', tipo: 'FIESTA' },
  { mes: 10, dia: 15, nombreEs: 'Día de la Madre', nombrePt: 'Dia das Mães (AR)', tipo: 'FIESTA' },
  { mes: 6, dia: 15, nombreEs: 'Día del Padre', nombrePt: 'Dia dos Pais (AR)', tipo: 'FIESTA' },
];

// Brasil — feriados nacionales fijos + festejos.
const BRASIL: FechaEspecial[] = [
  { mes: 4, dia: 21, nombreEs: 'Tiradentes', nombrePt: 'Tiradentes', tipo: 'PATRIA' },
  { mes: 5, dia: 1, nombreEs: 'Día del Trabajador', nombrePt: 'Dia do Trabalho', tipo: 'FIESTA' },
  { mes: 9, dia: 7, nombreEs: 'Día de la Independencia de Brasil', nombrePt: 'Independência do Brasil', tipo: 'PATRIA' },
  { mes: 10, dia: 12, nombreEs: 'Nuestra Señora Aparecida', nombrePt: 'Nossa Senhora Aparecida', tipo: 'PATRIA' },
  { mes: 11, dia: 2, nombreEs: 'Día de Finados', nombrePt: 'Finados', tipo: 'PATRIA' },
  { mes: 11, dia: 15, nombreEs: 'Proclamación de la República', nombrePt: 'Proclamação da República', tipo: 'PATRIA' },
  { mes: 11, dia: 20, nombreEs: 'Día de la Conciencia Negra', nombrePt: 'Dia da Consciência Negra', tipo: 'PATRIA' },
  { mes: 10, dia: 12, nombreEs: 'Día del Niño', nombrePt: 'Dia das Crianças', tipo: 'FIESTA' },
  { mes: 5, dia: 11, nombreEs: 'Día de la Madre (2º domingo de mayo, fecha referencial)', nombrePt: 'Dia das Mães (2º domingo de maio, data referencial)', tipo: 'FIESTA' },
  { mes: 8, dia: 10, nombreEs: 'Día del Padre (2º domingo de agosto, fecha referencial)', nombrePt: 'Dia dos Pais (2º domingo de agosto, data referencial)', tipo: 'FIESTA' },
  { mes: 6, dia: 24, nombreEs: 'San Juan (Festas Juninas)', nombrePt: 'São João (Festas Juninas)', tipo: 'FIESTA' },
];

export type PaisCalendario = 'AR' | 'BR';

// Mismo criterio que perfiles.ts para elegir el Plano de Contas:
// ARS → Argentina, cualquier otra moneda (hoy solo BRL) → Brasil.
export function paisPorMoneda(moneda: string | null | undefined): PaisCalendario {
  return moneda === 'ARS' ? 'AR' : 'BR';
}

export function fechasEspecialesDelPais(pais: PaisCalendario): FechaEspecial[] {
  return [...FIESTAS_COMUNES, ...ESTACIONES, ...(pais === 'AR' ? ARGENTINA : BRASIL)];
}

// Mapa "MM-DD" → fechas especiales de ese día (puede haber más de una,
// ej. Día del Niño coincidiendo con otro feriado).
export function mapaFechasEspeciales(pais: PaisCalendario): Map<string, FechaEspecial[]> {
  const mapa = new Map<string, FechaEspecial[]>();

  for (const fecha of fechasEspecialesDelPais(pais)) {
    const clave = `${String(fecha.mes).padStart(2, '0')}-${String(fecha.dia).padStart(2, '0')}`;
    const lista = mapa.get(clave) ?? [];
    lista.push(fecha);
    mapa.set(clave, lista);
  }

  return mapa;
}
