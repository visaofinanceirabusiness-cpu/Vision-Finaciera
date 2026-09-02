// components/panel/i18nCharts.ts
//
// Diccionario compartido de los componentes de gráfico
// (LucroChart, CategoryChart, StockChart, EvolucionFamiliarChart,
// DistribucionPieChart). Misma mecánica que lib/i18n.ts.

import type { Diccionario } from '@/lib/i18n';

export type ClaveChart =
  | 'ingresos'
  | 'costos'
  | 'gastos'
  | 'ahorro'
  | 'total'
  | 'stock'
  | 'sinStock'
  | 'tituloLucro'
  | 'subtituloLucro'
  | 'tituloVentasCategoria'
  | 'subtituloVentasCategoria'
  | 'tituloStock'
  | 'subtituloStock'
  | 'tituloEvolucionFamiliar'
  | 'subtituloEvolucionFamiliar';

export const diccionarioCharts: Diccionario<ClaveChart> = {
  ES: {
    ingresos: 'Ingresos',
    costos: 'Costos',
    gastos: 'Gastos',
    ahorro: 'Ahorro',
    total: 'Total',
    stock: 'STOCK',
    sinStock: 'Sin stock cargado todavía.',
    tituloLucro: '📈 Evolución de Lucro',
    subtituloLucro: 'Ingresos, costos y gastos por mes',
    tituloVentasCategoria: '🛍️ Ventas por categoría',
    subtituloVentasCategoria: 'Distribución comercial',
    tituloStock: '📦 Composición del stock',
    subtituloStock: 'Participación por categoría',
    tituloEvolucionFamiliar: '📈 Evolución de ingresos, gastos y ahorro',
    subtituloEvolucionFamiliar: 'Mes a mes',
  },
  PT: {
    ingresos: 'Receitas',
    costos: 'Custos',
    gastos: 'Despesas',
    ahorro: 'Poupança',
    total: 'Total',
    stock: 'ESTOQUE',
    sinStock: 'Ainda não há estoque cadastrado.',
    tituloLucro: '📈 Evolução de Lucro',
    subtituloLucro: 'Receitas, custos e despesas por mês',
    tituloVentasCategoria: '🛍️ Vendas por categoria',
    subtituloVentasCategoria: 'Distribuição comercial',
    tituloStock: '📦 Composição do estoque',
    subtituloStock: 'Participação por categoria',
    tituloEvolucionFamiliar: '📈 Evolução de receitas, despesas e poupança',
    subtituloEvolucionFamiliar: 'Mês a mês',
  },
};
