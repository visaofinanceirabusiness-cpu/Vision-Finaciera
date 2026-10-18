'use client';

import { useMemo, useState } from 'react';
import { etiquetaPeriodo } from '@/lib/evolucionFinanciera';
import { TendenciaIndicador } from './TendenciaIndicador';
import {
  INDICADORES,
  calcularIndicadores,
  cambioContraAnterior,
  serieDeIndicador,
  type FotoMes,
  type IndicadorId,
} from '@/lib/indicadoresFinancieros';

// INDICADORES FINANCIEROS — tarjeta de Situación actual (solo empresas)
// =====================================================
//
// Doce indicadores de liquidez, márgenes, rentabilidad, estructura y
// crecimiento, con selector de mes PROPIO (esta pantalla es una foto actual,
// pero cada indicador se puede mirar a cierre de cualquier mes). Cada tile
// muestra el valor, un pulgar contra el mes anterior y una mini-línea de los
// últimos 12 meses.

const AZUL = '#1f3a5f';
const VERDE = '#2e8b57';
const ROJO = '#dc2626';

type Textos = { nombre: string; formula: string };

function textos(id: IndicadorId, esPT: boolean): Textos {
  const t = (es: string, pt: string) => (esPT ? pt : es);

  const mapa: Record<IndicadorId, Textos> = {
    liquidezCorriente: {
      nombre: t('Liquidez corriente', 'Liquidez corrente'),
      formula: t('Activo corriente ÷ Pasivo corriente. Cuántos pesos tenés disponibles o por cobrar por cada peso que debés a corto plazo. Incluye ahorros e inversiones.', 'Ativo circulante ÷ Passivo circulante. Quanto você tem disponível ou a receber para cada real que deve no curto prazo. Inclui poupança e investimentos.'),
    },
    liquidezSeca: {
      nombre: t('Liquidez seca', 'Liquidez seca'),
      formula: t('(Activo corriente − Mercaderías) ÷ Pasivo corriente. Lo mismo, sin contar con vender el stock.', '(Ativo circulante − Estoques) ÷ Passivo circulante. O mesmo, sem contar com a venda do estoque.'),
    },
    liquidezGeneral: {
      nombre: t('Liquidez general', 'Liquidez geral'),
      formula: t('Activo corriente ÷ Pasivo total. Hoy no hay deudas ni créditos a largo plazo, así que usa todo el pasivo.', 'Ativo circulante ÷ Passivo total. Hoje não há dívidas nem créditos de longo prazo, então usa todo o passivo.'),
    },
    margenBruto: {
      nombre: t('Margen de lucro bruto', 'Margem de lucro bruta'),
      formula: t('(Ingresos − Costos) ÷ Ingresos. Cuánto te queda de cada venta después de lo que cuesta producirla o comprarla.', '(Receitas − Custos) ÷ Receitas. Quanto sobra de cada venda depois do que custa produzi-la ou comprá-la.'),
    },
    margenOperacional: {
      nombre: t('Margen de lucro operacional', 'Margem de lucro operacional'),
      formula: t('(Ingresos − Costos − Gastos de operar) ÷ Ingresos. Antes de gastos financieros e impuestos.', '(Receitas − Custos − Despesas operacionais) ÷ Receitas. Antes de despesas financeiras e impostos.'),
    },
    margenLiquido: {
      nombre: t('Margen de lucro líquido', 'Margem de lucro líquida'),
      formula: t('Lucro líquido ÷ Ingresos. Lo que queda de cada venta después de todo, incluidos gastos financieros e impuestos.', 'Lucro líquido ÷ Receitas. O que sobra de cada venda depois de tudo, incluindo despesas financeiras e impostos.'),
    },
    rentabilidadActivo: {
      nombre: t('Rentabilidad del activo', 'Rentabilidade do ativo'),
      formula: t('Lucro líquido del mes ÷ Activo total al cierre. Cuánto rinde lo que tiene el negocio.', 'Lucro líquido do mês ÷ Ativo total no fechamento. Quanto rende o que o negócio possui.'),
    },
    rentabilidadPN: {
      nombre: t('Rentabilidad del patrimonio', 'Rentabilidade do patrimônio'),
      formula: t('Lucro líquido del mes ÷ Patrimonio neto al cierre. Cuánto rinde lo que pusieron y dejaron los dueños.', 'Lucro líquido do mês ÷ Patrimônio líquido no fechamento. Quanto rende o que os donos colocaram e deixaram.'),
    },
    participacionTerceros: {
      nombre: t('Participación de capital de terceros', 'Participação de capital de terceiros'),
      formula: t('Pasivo total ÷ Patrimonio neto. Cuánto debés por cada peso propio.', 'Passivo total ÷ Patrimônio líquido. Quanto você deve para cada real próprio.'),
    },
    endeudamiento: {
      nombre: t('Grado de endeudamiento', 'Grau de endividamento'),
      formula: t('Pasivo total ÷ Activo total. Qué parte de lo que tenés está financiada con deuda.', 'Passivo total ÷ Ativo total. Que parte do que você tem é financiada com dívida.'),
    },
    crecimientoIngresos: {
      nombre: t('Crecimiento de ingresos', 'Crescimento da receita'),
      formula: t('(Ingresos del mes − Ingresos del mes anterior) ÷ Ingresos del mes anterior. Receita líquida: en este plan equivale a los ingresos.', '(Receita do mês − Receita do mês anterior) ÷ Receita do mês anterior. Receita líquida: neste plano equivale às receitas.'),
    },
    crecimientoLucro: {
      nombre: t('Crecimiento del lucro líquido', 'Crescimento do lucro líquido'),
      formula: t('(Lucro del mes − Lucro del mes anterior) ÷ |Lucro del mes anterior|. Si el mes anterior fue pérdida, perder menos cuenta como crecer.', '(Lucro do mês − Lucro do mês anterior) ÷ |Lucro do mês anterior|. Se o mês anterior foi prejuízo, perder menos conta como crescer.'),
    },
  };

  return mapa[id];
}

const BLOQUES: { id: string; es: string; pt: string; indicadores: IndicadorId[] }[] = [
  { id: 'liquidez', es: 'Liquidez', pt: 'Liquidez', indicadores: ['liquidezCorriente', 'liquidezSeca', 'liquidezGeneral'] },
  { id: 'margenes', es: 'Márgenes y rentabilidad', pt: 'Margens e rentabilidade', indicadores: ['margenBruto', 'margenOperacional', 'margenLiquido', 'rentabilidadActivo', 'rentabilidadPN'] },
  { id: 'estructura', es: 'Estructura de capital', pt: 'Estrutura de capital', indicadores: ['participacionTerceros', 'endeudamiento'] },
  { id: 'crecimiento', es: 'Crecimiento (mes contra mes)', pt: 'Crescimento (mês contra mês)', indicadores: ['crecimientoIngresos', 'crecimientoLucro'] },
];

export function IndicadoresFinancieros({
  fotos,
  idioma = 'ES',
  imagenSabio,
}: {
  fotos: FotoMes[];
  idioma?: string;
  imagenSabio?: string;
}) {
  const esPT = idioma === 'PT';
  const t = (es: string, pt: string) => (esPT ? pt : es);
  const locale = esPT ? 'pt-BR' : 'es-AR';

  const [elegida, setElegida] = useState<string | null>(null);
  const [anualizar, setAnualizar] = useState(false);
  const [abierta, setAbierta] = useState<IndicadorId | null>(null);
  const [tendencia, setTendencia] = useState<IndicadorId | null>(null);

  const claves = useMemo(() => fotos.map((f) => f.clave), [fotos]);
  const claveActiva = elegida && claves.includes(elegida) ? elegida : claves[claves.length - 1];
  const indice = claves.indexOf(claveActiva);

  const actual = fotos[indice];
  const previa = indice > 0 ? fotos[indice - 1] : null;

  const valores = useMemo(() => (actual ? calcularIndicadores(actual, previa, { anualizar }) : null), [actual, previa, anualizar]);
  const valoresPrevios = useMemo(
    () => (previa ? calcularIndicadores(previa, indice > 1 ? fotos[indice - 2] : null, { anualizar }) : null),
    [previa, fotos, indice, anualizar]
  );

  if (!actual || !valores) {
    return (
      <Tarjeta t={t} imagenSabio={imagenSabio}>
        <p style={{ color: '#6e7781', fontSize: 14, margin: '12px 0 0' }}>
          {t('Todavía no hay movimientos para calcular indicadores.', 'Ainda não há movimentos para calcular indicadores.')}
        </p>
      </Tarjeta>
    );
  }

  const formatear = (id: IndicadorId, valor: number): string => {
    const unidad = INDICADORES.find((i) => i.id === id)!.unidad;
    return unidad === 'veces'
      ? `${valor.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`
      : `${valor.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  const motivoSinDato = (id: IndicadorId): string => {
    if ((id === 'liquidezCorriente' || id === 'liquidezSeca') && actual.pasivoCorriente === 0) return t('Sin deudas a corto plazo', 'Sem dívidas de curto prazo');
    if (id === 'liquidezGeneral' && actual.pasivoTotal === 0) return t('Sin deudas', 'Sem dívidas');
    if ((id === 'crecimientoIngresos' || id === 'crecimientoLucro') && !previa) return t('Sin mes anterior', 'Sem mês anterior');
    if (id === 'crecimientoIngresos' || id === 'crecimientoLucro') return t('Mes anterior en cero', 'Mês anterior em zero');
    if ((id === 'rentabilidadPN' || id === 'participacionTerceros') && actual.patrimonioNeto <= 0) return t('Patrimonio no positivo', 'Patrimônio não positivo');
    return t('Sin datos', 'Sem dados');
  };

  const mesesDesc = [...claves].reverse();

  return (
    <Tarjeta t={t} imagenSabio={imagenSabio}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '14px 0 16px' }}>
        <button type="button" onClick={() => setElegida(claves[indice - 1])} disabled={indice <= 0} aria-label={t('Mes anterior', 'Mês anterior')} style={botonFlecha(indice <= 0)}>
          ‹
        </button>
        <select
          value={claveActiva}
          onChange={(e) => setElegida(e.target.value)}
          aria-label={t('Mes', 'Mês')}
          style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: '#374151', background: '#fff' }}
        >
          {mesesDesc.map((c) => (
            <option key={c} value={c}>
              {etiquetaPeriodo(c, idioma, { larga: true })}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setElegida(claves[indice + 1])} disabled={indice >= claves.length - 1} aria-label={t('Mes siguiente', 'Próximo mês')} style={botonFlecha(indice >= claves.length - 1)}>
          ›
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer', marginLeft: 'auto' }}>
          <input type="checkbox" checked={anualizar} onChange={(e) => setAnualizar(e.target.checked)} />
          {t('Anualizar rentabilidades (×12)', 'Anualizar rentabilidades (×12)')}
        </label>
      </div>

      {BLOQUES.map((bloque) => (
        <div key={bloque.id} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.4, color: '#6e7781', textTransform: 'uppercase', marginBottom: 8 }}>{esPT ? bloque.pt : bloque.es}</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {bloque.indicadores.map((id) => {
              const valor = valores[id];
              const cambio = cambioContraAnterior(id, valor, valoresPrevios ? valoresPrevios[id] : null);
              const serie = serieDeIndicador(fotos, id, { anualizar, hastaClave: claveActiva, ultimos: 12 });
              const { nombre, formula } = textos(id, esPT);
              const sufijo = anualizar && (id === 'rentabilidadActivo' || id === 'rentabilidadPN') ? ` ${t('(anualizada)', '(anualizada)')}` : '';
              const unidad = INDICADORES.find((i) => i.id === id)!.unidad;
              const colorValor = valor !== null && valor < 0 ? ROJO : AZUL;

              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={tendencia === id}
                  onClick={() => setTendencia(tendencia === id ? null : id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTendencia(tendencia === id ? null : id);
                    }
                  }}
                  style={{ background: '#fff', border: `${tendencia === id ? 2 : 1}px solid ${tendencia === id ? AZUL : '#e5e7eb'}`, borderRadius: 14, padding: tendencia === id ? '11px 13px' : '12px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#374151', lineHeight: 1.25 }}>
                      {nombre}
                      {sufijo}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAbierta(abierta === id ? null : id);
                      }}
                      aria-label={t('Cómo se calcula', 'Como é calculado')}
                      aria-expanded={abierta === id}
                      style={{ border: '1px solid #cbd5e1', background: abierta === id ? '#eef4fb' : '#fff', color: AZUL, borderRadius: '50%', width: 22, height: 22, fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0, padding: 0 }}
                    >
                      i
                    </button>
                  </div>

                  {abierta === id && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#4b5563', lineHeight: 1.45 }}>{formula}</p>}

                  {valor === null ? (
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', margin: '10px 0 4px' }}>{motivoSinDato(id)}</div>
                  ) : (
                    <div style={{ fontSize: 30, fontWeight: 900, color: colorValor, margin: '6px 0 2px', lineHeight: 1.1 }}>{formatear(id, valor)}</div>
                  )}

                  <div style={{ minHeight: 34, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {cambio &&
                      (cambio.favorable === null ? (
                        <span style={{ fontSize: 12.5, color: '#6b7280' }}>= {t('igual que el mes anterior', 'igual ao mês anterior')}</span>
                      ) : (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={cambio.favorable ? '/iconos/pulgar-arriba.webp' : '/iconos/pulgar-abajo.webp'} alt={cambio.favorable ? 'favorable' : 'desfavorable'} style={{ width: 30, height: 30, flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, color: '#6b7280' }}>
                            <b style={{ color: cambio.favorable ? '#15803d' : ROJO, fontSize: 14 }}>
                              {cambio.delta > 0 ? '+' : '−'}
                              {Math.abs(cambio.delta).toLocaleString(locale, { minimumFractionDigits: unidad === 'veces' ? 2 : 1, maximumFractionDigits: unidad === 'veces' ? 2 : 1 })}
                              {unidad === 'porcentaje' ? ' pp' : ''}
                            </b>{' '}
                            {t('vs. mes anterior', 'vs. mês anterior')}
                          </span>
                        </>
                      ))}
                  </div>

                  <MiniLinea puntos={serie.map((p) => p.valor)} color={cambio?.favorable === false ? ROJO : VERDE} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: AZUL, textAlign: 'right', marginTop: 2 }}>{tendencia === id ? t('Ocultar tendencia ▴', 'Ocultar tendência ▴') : t('Ver tendencia ▾', 'Ver tendência ▾')}</div>
                </div>
              );
            })}
          </div>

          {tendencia && bloque.indicadores.includes(tendencia) && (
            <TendenciaIndicador
              fotos={fotos}
              id={tendencia}
              nombre={textos(tendencia, esPT).nombre}
              anualizar={anualizar}
              claveActiva={claveActiva}
              onElegir={setElegida}
              onCerrar={() => setTendencia(null)}
              formatear={formatear}
              idioma={idioma}
            />
          )}
        </div>
      ))}
    </Tarjeta>
  );
}

const botonFlecha = (deshabilitado: boolean): React.CSSProperties => ({
  width: 34,
  height: 34,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: AZUL,
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1,
  cursor: deshabilitado ? 'default' : 'pointer',
  opacity: deshabilitado ? 0.35 : 1,
});

// Mini-línea de tendencia (sin ejes ni números): los huecos (null) cortan la línea.
function MiniLinea({ puntos, color }: { puntos: (number | null)[]; color: string }) {
  const ancho = 220;
  const alto = 40;
  const conDato = puntos.filter((p): p is number => p !== null);

  if (conDato.length < 2) {
    return <div style={{ height: alto }} />;
  }

  const min = Math.min(...conDato);
  const max = Math.max(...conDato);
  const rango = max - min || 1;
  const x = (i: number) => 4 + (i / (puntos.length - 1)) * (ancho - 8);
  const y = (v: number) => alto - 6 - ((v - min) / rango) * (alto - 12);

  let trazo = '';
  let abierto = false;
  puntos.forEach((p, i) => {
    if (p === null) {
      abierto = false;
      return;
    }
    trazo += `${abierto ? 'L' : 'M'} ${x(i)} ${y(p)} `;
    abierto = true;
  });

  const ultimo = puntos.length - 1;
  const valorUltimo = puntos[ultimo];

  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: alto, display: 'block' }} role="img" aria-label="tendencia">
      <path d={trazo} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      {valorUltimo !== null && <circle cx={x(ultimo)} cy={y(valorUltimo)} r="4.5" fill={color} stroke="#fff" strokeWidth="2" />}
    </svg>
  );
}

function Tarjeta({ t, imagenSabio, children }: { t: (es: string, pt: string) => string; imagenSabio?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, padding: 20, background: '#fbfcfd' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 4.2vw, 34px)', lineHeight: 1.1, fontWeight: 900, color: AZUL, letterSpacing: -0.3 }}>
            🧮 {t('Indicadores financieros', 'Indicadores financeiros')}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 15, color: '#6e7781' }}>
            {t('Liquidez, márgenes, rentabilidad y endeudamiento, mes a mes', 'Liquidez, margens, rentabilidade e endividamento, mês a mês')}
          </p>
        </div>
        {imagenSabio && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagenSabio} alt="" style={{ height: 'clamp(84px, 14vw, 128px)', width: 'auto', flexShrink: 0 }} />
        )}
      </div>
      {children}
    </div>
  );
}
