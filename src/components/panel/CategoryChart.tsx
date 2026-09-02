'use client';

import { ChartCard } from './ChartCard';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioCharts } from './i18nCharts';

type DatosCategoria = {
  nombre: string;
  valor: number;
};

// GRÁFICO CATEGORÍAS
// =====================================================

const PALETA = ['#f59e0b', '#0ea5e9', '#a855f7', '#16a34a', '#ec4899', '#6366f1'];

export function CategoryChart({
  datos,
  color,
  simbolo = 'R$',
  idioma = 'ES',
  titulo,
  subtitulo,
}: {
  datos: DatosCategoria[];
  color: string;
  simbolo?: string;
  idioma?: string;
  titulo?: string;
  subtitulo?: string;
}) {
  const t = crearTraductor(diccionarioCharts, idioma);
  const tituloFinal = titulo ?? t('tituloVentasCategoria');
  const subtituloFinal = subtitulo ?? t('subtituloVentasCategoria');
  const locale = idioma === 'PT' ? 'pt-BR' : 'es-AR';
  const ancho = 520;
  const alto = 270;

  const margenIzq = 16;
  const margenDer = 16;
  const margenSup = 40;
  const margenInf = 66;

  const maxValor = Math.max(...datos.map((dato) => dato.valor), 1);

  const anchoUtil = ancho - margenIzq - margenDer;
  const altoUtil = alto - margenSup - margenInf;

  const anchoBarra = anchoUtil / Math.max(datos.length, 1);

  const paleta = [color, ...PALETA];

  return (
    <ChartCard titulo={tituloFinal} subtitulo={subtituloFinal}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 270, display: 'block' }}>
        {/* Líneas de referencia horizontales, sin números */}
        {[0, 0.25, 0.5, 0.75, 1].map((factor) => {
          const y = margenSup + altoUtil - factor * altoUtil;

          return (
            <line
              key={factor}
              x1={margenIzq}
              x2={ancho - margenDer}
              y1={y}
              y2={y}
              stroke="#eef2f6"
              strokeWidth="1"
            />
          );
        })}

        {datos.map((dato, indice) => {
          const altura = (dato.valor / maxValor) * altoUtil;
          const x = margenIzq + indice * anchoBarra + anchoBarra * 0.18;
          const y = margenSup + altoUtil - altura;
          const anchoReal = anchoBarra * 0.64;
          const colorBarra = paleta[indice % paleta.length];

          return (
            <g key={dato.nombre}>
              <rect x={x} y={y} width={anchoReal} height={altura} rx="10" fill={colorBarra} />

              <text
                x={x + anchoReal / 2}
                y={y - 12}
                textAnchor="middle"
                fontSize="16"
                fontWeight="800"
                fill="#1f3a5f"
              >
                {simbolo}{dato.valor.toLocaleString(locale, { maximumFractionDigits: 0 })}
              </text>

              <text
                x={x + anchoReal / 2}
                y={alto - 26}
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill="#374151"
              >
                {dato.nombre}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}
