// Parte el nombre de una barra en hasta `maxLineas` líneas de `maxCaracteres`, cortando entre palabras
// (una palabra más larga que la línea se corta) y cerrando con "…" si algo no entra. En un SVG el texto
// no se acomoda solo: los nombres largos se montaban unos sobre otros.
export function partirEtiqueta(texto: string, maxCaracteres: number, maxLineas = 3): string[] {
  const limite = Math.max(4, Math.floor(maxCaracteres));
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  let truncado = false;

  const cerrar = () => {
    if (actual) lineas.push(actual);
    actual = '';
  };

  for (let palabra of palabras) {
    while (palabra.length > limite) {
      if (actual) cerrar();
      if (lineas.length >= maxLineas) {
        truncado = true;
        break;
      }
      lineas.push(palabra.slice(0, limite - 1) + '-');
      palabra = palabra.slice(limite - 1);
    }
    if (truncado) break;
    if (!palabra) continue;
    if (!actual) actual = palabra;
    else if ((actual + ' ' + palabra).length <= limite) actual += ' ' + palabra;
    else {
      cerrar();
      if (lineas.length >= maxLineas) {
        truncado = true;
        break;
      }
      actual = palabra;
    }
  }
  if (!truncado && actual) {
    if (lineas.length >= maxLineas) truncado = true;
    else lineas.push(actual);
  }

  if (truncado && lineas.length > 0) {
    const ultima = lineas[lineas.length - 1];
    lineas[lineas.length - 1] = (ultima.length >= limite ? ultima.slice(0, limite - 1) : ultima) + '…';
  }
  return lineas.length > 0 ? lineas : [''];
}
