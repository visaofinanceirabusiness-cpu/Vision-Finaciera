import { describe, it, expect } from 'vitest';
import { parsearFeed, mezclarTitulares, enlaceSeguro, type Titular } from './noticias';

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Dólar cae &amp; el real sube]]></title><link>https://ej.com/a</link><pubDate>Tue, 06 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Sin enlace</title></item>
<item><title>Enlace malo</title><link>javascript:alert(1)</link></item>
<item><title>Tilde &#225;</title><link>https://ej.com/b</link></item>
</channel></rss>`;

const ATOM = `<feed><entry><title>Atom uno</title><link href="https://ej.com/c"/><updated>2026-10-06T10:00:00Z</updated></entry></feed>`;

describe('parsearFeed', () => {
  it('lee RSS, decodifica entidades y descarta lo inválido', () => {
    const r = parsearFeed(RSS, 'Fuente');
    expect(r.map((t) => t.titulo)).toEqual(['Dólar cae & el real sube', 'Tilde á']);
    expect(r[0].fecha).toBe(Date.parse('2026-10-06T10:00:00Z'));
  });
  it('lee Atom', () => {
    expect(parsearFeed(ATOM, 'A')[0]).toMatchObject({ titulo: 'Atom uno', enlace: 'https://ej.com/c' });
  });
  it('respeta el límite', () => {
    expect(parsearFeed(RSS, 'F', 1)).toHaveLength(1);
  });
});

describe('enlaceSeguro', () => {
  it('solo http(s)', () => {
    expect(enlaceSeguro('javascript:alert(1)')).toBeNull();
    expect(enlaceSeguro('https://a.com/x')).toBe('https://a.com/x');
  });
});

describe('mezclarTitulares', () => {
  const t = (titulo: string): Titular => ({ titulo, enlace: 'https://x.com', fuente: 'f', fecha: null });
  it('intercala fuentes, sin repetir titulares y con tope', () => {
    const r = mezclarTitulares([[t('a1'), t('a2')], [t('b1'), t('a1')], [t('c1')]], 4);
    expect(r.map((x) => x.titulo)).toEqual(['a1', 'b1', 'c1', 'a2']);
  });
});
