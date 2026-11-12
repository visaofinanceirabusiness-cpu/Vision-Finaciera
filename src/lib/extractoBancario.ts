// lib/extractoBancario.ts
//
// IMPORTAR EXTRACTO (OFX / CSV) — la alternativa sin costo a Open Finance: la persona baja el extracto de su banco y lo sube a Visão;
// los movimientos entran a la MISMA conciliación (ver lib/conciliacionBancaria.ts). Parte pura (se prueba en extractoBancario.test.ts).
// Formatos: OFX/QFX (el estándar que exportan Santander, Bradesco, Caixa, Itaú…) y CSV (Nubank y otros), con números y fechas de Brasil
// o de Argentina («1.234,56», «25/12/2026») y también ISO.

import type { MovimientoExterno } from './openFinance/proveedor';

export type ExtractoLeido = { movimientos: MovimientoExterno[]; saldoFinal: number | null; errores: string[] };

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// «1.234,56» (BR/AR) · «1234.56» · «-45,9» · «(45,90)» · «R$ 1.000» → número con signo; null si no es un número.
export function numeroDeTexto(crudo: string): number | null {
  let t = crudo.trim();
  if (!t) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (/-\s*$/.test(t)) {
    negativo = true;
    t = t.replace(/-\s*$/, '');
  }
  if (/^\s*-/.test(t)) negativo = !negativo ? true : negativo;
  t = t.replace(/[^0-9.,]/g, '');
  if (!t) return null;

  const ultimaComa = t.lastIndexOf(',');
  const ultimoPunto = t.lastIndexOf('.');
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    t = ultimaComa > ultimoPunto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (ultimaComa >= 0) {
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if (ultimoPunto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round((negativo ? -n : n) * 100) / 100;
}

// dd/mm/aaaa · dd-mm-aaaa · dd/mm/aa · aaaa-mm-dd · aaaammdd → YYYY-MM-DD (null si no es una fecha real).
export function fechaDeTexto(crudo: string): string | null {
  const t = crudo.trim();
  let a: string, m: string, d: string;
  let r = /^(\d{4})-(\d{2})-(\d{2})/.exec(t) ?? /^(\d{4})(\d{2})(\d{2})/.exec(t);
  if (r) [, a, m, d] = r;
  else {
    r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(t);
    if (!r) return null;
    d = r[1].padStart(2, '0');
    m = r[2].padStart(2, '0');
    a = r[3].length === 2 ? `20${r[3]}` : r[3];
  }
  const f = new Date(`${a}-${m}-${d}T12:00:00Z`);
  if (Number.isNaN(f.getTime()) || f.getUTCMonth() + 1 !== Number(m) || f.getUTCDate() !== Number(d)) return null;
  return `${a}-${m}-${d}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// OFX
// ---------------------------------------------------------------------------------------------------------------------

export function leerOFX(texto: string): ExtractoLeido {
  const errores: string[] = [];
  const movimientos: MovimientoExterno[] = [];
  const bloques = texto.split(/<STMTTRN>/i).slice(1);
  const etiqueta = (b: string, tag: string) => new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i').exec(b)?.[1]?.trim() ?? '';

  bloques.forEach((b, i) => {
    const fecha = fechaDeTexto(etiqueta(b, 'DTPOSTED'));
    const monto = numeroDeTexto(etiqueta(b, 'TRNAMT'));
    if (!fecha || monto === null) {
      errores.push(`Movimiento ${i + 1} del OFX sin fecha o importe válido: se omitió.`);
      return;
    }
    const memo = etiqueta(b, 'MEMO');
    const nombre = etiqueta(b, 'NAME');
    const descripcion = [nombre, memo].filter((x, k, arr) => x && arr.indexOf(x) === k).join(' · ');
    const fitid = etiqueta(b, 'FITID');
    movimientos.push({ idExterno: fitid || `ofx|${fecha}|${monto}|${descripcion}|${i}`, fecha, monto, descripcion, contraparte: null });
  });

  const saldo = /<LEDGERBAL>[\s\S]*?<BALAMT>\s*([^<\r\n]+)/i.exec(texto)?.[1];
  return { movimientos, saldoFinal: saldo ? numeroDeTexto(saldo) : null, errores };
}

// ---------------------------------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------------------------------

function partirLinea(linea: string, sep: string): string[] {
  const salida: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else entreComillas = !entreComillas;
    } else if (c === sep && !entreComillas) {
      salida.push(actual);
      actual = '';
    } else actual += c;
  }
  salida.push(actual);
  return salida.map((x) => x.trim());
}

const COLUMNAS = {
  fecha: ['data', 'date', 'fecha', 'data lancamento', 'data da transacao', 'data movimento', 'dt'],
  monto: ['valor', 'monto', 'importe', 'amount', 'valor (r$)', 'valor r$'],
  debito: ['debito', 'saida', 'saidas', 'debitos'],
  credito: ['credito', 'entrada', 'entradas', 'creditos'],
  descripcion: ['descricao', 'descripcion', 'historico', 'lancamento', 'memo', 'description', 'detalhe', 'detalle', 'concepto'],
  id: ['identificador', 'id', 'documento', 'numero documento', 'nr. documento'],
  saldo: ['saldo', 'balance'],
};

export function leerCSV(texto: string): ExtractoLeido {
  const errores: string[] = [];
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return { movimientos: [], saldoFinal: null, errores: ['El archivo no tiene movimientos.'] };

  // El encabezado puede no ser la primera línea (algunos bancos agregan datos de la cuenta arriba): se busca la primera con fecha y monto/débito.
  const contar = (l: string, c: string) => l.split(c).length - 1;
  let iEnc = -1;
  let sep = ';';
  let enc: string[] = [];
  const indice = (cols: string[], tipo: keyof typeof COLUMNAS) => cols.findIndex((c) => COLUMNAS[tipo].includes(normalizar(c)));

  for (let i = 0; i < Math.min(lineas.length, 15); i++) {
    sep = [';', '\t', ','].sort((a, b) => contar(lineas[i], b) - contar(lineas[i], a))[0];
    const cols = partirLinea(lineas[i], sep);
    if (indice(cols, 'fecha') >= 0 && (indice(cols, 'monto') >= 0 || indice(cols, 'debito') >= 0 || indice(cols, 'credito') >= 0)) {
      iEnc = i;
      enc = cols;
      break;
    }
  }
  if (iEnc < 0) return { movimientos: [], saldoFinal: null, errores: ['No reconocí las columnas: tiene que haber al menos Fecha y Valor (o Débito/Crédito).'] };

  const iFecha = indice(enc, 'fecha');
  const iMonto = indice(enc, 'monto');
  const iDeb = indice(enc, 'debito');
  const iCre = indice(enc, 'credito');
  const iDesc = indice(enc, 'descripcion');
  const iId = indice(enc, 'id');
  const iSaldo = indice(enc, 'saldo');

  const movimientos: MovimientoExterno[] = [];
  const repetidos = new Map<string, number>();
  let saldoFinal: number | null = null;

  for (let i = iEnc + 1; i < lineas.length; i++) {
    const c = partirLinea(lineas[i], sep);
    const fecha = fechaDeTexto(c[iFecha] ?? '');
    let monto: number | null = null;
    if (iMonto >= 0) monto = numeroDeTexto(c[iMonto] ?? '');
    else {
      const d = numeroDeTexto(c[iDeb] ?? '');
      const cr = numeroDeTexto(c[iCre] ?? '');
      monto = cr !== null && cr !== 0 ? Math.abs(cr) : d !== null && d !== 0 ? -Math.abs(d) : null;
    }
    if (!fecha || monto === null) {
      if (c.some((x) => x)) errores.push(`Línea ${i + 1}: sin fecha o importe válido, se omitió.`);
      continue;
    }
    const descripcion = iDesc >= 0 ? (c[iDesc] ?? '') : '';
    const base = iId >= 0 && c[iId] ? c[iId] : `csv|${fecha}|${monto}|${descripcion}`;
    // Dos movimientos idénticos el mismo día son dos movimientos: se numeran para que no se pisen (y al volver a subir el archivo sigan siendo los mismos).
    const n = (repetidos.get(base) ?? 0) + 1;
    repetidos.set(base, n);
    movimientos.push({ idExterno: n === 1 ? base : `${base}|${n}`, fecha, monto, descripcion, contraparte: null });
    if (iSaldo >= 0) {
      const s = numeroDeTexto(c[iSaldo] ?? '');
      if (s !== null) saldoFinal = s;
    }
  }
  return { movimientos, saldoFinal, errores };
}

export function parsearExtracto(nombreArchivo: string, texto: string): ExtractoLeido {
  const esOfx = /\.(ofx|qfx)$/i.test(nombreArchivo) || /<OFX>|OFXHEADER/i.test(texto.slice(0, 2000));
  const r = esOfx ? leerOFX(texto) : leerCSV(texto);
  if (r.movimientos.length === 0 && r.errores.length === 0) r.errores.push('No encontré movimientos en el archivo.');
  return r;
}
