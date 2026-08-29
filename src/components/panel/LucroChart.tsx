'use client';

import { ChartCard } from './ChartCard';

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

export function LucroChart({ datos }: { datos: PuntoLucroMes[] }) {
  const ancho = 520;
  const alto = 300;

  const margenIzq = 20;
  const margenDer = 20;
  const margenSup = 62;
  const margenInf = 55;

  const maxValor = Math.max(
    ...datos.flatMap((dato) => [dato.ingresos, dato.costos, dato.gastos]),
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
    <ChartCard titulo="📈 Evolución de Lucro" subtitulo="Ingresos, costos y gastos por mes">
      {/* Referencias de color */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <Referencia color={COLOR_INGRESOS} emoji="💵" etiqueta="Ingresos" />
        <Referencia color={COLOR_COSTOS} emoji="📦" etiqueta="Costos" />
        <Referencia color={COLOR_GASTOS} emoji="🧾" etiqueta="Gastos" />
      </div>

      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 280, display: 'block' }}>
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
        <path d={trazarLinea((d) => d.costos)} fill="none" stroke={COLOR_COSTOS} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <path d={trazarLinea((d) => d.ingresos)} fill="none" stroke={COLOR_INGRESOS} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        {datos.map((dato, indice) => {
          const puntoIngresos = coordenadas(dato.ingresos, indice);
          const puntoCostos = coordenadas(dato.costos, indice);
          const puntoGastos = coordenadas(dato.gastos, indice);

          const lucro = dato.ingresos - dato.costos - dato.gastos;

          return (
            <g key={dato.mes}>
              <circle cx={puntoGastos.x} cy={puntoGastos.y} r="5" fill={COLOR_GASTOS}>
                <title>Gastos: R$ {dato.gastos.toFixed(2)}</title>
              </circle>

              <circle cx={puntoCostos.x} cy={puntoCostos.y} r="5" fill={COLOR_COSTOS}>
                <title>Costos: R$ {dato.costos.toFixed(2)}</title>
              </circle>

              <circle cx={puntoIngresos.x} cy={puntoIngresos.y} r="7" fill={COLOR_INGRESOS} stroke="#ffffff" strokeWidth="3">
                <title>Ingresos: R$ {dato.ingresos.toFixed(2)}</title>
              </circle>

              <text
                x={puntoIngresos.x}
                y={Math.max(16, puntoIngresos.y - 16)}
                textAnchor="middle"
                fontSize="15"
                fontWeight="800"
                fill={lucro >= 0 ? COLOR_INGRESOS : COLOR_GASTOS}
              >
                R$ {lucro.toFixed(0)}
              </text>

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

function Referencia({ color, emoji, etiqueta }: { color: string; emoji: string; etiqueta: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
        {emoji} {etiqueta}
      </span>
    </div>
  );
}
