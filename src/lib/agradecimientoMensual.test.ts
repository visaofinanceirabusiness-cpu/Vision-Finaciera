import { describe, expect, it } from 'vitest';
import { construirMensajeAgradecimiento } from './agradecimientoMensual';

describe('construirMensajeAgradecimiento', () => {
  it('arma el mensaje en español por defecto', () => {
    const { titulo, texto } = construirMensajeAgradecimiento('ES');
    expect(titulo).toContain('🎉');
    expect(texto).toContain('agradecerte');
    expect(texto).toContain('Sabio');
  });

  it('arma el mensaje en portugués cuando corresponde', () => {
    const { titulo, texto } = construirMensajeAgradecimiento('PT');
    expect(titulo).toContain('Obrigado');
    expect(texto).toContain('Sábio');
  });

  it('usa español si no hay idioma', () => {
    const { texto } = construirMensajeAgradecimiento(null);
    expect(texto).toContain('agradecerte');
  });
});
