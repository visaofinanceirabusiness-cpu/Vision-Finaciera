'use client';

// COMPOSICIÓN POR GRUPOS — dona + una tarjeta por grupo de cuentas, cada una
// con su imagen, su % del total y la lista de sus cuentas. Hoy lo usa el
// Activo (ver lib/gruposActivo.ts); sirve igual para Pasivo y Patrimonio.

import type { GrupoComposicion } from '@/lib/gruposActivo';
import type { PresentacionGrupo } from './gruposComposicion';

const PRESENTACION_OTRO: PresentacionGrupo = {
  es: 'Otros', pt: 'Outros', imagen: null, emoji: '💰', acento: '#475569', fondo: '#f8fafc', borde: '#e2e8f0',
};

export function ComposicionPorGrupos({
  grupos,
  presentacion,
  titulo,
  subtitulo,
  etiquetaTotal,
  mensajeVacio,
  imagenBanner,
  simbolo = 'R$',
  idioma = 'ES',
  colorBanner = '#1f3a5f',
}: {
  grupos: GrupoComposicion[];
  presentacion: Record<string, PresentacionGrupo>;
  titulo: string;
  subtitulo: string;
  etiquetaTotal: string;
  mensajeVacio: string;
  imagenBanner?: string;
  simbolo?: string;
  idioma?: string;
  colorBanner?: string;
}) {
  const esPT = idioma === 'PT';
  const locale = esPT ? 'pt-BR' : 'es-AR';
  const formatear = (v: number) => `${simbolo}${Math.round(v).toLocaleString(locale)}`;
  const total = grupos.reduce((s, g) => s + g.total, 0);
  const presentar = (id: string) => presentacion[id] ?? PRESENTACION_OTRO;

  const encabezado = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ minWidth: 200, flex: '1 1 220px' }}>
        <h3 style={{ margin: 0, fontSize: 22, color: '#1f3a5f' }}>{titulo}</h3>
        <div style={{ fontSize: 13, color: '#6e7781', marginTop: 3 }}>{subtitulo}</div>
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: `linear-gradient(125deg, ${colorBanner}, ${colorBanner}dd)`, color: '#fff', borderRadius: 18, padding: '10px 18px', boxShadow: '0 8px 20px rgba(31,58,95,0.18)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, opacity: 0.85, textTransform: 'uppercase' }}>{etiquetaTotal}</div>
            <div style={{ fontSize: 'clamp(24px, 6vw, 34px)', fontWeight: 900, lineHeight: 1.1 }}>{formatear(total)}</div>
          </div>
          {imagenBanner && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagenBanner} alt="" style={{ height: 96, width: 'auto', margin: '-14px -6px -14px 0', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))' }} />
          )}
        </div>
      )}
    </div>
  );

  if (total <= 0) {
    return (
      <div style={contenedor}>
        {encabezado}
        <div style={{ padding: '30px 16px', textAlign: 'center', color: '#6e7781', fontSize: 13 }}>{mensajeVacio}</div>
      </div>
    );
  }

  // ---- Dona por grupo ----
  const tam = 260;
  const cx = tam / 2;
  const radio = 104;
  const grosor = 44;
  let acumulado = 0;

  const porciones = grupos.map((g) => {
    const proporcion = g.total / total;
    const inicio = acumulado * 2 * Math.PI - Math.PI / 2;
    acumulado += proporcion;
    const fin = acumulado * 2 * Math.PI - Math.PI / 2;
    const medio = (inicio + fin) / 2;
    const punto = (ang: number, r: number) => [cx + r * Math.cos(ang), cx + r * Math.sin(ang)];
    const [x1, y1] = punto(inicio, radio);
    const [x2, y2] = punto(fin, radio);
    const grande = fin - inicio > Math.PI ? 1 : 0;
    const completo = proporcion > 0.9999;
    const trazo = completo
      ? `M ${cx} ${cx - radio} A ${radio} ${radio} 0 1 1 ${cx - 0.01} ${cx - radio}`
      : `M ${x1} ${y1} A ${radio} ${radio} 0 ${grande} 1 ${x2} ${y2}`;
    const [lx, ly] = punto(medio, radio);
    return { g, proporcion, trazo, lx, ly };
  });

  return (
    <div style={contenedor}>
      {encabezado}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} role="img" aria-label={titulo}>
          {porciones.map(({ g, trazo }) => (
            <path key={g.id} d={trazo} fill="none" stroke={presentar(g.id).acento} strokeWidth={grosor} />
          ))}
          {porciones.map(({ g, proporcion, lx, ly }) =>
            proporcion >= 0.06 ? (
              <text key={g.id} x={lx} y={ly + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">
                {Math.round(proporcion * 100)}%
              </text>
            ) : null
          )}
          <text x={cx} y={cx - 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#6e7781">Total</text>
          <text x={cx} y={cx + 20} textAnchor="middle" fontSize="22" fontWeight="900" fill="#1f3a5f">{formatear(total)}</text>
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
        {grupos.map((g) => {
          const p = presentar(g.id);
          const porcentaje = Math.round((g.total / total) * 100);

          return (
            <div key={g.id} style={{ background: p.fondo, border: `1px solid ${p.borde}`, borderRadius: 20, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 17, color: p.acento }}>{esPT ? p.pt : p.es}</strong>
                    <span style={{ background: p.acento, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>{porcentaje}%</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 900, color: '#1f2937' }}>{formatear(g.total)}</div>
                </div>

                {p.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen} alt="" style={{ width: 96, height: 'auto', maxHeight: 96, objectFit: 'contain', flexShrink: 0 }} />
                ) : (
                  <span style={{ fontSize: 54, flexShrink: 0 }}>{p.emoji}</span>
                )}
              </div>

              <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.75)', borderRadius: 14, padding: '6px 12px' }}>
                {g.cuentas.map((c, i) => (
                  <div key={c.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid #eef2f6', fontSize: 13.5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.acento, opacity: Math.max(0.35, 1 - i * 0.15), flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, color: '#1f2937', fontWeight: 600, overflowWrap: 'anywhere' }}>{c.nombre}</span>
                    <strong style={{ color: '#1f3a5f' }}>{formatear(c.valor)}</strong>
                    <span style={{ width: 36, textAlign: 'right', color: '#6e7781', fontSize: 12 }}>{Math.round((c.valor / total) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const contenedor: React.CSSProperties = {
  background: '#fbfcfd',
  border: '1px solid #e5e7eb',
  borderRadius: 24,
  padding: 20,
};
