'use client';

import { ChartCard } from './ChartCard';

type DatosCategoria = {
  nombre: string;
  valor: number;
};

// GRÁFICO CATEGORÍAS
// =====================================================

export function CategoryChart({
  datos,
  color,
}: {
  datos: DatosCategoria[];
  color: string;
}) {
  const ancho = 520;
  const alto = 270;

  const margenIzq = 70;
  const margenDer = 16;
  const margenSup = 30;
  const margenInf = 62;

  const maxValor = Math.max(
    ...datos.map(
      (dato) => dato.valor
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

  const anchoBarra =
    anchoUtil /
    datos.length;

  return (
    <ChartCard
      titulo="Ventas por categoría"
      subtitulo="Distribución comercial"
    >
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{
          width: '100%',
          height: 270,
          display: 'block',
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
                key={factor}
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
                  y={y + 5}
                  textAnchor="end"
                  fontSize="14"
                  fill="#6e7781"
                >
                  R${valor}
                </text>
              </g>
            );
          }
        )}

        {datos.map(
          (
            dato,
            indice
          ) => {
            const altura =
              (dato.valor /
                maxValor) *
              altoUtil;

            const x =
              margenIzq +
              indice *
                anchoBarra +
              anchoBarra *
                0.20;

            const y =
              margenSup +
              altoUtil -
              altura;

            const anchoReal =
              anchoBarra *
              0.60;

            return (
              <g
                key={
                  dato.nombre
                }
              >
                <rect
                  x={x}
                  y={y}
                  width={
                    anchoReal
                  }
                  height={
                    altura
                  }
                  rx="9"
                  fill={color}
                  opacity={
                    0.76 +
                    indice *
                      0.05
                  }
                />

                <text
                  x={
                    x +
                    anchoReal /
                      2
                  }
                  y={
                    y - 10
                  }
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="800"
                  fill="#1f3a5f"
                >
                  R${dato.valor}
                </text>

                <text
                  x={
                    x +
                    anchoReal /
                      2
                  }
                  y={
                    alto - 23
                  }
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill="#6e7781"
                >
                  {
                    dato.nombre
                  }
                </text>
              </g>
            );
          }
        )}
      </svg>
    </ChartCard>
  );
}

// =====================================================
