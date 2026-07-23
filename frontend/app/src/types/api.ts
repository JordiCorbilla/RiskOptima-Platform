export interface PortfolioSummary {
  id: number;
  name: string;
  base_currency: string;
  created_at: string;
  position_count: number;
  market_value: number;
}

export interface SamplePortfolioSummary {
  slug: string;
  name: string;
  filename: string;
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
  diagnostics?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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
  diagnostics?: Record<string, unknown>;
}

export interface RunDiagnostics {
  functions_executed: string[];
  runtime_ms_by_stage: Record<string, number>;
  fallback_used: boolean;
  warnings: string[];
  errors: string[];
  generated_code: Record<string, string>;
}

export interface LibraryMetadata {
  package_name: string;
  installed_version: string | null;
  import_source: string | null;
  installed: boolean;
  local_checkout_override_active: boolean;
  python_version: string;
  platform_engine_version: string;
  platform_version: string;
}

export interface LibraryCapability {
  module: string;
  name: string;
  category: string;
  surfaced_in_platform: boolean;
  demo_endpoint: string | null;
  ui_module: string | null;
  description: string;
  example_code: string;
}

export type LibraryExample =
  | "black_scholes_price"
  | "greeks"
  | "implied_volatility"
  | "var_cvar"
  | "volatility_estimator"
  | "optimizer"
  | "merton_pd"
  | "sofr_curve";

export interface ExampleRunResponse {
  example: LibraryExample;
  title: string;
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
  generated_code: string;
  diagnostics: RunDiagnostics;
}

export interface RatesQuote {
  quote_id: string;
  instrument_type: string;
  start_date: string | null;
  end_date: string | null;
  maturity_date: string | null;
  rate: number | null;
  price: number | null;
  convexity_adjustment_bps: number | null;
  payment_frequency: number | null;
}

export interface RatesCurvePoint {
  tenor: number;
  tenor_label: string;
  zero_rate: number;
  forward_rate: number;
  discount_factor: number;
  par_swap_rate: number;
}

export interface RatesCalibrationRow {
  quote_id: string;
  instrument_type: string;
  start_date: string;
  end_date: string;
  market_rate: number;
  model_rate: number;
  error_bps: number;
}

export interface RatesKeyRateDv01 {
  key_tenor: number;
  tenor_label: string;
  dv01: number;
  contribution_percent: number;
}

export interface RatesJacobianRow {
  output_tenor: number;
  output_tenor_label: string;
  sensitivities: Record<string, number>;
}

export interface RatesWorkbenchResponse {
  valuation_date: string;
  curve_name: string;
  library_version: string | null;
  summary: {
    quote_count: number;
    five_year_zero_rate: number;
    five_year_par_swap_rate: number;
    two_year_par_swap_rate: number;
    fixed_rate_bond_price: number;
    total_key_rate_dv01: number;
    max_calibration_error_bps: number;
  };
  quotes: RatesQuote[];
  curve_points: RatesCurvePoint[];
  calibration: RatesCalibrationRow[];
  key_rate_dv01: RatesKeyRateDv01[];
  jacobian: RatesJacobianRow[];
  generated_code: string;
  diagnostics: RunDiagnostics;
}

export interface OptionsWorkbenchResponse {
  portfolio_id: number;
  underlying_symbol: string;
  spot: number;
  valuation_date: string;
  expiries: string[];
  strikes: number[];
  option_chain: Array<Record<string, number | string | null>>;
  aggregate_greeks: Record<string, number>;
  iv_surface: Array<Record<string, number | string | null>>;
  scenario_grid: Array<Record<string, number | string | null>>;
  event_straddle_analysis: Array<Record<string, number | string | null>>;
  generated_code: string;
  diagnostics: RunDiagnostics;
}

export interface BacktestRunRequest {
  start_date?: string;
  as_of_date?: string;
  strategy_type?: string;
  short_window: number;
  long_window: number;
  rebalance_rule: string;
  initial_cash?: number;
  spread_bps: number;
  slippage_bps: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface BacktestRunResponse {
  portfolio_id: number;
  strategy_name: string;
  parameters: Record<string, unknown>;
  equity_curve: Array<{ date: string; value: number; cash: number; costs: number; turnover: number }>;
  drawdown_curve: Array<{ date: string; drawdown: number }>;
  trades: SignalTrade[];
  turnover: number;
  final_value: number;
  total_return: number;
  annualized_return: number;
  annualized_volatility: number;
  sharpe: number;
  sortino: number;
  max_drawdown: number;
  win_rate: number;
  comparisons: Array<Record<string, number | string>>;
  generated_code: string;
  diagnostics: RunDiagnostics;
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
