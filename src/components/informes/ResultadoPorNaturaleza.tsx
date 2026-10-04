'use client';

// ESTADO DE RESULTADO "POR NATURALEZA"
//
// La misma suma que el estado de resultado por cuenta, pero partida según de
// dónde viene cada ingreso y cada gasto:
//   - Fijos: vienen de un recurrente de monto fijo (alquiler, Netflix...).
//   - Recurrentes variables: de un recurrente cuyo monto cambia (luz, agua...).
//   - Del mes: todo lo demás, lo eventual.
// El neto de cada grupo muestra qué parte del resultado es previsible y cuál
// depende del mes. Solo es una vista: no cambia ningún asiento (ver
// lib/naturalezaResultado.ts).

import { useEffect, useMemo, useState } from 'react';
import { formatearNumeroEntero } from '@/lib/moneda';
import { cargarNaturalezaPorOperacion } from '@/lib/naturalezaResultadoDatos';
import {
  ORDEN_NATURALEZA,
  resultadoPorNaturaleza,
  resumenNaturaleza,
  type AsientoResultado,
  type CuentaResultado,
  type GrupoNaturaleza,
  type Naturaleza,
  type TipoResultado,
} from '@/lib/naturalezaResultado';

const COLORES = { azul: '#1f3a5f', verde: '#2e8b57', gris: '#6e7781', rojo: '#dc2626', naranja: '#c2410c' };

export function ResultadoPorNaturaleza({
  empresaId,
  idioma,
  simbolo,
  cuentas,
  asientos,
  incluirSaldoInicial,
  etiquetaPeriodo,
}: {
  empresaId: string;
  idioma: string | null;
  simbolo: string;
  cuentas: CuentaResultado[];
  asientos: AsientoResultado[];
  incluirSaldoInicial: boolean;
  etiquetaPeriodo: string;
}) {
  const esPT = idioma === 'PT';
  const [mapa, setMapa] = useState<Map<string, Naturaleza> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;

    cargarNaturalezaPorOperacion(empresaId)
      .then((resultado) => {
        if (vigente) setMapa(resultado);
      })
      .catch((e) => {
        console.error('No se pudo cargar la naturaleza de los asientos:', e);
        if (vigente) setError(e instanceof Error ? e.message : 'Error inesperado.');
      });

    return () => {
      vigente = false;
    };
  }, [empresaId]);

  const resultado = useMemo(
    () => (mapa ? resultadoPorNaturaleza(cuentas, asientos, mapa, incluirSaldoInicial) : null),
    [cuentas, asientos, mapa, incluirSaldoInicial]
  );

  const resumen = useMemo(() => (resultado ? resumenNaturaleza(resultado) : null), [resultado]);

  if (error) {
    return <div style={{ padding: 16, color: '#b91c1c', fontSize: 13 }}>{error}</div>;
  }

  if (!resultado || !resumen) {
    return <div style={{ padding: 24, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>{esPT ? 'Carregando...' : 'Cargando...'}</div>;
  }

  const formatear = (valor: number) => `${simbolo} ${formatearNumeroEntero(valor)}`;

  const etiquetaGrupo: Record<Naturaleza, string> = {
    FIJO: esPT ? 'Fixos' : 'Fijos',
    RECURRENTE_VARIABLE: esPT ? 'Recorrentes variáveis' : 'Recurrentes variables',
    DEL_MES: esPT ? 'Do mês (eventuais)' : 'Del mes (eventuales)',
  };

  const ayudaGrupo: Record<Naturaleza, string> = {
    FIJO: esPT ? 'Monto fixo todo mês' : 'Monto igual todos los meses',
    RECURRENTE_VARIABLE: esPT ? 'Todo mês, mas o valor muda' : 'Todos los meses, pero el monto cambia',
    DEL_MES: esPT ? 'Não vem de nenhum recorrente' : 'No viene de ningún recurrente',
  };

  const etiquetaNeto: Record<Naturaleza, string> = {
    FIJO: esPT ? 'Neto fixo' : 'Neto fijo',
    RECURRENTE_VARIABLE: esPT ? 'Neto recorrente variável' : 'Neto recurrente variable',
    DEL_MES: esPT ? 'Neto do mês' : 'Neto del mes',
  };

  const secciones: { tipo: TipoResultado; titulo: string; emoji: string; color: string; resta: boolean }[] = [
    { tipo: 'INGRESO', titulo: esPT ? 'Receitas' : 'Ingresos', emoji: '💵', color: COLORES.verde, resta: false },
    { tipo: 'COSTO', titulo: esPT ? 'Custos' : 'Costos', emoji: '📦', color: COLORES.naranja, resta: true },
    { tipo: 'GASTO', titulo: esPT ? 'Despesas' : 'Gastos', emoji: '🧾', color: COLORES.naranja, resta: true },
  ];

  const totalDe = (tipo: TipoResultado) => ORDEN_NATURALEZA.reduce((suma, n) => suma + resultado[tipo][n].total, 0);

  const resultadoTotal = resumen.resultadoTotal;

  return (
    <div>
      {secciones.map(({ tipo, titulo, emoji, color, resta }) => {
        const grupos = ORDEN_NATURALEZA.map((n) => ({ naturaleza: n, grupo: resultado[tipo][n] as GrupoNaturaleza })).filter(
          ({ grupo }) => grupo.filas.length > 0
        );

        // Una empresa sin costos nunca tiene nada acá: la sección sería solo ruido.
        if (tipo === 'COSTO' && grupos.length === 0) return null;

        return (
          <div key={tipo} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px 10px 0 0', border: '1px solid #e5e7eb', borderBottom: 'none', gap: 12 }}>
              <strong style={{ color: COLORES.azul, fontSize: 13 }}>
                {emoji} {titulo}
              </strong>
              <strong style={{ color, fontSize: 13, flexShrink: 0 }}>
                {resta ? '− ' : ''}
                {formatear(totalDe(tipo))}
              </strong>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {grupos.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>
                  {esPT ? 'Sem movimento neste período.' : 'Sin movimiento en este período.'}
                </div>
              ) : (
                grupos.map(({ naturaleza, grupo }, indice) => (
                  <div key={naturaleza} style={{ borderTop: indice === 0 ? 'none' : '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '8px 14px', background: '#fbfcfd', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: COLORES.azul }}>
                        {etiquetaGrupo[naturaleza]}
                        <span style={{ fontWeight: 400, color: COLORES.gris, marginLeft: 8 }}>{ayudaGrupo[naturaleza]}</span>
                      </span>
                      <strong style={{ fontSize: 12.5, color }}>{formatear(grupo.total)}</strong>
                    </div>

                    {grupo.filas.map((fila) => (
                      <div key={fila.cuentaId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px 8px 28px', fontSize: 13, gap: 16, borderTop: '1px solid #f1f5f9' }}>
                        <span>{fila.nombre}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{formatear(fila.valor)}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 18, padding: '18px 20px', borderRadius: 16, background: resultadoTotal >= 0 ? 'linear-gradient(90deg, #edf6f0, #f7faf8)' : '#fef2f2' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: COLORES.gris, marginBottom: 10 }}>
          {esPT ? 'RESULTADO' : 'RESULTADO'} — {etiquetaPeriodo}
        </div>

        {ORDEN_NATURALEZA.map((n) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 13.5 }}>
            <span style={{ color: '#374151' }}>
              {etiquetaNeto[n]}
              <span style={{ color: COLORES.gris, fontSize: 11.5, marginLeft: 8 }}>
                {n === 'DEL_MES'
                  ? esPT
                    ? 'o que depende do mês'
                    : 'lo que depende del mes'
                  : esPT
                    ? 'o previsível'
                    : 'lo previsible'}
              </span>
            </span>
            <strong style={{ color: resumen.neto[n] >= 0 ? COLORES.verde : COLORES.rojo, whiteSpace: 'nowrap' }}>{formatear(resumen.neto[n])}</strong>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.08)', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORES.azul }}>{esPT ? 'Resultado total' : 'Resultado total'}</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: resultadoTotal >= 0 ? COLORES.verde : COLORES.rojo }}>{formatear(resultadoTotal)}</span>
        </div>
      </div>

      {(resumen.cobertura !== null || resumen.pesoRecurrente !== null) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          {resumen.cobertura !== null && (
            <div style={{ flex: '1 1 220px', border: '1px solid #e5e7eb', borderRadius: 14, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: COLORES.gris }}>
                {esPT ? 'COBERTURA DO RECORRENTE' : 'COBERTURA DE LO RECURRENTE'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: resumen.cobertura >= 1 ? COLORES.verde : COLORES.rojo }}>
                {(resumen.cobertura * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 12, color: COLORES.gris, lineHeight: 1.4 }}>
                {esPT ? 'Suas receitas recorrentes cobrem esta parte dos seus gastos recorrentes.' : 'Tus ingresos recurrentes cubren esta parte de tus gastos recurrentes.'}
              </div>
            </div>
          )}

          {resumen.pesoRecurrente !== null && (
            <div style={{ flex: '1 1 220px', border: '1px solid #e5e7eb', borderRadius: 14, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: COLORES.gris }}>
                {esPT ? 'PESO DO RECORRENTE' : 'PESO DE LO RECURRENTE'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORES.azul }}>{(resumen.pesoRecurrente * 100).toFixed(0)}%</div>
              <div style={{ fontSize: 12, color: COLORES.gris, lineHeight: 1.4 }}>
                {esPT ? 'Dos seus gastos já estava comprometido por recorrentes.' : 'De tus gastos ya estaba comprometido por recurrentes.'}
              </div>
            </div>
          )}
        </div>
      )}

      <p style={{ margin: '14px 0 0', fontSize: 11.5, color: COLORES.gris, lineHeight: 1.5 }}>
        {esPT
          ? 'Só conta como recorrente o que está vinculado a um gasto ou ingresso recorrente; o resto aparece em "Do mês". O total é o mesmo da visão por conta.'
          : 'Solo cuenta como recurrente lo que está vinculado a un gasto o ingreso recurrente; el resto aparece en "Del mes". El total es el mismo que en la vista por cuenta.'}
      </p>
    </div>
  );
}
