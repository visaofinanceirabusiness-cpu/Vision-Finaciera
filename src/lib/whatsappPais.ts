// lib/whatsappPais.ts
//
// WhatsApp con selector de país: [bandera +código] [característica / DDD] [número]. Lógica pura (sin pantalla).
// El valor que se guarda y se manda al servidor es SIEMPRE internacional, solo dígitos (ej. 5493516648669): así el
// link wa.me no depende de adivinar el país. Los números viejos, cargados como texto local, se siguen leyendo
// (ver separarWhatsapp con el país por defecto).

export type CodigoPais = 'AR' | 'BR' | 'UY' | 'PY' | 'CL' | 'BO' | 'PE' | 'CO' | 'EC' | 'VE' | 'MX' | 'US' | 'ES' | 'PT';

export type Pais = { codigo: CodigoPais; marca: string; bandera: string; nombre: { es: string; pt: string } };

// Los más usados primero (Argentina y Brasil son los dos mercados del negocio).
export const PAISES: Pais[] = [
  { codigo: 'AR', marca: '54', bandera: '🇦🇷', nombre: { es: 'Argentina', pt: 'Argentina' } },
  { codigo: 'BR', marca: '55', bandera: '🇧🇷', nombre: { es: 'Brasil', pt: 'Brasil' } },
  { codigo: 'UY', marca: '598', bandera: '🇺🇾', nombre: { es: 'Uruguay', pt: 'Uruguai' } },
  { codigo: 'PY', marca: '595', bandera: '🇵🇾', nombre: { es: 'Paraguay', pt: 'Paraguai' } },
  { codigo: 'CL', marca: '56', bandera: '🇨🇱', nombre: { es: 'Chile', pt: 'Chile' } },
  { codigo: 'BO', marca: '591', bandera: '🇧🇴', nombre: { es: 'Bolivia', pt: 'Bolívia' } },
  { codigo: 'PE', marca: '51', bandera: '🇵🇪', nombre: { es: 'Perú', pt: 'Peru' } },
  { codigo: 'CO', marca: '57', bandera: '🇨🇴', nombre: { es: 'Colombia', pt: 'Colômbia' } },
  { codigo: 'EC', marca: '593', bandera: '🇪🇨', nombre: { es: 'Ecuador', pt: 'Equador' } },
  { codigo: 'VE', marca: '58', bandera: '🇻🇪', nombre: { es: 'Venezuela', pt: 'Venezuela' } },
  { codigo: 'MX', marca: '52', bandera: '🇲🇽', nombre: { es: 'México', pt: 'México' } },
  { codigo: 'US', marca: '1', bandera: '🇺🇸', nombre: { es: 'Estados Unidos', pt: 'Estados Unidos' } },
  { codigo: 'ES', marca: '34', bandera: '🇪🇸', nombre: { es: 'España', pt: 'Espanha' } },
  { codigo: 'PT', marca: '351', bandera: '🇵🇹', nombre: { es: 'Portugal', pt: 'Portugal' } },
];

export function paisDe(codigo: string | null | undefined): Pais {
  return PAISES.find((p) => p.codigo === codigo) ?? PAISES[0];
}

// País por defecto de una tienda según su moneda: pesos → Argentina; el resto, Brasil (como arrancó).
export function paisPorMoneda(moneda: string | null | undefined): 'AR' | 'BR' {
  return moneda === 'ARS' ? 'AR' : 'BR';
}

const soloDigitos = (t: string) => t.replace(/\D/g, '');

// Arma el número internacional. En Argentina el celular lleva un 9 después del 54 (549…) y se borran el 0 inicial de
// la característica y el «15» de adelante del número; en los demás países es código + característica + número.
export function componerWhatsapp(codigo: CodigoPais, area: string, numero: string): string {
  let a = soloDigitos(area);
  let n = soloDigitos(numero);
  if (!a || !n) return '';
  if (codigo === 'AR') {
    a = a.replace(/^0+/, '');
    if (n.startsWith('15') && a.length + n.length > 10) n = n.slice(2);
    return `549${a}${n}`;
  }
  if (codigo === 'BR') a = a.replace(/^0+/, '');
  return `${paisDe(codigo).marca}${a}${n}`;
}

export type WhatsappSeparado = { pais: CodigoPais; area: string; numero: string };

// Parte un valor guardado en país + característica + número. Acepta el formato nuevo (internacional) y los viejos
// (texto local, 10-11 dígitos, que se leen con el país por defecto). La característica de un número viejo se
// adivina (puede ser de 2 a 4 dígitos en Argentina): se muestra para que la persona la corrija si hace falta.
export function separarWhatsapp(valor: string | null | undefined, porDefecto: CodigoPais = 'BR'): WhatsappSeparado {
  let d = soloDigitos(valor ?? '');
  if (!d) return { pais: porDefecto, area: '', numero: '' };

  const local = d.length <= 11 && !(porDefecto === 'BR' && d.startsWith('55') && d.length >= 12);
  let pais = porDefecto;
  if (!local) {
    const candidato = [...PAISES].sort((x, y) => y.marca.length - x.marca.length).find((p) => d.startsWith(p.marca));
    if (candidato) {
      pais = candidato.codigo;
      d = d.slice(candidato.marca.length);
    }
  }
  if (pais === 'AR') {
    if (d.startsWith('9') && d.length === 11) d = d.slice(1);
    d = d.replace(/^0+/, '');
    const largoArea = d.startsWith('11') ? 2 : 3;
    return { pais, area: d.slice(0, largoArea), numero: d.slice(largoArea) };
  }
  return { pais, area: d.slice(0, 2), numero: d.slice(2) };
}

// «🇦🇷 +54 351 6648669», para mostrar en pantalla.
export function formatearWhatsapp(valor: string | null | undefined, porDefecto: CodigoPais = 'BR'): string {
  const s = separarWhatsapp(valor, porDefecto);
  if (!s.area && !s.numero) return '';
  const p = paisDe(s.pais);
  return `${p.bandera} +${p.marca} ${s.area} ${s.numero}`.trim();
}

// Ejemplos (placeholders) de característica y número según el país.
export function ejemploWhatsapp(codigo: CodigoPais): { area: string; numero: string } {
  if (codigo === 'AR') return { area: '351', numero: '6648669' };
  if (codigo === 'BR') return { area: '11', numero: '912345678' };
  return { area: '', numero: '' };
}
