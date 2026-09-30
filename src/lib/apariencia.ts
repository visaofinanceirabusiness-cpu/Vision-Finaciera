// lib/apariencia.ts
//
// TEMA GLOBAL — colores y fondo personalizados por empresa
// =====================================================
// Hasta ahora, cada pantalla define sus propios colores por defecto
// como literales (ej. `const COLORES = { azul: '#1f3a5f', ... }`), y
// solo el lobby y Panel de Control volvían a consultar
// configuracion_dashboard para pisarlos. En vez de hacer que cada una
// de las ~15 pantallas repita esa consulta, esos literales pasan a
// ser `var(--color-primario, '#1f3a5f')`: el navegador resuelve la
// variable si TemaGlobal (componente montado una sola vez en el
// layout raíz) la seteó, y si no, usa el mismo valor de siempre — el
// gris/azul/verde por defecto no cambia para quien no eligió nada.
//
// Los matices con alfa (ej. `${COLORES.azul}22` para un borde
// translúcido) no se tocan: no se puede concatenar una alfa
// hexadecimal a un var(), así que esos detalles decorativos quedan
// siempre en el tono por defecto — costo aceptable frente a reescribir
// cada uno de esos usos.
//
// Sin acceso a internet desde este entorno para descargar fotos reales,
// los 6 fondos son paisajes dibujados con degradados CSS en capas —
// reemplazables más adelante por fotos reales en /public/fondos sin
// tocar nada de lo que los usa (la clave elegida no cambia).

export type ConfiguracionTema = {
  color_primario?: string | null;
  color_secundario?: string | null;
  color_acento?: string | null;
  fondo_imagen?: string | null;
};

export type FondoPreset = {
  clave: string;
  nombreEs: string;
  nombrePt: string;
  fondoCss: string;
};

export const FONDOS_DISPONIBLES: FondoPreset[] = [
  {
    clave: 'MONTANA',
    nombreEs: 'Montaña',
    nombrePt: 'Montanha',
    fondoCss:
      'linear-gradient(200deg, #334155 0%, #64748b 22%, transparent 23%), linear-gradient(160deg, #1e293b 0%, #475569 18%, transparent 19%), linear-gradient(180deg, #7dd3fc 0%, #bae6fd 45%, #e0f2fe 100%)',
  },
  {
    clave: 'OCEANO',
    nombreEs: 'Océano',
    nombrePt: 'Oceano',
    fondoCss: 'linear-gradient(180deg, #0ea5e9 0%, #38bdf8 38%, #7dd3fc 52%, #075985 100%)',
  },
  {
    clave: 'BOSQUE',
    nombreEs: 'Bosque',
    nombrePt: 'Floresta',
    fondoCss: 'linear-gradient(180deg, #bbf7d0 0%, #4ade80 30%, #16a34a 60%, #14532d 100%)',
  },
  {
    clave: 'ATARDECER',
    nombreEs: 'Atardecer',
    nombrePt: 'Pôr do sol',
    fondoCss: 'linear-gradient(180deg, #fde047 0%, #fb923c 38%, #ea580c 65%, #7c2d12 100%)',
  },
  {
    clave: 'CAMPO',
    nombreEs: 'Campo',
    nombrePt: 'Campo',
    fondoCss: 'linear-gradient(180deg, #bae6fd 0%, #e0f2fe 38%, #fef08a 55%, #ca8a04 100%)',
  },
  {
    clave: 'CIUDAD',
    nombreEs: 'Ciudad de noche',
    nombrePt: 'Cidade à noite',
    fondoCss: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 45%, #4c1d95 75%, #1e1b4b 100%)',
  },
];

export function fondoPorClave(clave: string | null | undefined): FondoPreset | null {
  if (!clave) return null;
  return FONDOS_DISPONIBLES.find((f) => f.clave === clave) ?? null;
}

// Pantallas donde no corresponde aplicar el tema de una empresa
// (todavía no hay sesión, o es el panel del administrador de la
// plataforma, que no pertenece a una sola empresa).
export const RUTAS_SIN_TEMA_EMPRESA = [
  '/login',
  '/crear-cuenta',
  '/recuperar-senha',
  '/restablecer-senha',
  '/aceptar-convite',
  '/bienvenida',
  '/panel-maestro',
];

function fijarOQuitar(nombre: string, valor: string | null | undefined) {
  const raiz = document.documentElement.style;
  if (valor) {
    raiz.setProperty(nombre, valor);
  } else {
    raiz.removeProperty(nombre);
  }
}

export function aplicarTemaGlobal(config: ConfiguracionTema | null) {
  fijarOQuitar('--color-primario', config?.color_primario);
  fijarOQuitar('--color-secundario', config?.color_secundario);
  fijarOQuitar('--color-acento', config?.color_acento);
  fijarOQuitar('--fondo-app', fondoPorClave(config?.fondo_imagen)?.fondoCss);
}
