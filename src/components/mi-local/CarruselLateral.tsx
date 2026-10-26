'use client';

// Carrusel de imágenes para los costados de la tienda pública (Mi Local):
// prendas, medios de pago, promociones. Rota solo; con una sola imagen queda fija.

import { useEffect, useState } from 'react';

type Imagen = { imagen_url: string; enlace: string | null };

export function CarruselLateral({ imagenes, alto, intervaloMs = 5000 }: { imagenes: Imagen[]; alto?: number | string; intervaloMs?: number }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (imagenes.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % imagenes.length), intervaloMs);
    return () => clearInterval(t);
  }, [imagenes.length, intervaloMs]);

  if (imagenes.length === 0) return null;
  const actual = imagenes[i % imagenes.length];
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={actual.imagen_url} alt="" style={{ width: '100%', height: alto ?? 'auto', objectFit: 'cover', display: 'block', borderRadius: 16 }} />
  );

  return (
    <div style={{ position: 'relative' }}>
      {actual.enlace ? <a href={actual.enlace} target="_blank" rel="noreferrer noopener">{img}</a> : img}
      {imagenes.length > 1 && (
        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {imagenes.map((_, n) => (
            <button key={n} aria-label={`Imagem ${n + 1}`} onClick={() => setI(n)} style={{ width: 8, height: 8, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', background: n === i % imagenes.length ? '#fff' : 'rgba(255,255,255,0.55)', boxShadow: '0 0 3px rgba(0,0,0,0.4)' }} />
          ))}
        </div>
      )}
    </div>
  );
}
