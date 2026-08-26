'use client';

import { ChartCard } from './ChartCard';

type DatosVentaMes = { mes: string; valor: number };

// GRÁFICO VENTAS
// =====================================================

function GraficoVentas({
  datos,
  color,
  colorSecundario,
}: {
  datos: DatosVentaMes[];
  color: string;
  colorSecundario: string;
}) {
  const ancho =
    520;

  const alto =
    270;

  const margenIzq =
    70;

  const margenDer =
    20;

  const margenSup =
    32;

  const margenInf =
    55;

  const maxValor =
    Math.max(
      ...datos.map(
        (dato) =>
          dato.valor
      ),
      1
    );

  const anchoUtil =
    ancho -
    margenIzq -
    margenDer;

  const altoUtil =
    alto -
    margenSup -
    margenInf;

  const pasoX =
    datos.length > 1
      ? anchoUtil /
        (datos.length -
          1)
      : anchoUtil;

  const puntos =
    datos.map(
      (
        dato,
        indice
      ) => {
        const x =
          margenIzq +
          indice *
            pasoX;

        const y =
          margenSup +
          altoUtil -
          (dato.valor /
            maxValor) *
            altoUtil;

        return {
          ...dato,
          x,
          y,
        };
      }
    );

  const linea =
    puntos
      .map(
        (
          punto,
          indice
        ) =>
          `${
            indice ===
            0
              ? 'M'
              : 'L'
          } ${punto.x} ${punto.y}`
      )
      .join(' ');

  return (
    <ChartCard
      titulo="Evolución de ventas"
      subtitulo="Tendencia mensual"
    >
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{
          width:
            '100%',
          height:
            270,
          display:
            'block',
        }}
      >
        {[
          0,
          0.25,
          0.5,
          0.75,
          1,
        ].map(
          (factor) => {
            const y =
              margenSup +
              altoUtil -
              factor *
                altoUtil;

            const valor =
              Math.round(
                maxValor *
                  factor
              );

            return (
              <g
                key={
                  factor
                }
              >
                <line
                  x1={
                    margenIzq
                  }
                  x2={
                    ancho -
                    margenDer
                  }
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />

                <text
                  x={
                    margenIzq -
                    10
                  }
                  y={
                    y + 5
                  }
                  textAnchor="end"
                  fontSize="14"
                  fill="#6e7781"
                >
                  R$
                  {
                    valor
                  }
                </text>
              </g>
            );
          }
        )}

        <path
          d={linea}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {puntos.map(
          (punto) => (
            <g
              key={
                punto.mes
              }
            >
              <circle
                cx={punto.x}
                cy={punto.y}
                r="7"
                fill={
                  colorSecundario
                }
                stroke="#ffffff"
                strokeWidth="3"
              />

              <text
                x={punto.x}
                y={
                  punto.y -
                  14
                }
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#1f3a5f"
              >
                R$
                {
                  punto.valor
                }
              </text>

              <text
                x={punto.x}
                y={
                  alto -
                  18
                }
                textAnchor="middle"
                fontSize="14"
                fontWeight="600"
                fill="#6e7781"
              >
                {
                  punto.mes
                }
              </text>
            </g>
          )
        )}
      </svg>
    </ChartCard>
  );
}

// =====================================================
