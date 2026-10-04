// lib/cuentasCompromisoNombres.ts
//
// Reglas puras (sin Supabase) para las cuentas específicas de los
// compromisos: cómo se llaman y dónde cuelgan en el plan. El libro
// identifica las cuentas por NOMBRE, así que el nombre tiene que ser
// único y estable — de ahí que se arme siempre con la misma regla.

export type LadoCompromiso = 'PAGAR' | 'COBRAR';

const SUFIJO: Record<LadoCompromiso, string> = { PAGAR: 'a pagar', COBRAR: 'a cobrar' };

const TERMINA_EN_SUFIJO = /\s+a\s+(pagar|cobrar)$/i;

function limpiar(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

// "Alquiler Santihno" → "Alquiler Santihno a pagar" (el "a pagar / a cobrar"
// va siempre al final, para que primero se lea el nombre). Si el nombre ya
// termina en "a pagar" o "a cobrar" no se duplica ni se mezcla: se
// normaliza al sufijo del lado que corresponde.
export function nombreCuentaCompromiso(nombre: string, lado: LadoCompromiso): string {
  const base = limpiar(nombre).replace(TERMINA_EN_SUFIJO, '');
  return `${base} ${SUFIJO[lado]}`;
}

// ¿Esta cuenta tiene el nombre que le correspondería a una plantilla?
// (Sirve para saber si la cuenta se creó automáticamente con el nombre
// de la plantilla — y por eso debe acompañar sus renombrados — o si es
// una cuenta compartida/elegida a mano, que no se toca.)
export function esCuentaNombradaComo(nombreCuenta: string, nombrePlantilla: string, lado: LadoCompromiso): boolean {
  return limpiar(nombreCuenta).toLowerCase() === nombreCuentaCompromiso(nombrePlantilla, lado).toLowerCase();
}

// Los códigos del plan son "A.B.C.D.E". Un grupo nuevo es un contenedor
// "A.B.k.0.0" y sus cuentas individuales "A.B.k.0.n". Esto devuelve el
// próximo k libre bajo el prefijo "A.B" mirando TODOS los códigos de ese
// prefijo (hay hojas sueltas, como "2.1.1.0.1", que ya ocupan un k).
export function siguienteSegmentoLibre(codigos: string[], prefijo: string): number {
  const usados = codigos
    .filter((codigo) => codigo.startsWith(`${prefijo}.`))
    .map((codigo) => parseInt(codigo.split('.')[2] ?? '0', 10))
    .filter((n) => !Number.isNaN(n));

  return usados.length > 0 ? Math.max(...usados) + 1 : 1;
}

export function codigoDeGrupo(prefijo: string, segmento: number): string {
  return `${prefijo}.${segmento}.0.0`;
}

// Un nombre que ya existe (sin importar mayúsculas ni espacios) no se puede
// reutilizar para una cuenta nueva: el libro mezclaría los saldos.
export function nombreYaExiste(nombre: string, existentes: string[]): boolean {
  const buscado = limpiar(nombre).toLowerCase();
  return existentes.some((existente) => limpiar(existente).toLowerCase() === buscado);
}
