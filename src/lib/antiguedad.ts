// Calcula hace cuánto tiempo está dado de alta un emprendedor en el
// sistema, a partir de su fecha de alta (creado_en) hasta hoy.

export function calcularAntiguedadTexto(fechaAlta: string | null | undefined): string | null {
  if (!fechaAlta) {
    return null;
  }

  const inicio = new Date(fechaAlta);

  if (Number.isNaN(inicio.getTime())) {
    return null;
  }

  const hoy = new Date();

  let anios = hoy.getFullYear() - inicio.getFullYear();
  let meses = hoy.getMonth() - inicio.getMonth();
  let dias = hoy.getDate() - inicio.getDate();

  if (dias < 0) {
    meses -= 1;
    const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    dias += mesAnterior.getDate();
  }

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  if (anios > 0) {
    return meses > 0
      ? `${anios} ${anios === 1 ? 'año' : 'años'} y ${meses} ${meses === 1 ? 'mes' : 'meses'}`
      : `${anios} ${anios === 1 ? 'año' : 'años'}`;
  }

  if (meses > 0) {
    return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  }

  if (dias > 0) {
    return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  }

  return 'Hoy';
}
