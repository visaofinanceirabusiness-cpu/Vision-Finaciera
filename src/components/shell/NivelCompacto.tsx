'use client';

// «Progreso de tu negocio» en versión reducida para la barra superior: el nivel actual, el porcentaje de avance, las medallas
// del nivel y Misión/Faltan. Mismos datos, textos y colores que el banner de Mi negocio del lobby (SabioHero).

import { crearTraductor } from '@/lib/i18n';
import { diccionarioPanel } from '@/components/panel/i18n';
import type { ProgresoGamificacion } from '@/lib/gamificacion';

export function NivelCompacto({ g, idioma }: { g: ProgresoGamificacion; idioma: string }) {
  const t = crearTraductor(diccionarioPanel, idioma);
  const esPT = idioma === 'PT';
  const avance = g.operaciones - g.operacionesMin;
  const medallas = [
    { emoji: '🥉', ganada: avance >= 25, etiqueta: esPT ? 'Bronze' : 'Bronce' },
    { emoji: '🥈', ganada: avance >= 50, etiqueta: esPT ? 'Prata' : 'Plata' },
    { emoji: '🥇', ganada: avance >= 75, etiqueta: esPT ? 'Ouro' : 'Oro' },
  ];

  return (
    <div style={{ borderRadius: 20, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', padding: '12px 16px', width: 310, maxWidth: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, opacity: 0.78 }}>{t('progresoNegocio')}</div>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, marginTop: 3 }}>
            {g.emoji} {t('nivel')} {g.nivel}
            <span style={{ opacity: 0.85 }}> · {g.nombre}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <strong style={{ fontSize: 20, display: 'block', lineHeight: 1.1 }}>{g.progreso}%</strong>
          <span style={{ fontSize: 10, opacity: 0.8 }}>{g.operaciones} {t('operacionesPalabra')}</span>
        </div>
      </div>

      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.18)', overflow: 'hidden', margin: '9px 0 8px' }}>
        <div style={{ width: `${g.progreso}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #86efac, #ffffff)', transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {g.operacionesMax !== null && (
          <div style={{ display: 'flex', gap: 6 }}>
            {medallas.map((m) => (
              <span key={m.etiqueta} title={m.etiqueta} style={{ fontSize: 18, opacity: m.ganada ? 1 : 0.35, filter: m.ganada ? 'none' : 'grayscale(1)' }}>{m.emoji}</span>
            ))}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, fontSize: 11, lineHeight: 1.3, textAlign: 'right', opacity: 0.92 }}>
          <b>{t('mision')}:</b> {g.mision}
          <br />
          <b>{t('faltan')}:</b> {g.operacionesMax === null ? t('faltanCero') : `${g.faltan} ${t('operacionesPalabra')}`}
        </div>
      </div>
    </div>
  );
}
