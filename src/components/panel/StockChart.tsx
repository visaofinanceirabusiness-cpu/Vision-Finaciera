'use client';

import { ChartCard } from './ChartCard';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioCharts } from './i18nCharts';

type DatosCategoria = {
  nombre: string;
  valor: number;
};

// GRÁFICO STOCK
// =====================================================
//
// "valor" acá son UNIDADES de stock, no un porcentaje — el gráfico
// anterior asumía por error que ya venía en % (0-100), por eso las
// porciones no cerraban un círculo y la leyenda mostraba números como
// "129%". Ahora se calcula el porcentaje acá adentro, sobre el total
// real de unidades.

const PALETA = ['#f59e0b', '#0ea5e9', '#a855f7', '#16a34a', '#ec4899', '#6366f1'];

export function StockChart({ datos, color, idioma = 'ES' }: { datos: DatosCategoria[]; color: string; idioma?: string }) {
  const t = crearTraductor(diccionarioCharts, idioma);
  const radio = 78;

  const centroX = 150;
  const centroY = 135;

  const paleta = [color, ...PALETA];

  const totalUnidades = datos.reduce((suma, dato) => suma + Math.max(dato.valor, 0), 0);

  let anguloActual = -Math.PI / 2;

  const segmentos = datos.map((dato, indice) => {
    const porcentaje = totalUnidades > 0 ? (Math.max(dato.valor, 0) / totalUnidades) * 100 : 0;

    const inicio = anguloActual;
    const barrido = (porcentaje / 100) * Math.PI * 2;
    const fin = inicio + barrido;

    anguloActual = fin;

    const x1 = centroX + radio * Math.cos(inicio);
    const y1 = centroY + radio * Math.sin(inicio);
    const x2 = centroX + radio * Math.cos(fin);
    const y2 = centroY + radio * Math.sin(fin);

    const grande = barrido > Math.PI ? 1 : 0;

    const path =
      porcentaje >= 100
        ? [
            `M ${centroX - radio} ${centroY}`,
            `A ${radio} ${radio} 0 1 1 ${centroX + radio} ${centroY}`,
            `A ${radio} ${radio} 0 1 1 ${centroX - radio} ${centroY}`,
            'Z',
          ].join(' ')
        : [`M ${centroX} ${centroY}`, `L ${x1} ${y1}`, `A ${radio} ${radio} 0 ${grande} 1 ${x2} ${y2}`, 'Z'].join(
            ' '
          );

    return {
      ...dato,
      porcentaje,
      path,
      color: paleta[indice % paleta.length],
    };
  });

  return (
    <ChartCard titulo={t('tituloStock')} subtitulo={t('subtituloStock')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, minHeight: 270 }}>
        <svg viewBox="0 0 305 270" style={{ width: '58%', maxWidth: 305, height: 260 }}>
          {segmentos.map((segmento) => (
            <path
              key={segmento.nombre}
              d={segmento.path}
              fill={segmento.color}
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          <circle cx={centroX} cy={centroY} r="44" fill="#ffffff" />

          <text x={centroX} y={centroY + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#1f3a5f">
            {t('stock')}
          </text>
        </svg>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {segmentos.map((segmento) => (
            <div key={segmento.nombre} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  background: segmento.color,
                  flexShrink: 0,
                }}
              />

              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.3 }}>
                <strong style={{ color: '#1f3a5f', fontSize: 14 }}>{segmento.nombre}</strong>

                <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700 }}>
                  {segmento.porcentaje.toFixed(0)}%
                </div>
              </div>
            </div>
          ))}

          {!segmentos.length && (
            <div style={{ fontSize: 13, color: '#6e7781' }}>{t('sinStock')}</div>
          )}
        </div>
      </div>
    </ChartCard>
  );
}
