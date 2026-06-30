export interface PortfolioSummary {
  id: number;
  name: string;
  base_currency: string;
  created_at: string;
  position_count: number;
  market_value: number;
}

export interface Instrument {
  symbol: string;
  name: string;
  asset_class: string;
  sector: string;
  currency: string;
  beta: number;
}

export interface Position {
  instrument: Instrument;
  quantity: number;
  price: number;
}

export interface Portfolio {
  id: number;
  name: string;
  base_currency: string;
  created_at: string;
  positions: Position[];
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
  analytics_engine: {
    name?: string;
    package?: string;
    version?: string | null;
    installed?: boolean;
    source?: string | null;
  };
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

export interface GeneratedRun {
  portfolio_id: number;
  run_id: string;
  start_date: string;
  as_of_date: string;
  generated_at: string;
  cache_hit: boolean;
  report: RiskReport;
  charts: RenderedChart[];
}

export interface RunSummary {
  portfolio_id: number;
  run_id: string;
  start_date: string;
  as_of_date: string;
  generated_at: string;
  analytics_engine: {
    name?: string;
    package?: string;
    version?: string | null;
    installed?: boolean;
    source?: string | null;
  };
}

export interface SignalPoint {
  date: string;
  close: number;
  sma_short: number | null;
  sma_long: number | null;
  signal: number;
}

export interface SignalTrade {
  ticker: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  return: number;
  exit_reason: string;
}

export interface SignalSummary {
  symbol: string;
  name: string;
  asset_class: string;
  sector: string;
  weight: number;
  close: number;
  sma_short: number;
  sma_long: number;
  state: string;
  latest_signal: string;
  last_signal: string;
  last_signal_date: string | null;
  trade_count: number;
  win_rate: number;
  average_trade_return: number;
  cumulative_trade_return: number;
  annualized_volatility: number;
  max_drawdown: number;
}

export interface SignalDetail extends SignalSummary {
  signals: SignalPoint[];
  trades: SignalTrade[];
}

export interface PortfolioSignalReport {
  portfolio_id: number;
  portfolio_name: string;
  generated_at: string;
  start_date: string;
  as_of_date: string;
  short_window: number;
  long_window: number;
  stop_loss: number | null;
  take_profit: number | null;
  summary: SignalSummary[];
  details: Record<string, SignalDetail>;
  portfolio_equity: Array<{ date: string; value: number; cash: number; costs: number; turnover: number }>;
  portfolio_final_weights: Record<string, number>;
  trades: SignalTrade[];
}

export interface NotebookWorkbench {
  portfolio_id: number;
  generated_at: string;
  start_date: string;
  as_of_date: string;
  optimization_ml: {
    weights: Array<{
      symbol: string;
      current: number;
      min_variance: number;
      max_sharpe: number;
      ml_adjusted: number;
      momentum_score: number;
    }>;
    metrics: Record<string, { return: number; volatility: number; sharpe: number }>;
  };
  index_vol_divergence: {
    series: Array<{ date: string; base: number; vix: number; ma: number | null; upper: number | null; lower: number | null }>;
    signals: Array<{ date: string; base: number; vix: number; comment: string }>;
    exits: Array<{ entry_date: string; exit_date: string; entry_price: number; exit_price: number; reason: string }>;
    returns: Array<{ entry_date: string; exit_date: string; pnl: number; total_return: number }>;
  };
  options: {
    symbol: string;
    spot: number;
    historical_vol: number;
    iv_term_structure: Array<{ expiry_days: number; iv: number; historical_vol: number }>;
    greeks: Array<{ strike: number; delta: number; gamma: number; theta: number; vega: number }>;
    straddles: Array<{ event_date: string; entry_price: number; exit_price: number; abs_move: number; straddle_cost: number; profit: number }>;
  };
  credit: {
    obligors: Array<{ symbol: string; pd: number; lgd: number; ead: number; rating: string; expected_loss: number }>;
    portfolio_expected_loss: number;
    credit_var_99: number;
    credit_cvar_99: number;
    loss_distribution: Array<{ bucket: number; loss: number }>;
    migration: Record<string, Record<string, string>>;
    merton: Array<{ symbol: string; pd: number }>;
  };
  bonds: {
    bonds: Array<{
      symbol: string;
      coupon: number;
      yield: number;
      maturity_years: number;
      macaulay_duration: number;
      modified_duration: number;
      pvbp: number;
      convexity: number;
    }>;
  };
  stochastic_volatility: {
    paths: Array<{
      date: string;
      hull_white: number;
      heston: number;
      sabr: number;
      hull_white_vol: number;
      heston_vol: number;
      sabr_vol: number;
    }>;
  };
  markov_regimes: {
    current_regime: number;
    summary: Array<{
      regime: number;
      count: number;
      mean: number;
      volatility: number;
      min: number;
      max: number;
      annualized_return: number;
      annualized_volatility: number;
    }>;
    transition_matrix: Array<{ from: string; to: string; probability: number }>;
    series: Array<{
      date: string;
      return: number;
      wealth: number;
      regime: number;
      regime_0_probability?: number;
      regime_1_probability?: number;
      regime_2_probability?: number;
    }>;
  };
  portfolio_sophistication: {
    performance: Array<{
      method: string;
      description: string;
      total_return: number;
      annualized_return: number;
      annualized_volatility: number;
      max_drawdown: number;
      sharpe: number;
      calmar: number;
      sortino: number;
      value_at_risk: number;
    }>;
    weights: Array<Record<string, number | string>>;
  };
  volatility_toolkit: {
    summary: {
      historical_volatility: number;
      ewma_volatility: number;
      realized_volatility_21d: number;
      latest_rolling_volatility: number;
      peak_rolling_volatility: number;
    };
    series: Array<{ date: string; rolling_volatility: number }>;
    assets: Array<{
      symbol: string;
      historical_volatility: number;
      ewma_volatility: number;
      latest_rolling_volatility: number;
    }>;
  };
}
