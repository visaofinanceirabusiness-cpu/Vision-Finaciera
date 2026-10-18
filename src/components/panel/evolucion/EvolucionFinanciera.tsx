'use client';

import { useMemo, useState } from 'react';
import type { PuntoEvolucion } from '@/lib/evolucionResultado';
import { tieneCostos } from '@/lib/evolucionResultado';
import {
  agrupar,
  etiquetaPeriodo,
  filtrarRango,
  rangoAnterior,
  rangoDePreset,
  rellenarMeses,
  totalesDe,
  variacion,
  type Granularidad,
  type PresetRango,
  type PuntoAgrupado,
  type RangoMeses,
} from '@/lib/evolucionFinanciera';
import { AZUL, BotonFlecha, COLOR, PestanasVista, SUBIR_ES_BUENO, Variacion, controlEstilo, useAncho, type Serie, type VistaEvolucion } from './compartido';
import { VistaComparar } from './VistaComparar';
import { VistaDetalles } from './VistaDetalles';

// EVOLUCIÓN FINANCIERA — tarjeta del Panel (Tendência)
// =====================================================
//
// Una sola tarjeta para todos los perfiles: Ingresos, Costos (solo si el
// perfil los tiene), Gastos y Resultado, con rango de fechas PROPIO (la
// tarjeta muestra una evolución, no un único período como el resto del Panel).
// Sin números sueltos sobre el gráfico: los valores aparecen al pasar el
// cursor o tocar un punto, y el panel lateral compara ese período con el
// anterior.

const ALTO = 420;
const MARGEN = { izq: 86, der: 24, sup: 24, inf: 46 };

const GRANULARIDADES: Granularidad[] = ['MES', 'TRIMESTRE', 'SEMESTRE', 'ANIO'];

export function EvolucionFinanciera({
  datos,
  simbolo = 'R$',
  idioma = 'ES',
}: {
  datos: PuntoEvolucion[];
  simbolo?: string;
  idioma?: string;
}) {
  const esPT = idioma === 'PT';
  const t = (es: string, pt: string) => (esPT ? pt : es);
  const locale = esPT ? 'pt-BR' : 'es-AR';

  const completos = useMemo(() => rellenarMeses(datos), [datos]);
  const claves = useMemo(() => completos.map((d) => d.clave), [completos]);
  const conCostos = tieneCostos(datos);

  const [preset, setPreset] = useState<PresetRango | 'PERSONALIZADO'>('ANIO_ACTUAL');
  const [personalizado, setPersonalizado] = useState<RangoMeses | null>(null);
  const [granularidad, setGranularidad] = useState<Granularidad>('MES');
  // El margen bruto arranca apagado: es un dato de apoyo, no el protagonista.
  const [ocultas, setOcultas] = useState<Set<Serie>>(new Set(['margenBruto']));
  const [elegida, setElegida] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [vista, setVista] = useState<VistaEvolucion>('TENDENCIA');
  const [refGrafico, anchoGrafico] = useAncho();

  const visible = (serie: Serie) => !ocultas.has(serie) && (conCostos || (serie !== 'costos' && serie !== 'margenBruto'));

  function alternar(serie: Serie) {
    setOcultas((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(serie)) siguiente.delete(serie);
      else siguiente.add(serie);
      return siguiente;
    });
  }

  const anios = useMemo(() => Array.from(new Set(claves.map((c) => c.slice(0, 4)))).sort().reverse(), [claves]);

  const rango: RangoMeses | null =
    preset === 'PERSONALIZADO'
      ? personalizado ?? rangoDePreset('TODO', claves)
      : rangoDePreset(preset, claves);

  const enRango = useMemo(() => (rango ? filtrarRango(completos, rango) : []), [completos, rango]);
  const serie = useMemo(() => agrupar(enRango, granularidad), [enRango, granularidad]);
  const serieCompleta = useMemo(() => agrupar(completos, granularidad), [completos, granularidad]);

  if (vista === 'COMPARAR' && completos.length > 0) {
    return (
      <Tarjeta idioma={idioma} t={t}>
        <PestanasVista vista={vista} onCambiar={setVista} t={t} />
        <VistaComparar completos={completos} conCostos={conCostos} simbolo={simbolo} idioma={idioma} />
      </Tarjeta>
    );
  }

  if (!rango || serie.length === 0) {
    return (
      <Tarjeta idioma={idioma} t={t}>
        <p style={{ color: '#6e7781', fontSize: 14, margin: '12px 0 0' }}>
          {t('Todavía no hay movimientos para mostrar la evolución.', 'Ainda não há movimentos para mostrar a evolução.')}
        </p>
      </Tarjeta>
    );
  }

  const varios = new Set(serie.map((p) => p.clave.slice(0, 4))).size > 1;
  const etiqueta = (clave: string, larga = false) => etiquetaPeriodo(clave, idioma, { larga, conAnio: varios });

  // Tarjetas superiores: total del rango contra el rango de igual largo anterior.
  const totales = totalesDe(enRango);
  const previoRango = rangoAnterior(rango);
  const hayPrevio = previoRango.hasta >= claves[0];
  const totalesPrevios = hayPrevio ? totalesDe(filtrarRango(completos, previoRango)) : null;

  const claveElegida = elegida && serie.some((p) => p.clave === elegida) ? elegida : serie[serie.length - 1].clave;
  const indiceElegido = serie.findIndex((p) => p.clave === claveElegida);
  const puntoElegido = serie[indiceElegido];
  const indiceCompleto = serieCompleta.findIndex((p) => p.clave === claveElegida);
  const puntoPrevio = indiceCompleto > 0 ? serieCompleta[indiceCompleto - 1] : null;

  const nombrePrevio: Record<Granularidad, string> = {
    MES: t('vs. mes anterior', 'vs. mês anterior'),
    TRIMESTRE: t('vs. trimestre anterior', 'vs. trimestre anterior'),
    SEMESTRE: t('vs. semestre anterior', 'vs. semestre anterior'),
    ANIO: t('vs. año anterior', 'vs. ano anterior'),
  };

  const nombreSerie: Record<Serie, string> = {
    ingresos: t('Ingresos', 'Receitas'),
    costos: t('Costos', 'Custos'),
    gastos: t('Gastos', 'Despesas'),
    resultado: t('Resultado', 'Resultado'),
    margenBruto: t('Margen bruto', 'Margem bruta'),
  };

  const seriesVisibles = (['ingresos', 'costos', 'gastos', 'resultado', 'margenBruto'] as Serie[]).filter(visible);

  const valores = serie.flatMap((p) => seriesVisibles.map((s) => p[s]));
  const maxValor = Math.max(...valores, 1);
  const minValor = Math.min(...valores, 0);
  const rangoValores = maxValor - minValor || 1;

  // Ancho natural del gráfico; con muchos períodos crece y se desplaza.
  const ANCHO = Math.max(anchoGrafico, serie.length * 46 + MARGEN.izq + MARGEN.der);
  const anchoUtil = ANCHO - MARGEN.izq - MARGEN.der;
  const altoUtil = ALTO - MARGEN.sup - MARGEN.inf;

  const xDe = (i: number) => (serie.length === 1 ? MARGEN.izq + anchoUtil / 2 : MARGEN.izq + (i / (serie.length - 1)) * anchoUtil);
  const yDe = (valor: number) => MARGEN.sup + altoUtil - ((valor - minValor) / rangoValores) * altoUtil;

  const trazo = (s: Serie) => serie.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xDe(i)} ${yDe(p[s])}`).join(' ');

  const paso = Math.max(1, Math.ceil(serie.length / 14));
  const formatoEje = (v: number) => `${simbolo} ${v.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
  const formato = (v: number) => `${simbolo} ${v.toLocaleString(locale, { maximumFractionDigits: 0 })}`;

  function indiceDesdeEvento(evento: React.PointerEvent<SVGSVGElement>): number {
    const caja = evento.currentTarget.getBoundingClientRect();
    const x = ((evento.clientX - caja.left) / caja.width) * ANCHO;
    const relativo = (x - MARGEN.izq) / anchoUtil;
    return Math.min(serie.length - 1, Math.max(0, Math.round(relativo * (serie.length - 1))));
  }

  const indiceActivo = hover ?? indiceElegido;
  const puntoActivo: PuntoAgrupado = serie[indiceActivo];
  const leftTooltip = Math.min(86, Math.max(14, (xDe(indiceActivo) / ANCHO) * 100));

  const tarjetas: { serie: Serie; icono: string }[] = [
    { serie: 'ingresos', icono: '📈' },
    ...(conCostos ? [{ serie: 'costos' as Serie, icono: '📦' }] : []),
    { serie: 'gastos', icono: '💸' },
    { serie: 'resultado', icono: '🎯' },
  ];

  function cambiarRango(valor: string) {
    if (valor === 'PERSONALIZADO') {
      setPersonalizado(rango);
    }
    setPreset(valor as PresetRango | 'PERSONALIZADO');
    setElegida(null);
    setHover(null);
  }

  return (
    <Tarjeta idioma={idioma} t={t}>
      <style>{`
        .evo-cuerpo { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
      `}</style>

      <PestanasVista vista={vista} onCambiar={setVista} t={t} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 14px' }}>
        <select
          value={preset}
          onChange={(e) => cambiarRango(e.target.value)}
          aria-label={t('Rango de fechas', 'Intervalo de datas')}
          style={controlEstilo}
        >
          <option value="ANIO_ACTUAL">{t('Año en curso', 'Ano atual')}</option>
          <option value="ULT12">{t('Últimos 12 meses', 'Últimos 12 meses')}</option>
          <option value="ULT6">{t('Últimos 6 meses', 'Últimos 6 meses')}</option>
          {anios.map((a) => (
            <option key={a} value={`ANIO_${a}`}>
              {a}
            </option>
          ))}
          <option value="TODO">{t('Todo el historial', 'Todo o histórico')}</option>
          <option value="PERSONALIZADO">{t('Personalizado…', 'Personalizado…')}</option>
        </select>

        {preset === 'PERSONALIZADO' && personalizado && (
          <>
            <input
              type="month"
              value={personalizado.desde}
              min={claves[0]}
              max={personalizado.hasta}
              onChange={(e) => e.target.value && setPersonalizado({ ...personalizado, desde: e.target.value })}
              aria-label={t('Desde', 'De')}
              style={controlEstilo}
            />
            <input
              type="month"
              value={personalizado.hasta}
              min={personalizado.desde}
              max={claves[claves.length - 1]}
              onChange={(e) => e.target.value && setPersonalizado({ ...personalizado, hasta: e.target.value })}
              aria-label={t('Hasta', 'Até')}
              style={controlEstilo}
            />
          </>
        )}

        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 10, overflow: 'hidden', marginLeft: 'auto' }}>
          {GRANULARIDADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setGranularidad(g);
                setElegida(null);
                setHover(null);
              }}
              style={{
                border: 'none',
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                background: granularidad === g ? AZUL : '#fff',
                color: granularidad === g ? '#fff' : '#374151',
              }}
            >
              {g === 'MES' ? t('Mensual', 'Mensal') : g === 'TRIMESTRE' ? t('Trimestral', 'Trimestral') : g === 'SEMESTRE' ? t('Semestral', 'Semestral') : t('Anual', 'Anual')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
        {tarjetas.map(({ serie: s, icono }) => {
          const cambio = totalesPrevios ? variacion(totales[s], totalesPrevios[s]) : null;
          return (
            <div key={s} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6e7781' }}>
                {icono} {t(`${nombreSerie[s]} del período`, `${nombreSerie[s]} do período`)}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: totales[s] < 0 ? COLOR.gastos : AZUL, marginTop: 2 }}>{formato(totales[s])}</div>
              <Variacion valor={cambio} subirEsBueno={SUBIR_ES_BUENO[s]} etiqueta={t('vs. período anterior', 'vs. período anterior')} locale={locale} noHayBase={t('sin período anterior para comparar', 'sem período anterior para comparar')} />
            </div>
          );
        })}
      </div>

      {vista === 'DETALLES' ? (
        <VistaDetalles serie={serie} totales={totales} conCostos={conCostos} simbolo={simbolo} idioma={idioma} etiqueta={etiqueta} />
      ) : (
        <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {(['ingresos', 'costos', 'gastos', 'resultado', 'margenBruto'] as Serie[])
          .filter((s) => conCostos || (s !== 'costos' && s !== 'margenBruto'))
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => alternar(s)}
              aria-pressed={visible(s)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', opacity: visible(s) ? 1 : 0.4 }}
            >
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: visible(s) ? COLOR[s] : 'transparent', border: `2px solid ${COLOR[s]}`, boxSizing: 'border-box', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textDecoration: visible(s) ? 'none' : 'line-through' }}>{nombreSerie[s]}</span>
            </button>
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
              setElegida(serie[i].clave);
            }}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = MARGEN.sup + altoUtil - f * altoUtil;
              return (
                <g key={f}>
                  <line x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={y} y2={y} stroke="#eef2f6" strokeWidth="1" />
                  <text x={MARGEN.izq - 10} y={y + 4} textAnchor="end" fontSize="14" fill="#94a3b8">
                    {formatoEje(minValor + f * rangoValores)}
                  </text>
                </g>
              );
            })}

            {minValor < 0 && <line x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={yDe(0)} y2={yDe(0)} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 5" />}

            <line x1={xDe(indiceActivo)} x2={xDe(indiceActivo)} y1={MARGEN.sup} y2={ALTO - MARGEN.inf} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" />

            {seriesVisibles.map((s) => (
              <path
                key={s}
                d={trazo(s)}
                fill="none"
                stroke={COLOR[s]}
                strokeWidth={s === 'resultado' ? 4.5 : 3}
                strokeDasharray={s === 'margenBruto' ? '3 7' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={s === 'resultado' ? 1 : 0.85}
              />
            ))}

            {serie.map((p, i) =>
              seriesVisibles.map((s) => (
                <circle
                  key={`${p.clave}-${s}`}
                  cx={xDe(i)}
                  cy={yDe(p[s])}
                  r={i === indiceActivo ? 7 : 3.5}
                  fill={s === 'resultado' && p.resultado < 0 ? COLOR.gastos : COLOR[s]}
                  stroke="#fff"
                  strokeWidth={i === indiceActivo ? 2.5 : 1.5}
                />
              ))
            )}

            {serie.map((p, i) =>
              i % paso === 0 || i === indiceActivo ? (
                <text key={p.clave} x={xDe(i)} y={ALTO - 14} textAnchor="middle" fontSize="15" fontWeight={i === indiceActivo ? 800 : 600} fill={i === indiceActivo ? AZUL : '#6e7781'}>
                  {etiqueta(p.clave)}
                </text>
              ) : null
            )}
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
            <div style={{ fontWeight: 800, color: AZUL, marginBottom: 4 }}>{etiqueta(puntoActivo.clave, true)}</div>
            {seriesVisibles.map((s) => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, lineHeight: 1.55 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4b5563' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR[s], display: 'inline-block' }} />
                  {nombreSerie[s]}
                </span>
                <b style={{ color: puntoActivo[s] < 0 ? COLOR.gastos : '#111827' }}>{formato(puntoActivo[s])}</b>
              </div>
            ))}
          </div>
          )}
         </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: '#eef4fb', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: AZUL }}>{etiqueta(puntoElegido.clave, true)}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <BotonFlecha deshabilitado={indiceElegido <= 0} onClick={() => setElegida(serie[indiceElegido - 1].clave)} etiqueta={t('Período anterior', 'Período anterior')}>
                ‹
              </BotonFlecha>
              <BotonFlecha deshabilitado={indiceElegido >= serie.length - 1} onClick={() => setElegida(serie[indiceElegido + 1].clave)} etiqueta={t('Período siguiente', 'Próximo período')}>
                ›
              </BotonFlecha>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0 24px', padding: '10px 14px 12px' }}>
            {(['ingresos', 'costos', 'gastos', 'resultado', 'margenBruto'] as Serie[])
              .filter((s) => (conCostos || (s !== 'costos' && s !== 'margenBruto')) && (s !== 'margenBruto' || visible('margenBruto')))
              .map((s) => (
                <div key={s} style={{ padding: '6px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#374151', fontWeight: s === 'resultado' ? 800 : 600 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR[s], display: 'inline-block' }} />
                      {nombreSerie[s]}
                    </span>
                    <b style={{ fontSize: s === 'resultado' ? 17 : 15, color: puntoElegido[s] < 0 ? COLOR.gastos : '#111827' }}>{formato(puntoElegido[s])}</b>
                  </div>
                  {puntoPrevio && (
                    <div style={{ marginTop: 2 }}>
                      <Variacion valor={variacion(puntoElegido[s], puntoPrevio[s])} subirEsBueno={SUBIR_ES_BUENO[s]} etiqueta={nombrePrevio[granularidad]} locale={locale} chica noHayBase={t('sin base de comparación', 'sem base de comparação')} />
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
        </>
      )}
    </Tarjeta>
  );
}

function Tarjeta({ idioma, t, children }: { idioma: string; t: (es: string, pt: string) => string; children: React.ReactNode }) {
  void idioma;
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, padding: 20, background: '#fbfcfd' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 4.2vw, 34px)', lineHeight: 1.1, fontWeight: 900, color: AZUL, letterSpacing: -0.3 }}>
            📈 {t('Evolución financiera', 'Evolução financeira')}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 15, color: '#6e7781' }}>
            {t('Ingresos, costos, gastos y resultado', 'Receitas, custos, despesas e resultado')}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sabio/sabio-evolucion.webp" alt="" style={{ height: 'clamp(84px, 14vw, 128px)', width: 'auto', flexShrink: 0 }} />
      </div>
      {children}
    </div>
  );
}

