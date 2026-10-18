'use client';

import { useState } from 'react';
import { ChartCard } from './ChartCard';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioCharts } from './i18nCharts';
import { calcularEvolucion, tieneCostos, type PuntoEvolucion } from '@/lib/evolucionResultado';

type PuntoMesFamiliar = PuntoEvolucion;

type Serie = 'ingresos' | 'costos' | 'gastos' | 'resultado' | 'margenBruto';

// Ubica cada punto según la distancia real en
// meses entre el primero y el último, no por índice.
function claveANumeroDeMes(clave: string): number {
  const [anio, mes] = clave.split('-').map(Number);
  return anio * 12 + (mes - 1);
}

// GRÁFICO EVOLUCIÓN — Ingresos, Costos (si hay), Gastos y Resultado
// =====================================================
//
// Sirve a todos los perfiles (antes solo Familia; reemplazó a LucroChart, que
// asumía Ingresos > Gastos y pegaba el "Lucro" a la línea de Ingresos). Un
// hogar o un negocio pueden gastar más de lo que ingresan algunos meses, por
// eso cada línea tiene SU PROPIA etiqueta en SU PROPIO punto (nunca la de otra
// serie), y hay una línea de referencia en $0 para que un resultado negativo
// (déficit) se entienda de un vistazo.

const COLOR_INGRESOS = '#2e8b57';
const COLOR_GASTOS = '#dc2626';
const COLOR_AHORRO = '#1f3a5f';
const COLOR_COSTOS = '#ea8a1a';
const COLOR_MARGEN = '#0d9488';
const COLOR_DEFICIT = '#dc2626';

export function EvolucionFamiliarChart({ datos: todosLosDatos, simbolo = 'R$', idioma = 'ES' }: { datos: PuntoMesFamiliar[]; simbolo?: string; idioma?: string }) {
  const t = crearTraductor(diccionarioCharts, idioma);

  // Filtro por año: por defecto el año en curso (si no hay datos de ese año, el
  // último con datos). Con varios años juntos los meses quedaban muy apretados.
  const anios = Array.from(new Set(todosLosDatos.map((d) => Number(d.clave.slice(0, 4))))).sort((a, b) => a - b);
  const [anioElegido, setAnioElegido] = useState<number | 'TODOS' | null>(null);
  const anioPorDefecto = anios.includes(new Date().getFullYear()) ? new Date().getFullYear() : (anios[anios.length - 1] ?? null);
  const anioActivo = anioElegido ?? anioPorDefecto;
  const datos = anioActivo === 'TODOS' || anioActivo === null ? todosLosDatos : todosLosDatos.filter((d) => Number(d.clave.slice(0, 4)) === anioActivo);

  const locale = idioma === 'PT' ? 'pt-BR' : 'es-AR';
  const ancho = 1180;
  const alto = 340;

  const margenIzq = 30;
  const margenDer = 30;
  const margenSup = 60;
  const margenInf = 55;

  const conCostos = tieneCostos(todosLosDatos);
  // El margen bruto arranca apagado: es un dato de apoyo, no el protagonista.
  const [ocultas, setOcultas] = useState<Set<Serie>>(new Set(['margenBruto']));
  const visible = (serie: Serie) => !ocultas.has(serie);

  function alternar(serie: Serie) {
    setOcultas((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(serie)) siguiente.delete(serie);
      else siguiente.add(serie);
      return siguiente;
    });
  }

  const conAhorro = calcularEvolucion(datos).map((dato) => ({ ...dato, ahorro: dato.resultado }));

  const todosLosValores = conAhorro.flatMap((dato) => [
    ...(visible('ingresos') ? [dato.ingresos] : []),
    ...(visible('gastos') ? [dato.gastos] : []),
    ...(visible('resultado') ? [dato.ahorro] : []),
    ...(conCostos && visible('costos') ? [dato.costos] : []),
    ...(conCostos && visible('margenBruto') ? [dato.margenBruto] : []),
  ]);
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
    <ChartCard titulo={conCostos ? t('tituloEvolucionConCostos') : t('tituloEvolucionFamiliar')} subtitulo={t('subtituloEvolucionFamiliar')}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <Referencia color={COLOR_INGRESOS} etiqueta={t('ingresos')} activa={visible('ingresos')} onClick={() => alternar('ingresos')} />
        {conCostos && <Referencia color={COLOR_COSTOS} etiqueta={t('costos')} activa={visible('costos')} onClick={() => alternar('costos')} />}
        <Referencia color={COLOR_GASTOS} etiqueta={t('gastos')} activa={visible('gastos')} onClick={() => alternar('gastos')} />
        <Referencia color={COLOR_AHORRO} etiqueta={t('ahorro')} activa={visible('resultado')} onClick={() => alternar('resultado')} />
        {conCostos && <Referencia color={COLOR_MARGEN} etiqueta={t('margenBruto')} activa={visible('margenBruto')} onClick={() => alternar('margenBruto')} />}
      </div>

      {anios.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {[...anios].reverse().map((anio) => (
            <ChipAnio key={anio} activo={anioActivo === anio} onClick={() => setAnioElegido(anio)}>
              {anio}
            </ChipAnio>
          ))}
          <ChipAnio activo={anioActivo === 'TODOS'} onClick={() => setAnioElegido('TODOS')}>
            Todos
          </ChipAnio>
        </div>
      )}

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

        {/* Línea de referencia en $0 — si el Resultado cae por debajo, acá está el piso. */}
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

        {conCostos && visible('margenBruto') && (
          <path d={trazarLinea((d) => d.margenBruto)} fill="none" stroke={COLOR_MARGEN} strokeWidth="3" strokeDasharray="3 7" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        )}
        {visible('gastos') && <path d={trazarLinea((d) => d.gastos)} fill="none" stroke={COLOR_GASTOS} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />}
        {conCostos && visible('costos') && <path d={trazarLinea((d) => d.costos)} fill="none" stroke={COLOR_COSTOS} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />}
        {visible('ingresos') && <path d={trazarLinea((d) => d.ingresos)} fill="none" stroke={COLOR_INGRESOS} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />}
        {visible('resultado') && <path d={trazarLinea((d) => d.ahorro)} fill="none" stroke={COLOR_AHORRO} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}

        {conAhorro.map((dato, indice) => {
          const puntoIngresos = coordenadas(dato.ingresos, indice);
          const puntoGastos = coordenadas(dato.gastos, indice);
          const puntoAhorro = coordenadas(dato.ahorro, indice);
          const puntoCostos = coordenadas(dato.costos, indice);
          const puntoMargen = coordenadas(dato.margenBruto, indice);

          const colorAhorro = dato.ahorro >= 0 ? COLOR_AHORRO : COLOR_DEFICIT;

          return (
            <g key={dato.mes}>
              {visible('gastos') && <circle cx={puntoGastos.x} cy={puntoGastos.y} r="5" fill={COLOR_GASTOS} />}
              {visible('ingresos') && <circle cx={puntoIngresos.x} cy={puntoIngresos.y} r="5" fill={COLOR_INGRESOS} />}
              {conCostos && visible('costos') && <circle cx={puntoCostos.x} cy={puntoCostos.y} r="5" fill={COLOR_COSTOS} />}
              {conCostos && visible('margenBruto') && <circle cx={puntoMargen.x} cy={puntoMargen.y} r="5" fill={COLOR_MARGEN} />}

              {visible('resultado') && (
                <circle
                  cx={puntoAhorro.x}
                  cy={puntoAhorro.y}
                  r="7"
                  fill={colorAhorro}
                  stroke="#ffffff"
                  strokeWidth="3"
                />
              )}

              {visible('ingresos') && (
                <EtiquetaValor
                  x={puntoIngresos.x}
                  y={puntoIngresos.y - 18}
                  texto={`${simbolo} ${dato.ingresos.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                  color={COLOR_INGRESOS}
                />
              )}

              {conCostos && visible('costos') && (
                <EtiquetaValor
                  x={puntoCostos.x}
                  y={puntoCostos.y + 24}
                  texto={`${simbolo} ${dato.costos.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                  color={COLOR_COSTOS}
                />
              )}

              {conCostos && visible('margenBruto') && (
                <EtiquetaValor
                  x={puntoMargen.x}
                  y={puntoMargen.y - 18}
                  texto={`${simbolo} ${dato.margenBruto.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                  color={COLOR_MARGEN}
                />
              )}

              {visible('gastos') && (
                <EtiquetaValor
                  x={puntoGastos.x}
                  y={puntoGastos.y + 24}
                  texto={`${simbolo} ${dato.gastos.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                  color={COLOR_GASTOS}
                />
              )}

              {visible('resultado') && (
                <EtiquetaValor
                  x={puntoAhorro.x}
                  y={dato.ahorro >= 0 ? puntoAhorro.y - 24 : puntoAhorro.y + 24}
                  texto={`${simbolo} ${dato.ahorro.toLocaleString(locale, { maximumFractionDigits: 0 })}`}
                  color={colorAhorro}
                  grande
                />
              )}

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

function ChipAnio({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${activo ? COLOR_AHORRO : '#d1d5db'}`,
        background: activo ? COLOR_AHORRO : '#fff',
        color: activo ? '#fff' : '#374151',
        borderRadius: 999,
        padding: '5px 14px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Referencia({ color, etiqueta, activa, onClick }: { color: string; etiqueta: string; activa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: activa ? 1 : 0.4 }}
    >
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: activa ? color : 'transparent', border: `2px solid ${color}`, boxSizing: 'border-box', display: 'inline-block' }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textDecoration: activa ? 'none' : 'line-through' }}>{etiqueta}</span>
    </button>
  );
}
