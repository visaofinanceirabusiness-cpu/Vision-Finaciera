'use client';

import { ChartCard } from './ChartCard';

type DatosCategoria = {
  nombre: string;
  valor: number;
};

// GRÁFICO STOCK
// =====================================================

export function StockChart({
  datos,
  color,
}: {
  datos: DatosCategoria[];
  color: string;
}) {
  const radio = 70;

  const centroX = 150;
  const centroY = 135;

  let anguloActual =
    -Math.PI / 2;

  const coloresSegmentos = [
    color,
    '#f59e0b',
    '#2e8b57',
    '#6e7781',
  ];

  const segmentos =
    datos.map(
      (
        dato,
        indice
      ) => {
        const inicio =
          anguloActual;

        const barrido =
          (dato.valor /
            100) *
          Math.PI *
          2;

        const fin =
          inicio +
          barrido;

        anguloActual =
          fin;

        const x1 =
          centroX +
          radio *
            Math.cos(
              inicio
            );

        const y1 =
          centroY +
          radio *
            Math.sin(
              inicio
            );

        const x2 =
          centroX +
          radio *
            Math.cos(
              fin
            );

        const y2 =
          centroY +
          radio *
            Math.sin(
              fin
            );

        const grande =
          barrido >
          Math.PI
            ? 1
            : 0;

        const path = [
          `M ${centroX} ${centroY}`,
          `L ${x1} ${y1}`,
          `A ${radio} ${radio} 0 ${grande} 1 ${x2} ${y2}`,
          'Z',
        ].join(' ');

        return {
          ...dato,
          path,
          color:
            coloresSegmentos[
              indice %
                coloresSegmentos.length
            ],
        };
      }
    );

  return (
    <ChartCard
      titulo="Composición del stock"
      subtitulo="Participación por categoría"
    >
      <div
        style={{
          display: 'flex',
          alignItems:
            'center',
          gap: 20,
          minHeight: 270,
        }}
      >
        <svg
          viewBox="0 0 305 270"
          style={{
            width: '58%',
            maxWidth: 305,
            height: 260,
          }}
        >
          {segmentos.map(
            (segmento) => (
              <path
                key={
                  segmento.nombre
                }
                d={
                  segmento.path
                }
                fill={
                  segmento.color
                }
                stroke="#ffffff"
                strokeWidth="2"
              />
            )
          )}

          <circle
            cx={centroX}
            cy={centroY}
            r="40"
            fill="#ffffff"
          />

          <text
            x={centroX}
            y={
              centroY + 5
            }
            textAnchor="middle"
            fontSize="15"
            fontWeight="800"
            fill="#1f3a5f"
          >
            STOCK
          </text>
        </svg>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection:
              'column',
            gap: 12,
          }}
        >
          {datos.map(
            (
              dato,
              indice
            ) => (
              <div
                key={
                  dato.nombre
                }
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap: 9,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius:
                      '50%',
                    background:
                      coloresSegmentos[
                        indice %
                          coloresSegmentos.length
                      ],
                    flexShrink: 0,
                  }}
                />

                <div
                  style={{
                    fontSize: 12,
                    color:
                      '#475569',
                    lineHeight:
                      1.25,
                  }}
                >
                  <strong
                    style={{
                      color:
                        '#1f3a5f',
                      fontSize: 13,
                    }}
                  >
                    {
                      dato.nombre
                    }
                  </strong>

                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                    }}
                  >
                    {
                      dato.valor
                    }%
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </ChartCard>
  );
}

// =====================================================
