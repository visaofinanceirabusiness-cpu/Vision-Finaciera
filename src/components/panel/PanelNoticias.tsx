'use client';

// NOTICIAS DEL DÍA (fase 1, piloto Buenaventura) — solo titulares de feeds
// públicos con fuente y enlace a la nota original; no se guarda ni se copia
// contenido. Los títulos vienen de sitios ajenos: se muestran como texto y
// solo se enlazan URLs http(s) (validadas en lib/noticias.ts).

import { useEffect, useState } from 'react';
import type { Bloque, Titular } from '@/lib/noticias';

type Respuesta = Record<Bloque, Titular[]> & { fuentesFallidas?: string[] };

const BLOQUES: Array<{ id: Bloque; emoji: string; es: string; pt: string }> = [
  { id: 'mundo', emoji: '🌎', es: 'Mundo', pt: 'Mundo' },
  { id: 'brasil', emoji: '🇧🇷', es: 'Brasil', pt: 'Brasil' },
  { id: 'argentina', emoji: '🇦🇷', es: 'Argentina', pt: 'Argentina' },
];

export function PanelNoticias({
  idioma,
  colores,
}: {
  idioma: string;
  colores: { azul: string; verde: string };
}) {
  const esPT = idioma === 'PT';
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [bloque, setBloque] = useState<Bloque>('brasil');
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    fetch('/api/noticias')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Respuesta) => setDatos(d))
      .catch(() => setFallo(true))
      .finally(() => setCargando(false));
  }, []);

  const titulares = datos?.[bloque] ?? [];

  return (
    <div>
      <div style={{ marginBottom: 5, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde }}>
        {esPT ? 'NOTÍCIAS' : 'NOTICIAS'}
      </div>
      <h2 style={{ margin: 0, color: colores.azul, fontSize: 23 }}>📰 {esPT ? 'Notícias do dia' : 'Noticias del día'}</h2>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
        {BLOQUES.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBloque(b.id)}
            style={{
              border: `1px solid ${bloque === b.id ? colores.azul : '#d1d5db'}`,
              background: bloque === b.id ? colores.azul : '#fff',
              color: bloque === b.id ? '#fff' : '#1f2937',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {b.emoji} {esPT ? b.pt : b.es}
          </button>
        ))}
      </div>

      {cargando ? (
        <p style={{ fontSize: 13, color: '#6e7781' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
      ) : fallo || titulares.length === 0 ? (
        <p style={{ fontSize: 12.5, color: '#6e7781' }}>
          {esPT ? 'Não foi possível carregar as notícias agora. Tente mais tarde.' : 'No pudimos cargar las noticias ahora. Probá más tarde.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {titulares.map((t) => (
            <li key={t.enlace} style={{ borderBottom: '1px solid #eef2f6', paddingBottom: 10 }}>
              <a
                href={t.enlace}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#1f2937', fontWeight: 700, fontSize: 14.5, textDecoration: 'none', lineHeight: 1.35 }}
              >
                {t.titulo}
              </a>
              <div style={{ fontSize: 11.5, color: '#6e7781', marginTop: 3 }}>{t.fuente} ↗</div>
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: 11, color: '#94a3b8', margin: '12px 0 0' }}>
        {esPT ? 'Títulos de portais públicos; leia a nota completa na fonte.' : 'Titulares de portales públicos; leé la nota completa en la fuente.'}
      </p>
    </div>
  );
}
