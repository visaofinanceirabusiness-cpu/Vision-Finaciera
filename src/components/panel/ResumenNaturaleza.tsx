'use client';

// CÓMO SE COMPONE EL RESULTADO — Resumen Ejecutivo del Panel de Control.
//
// El mismo reparto del Estado de Resultado "por naturaleza" (Informes), en
// chico: de cada peso que entra y sale, cuánto es PREVISIBLE (viene de un
// gasto/ingreso recurrente: fijo o de monto variable) y cuánto es "del mes"
// (eventual). Solo es una vista: la suma de los tres netos es el mismo
// resultado del período (ver lib/naturalezaResultado.ts).

import type { ResumenNaturalezaPanel } from '@/lib/contabilidad';
import { ORDEN_NATURALEZA, type Naturaleza } from '@/lib/naturalezaResultado';

type Colores = { azul: string; verde: string; blanco: string };

export function ResumenNaturaleza({
  datos,
  idioma,
  formatear,
  colores,
}: {
  datos: ResumenNaturalezaPanel;
  idioma: string;
  formatear: (valor: number) => string;
  colores: Colores;
}) {
  const esPT = idioma === 'PT';

  // Una empresa sin ningún recurrente no tiene nada que repartir: el bloque
  // sería solo ruido (todo "del mes").
  const hayRecurrentes = (['FIJO', 'RECURRENTE_VARIABLE'] as Naturaleza[]).some(
    (n) => Math.round(datos.ingresos[n]) !== 0 || Math.round(datos.gastos[n]) !== 0
  );

  if (!hayRecurrentes) {
    return null;
  }

  const etiqueta: Record<Naturaleza, string> = {
    FIJO: esPT ? 'Fixos' : 'Fijos',
    RECURRENTE_VARIABLE: esPT ? 'Recorrentes variáveis' : 'Recurrentes variables',
    DEL_MES: esPT ? 'Do mês' : 'Del mes',
  };

  const ayuda: Record<Naturaleza, string> = {
    FIJO: esPT ? 'Monto igual todo mês' : 'Monto igual todos los meses',
    RECURRENTE_VARIABLE: esPT ? 'Todo mês, valor muda' : 'Todos los meses, monto cambia',
    DEL_MES: esPT ? 'Eventual, sem plano' : 'Eventual, sin planificar',
  };

  const emoji: Record<Naturaleza, string> = { FIJO: '📌', RECURRENTE_VARIABLE: '🔁', DEL_MES: '🎲' };

  const colorNeto = (valor: number) => (Math.round(valor) >= 0 ? colores.verde : '#dc2626');

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.6, color: colores.verde, marginBottom: 4 }}>
        {esPT ? 'COMO SE COMPÕE O RESULTADO' : 'CÓMO SE COMPONE EL RESULTADO'}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#6e7781', lineHeight: 1.5 }}>
        {esPT
          ? 'O que é previsível (recorrentes) e o que depende do mês. Entra menos o que sai de cada grupo.'
          : 'Lo previsible (recurrentes) y lo que depende del mes. Cada grupo es lo que entra menos lo que sale.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {ORDEN_NATURALEZA.map((n) => (
          <div key={n} style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: '16px 18px', background: '#fbfcfd' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: colores.azul }}>
              {emoji[n]} {etiqueta[n]}
            </div>
            <div style={{ fontSize: 12.5, color: '#6e7781', marginBottom: 8 }}>{ayuda[n]}</div>

            <div style={{ fontSize: 28, fontWeight: 800, color: colorNeto(datos.neto[n]) }}>{formatear(datos.neto[n])}</div>

            <div style={{ marginTop: 8, fontSize: 14, color: '#374151', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{esPT ? 'Entra' : 'Entra'}</span>
              <strong style={{ color: colores.verde }}>{formatear(datos.ingresos[n])}</strong>
            </div>
            <div style={{ fontSize: 14, color: '#374151', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{esPT ? 'Sai' : 'Sale'}</span>
              <strong style={{ color: '#c2410c' }}>{formatear(datos.gastos[n])}</strong>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        {datos.cobertura !== null && (
          <div style={{ flex: '1 1 230px', border: '1px solid #e5e7eb', borderRadius: 16, padding: '14px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6e7781' }}>{esPT ? 'Cobertura do recorrente' : 'Cobertura de lo recurrente'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: datos.cobertura >= 1 ? colores.verde : '#dc2626' }}>
              {(datos.cobertura * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 13, color: '#6e7781', lineHeight: 1.4 }}>
              {esPT ? 'Suas receitas recorrentes cobrem esta parte dos gastos recorrentes.' : 'Tus ingresos recurrentes cubren esta parte de tus gastos recurrentes.'}
            </div>
          </div>
        )}

        {datos.pesoRecurrente !== null && (
          <div style={{ flex: '1 1 230px', border: '1px solid #e5e7eb', borderRadius: 16, padding: '14px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6e7781' }}>{esPT ? 'Peso do recorrente' : 'Peso de lo recurrente'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: colores.azul }}>{(datos.pesoRecurrente * 100).toFixed(0)}%</div>
            <div style={{ fontSize: 13, color: '#6e7781', lineHeight: 1.4 }}>
              {esPT ? 'Dos seus gastos já estava comprometido por recorrentes.' : 'De tus gastos ya estaba comprometido por recurrentes.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
