// components/panel/i18nCharts.ts
//
// Diccionario compartido de los componentes de gráfico
// (LucroChart, CategoryChart, EvolucionFamiliarChart,
// DistribucionPieChart). Misma mecánica que lib/i18n.ts.

import type { Diccionario } from '@/lib/i18n';

export type ClaveChart =
  | 'ingresos'
  | 'costos'
  | 'gastos'
  | 'ahorro'
  | 'total'
  | 'tituloLucro'
  | 'subtituloLucro'
  | 'tituloVentasCategoria'
  | 'subtituloVentasCategoria'
  | 'tituloEvolucionFamiliar'
  | 'subtituloEvolucionFamiliar';

export const diccionarioCharts: Diccionario<ClaveChart> = {
  ES: {
    ingresos: 'Ingresos',
    costos: 'Costos',
    gastos: 'Gastos',
    ahorro: 'Ahorro',
    total: 'Total',
    tituloLucro: '📈 Evolución de Lucro',
    subtituloLucro: 'Ingresos, costos y gastos por mes',
    tituloVentasCategoria: '🛍️ Ventas por categoría',
    subtituloVentasCategoria: 'Distribución comercial',
    tituloEvolucionFamiliar: '📈 Evolución de ingresos, gastos y ahorro',
    subtituloEvolucionFamiliar: 'Mes a mes',
  },
  PT: {
    ingresos: 'Receitas',
    costos: 'Custos',
    gastos: 'Despesas',
    ahorro: 'Poupança',
    total: 'Total',
    tituloLucro: '📈 Evolução de Lucro',
    subtituloLucro: 'Receitas, custos e despesas por mês',
    tituloVentasCategoria: '🛍️ Vendas por categoria',
    subtituloVentasCategoria: 'Distribuição comercial',
    tituloEvolucionFamiliar: '📈 Evolução de receitas, despesas e poupança',
    subtituloEvolucionFamiliar: 'Mês a mês',
  },
};
