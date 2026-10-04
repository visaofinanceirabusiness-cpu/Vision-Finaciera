// lib/cultivoTomate.ts
//
// MI CULTIVO — fases del tomate y cálculo de calendario. Todo puro
// (sin Supabase) para poder testearlo. Cada producción guarda sus
// propias semanas por fase (arrancan con las de acá y el usuario las
// ajusta según su variedad/clima), por eso la fase actual se calcula
// siempre a partir de las fechas guardadas, no de estas constantes.

export type ClaveFase =
  | 'GERMINACION'
  | 'PLANTULA'
  | 'TRASPLANTE'
  | 'VEGETATIVO'
  | 'FLORACION'
  | 'FRUTOS'
  | 'COSECHA';

export type DefinicionFase = {
  clave: ClaveFase;
  nombre: string;
  emoji: string;
  semanasPorDefecto: number;
  queOcurre: string;
  ambiente: string;
  riego: string;
  nutricion: string;
  tareas: string[];
  pasaALaSiguiente: string;
};

export const FASES_TOMATE: DefinicionFase[] = [
  {
    clave: 'GERMINACION',
    nombre: 'Germinación',
    emoji: '🌱',
    semanasPorDefecto: 1,
    queOcurre: 'La semilla absorbe humedad, rompe la cáscara y asoma la raíz. Después sale el tallito con sus dos primeras hojas redondas (cotiledones).',
    ambiente: 'Temperatura de 22 a 26 °C, lugar luminoso pero sin sol directo fuerte.',
    riego: 'Sustrato siempre húmedo, nunca encharcado. Mejor rociar que regar con chorro.',
    nutricion: 'No hace falta abonar: la semilla trae su propia reserva.',
    tareas: [
      'Sembrar a 0,5–1 cm de profundidad en sustrato fino y suelto',
      'Mantener el sustrato húmedo y la temperatura estable',
      'Tapar con film o tapa el primer par de días para conservar humedad',
    ],
    pasaALaSiguiente: 'Cuando emergen los cotiledones en la mayoría de las semillas (entre 5 y 10 días).',
  },
  {
    clave: 'PLANTULA',
    nombre: 'Plántula en semillero',
    emoji: '🪴',
    semanasPorDefecto: 4,
    queOcurre: 'Aparecen las hojas verdaderas (con borde dentado) y el tallo y la raíz se fortalecen. Acá se define si la planta sale robusta o "espigada".',
    ambiente: 'Mucha luz (6 a 8 horas de sol o luz artificial), 18–25 °C de día y no menos de 12 °C de noche. Buena ventilación.',
    riego: 'Moderado y por la mañana. El exceso de agua provoca hongos en la base del tallo (mal del talluelo).',
    nutricion: 'Desde la 2.ª o 3.ª hoja verdadera, fertilizante diluido a la mitad cada 10–15 días.',
    tareas: [
      'Repicar (pasar a macetita individual) cuando tenga 2 o 3 hojas verdaderas',
      'Dar vuelta las bandejas cada pocos días para que no se doblen hacia la luz',
      'Revisar que no haya hongos ni plántulas caídas en la base',
      'Desde la semana 3: sacar las plántulas un rato al exterior (endurecimiento)',
    ],
    pasaALaSiguiente: 'Cuando mide 15–20 cm, tiene de 5 a 7 hojas verdaderas y tallo grueso como un lápiz.',
  },
  {
    clave: 'TRASPLANTE',
    nombre: 'Trasplante y adaptación',
    emoji: '🚜',
    semanasPorDefecto: 1,
    queOcurre: 'La plántula pasa a su lugar definitivo (tierra o maceta grande). Frena un poco su crecimiento mientras arma raíces nuevas.',
    ambiente: 'Plantar sin riesgo de heladas, con suelo por encima de 15 °C. Mejor a la tarde o en día nublado.',
    riego: 'Riego abundante apenas se trasplanta y luego cada 2–3 días, manteniendo humedad pareja.',
    nutricion: 'Preparar el suelo con compost o abono orgánico bien maduro. Se puede enterrar el tallo hasta las primeras hojas para que eche más raíces.',
    tareas: [
      'Preparar el suelo: aflojar, agregar compost y definir el tutor o enrejado',
      'Separar las plantas entre 40 y 60 cm (80–100 cm entre líneas)',
      'Colocar el tutor al momento de plantar para no dañar raíces después',
      'Cubrir el suelo con paja o mulch para conservar humedad',
    ],
    pasaALaSiguiente: 'Cuando la planta se ve firme, con hojas erguidas y brotes nuevos (señal de que enraizó).',
  },
  {
    clave: 'VEGETATIVO',
    nombre: 'Crecimiento vegetativo',
    emoji: '🌿',
    semanasPorDefecto: 3,
    queOcurre: 'La planta gana altura y arma su estructura de tallos y hojas. Es la etapa donde más crece antes de florecer.',
    ambiente: 'Sol directo 6 a 8 horas, 20–28 °C de día. Ventilación para prevenir enfermedades de hoja.',
    riego: 'Profundo y regular (unos 2–3 litros por planta por semana, según clima). Regar en la base, sin mojar las hojas.',
    nutricion: 'Abono rico en nitrógeno (N) y equilibrado; evitar el exceso de nitrógeno cuando se acerca la flor.',
    tareas: [
      'Atar el tallo al tutor a medida que crece',
      'Deschuponar: sacar los brotes que nacen en la axila entre tallo y hoja (según la variedad)',
      'Retirar hojas bajas amarillas o que toquen el suelo',
      'Revisar plagas (mosca blanca, pulgón, trips) una vez por semana',
    ],
    pasaALaSiguiente: 'Cuando aparece el primer racimo de flores.',
  },
  {
    clave: 'FLORACION',
    nombre: 'Floración y cuajado',
    emoji: '🌼',
    semanasPorDefecto: 3,
    queOcurre: 'Salen los racimos de flores amarillas y las flores polinizadas se transforman en frutitos (cuajado).',
    ambiente: 'Ideal 18–27 °C. Con más de 32 °C o menos de 12 °C las flores se caen sin cuajar.',
    riego: 'Constante y parejo: los cambios bruscos de humedad provocan caída de flores y la "podredumbre apical".',
    nutricion: 'Bajar el nitrógeno y subir fósforo (P), potasio (K) y calcio (Ca).',
    tareas: [
      'Sacudir suavemente los tutores o racimos para ayudar a la polinización',
      'Mantener riego parejo, sin picos de sequía ni encharcamiento',
      'Aplicar fertilizante con más potasio y calcio',
      'Seguir atando y deschuponando',
    ],
    pasaALaSiguiente: 'Cuando los primeros frutos cuajados ya tienen el tamaño de una arveja o una nuez.',
  },
  {
    clave: 'FRUTOS',
    nombre: 'Fructificación y maduración',
    emoji: '🍅',
    semanasPorDefecto: 6,
    queOcurre: 'Los frutos crecen y engordan hasta alcanzar su tamaño y pasan de verde a su color de madurez.',
    ambiente: 'Sol y calor moderado. Proteger de lluvias fuertes y de sol extremo que "quema" los frutos.',
    riego: 'Regular, sin excesos cuando el fruto empieza a madurar (el exceso de agua los raja).',
    nutricion: 'Potasio y calcio; mantener el abono hasta que empiece la cosecha.',
    tareas: [
      'Despuntar o limitar racimos si la planta está muy cargada (según variedad)',
      'Retirar hojas que tapan los racimos para dar aire y luz',
      'Vigilar tizón (manchas oscuras en hoja o fruto) y actuar rápido',
      'Cosechar los primeros frutos apenas virar de color',
    ],
    pasaALaSiguiente: 'Cuando el primer racimo empieza a madurar y se puede cosechar.',
  },
  {
    clave: 'COSECHA',
    nombre: 'Cosecha',
    emoji: '🧺',
    semanasPorDefecto: 6,
    queOcurre: 'Los frutos maduran de manera escalonada: se cosecha cada pocos días mientras la planta siga produciendo.',
    ambiente: 'Cosechar temprano a la mañana, con los frutos secos.',
    riego: 'Mantener el riego regular; reducirlo hacia el final del ciclo.',
    nutricion: 'Ya no se necesita abono fuerte; un último aporte de potasio ayuda a sostener la producción.',
    tareas: [
      'Cosechar cada 2 o 3 días los frutos bien coloreados y firmes',
      'Retirar frutos dañados o podridos para que no contagien al resto',
      'Registrar kilos cosechados para medir el rendimiento de la producción',
      'Al terminar: retirar las plantas y no repetir tomate en el mismo lugar el ciclo siguiente',
    ],
    pasaALaSiguiente: 'Fin de la producción: cuando la planta deja de dar frutos o se decide cerrarla.',
  },
];

export type FaseProduccion = {
  clave: ClaveFase;
  semanas: number;
};

export function fasesPorDefecto(): FaseProduccion[] {
  return FASES_TOMATE.map((f) => ({ clave: f.clave, semanas: f.semanasPorDefecto }));
}

export function definicionFase(clave: ClaveFase): DefinicionFase {
  return FASES_TOMATE.find((f) => f.clave === clave) as DefinicionFase;
}

// Se trabaja con fechas "YYYY-MM-DD" y día de calendario local (sin
// hora) — mismo motivo que lib/fecha.ts: toISOString() en UTC puede
// correr un día.
function aFechaLocal(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function aIso(fecha: Date): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export function sumarDias(iso: string, dias: number): string {
  const f = aFechaLocal(iso);
  f.setDate(f.getDate() + dias);
  return aIso(f);
}

function diasEntreIso(desde: string, hasta: string): number {
  return Math.round((aFechaLocal(hasta).getTime() - aFechaLocal(desde).getTime()) / 86400000);
}

export type FaseConFechas = FaseProduccion & {
  numero: number;
  inicio: string;
  fin: string; // último día de la fase (inclusive)
};

export function calcularCalendario(fechaInicio: string, fases: FaseProduccion[]): FaseConFechas[] {
  let cursor = fechaInicio;

  return fases.map((fase, i) => {
    const dias = Math.max(1, Math.round(fase.semanas * 7));
    const inicio = cursor;
    const fin = sumarDias(inicio, dias - 1);
    cursor = sumarDias(fin, 1);
    return { ...fase, numero: i + 1, inicio, fin };
  });
}

export type EstadoProduccion = {
  estado: 'PENDIENTE' | 'EN_CURSO' | 'TERMINADA';
  faseActual: FaseConFechas | null;
  semanaDeLaFase: number;
  semanasDeLaFase: number;
  diasTotales: number;
  diaActual: number;
  porcentaje: number;
  diasParaSiguienteFase: number;
};

export function estadoProduccion(calendario: FaseConFechas[], hoy: string): EstadoProduccion {
  const inicio = calendario[0].inicio;
  const fin = calendario[calendario.length - 1].fin;
  const diasTotales = diasEntreIso(inicio, fin) + 1;

  if (hoy < inicio) {
    return {
      estado: 'PENDIENTE',
      faseActual: null,
      semanaDeLaFase: 0,
      semanasDeLaFase: 0,
      diasTotales,
      diaActual: 0,
      porcentaje: 0,
      diasParaSiguienteFase: diasEntreIso(hoy, inicio),
    };
  }

  if (hoy > fin) {
    return {
      estado: 'TERMINADA',
      faseActual: null,
      semanaDeLaFase: 0,
      semanasDeLaFase: 0,
      diasTotales,
      diaActual: diasTotales,
      porcentaje: 100,
      diasParaSiguienteFase: 0,
    };
  }

  const faseActual = calendario.find((f) => hoy >= f.inicio && hoy <= f.fin) as FaseConFechas;
  const diaActual = diasEntreIso(inicio, hoy) + 1;
  const semanaDeLaFase = Math.floor(diasEntreIso(faseActual.inicio, hoy) / 7) + 1;

  return {
    estado: 'EN_CURSO',
    faseActual,
    semanaDeLaFase,
    semanasDeLaFase: Math.ceil(faseActual.semanas),
    diasTotales,
    diaActual,
    porcentaje: Math.round((diaActual / diasTotales) * 100),
    diasParaSiguienteFase: diasEntreIso(hoy, faseActual.fin) + 1,
  };
}
