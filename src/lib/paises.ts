// lib/paises.ts
//
// Lista de países con su código telefónico, para el selector de
// "país + número" en los formularios de teléfono. No pretende ser
// exhaustiva — cubre los países donde es más probable tener
// clientes/proveedores/usuarios, con Brasil primero (sede del
// negocio) y el resto en orden alfabético.

export type PaisTelefono = {
  nombre: string;
  codigo: string; // código telefónico, ej: "+55"
};

export const PAISES_TELEFONO: PaisTelefono[] = [
  { nombre: 'Brasil', codigo: '+55' },
  { nombre: 'Argentina', codigo: '+54' },
  { nombre: 'Alemania', codigo: '+49' },
  { nombre: 'Bolivia', codigo: '+591' },
  { nombre: 'Canadá', codigo: '+1' },
  { nombre: 'Chile', codigo: '+56' },
  { nombre: 'Colombia', codigo: '+57' },
  { nombre: 'Costa Rica', codigo: '+506' },
  { nombre: 'Cuba', codigo: '+53' },
  { nombre: 'Ecuador', codigo: '+593' },
  { nombre: 'El Salvador', codigo: '+503' },
  { nombre: 'España', codigo: '+34' },
  { nombre: 'Estados Unidos', codigo: '+1' },
  { nombre: 'Francia', codigo: '+33' },
  { nombre: 'Guatemala', codigo: '+502' },
  { nombre: 'Honduras', codigo: '+504' },
  { nombre: 'Italia', codigo: '+39' },
  { nombre: 'México', codigo: '+52' },
  { nombre: 'Nicaragua', codigo: '+505' },
  { nombre: 'Panamá', codigo: '+507' },
  { nombre: 'Paraguay', codigo: '+595' },
  { nombre: 'Perú', codigo: '+51' },
  { nombre: 'Portugal', codigo: '+351' },
  { nombre: 'Puerto Rico', codigo: '+1' },
  { nombre: 'Reino Unido', codigo: '+44' },
  { nombre: 'República Dominicana', codigo: '+1' },
  { nombre: 'Uruguay', codigo: '+598' },
  { nombre: 'Venezuela', codigo: '+58' },
];

// Para pre-cargar un teléfono ya guardado ("+55 48999999999") en el
// formulario: separa el código de país (el más largo que matchee) del
// resto del número. Si no matchea ninguno, devuelve Brasil por
// defecto y el texto completo como número — mejor esfuerzo, nunca
// bloquea la edición de un registro viejo.
export function separarCodigoPais(telefono: string): { codigo: string; numero: string } {
  const limpio = telefono.trim();

  const codigosOrdenados = [...PAISES_TELEFONO]
    .map((p) => p.codigo)
    .filter((codigo, indice, lista) => lista.indexOf(codigo) === indice)
    .sort((a, b) => b.length - a.length);

  for (const codigo of codigosOrdenados) {
    if (limpio.startsWith(codigo)) {
      return {
        codigo,
        numero: limpio.slice(codigo.length).trim(),
      };
    }
  }

  return { codigo: '+55', numero: limpio };
}
