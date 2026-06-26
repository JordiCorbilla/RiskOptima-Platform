export interface PortfolioSummary {
  id: number;
  name: string;
  base_currency: string;
  created_at: string;
  position_count: number;
  market_value: number;
}

export interface RiskMetric {
  name: string;
  value: number;
  unit: string;
  confidence?: number;
  description: string;
}

export interface ChartPoint {
  date?: string;
  name?: string;
  value: number;
  var95?: number;
  cvar95?: number;
  var99?: number;
  cvar99?: number;
}

export interface ScenarioResult {
  scenario_id: string;
  scenario_name: string;
  portfolio_value: number;
  stressed_value: number;
  pnl: number;
  pnl_percent: number;
  impacts: Array<Record<string, number | string>>;
}

export interface RiskReport {
  portfolio_id: number;
  portfolio_name: string;
  generated_at: string;
  metrics: RiskMetric[];
  var_cvar: ChartPoint[];
  drawdown: ChartPoint[];
  factor_exposure: ChartPoint[];
  largest_contributors: Array<Record<string, number | string>>;
  stress_results: ScenarioResult[];
  positions: Array<Record<string, number | string>>;
  optimization: {
    summary: Record<string, { return: number; volatility: number; sharpe: number }>;
    efficient_frontier: Array<{ volatility: number; return: number; sharpe: number }>;
    allocation_comparison: Array<{ symbol: string; current: number; max_sharpe: number; min_variance: number }>;
    correlation_matrix: Array<{ x: string; y: string; value: number }>;
    highlight_points: Array<{ name: string; return: number; volatility: number; sharpe: number }>;
  };
}

export interface RenderedChart {
  title: string;
  description: string;
  image: string;
}
