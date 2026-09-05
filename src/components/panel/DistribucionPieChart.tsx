'use client';

import { ChartCard } from './ChartCard';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioCharts } from './i18nCharts';

type DatosCategoria = {
  nombre: string;
  valor: number;
};

// GRÁFICO DE TORTA — DISTRIBUCIÓN (gastos por categoría, ingresos por
// socio, etc.)
// =====================================================
//
// A diferencia de CategoryChart (barras, pensado para ventas por
// categoría), acá interesa ver de un vistazo qué proporción del total
// se lleva cada parte — para eso una torta comunica mejor que barras.
// Genérico a propósito: hoy lo usan "Distribución de gastos" y
// "Distribución de ingresos" del perfil Familia, con los mismos datos
// (nombre + valor) pero distinto título/mensaje.

const PALETA = ['#dc2626', '#f59e0b', '#0ea5e9', '#a855f7', '#16a34a', '#ec4899', '#6366f1', '#0d9488'];

export function DistribucionPieChart({
  datos,
  simbolo = 'R$',
  idioma = 'ES',
  titulo = '🧾 Distribución de gastos',
  subtitulo = 'En qué se fue la plata este período',
  mensajeVacio = 'Todavía no hay datos registrados en este período.',
  grande = false,
}: {
  datos: DatosCategoria[];
  simbolo?: string;
  idioma?: string;
  titulo?: string;
  subtitulo?: string;
  mensajeVacio?: string;
  // Versión grande: a todo el ancho disponible, pensada para ocupar
  // una fila propia (apilada) en vez de compartir grilla con otras
  // tarjetas chicas.
  grande?: boolean;
}) {
  const t = crearTraductor(diccionarioCharts, idioma);
  const locale = idioma === 'PT' ? 'pt-BR' : 'es-AR';
  const total = datos.reduce((suma, dato) => suma + Math.max(dato.valor, 0), 0);

  if (total <= 0) {
    return (
      <ChartCard titulo={titulo} subtitulo={subtitulo}>
        <div
          style={{
            padding: '40px 16px',
            textAlign: 'center',
            color: '#6e7781',
            fontSize: 13,
          }}
        >
          {mensajeVacio}
        </div>
      </ChartCard>
    );
  }

  const tamano = grande ? 340 : 220;
  const cx = tamano / 2;
  const cy = tamano / 2;
  const radio = tamano / 2 - 20;

  let acumulado = 0;

  const porciones = datos
    .filter((dato) => dato.valor > 0)
    .map((dato, indice) => {
      const proporcion = dato.valor / total;
      const anguloInicio = acumulado * 2 * Math.PI;
      acumulado += proporcion;
      const anguloFin = acumulado * 2 * Math.PI;

      const x1 = cx + radio * Math.sin(anguloInicio);
      const y1 = cy - radio * Math.cos(anguloInicio);
      const x2 = cx + radio * Math.sin(anguloFin);
      const y2 = cy - radio * Math.cos(anguloFin);

      const arcoGrande = anguloFin - anguloInicio > Math.PI ? 1 : 0;
      const color = PALETA[indice % PALETA.length];

      const path =
        proporcion >= 0.999
          ? `M ${cx} ${cy - radio} A ${radio} ${radio} 0 1 1 ${cx - 0.01} ${cy - radio} Z`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${radio} ${radio} 0 ${arcoGrande} 1 ${x2} ${y2} Z`;

      return { ...dato, proporcion, color, path };
    });

  return (
    <ChartCard titulo={titulo} subtitulo={subtitulo}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: grande ? 40 : 24,
          flexWrap: 'wrap',
          justifyContent: grande ? 'center' : undefined,
        }}
      >
        <svg
          viewBox={`0 0 ${tamano} ${tamano}`}
          style={{ width: grande ? '100%' : tamano, maxWidth: tamano, height: 'auto', flexShrink: 0 }}
        >
          {porciones.map((porcion) => (
            <path key={porcion.nombre} d={porcion.path} fill={porcion.color} stroke="#ffffff" strokeWidth={grande ? 3 : 2} />
          ))}

          <circle cx={cx} cy={cy} r={radio * 0.55} fill="#ffffff" />

          <text x={cx} y={cy - (grande ? 10 : 6)} textAnchor="middle" fontSize={grande ? 16 : 12} fontWeight="700" fill="#6e7781">
            {t('total')}
          </text>

          <text x={cx} y={cy + (grande ? 22 : 16)} textAnchor="middle" fontSize={grande ? 26 : 17} fontWeight="800" fill="#1f3a5f">
            {simbolo}{total.toLocaleString(locale, { maximumFractionDigits: 0 })}
          </text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: grande ? 14 : 10, flex: 1, minWidth: 260, maxWidth: grande ? 480 : undefined }}>
          {porciones.map((porcion) => (
            <div key={porcion.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: grande ? 16 : 12,
                  height: grande ? 16 : 12,
                  borderRadius: '50%',
                  background: porcion.color,
                  flexShrink: 0,
                }}
              />

              <span style={{ fontSize: grande ? 15 : 13, fontWeight: 700, color: '#374151', flex: 1 }}>{porcion.nombre}</span>

              <span style={{ fontSize: grande ? 15 : 13, fontWeight: 800, color: '#1f3a5f' }}>
                {simbolo}{porcion.valor.toLocaleString(locale, { maximumFractionDigits: 0 })}
              </span>

              <span style={{ fontSize: grande ? 13 : 12, color: '#6e7781', minWidth: 44, textAlign: 'right' }}>
                {(porcion.proporcion * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
