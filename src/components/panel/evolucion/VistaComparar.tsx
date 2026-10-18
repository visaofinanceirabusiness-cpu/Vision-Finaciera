'use client';

import { useMemo, useState } from 'react';
import type { PuntoEvolucionCalculado } from '@/lib/evolucionResultado';
import { agrupar, etiquetaPeriodo, variacion, type Granularidad } from '@/lib/evolucionFinanciera';
import { AZUL, BotonFlecha, COLOR, SUBIR_ES_BUENO, Variacion, controlEstilo, useAncho, type Serie } from './compartido';

// COMPARAR — mismos períodos de años distintos, lado a lado
// =====================================================
//
// Barras agrupadas: cada grupo es un mes (o trimestre/semestre) y cada barra
// un año. Trabaja sobre TODO el historial, con sus propios años elegidos (no
// usa el rango de Tendência). El panel lateral muestra el período elegido de
// cada año y la diferencia entre el año más reciente elegido y el anterior.

type Modo = Extract<Granularidad, 'MES' | 'TRIMESTRE' | 'SEMESTRE'>;

const ALTO = 420;
const MARGEN = { izq: 86, der: 24, sup: 24, inf: 46 };

const COLORES_ANIO = ['#1d4ed8', '#2e8b57', '#ea8a1a', '#7c3aed'];
const MAX_ANIOS = 4;
const SERIES: Serie[] = ['ingresos', 'costos', 'gastos', 'resultado', 'margenBruto'];

const CANTIDAD: Record<Modo, number> = { MES: 12, TRIMESTRE: 4, SEMESTRE: 2 };

function claveCategoria(anio: string, modo: Modo, indice: number): string {
  if (modo === 'MES') return `${anio}-${String(indice + 1).padStart(2, '0')}`;
  return `${anio}-${modo === 'TRIMESTRE' ? 'T' : 'S'}${indice + 1}`;
}

export function VistaComparar({
  completos,
  conCostos,
  simbolo,
  idioma,
}: {
  completos: PuntoEvolucionCalculado[];
  conCostos: boolean;
  simbolo: string;
  idioma: string;
}) {
  const esPT = idioma === 'PT';
  const t = (es: string, pt: string) => (esPT ? pt : es);
  const locale = esPT ? 'pt-BR' : 'es-AR';

  const aniosDisponibles = useMemo(() => Array.from(new Set(completos.map((d) => d.clave.slice(0, 4)))).sort().reverse(), [completos]);
  const primeraClave = completos[0].clave;
  const ultimaClave = completos[completos.length - 1].clave;

  const [modo, setModo] = useState<Modo>('MES');
  const [anios, setAnios] = useState<string[]>(() => aniosDisponibles.slice(0, 2));
  const [serie, setSerie] = useState<Serie>('ingresos');
  const [elegida, setElegida] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [refGrafico, anchoGrafico] = useAncho();

  const seriesDisponibles = SERIES.filter((s) => conCostos || (s !== 'costos' && s !== 'margenBruto'));
  const aniosOrdenados = [...anios].sort().reverse(); // el más reciente primero
  // Las barras van del año más viejo al más nuevo (de izquierda a derecha).
  const aniosCronologicos = [...aniosOrdenados].reverse();
  const colorDe = (anio: string) => COLORES_ANIO[aniosDisponibles.slice().reverse().indexOf(anio) % COLORES_ANIO.length];

  function alternarAnio(anio: string) {
    setAnios((previo) => {
      if (previo.includes(anio)) return previo.length > 1 ? previo.filter((a) => a !== anio) : previo;
      return previo.length >= MAX_ANIOS ? previo : [...previo, anio];
    });
  }

  const n = CANTIDAD[modo];

  // valores[anio][i]: null si ese período cae fuera de los datos (antes del
  // primero o después del último movimiento).
  const valores = useMemo(() => {
    const salida: Record<string, (number | null)[]> = {};

    for (const anio of aniosOrdenados) {
      const porClave = new Map(agrupar(completos.filter((d) => d.clave.startsWith(`${anio}-`)), modo).map((g) => [g.clave, g]));

      salida[anio] = Array.from({ length: n }, (_, i) => {
        const mesesPorGrupo = 12 / n;
        const primerMes = `${anio}-${String(i * mesesPorGrupo + 1).padStart(2, '0')}`;
        const ultimoMes = `${anio}-${String((i + 1) * mesesPorGrupo).padStart(2, '0')}`;
        const cubierto = ultimoMes >= primeraClave && primerMes <= ultimaClave;
        if (!cubierto) return null;
        return porClave.get(claveCategoria(anio, modo, i))?.[serie] ?? 0;
      });
    }

    return salida;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completos, modo, serie, anios]);

  const todos = aniosOrdenados.flatMap((a) => valores[a]).filter((v): v is number => v !== null);
  const maxValor = Math.max(...todos, 1);
  const minValor = Math.min(...todos, 0);
  const rangoValores = maxValor - minValor || 1;

  const ANCHO = Math.max(anchoGrafico, 420);
  const anchoUtil = ANCHO - MARGEN.izq - MARGEN.der;
  const altoUtil = ALTO - MARGEN.sup - MARGEN.inf;
  const anchoGrupo = anchoUtil / n;
  const anchoBarra = Math.min(40, (anchoGrupo * 0.78) / aniosOrdenados.length);
  const yDe = (valor: number) => MARGEN.sup + altoUtil - ((valor - minValor) / rangoValores) * altoUtil;
  const yCero = yDe(0);

  const formato = (v: number) => `${simbolo} ${v.toLocaleString(locale, { maximumFractionDigits: 0 })}`;

  const nombreSerie: Record<Serie, string> = {
    ingresos: t('Ingresos', 'Receitas'),
    costos: t('Costos', 'Custos'),
    gastos: t('Gastos', 'Despesas'),
    resultado: t('Resultado', 'Resultado'),
    margenBruto: t('Margen bruto', 'Margem bruta'),
  };

  const etiquetaCategoria = (i: number, larga = false) => {
    const clave = claveCategoria('2000', modo, i);
    const base = etiquetaPeriodo(clave, idioma, { larga });
    return larga ? base.replace(/ 2000$/, '') : base;
  };

  const indiceElegido = elegida ?? Math.max(0, ultimoIndiceConDatos());
  const indiceActivo = hover ?? indiceElegido;

  function ultimoIndiceConDatos(): number {
    // Último período con datos del año más reciente elegido.
    for (let i = n - 1; i >= 0; i--) {
      if (valores[aniosOrdenados[0]][i] !== null) return i;
    }
    return 0;
  }

  function indiceDesdeEvento(evento: React.PointerEvent<SVGSVGElement>): number {
    const caja = evento.currentTarget.getBoundingClientRect();
    const x = ((evento.clientX - caja.left) / caja.width) * ANCHO;
    return Math.min(n - 1, Math.max(0, Math.floor((x - MARGEN.izq) / anchoGrupo)));
  }

  const reciente = aniosOrdenados[0];
  const anterior = aniosOrdenados[1];
  const valorReciente = valores[reciente][indiceElegido];
  const valorAnterior = anterior ? valores[anterior][indiceElegido] : null;
  const diferencia = valorReciente !== null && valorAnterior !== null ? Math.round((valorReciente - valorAnterior) * 100) / 100 : null;
  const cambio = valorReciente !== null && valorAnterior !== null ? variacion(valorReciente, valorAnterior) : null;
  const diferenciaBuena = diferencia === null || diferencia === 0 ? null : diferencia > 0 === SUBIR_ES_BUENO[serie];

  const totales = aniosOrdenados.map((a) => ({ anio: a, total: Math.round(valores[a].reduce<number>((suma, v) => suma + (v ?? 0), 0) * 100) / 100 }));
  const leftTooltip = Math.min(86, Math.max(14, ((MARGEN.izq + (indiceActivo + 0.5) * anchoGrupo) / ANCHO) * 100));

  return (
    <div>
      <style>{`
        .evo-cuerpo { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
      `}</style>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 12px' }}>
        <select
          value={modo}
          onChange={(e) => {
            setModo(e.target.value as Modo);
            setElegida(null);
            setHover(null);
          }}
          aria-label={t('Comparar por', 'Comparar por')}
          style={controlEstilo}
        >
          <option value="MES">{t('Meses', 'Meses')}</option>
          <option value="TRIMESTRE">{t('Trimestres', 'Trimestres')}</option>
          <option value="SEMESTRE">{t('Semestres', 'Semestres')}</option>
        </select>

        <select value={serie} onChange={(e) => setSerie(e.target.value as Serie)} aria-label={t('Qué comparar', 'O que comparar')} style={controlEstilo}>
          {seriesDisponibles.map((s) => (
            <option key={s} value={s}>
              {nombreSerie[s]}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6e7781', fontWeight: 700 }}>{t('Años', 'Anos')}</span>
          {aniosDisponibles.map((a) => {
            const activo = anios.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => alternarAnio(a)}
                aria-pressed={activo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: `1px solid ${activo ? colorDe(a) : '#d1d5db'}`,
                  background: activo ? '#fff' : '#f8fafc',
                  borderRadius: 999,
                  padding: '5px 12px',
                  fontSize: 13,
                  fontWeight: 800,
                  color: activo ? '#111827' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: activo ? colorDe(a) : 'transparent', border: `2px solid ${colorDe(a)}`, boxSizing: 'border-box' }} />
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10, fontSize: 14, color: '#4b5563' }}>
        {totales.map(({ anio, total }) => (
          <span key={anio}>
            <b style={{ color: colorDe(anio) }}>{anio}</b> · {t('Total', 'Total')} {nombreSerie[serie].toLowerCase()}: <b style={{ color: total < 0 ? COLOR.gastos : '#111827' }}>{formato(total)}</b>
          </span>
        ))}
      </div>

      <div className="evo-cuerpo">
        <div ref={refGrafico} style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ position: 'relative', width: ANCHO }}>
            <svg
              viewBox={`0 0 ${ANCHO} ${ALTO}`}
              style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }}
              onPointerMove={(e) => setHover(indiceDesdeEvento(e))}
              onPointerLeave={() => setHover(null)}
              onPointerDown={(e) => {
                const i = indiceDesdeEvento(e);
                setHover(i);
                setElegida(i);
              }}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const y = MARGEN.sup + altoUtil - f * altoUtil;
                return (
                  <g key={f}>
                    <line x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={y} y2={y} stroke="#eef2f6" strokeWidth="1" />
                    <text x={MARGEN.izq - 10} y={y + 4} textAnchor="end" fontSize="14" fill="#94a3b8">
                      {formato(minValor + f * rangoValores)}
                    </text>
                  </g>
                );
              })}

              <rect x={MARGEN.izq + indiceActivo * anchoGrupo} y={MARGEN.sup} width={anchoGrupo} height={altoUtil} fill="#eef4fb" opacity={0.7} />

              {minValor < 0 && <line x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={yCero} y2={yCero} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 5" />}

              {Array.from({ length: n }, (_, i) => {
                const inicioGrupo = MARGEN.izq + i * anchoGrupo + (anchoGrupo - anchoBarra * aniosOrdenados.length) / 2;
                return (
                  <g key={i}>
                    {aniosCronologicos.map((a, k) => {
                      const v = valores[a][i];
                      if (v === null) return null;
                      const y = yDe(v);
                      return (
                        <rect
                          key={a}
                          x={inicioGrupo + k * anchoBarra}
                          y={Math.min(y, yCero)}
                          width={anchoBarra - 3}
                          height={Math.max(Math.abs(y - yCero), v === 0 ? 0 : 2)}
                          rx={4}
                          fill={colorDe(a)}
                          opacity={i === indiceActivo ? 1 : 0.85}
                        />
                      );
                    })}
                    <text x={MARGEN.izq + (i + 0.5) * anchoGrupo} y={ALTO - 14} textAnchor="middle" fontSize="15" fontWeight={i === indiceActivo ? 800 : 600} fill={i === indiceActivo ? AZUL : '#6e7781'}>
                      {etiquetaCategoria(i)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hover !== null && (
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  left: `${leftTooltip}%`,
                  transform: 'translateX(-50%)',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
                  padding: '8px 12px',
                  minWidth: 150,
                  pointerEvents: 'none',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 800, color: AZUL, marginBottom: 4 }}>{etiquetaCategoria(hover, true)}</div>
                {aniosOrdenados.map((a) => (
                  <div key={a} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, lineHeight: 1.55 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4b5563' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: colorDe(a), display: 'inline-block' }} />
                      {a}
                    </span>
                    <b style={{ color: (valores[a][hover] ?? 0) < 0 ? COLOR.gastos : '#111827' }}>{valores[a][hover] === null ? '—' : formato(valores[a][hover] as number)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: '#eef4fb', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: AZUL }}>{etiquetaCategoria(indiceElegido, true)}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <BotonFlecha deshabilitado={indiceElegido <= 0} onClick={() => setElegida(indiceElegido - 1)} etiqueta={t('Anterior', 'Anterior')}>
                ‹
              </BotonFlecha>
              <BotonFlecha deshabilitado={indiceElegido >= n - 1} onClick={() => setElegida(indiceElegido + 1)} etiqueta={t('Siguiente', 'Próximo')}>
                ›
              </BotonFlecha>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0 24px', padding: '10px 14px 12px', alignItems: 'start' }}>
            {aniosOrdenados.map((a) => {
              const v = valores[a][indiceElegido];
              return (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#374151' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorDe(a), display: 'inline-block' }} />
                    {a}
                  </span>
                  <b style={{ fontSize: 16, color: v !== null && v < 0 ? COLOR.gastos : '#111827' }}>{v === null ? '—' : formato(v)}</b>
                </div>
              );
            })}

            {anterior ? (
              <div
                style={{
                  marginTop: 4,
                  borderRadius: 12,
                  padding: '10px 12px',
                  background: diferenciaBuena === null ? '#f1f5f9' : diferenciaBuena ? '#ecfdf3' : '#fef2f2',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4b5563' }}>{t('Diferencia', 'Diferença')}</div>
                {diferencia === null ? (
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{t('Sin datos en alguno de los dos años', 'Sem dados em um dos dois anos')}</div>
                ) : (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 900, color: diferenciaBuena === null ? '#6b7280' : diferenciaBuena ? '#15803d' : '#dc2626' }}>
                      {diferencia > 0 ? '+' : diferencia < 0 ? '−' : ''}
                      {formato(Math.abs(diferencia))}
                    </div>
                    <Variacion
                      valor={cambio}
                      subirEsBueno={SUBIR_ES_BUENO[serie]}
                      etiqueta={`vs. ${etiquetaCategoria(indiceElegido, true)} ${anterior}`}
                      locale={locale}
                      chica
                      noHayBase={t(`sin base de comparación (${anterior} en cero)`, `sem base de comparação (${anterior} em zero)`)}
                    />
                  </>
                )}
              </div>
            ) : (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6b7280' }}>{t('Elegí otro año para ver la diferencia.', 'Escolha outro ano para ver a diferença.')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
