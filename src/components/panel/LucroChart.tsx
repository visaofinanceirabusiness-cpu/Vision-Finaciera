'use client';

import { ChartCard } from './ChartCard';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioCharts } from './i18nCharts';

type PuntoLucroMes = {
  mes: string;
  ingresos: number;
  costos: number;
  gastos: number;
};

// GRÁFICO EVOLUCIÓN DE LUCRO
// =====================================================
//
// Muestra las 3 líneas que componen el Lucro (Ingresos, Costos y
// Gastos) mes a mes, y destaca el Lucro resultante de cada mes arriba
// de la línea de Ingresos — así el emprendedor ve de un vistazo de
// dónde sale ese número.

const COLOR_INGRESOS = '#2e8b57';
const COLOR_COSTOS = '#f59e0b';
const COLOR_GASTOS = '#dc2626';

export function LucroChart({
  datos,
  simbolo = 'R$',
  idioma = 'ES',
  titulo,
  subtitulo,
  mostrarCostos = true,
}: {
  datos: PuntoLucroMes[];
  simbolo?: string;
  idioma?: string;
  titulo?: string;
  subtitulo?: string;
  mostrarCostos?: boolean;
}) {
  const t = crearTraductor(diccionarioCharts, idioma);
  const tituloFinal = titulo ?? t('tituloLucro');
  const subtituloFinal = subtitulo ?? t('subtituloLucro');
  const locale = idioma === 'PT' ? 'pt-BR' : 'es-AR';

  // Ancho grande a propósito: este gráfico ahora ocupa todo el ancho
  // de la pantalla y puede mostrar 12 meses o más sin apretarse.
  const ancho = 1180;
  const alto = 320;

  const margenIzq = 30;
  const margenDer = 30;
  const margenSup = 60;
  const margenInf = 55;

  const maxValor = Math.max(
    ...datos.flatMap((dato) => (mostrarCostos ? [dato.ingresos, dato.costos, dato.gastos] : [dato.ingresos, dato.gastos])),
    1
  );

  const anchoUtil = ancho - margenIzq - margenDer;
  const altoUtil = alto - margenSup - margenInf;

  const pasoX = datos.length > 1 ? anchoUtil / (datos.length - 1) : anchoUtil;

  function coordenadas(valor: number, indice: number) {
    const x = margenIzq + indice * pasoX;
    const y = margenSup + altoUtil - (valor / maxValor) * altoUtil;
    return { x, y };
  }

  function trazarLinea(serie: (dato: PuntoLucroMes) => number) {
    return datos
      .map((dato, indice) => {
        const { x, y } = coordenadas(serie(dato), indice);
        return `${indice === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }

  return (
    <ChartCard titulo={tituloFinal} subtitulo={subtituloFinal}>
      {/* Referencias de color */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <Referencia color={COLOR_INGRESOS} etiqueta={t('ingresos')} />
        {mostrarCostos && <Referencia color={COLOR_COSTOS} etiqueta={t('costos')} />}
        <Referencia color={COLOR_GASTOS} etiqueta={t('gastos')} />
      </div>

      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 320, display: 'block' }}>
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

        <path d={trazarLinea((d) => d.gastos)} fill="none" stroke={COLOR_GASTOS} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        {mostrarCostos && (
          <path d={trazarLinea((d) => d.costos)} fill="none" stroke={COLOR_COSTOS} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        )}
        <path d={trazarLinea((d) => d.ingresos)} fill="none" stroke={COLOR_INGRESOS} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        {datos.map((dato, indice) => {
          const puntoIngresos = coordenadas(dato.ingresos, indice);
          const puntoCostos = coordenadas(dato.costos, indice);
          const puntoGastos = coordenadas(dato.gastos, indice);

          const lucro = dato.ingresos - dato.costos - dato.gastos;

          return (
            <g key={dato.mes}>
              <circle cx={puntoGastos.x} cy={puntoGastos.y} r="5" fill={COLOR_GASTOS} />
              {mostrarCostos && <circle cx={puntoCostos.x} cy={puntoCostos.y} r="5" fill={COLOR_COSTOS} />}

              <circle
                cx={puntoIngresos.x}
                cy={puntoIngresos.y}
                r="7"
                fill={COLOR_INGRESOS}
                stroke="#ffffff"
                strokeWidth="3"
              />

              {/* Valor de Costos, separado de su punto y con fondo propio
                  para no perderse contra la línea ni contra Gastos */}
              {mostrarCostos && (
                <EtiquetaValor
                  x={puntoCostos.x}
                  y={puntoCostos.y - 18}
                  texto={`${simbolo} ${dato.costos.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                  color={COLOR_COSTOS}
                />
              )}

              {/* Valor de Gastos, separado hacia abajo */}
              <EtiquetaValor
                x={puntoGastos.x}
                y={puntoGastos.y + 26}
                texto={`${simbolo} ${dato.gastos.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                color={COLOR_GASTOS}
              />

              {/* Resultado del mes — el número protagonista, arriba de todo */}
              <EtiquetaValor
                x={puntoIngresos.x}
                y={Math.max(22, puntoIngresos.y - 22)}
                texto={`${simbolo} ${lucro.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                color={lucro >= 0 ? COLOR_INGRESOS : COLOR_GASTOS}
                grande
              />

              <text x={puntoIngresos.x} y={alto - 18} textAnchor="middle" fontSize="15" fontWeight="700" fill="#6e7781">
                {dato.mes}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

// Etiqueta de valor con fondo propio, para que no se pierda cuando dos
// líneas quedan cerca una de la otra (ej. Costos y Gastos casi iguales).
function EtiquetaValor({
  x,
  y,
  texto,
  color,
  grande = false,
}: {
  x: number;
  y: number;
  texto: string;
  color: string;
  grande?: boolean;
}) {
  const fontSize = grande ? 16 : 12;
  const anchoFondo = texto.length * (grande ? 8.5 : 6.6) + 10;
  const altoFondo = grande ? 22 : 17;

  return (
    <g>
      <rect
        x={x - anchoFondo / 2}
        y={y - altoFondo + 5}
        width={anchoFondo}
        height={altoFondo}
        rx={altoFondo / 2}
        fill="#ffffff"
        opacity={0.92}
      />

      <text x={x} y={y} textAnchor="middle" fontSize={fontSize} fontWeight="800" fill={color}>
        {texto}
      </text>
    </g>
  );
}

function Referencia({ color, etiqueta }: { color: string; etiqueta: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{etiqueta}</span>
    </div>
  );
}
