import { describe, expect, it } from 'vitest';
import { componerWhatsapp, ejemploWhatsapp, formatearWhatsapp, paisPorMoneda, separarWhatsapp } from './whatsappPais';

describe('WhatsApp con selector de país', () => {
  it('Argentina: 549 + característica + número (el ejemplo del dueño)', () => {
    expect(componerWhatsapp('AR', '351', '6648669')).toBe('5493516648669');
  });
  it('Argentina: se borran el 0 de la característica y el 15 de adelante', () => {
    expect(componerWhatsapp('AR', '0351', '15 6648669')).toBe('5493516648669');
    expect(componerWhatsapp('AR', '11', '2345-6789')).toBe('5491123456789');
  });
  it('Brasil y otros países: código + característica + número', () => {
    expect(componerWhatsapp('BR', '11', '91234-5678')).toBe('5511912345678');
    expect(componerWhatsapp('UY', '9', '1234567')).toBe('59891234567');
  });
  it('sin característica o sin número no arma nada (así la validación lo rechaza)', () => {
    expect(componerWhatsapp('AR', '', '6648669')).toBe('');
    expect(componerWhatsapp('BR', '11', '')).toBe('');
  });
  it('separa un valor internacional y vuelve a componerlo igual', () => {
    for (const v of ['5493516648669', '5491123456789', '5511912345678']) {
      const s = separarWhatsapp(v);
      expect(componerWhatsapp(s.pais, s.area, s.numero)).toBe(v);
    }
    expect(separarWhatsapp('5493516648669')).toEqual({ pais: 'AR', area: '351', numero: '6648669' });
    expect(separarWhatsapp('5511912345678')).toEqual({ pais: 'BR', area: '11', numero: '912345678' });
  });
  it('lee los números viejos (texto local) con el país por defecto', () => {
    expect(separarWhatsapp('(11) 91234-5678', 'BR')).toEqual({ pais: 'BR', area: '11', numero: '912345678' });
    expect(separarWhatsapp('11 2345-6789', 'AR')).toEqual({ pais: 'AR', area: '11', numero: '23456789' });
    expect(separarWhatsapp('', 'AR')).toEqual({ pais: 'AR', area: '', numero: '' });
  });
  it('formato para mostrar y país según la moneda', () => {
    expect(formatearWhatsapp('5493516648669')).toBe('🇦🇷 +54 351 6648669');
    expect(formatearWhatsapp('')).toBe('');
    expect(paisPorMoneda('ARS')).toBe('AR');
    expect(paisPorMoneda('BRL')).toBe('BR');
    expect(paisPorMoneda(null)).toBe('BR');
    expect(ejemploWhatsapp('AR')).toEqual({ area: '351', numero: '6648669' });
  });
});
