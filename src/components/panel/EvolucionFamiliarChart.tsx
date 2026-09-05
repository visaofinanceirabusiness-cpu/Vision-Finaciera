'use client';

import { ChartCard } from './ChartCard';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioCharts } from './i18nCharts';

type PuntoMesFamiliar = {
  mes: string;
  clave: string; // "YYYY-MM"
  ingresos: number;
  gastos: number;
};

// Ver LucroChart.tsx: ubica cada punto según la distancia real en
// meses entre el primero y el último, no por índice.
function claveANumeroDeMes(clave: string): number {
  const [anio, mes] = clave.split('-').map(Number);
  return anio * 12 + (mes - 1);
}

// GRÁFICO EVOLUCIÓN FAMILIAR — Ingresos, Gastos y Ahorro
// =====================================================
//
// A diferencia de LucroChart (pensado para negocios, donde se asume
// Ingresos > Gastos y el "Lucro" se etiqueta pegado a la línea de
// Ingresos), acá una familia puede gastar más de lo que ingresa
// algunos meses. Por eso cada línea tiene SU PROPIA etiqueta en SU
// PROPIO punto (nunca la de otra serie), y se agrega una línea de
// referencia en $0 para que un Ahorro negativo (déficit) se entienda
// de un vistazo.

const COLOR_INGRESOS = '#2e8b57';
const COLOR_GASTOS = '#dc2626';
const COLOR_AHORRO = '#1f3a5f';
const COLOR_DEFICIT = '#dc2626';

export function EvolucionFamiliarChart({ datos, simbolo = 'R$', idioma = 'ES' }: { datos: PuntoMesFamiliar[]; simbolo?: string; idioma?: string }) {
  const t = crearTraductor(diccionarioCharts, idioma);
  const locale = idioma === 'PT' ? 'pt-BR' : 'es-AR';
  const ancho = 1180;
  const alto = 340;

  const margenIzq = 30;
  const margenDer = 30;
  const margenSup = 60;
  const margenInf = 55;

  const conAhorro = datos.map((dato) => ({ ...dato, ahorro: dato.ingresos - dato.gastos }));

  const todosLosValores = conAhorro.flatMap((dato) => [dato.ingresos, dato.gastos, dato.ahorro]);
  const maxValor = Math.max(...todosLosValores, 1);
  const minValor = Math.min(...todosLosValores, 0);

  const anchoUtil = ancho - margenIzq - margenDer;
  const altoUtil = alto - margenSup - margenInf;

  const rango = maxValor - minValor || 1;

  const numerosDeMes = conAhorro.map((dato) => claveANumeroDeMes(dato.clave));
  const numeroMin = numerosDeMes.length > 0 ? Math.min(...numerosDeMes) : 0;
  const numeroMax = numerosDeMes.length > 0 ? Math.max(...numerosDeMes) : 0;
  const rangoMeses = numeroMax - numeroMin;

  function posicionX(indice: number) {
    if (rangoMeses === 0) {
      return margenIzq + anchoUtil / 2;
    }

    return margenIzq + ((numerosDeMes[indice] - numeroMin) / rangoMeses) * anchoUtil;
  }

  function coordenadas(valor: number, indice: number) {
    const x = posicionX(indice);
    const y = margenSup + altoUtil - ((valor - minValor) / rango) * altoUtil;
    return { x, y };
  }

  const yCero = coordenadas(0, 0).y;

  function trazarLinea(serie: (dato: (typeof conAhorro)[number]) => number) {
    return conAhorro
      .map((dato, indice) => {
        const { x, y } = coordenadas(serie(dato), indice);
        return `${indice === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }

  return (
    <ChartCard titulo={t('tituloEvolucionFamiliar')} subtitulo={t('subtituloEvolucionFamiliar')}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <Referencia color={COLOR_INGRESOS} etiqueta={t('ingresos')} />
        <Referencia color={COLOR_GASTOS} etiqueta={t('gastos')} />
        <Referencia color={COLOR_AHORRO} etiqueta={t('ahorro')} />
      </div>

      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 340, display: 'block' }}>
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

        {/* Línea de referencia en $0 — si el Ahorro cae por debajo, acá está el piso. */}
        {minValor < 0 && (
          <line
            x1={margenIzq}
            x2={ancho - margenDer}
            y1={yCero}
            y2={yCero}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
        )}

        <path d={trazarLinea((d) => d.gastos)} fill="none" stroke={COLOR_GASTOS} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <path d={trazarLinea((d) => d.ingresos)} fill="none" stroke={COLOR_INGRESOS} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <path d={trazarLinea((d) => d.ahorro)} fill="none" stroke={COLOR_AHORRO} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        {conAhorro.map((dato, indice) => {
          const puntoIngresos = coordenadas(dato.ingresos, indice);
          const puntoGastos = coordenadas(dato.gastos, indice);
          const puntoAhorro = coordenadas(dato.ahorro, indice);

          const colorAhorro = dato.ahorro >= 0 ? COLOR_AHORRO : COLOR_DEFICIT;

          return (
            <g key={dato.mes}>
              <circle cx={puntoGastos.x} cy={puntoGastos.y} r="5" fill={COLOR_GASTOS} />
              <circle cx={puntoIngresos.x} cy={puntoIngresos.y} r="5" fill={COLOR_INGRESOS} />

              <circle
                cx={puntoAhorro.x}
                cy={puntoAhorro.y}
                r="7"
                fill={colorAhorro}
                stroke="#ffffff"
                strokeWidth="3"
              />

              <EtiquetaValor
                x={puntoIngresos.x}
                y={puntoIngresos.y - 18}
                texto={`${simbolo} ${dato.ingresos.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                color={COLOR_INGRESOS}
              />

              <EtiquetaValor
                x={puntoGastos.x}
                y={puntoGastos.y + 24}
                texto={`${simbolo} ${dato.gastos.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                color={COLOR_GASTOS}
              />

              <EtiquetaValor
                x={puntoAhorro.x}
                y={dato.ahorro >= 0 ? puntoAhorro.y - 24 : puntoAhorro.y + 24}
                texto={`${simbolo} ${dato.ahorro.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                color={colorAhorro}
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
