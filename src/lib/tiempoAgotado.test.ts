import { describe, expect, it } from 'vitest';
import { ErrorTiempoAgotado, estaSinTiempo, hoyLocal, mensajeWhatsappComprobante } from './tiempoAgotado';

describe('estaSinTiempo', () => {
  it('con el control apagado nunca bloquea, aunque la fecha esté vencida', () => {
    expect(estaSinTiempo({ controlActivo: false, fechaVencimiento: '2020-01-01' }, '2026-11-05')).toBe(false);
  });
  it('el último día de la suscripción todavía vale y al siguiente se corta', () => {
    expect(estaSinTiempo({ controlActivo: true, fechaVencimiento: '2026-11-05' }, '2026-11-05')).toBe(false);
    expect(estaSinTiempo({ controlActivo: true, fechaVencimiento: '2026-11-04' }, '2026-11-05')).toBe(true);
  });
  it('sin fecha no se bloquea', () => {
    expect(estaSinTiempo({ controlActivo: true, fechaVencimiento: null }, '2026-11-05')).toBe(false);
  });
});

describe('textos y fecha', () => {
  it('el error y el mensaje de WhatsApp salen en el idioma de la empresa', () => {
    expect(new ErrorTiempoAgotado('PT').message).toContain('Seu tempo acabou');
    expect(new ErrorTiempoAgotado('ES').message).toContain('Se agotó tu tiempo');
    expect(mensajeWhatsappComprobante('PT')).toContain('comprovante');
    expect(mensajeWhatsappComprobante('ES')).toContain('comprobante');
  });
  it('usa el día de Buenos Aires y no el de UTC', () => {
    expect(hoyLocal(new Date('2026-11-06T01:30:00Z'))).toBe('2026-11-05');
  });
});
