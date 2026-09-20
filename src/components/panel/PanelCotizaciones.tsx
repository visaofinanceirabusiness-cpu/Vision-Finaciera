'use client';

// PANEL DE COTIZACIONES — USD/ARS/BRL, actualizado una vez por día
// por el cron /api/cotizaciones/actualizar (ver lib/cotizaciones.ts).
// Muestra el valor de hoy de cada par + la variación vs. el día
// anterior, y un gráfico de evolución que se puede alternar entre
// vista diaria (últimos 30 días) y mensual (últimos 12 meses, valor
// de cierre de cada mes).

import { useEffect, useState } from 'react';
import {
  obtenerCotizacionesActuales,
  obtenerHistorialCotizacion,
  type CotizacionActual,
  type ParCotizacion,
  type PuntoCotizacion,
} from '@/lib/cotizaciones';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

const NOMBRE_PAR: Record<ParCotizacion, { es: string; pt: string }> = {
  USD_BRL: { es: 'Dólar → Real', pt: 'Dólar → Real' },
  ARS_BRL: { es: 'Peso ARS → Real', pt: 'Peso ARS → Real' },
  USD_ARS: { es: 'Dólar → Peso ARS', pt: 'Dólar → Peso ARS' },
};

// Los tres pares tienen magnitudes muy distintas (~5, ~0.005, ~1000+)
// — mostrarlos en el mismo gráfico los aplastaría, así que el
// selector solo ofrece las dos cotizaciones "contra Real" (para lo
// que se va a usar: valuar caja en moneda extranjera) y cada una se
// grafica sola, con su propia escala.
const PARES_GRAFICABLES: ParCotizacion[] = ['USD_BRL', 'ARS_BRL'];

function formatearValor(valor: number): string {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: valor < 1 ? 4 : 2,
    maximumFractionDigits: valor < 1 ? 4 : 2,
  });
}

export function PanelCotizaciones({ idioma, colores }: { idioma: string; colores: Colores }) {
  const esPT = idioma === 'PT';

  const [actuales, setActuales] = useState<CotizacionActual[]>([]);
  const [parGrafico, setParGrafico] = useState<ParCotizacion>('USD_BRL');
  const [granularidad, setGranularidad] = useState<'dia' | 'mes'>('dia');
  const [historial, setHistorial] = useState<PuntoCotizacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerCotizacionesActuales()
      .then(setActuales)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando cotizaciones.'))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    obtenerHistorialCotizacion(parGrafico, granularidad, granularidad === 'dia' ? 30 : 12)
      .then(setHistorial)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando el historial.'));
  }, [parGrafico, granularidad]);

  return (
    <div>
      <div style={{ marginBottom: 5, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde }}>
        {esPT ? 'COTAÇÕES' : 'COTIZACIONES'}
      </div>
      <h2 style={{ margin: 0, color: colores.azul, fontSize: 23 }}>💱 {esPT ? 'Cotações' : 'Cotizaciones'}</h2>

      {cargando ? (
        <p style={{ fontSize: 13, color: '#6e7781', marginTop: 14 }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
      ) : actuales.length === 0 ? (
        <p style={{ fontSize: 12.5, color: '#6e7781', marginTop: 14 }}>
          {esPT
            ? 'Ainda não hay nenhuma cotação carregada — a primeira vai aparecer depois da próxima atualização diária.'
            : 'Todavía no hay ninguna cotización cargada — la primera va a aparecer después de la próxima actualización diaria.'}
        </p>
      ) : (
        <ContenidoCotizaciones
          actuales={actuales}
          historial={historial}
          parGrafico={parGrafico}
          setParGrafico={setParGrafico}
          granularidad={granularidad}
          setGranularidad={setGranularidad}
          colores={colores}
          esPT={esPT}
        />
      )}

      {error && (
        <div style={{ fontSize: 12.5, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', margin: '14px 0' }}>
          {error}
        </div>
      )}
    </div>
  );
}

function ContenidoCotizaciones({
  actuales,
  historial,
  parGrafico,
  setParGrafico,
  granularidad,
  setGranularidad,
  colores,
  esPT,
}: {
  actuales: CotizacionActual[];
  historial: PuntoCotizacion[];
  parGrafico: ParCotizacion;
  setParGrafico: (par: ParCotizacion) => void;
  granularidad: 'dia' | 'mes';
  setGranularidad: (g: 'dia' | 'mes') => void;
  colores: Colores;
  esPT: boolean;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {actuales.map((cotizacion) => (
          <div
            key={cotizacion.par}
            style={{
              flex: '1 1 200px',
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6e7781' }}>
              {esPT ? NOMBRE_PAR[cotizacion.par].pt : NOMBRE_PAR[cotizacion.par].es}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <strong style={{ fontSize: 20, color: colores.azul }}>{formatearValor(cotizacion.valor)}</strong>
              {cotizacion.variacionPorcentual !== null && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: cotizacion.variacionPorcentual >= 0 ? '#16a34a' : '#dc2626',
                  }}
                >
                  {cotizacion.variacionPorcentual >= 0 ? '↑' : '↓'} {Math.abs(cotizacion.variacionPorcentual).toFixed(2)}%
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {esPT ? 'Atualizado em' : 'Actualizado el'} {cotizacion.fecha}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {PARES_GRAFICABLES.map((par) => (
            <BotonToggle key={par} activo={parGrafico === par} onClick={() => setParGrafico(par)} colores={colores}>
              {esPT ? NOMBRE_PAR[par].pt : NOMBRE_PAR[par].es}
            </BotonToggle>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <BotonToggle activo={granularidad === 'dia'} onClick={() => setGranularidad('dia')} colores={colores}>
            {esPT ? 'Dia' : 'Día'}
          </BotonToggle>
          <BotonToggle activo={granularidad === 'mes'} onClick={() => setGranularidad('mes')} colores={colores}>
            {esPT ? 'Mês' : 'Mes'}
          </BotonToggle>
        </div>
      </div>

      {historial.length < 2 ? (
        <p style={{ fontSize: 12.5, color: '#6e7781' }}>
          {esPT ? 'Ainda não hay histórico suficiente para o gráfico.' : 'Todavía no hay suficiente historial para el gráfico.'}
        </p>
      ) : (
        <GraficoEvolucionCotizacion puntos={historial} color={colores.verde} granularidad={granularidad} />
      )}
    </div>
  );
}

function BotonToggle({
  activo,
  onClick,
  colores,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  colores: Colores;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${activo ? colores.azul : '#d1d5db'}`,
        background: activo ? colores.azul : 'transparent',
        color: activo ? '#fff' : colores.azul,
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function GraficoEvolucionCotizacion({
  puntos,
  color,
  granularidad,
}: {
  puntos: PuntoCotizacion[];
  color: string;
  granularidad: 'dia' | 'mes';
}) {
  const ancho = 900;
  const alto = 220;
  const margenIzq = 50;
  const margenDer = 16;
  const margenSup = 16;
  const margenInf = 30;

  const valores = puntos.map((p) => p.valor);
  const maxValor = Math.max(...valores);
  const minValor = Math.min(...valores);
  const rango = maxValor - minValor || maxValor || 1;

  const anchoUtil = ancho - margenIzq - margenDer;
  const altoUtil = alto - margenSup - margenInf;

  function coordenadas(indice: number, valor: number) {
    const x = puntos.length > 1 ? margenIzq + (indice / (puntos.length - 1)) * anchoUtil : margenIzq + anchoUtil / 2;
    const y = margenSup + altoUtil - ((valor - minValor) / rango) * altoUtil;
    return { x, y };
  }

  const linea = puntos
    .map((p, i) => {
      const { x, y } = coordenadas(i, p.valor);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Etiquetas del eje X: no todas (se pisarían) — como mucho 6,
  // repartidas parejo a lo largo del recorrido.
  const cadaCuanto = Math.max(1, Math.ceil(puntos.length / 6));

  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 220, display: 'block' }}>
      {[0, 0.5, 1].map((factor) => {
        const y = margenSup + altoUtil - factor * altoUtil;
        const valor = minValor + factor * rango;
        return (
          <g key={factor}>
            <line x1={margenIzq} x2={ancho - margenDer} y1={y} y2={y} stroke="#eef2f6" strokeWidth="1" />
            <text x={margenIzq - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
              {formatearValor(valor)}
            </text>
          </g>
        );
      })}

      <path d={linea} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {puntos.map((p, i) => {
        const { x, y } = coordenadas(i, p.valor);
        const mostrarEtiqueta = i % cadaCuanto === 0 || i === puntos.length - 1;

        return (
          <g key={p.fecha}>
            <circle cx={x} cy={y} r="3.5" fill={color} />
            {mostrarEtiqueta && (
              <text x={x} y={alto - 8} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#6e7781">
                {granularidad === 'mes' ? p.fecha.slice(0, 7) : p.fecha.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
