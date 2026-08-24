from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AssetClass(str, Enum):
    equity = "Equity"
    fixed_income = "Fixed Income"
    credit = "Credit"
    commodity = "Commodity"
    cash = "Cash"
    alternative = "Alternative"


class Instrument(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    name: str
    asset_class: AssetClass
    sector: str = "Diversified"
    currency: str = "USD"
    beta: float = 1.0


class Position(BaseModel):
    instrument: Instrument
    quantity: float
    price: float

    @property
    def market_value(self) -> float:
        return self.quantity * self.price


class Portfolio(BaseModel):
    id: int
    name: str
    base_currency: str = "USD"
    created_at: datetime
    positions: list[Position]

    @property
    def market_value(self) -> float:
        return sum(position.market_value for position in self.positions)


class PortfolioUpdateRequest(BaseModel):
    name: str
    base_currency: str = "USD"
    positions: list[Position]


class PortfolioSummary(BaseModel):
    id: int
    name: str
    base_currency: str
    created_at: datetime
    position_count: int
    market_value: float


class SamplePortfolioSummary(BaseModel):
    slug: str
    name: str
    filename: str
    position_count: int
    market_value: float


class MarketDataPoint(BaseModel):
    date: date
    symbol: str
    price: float
    return_value: float = Field(serialization_alias="return")


class RiskMetric(BaseModel):
    name: str
    value: float
    unit: str = "ratio"
    confidence: float | None = None
    description: str = ""


class StressScenario(BaseModel):
    id: str
    name: str
    description: str
    shocks: dict[str, float]


class ScenarioRunRequest(BaseModel):
    portfolio_id: int
    scenario_id: str


class ScenarioResult(BaseModel):
    scenario_id: str
    scenario_name: str
    portfolio_value: float
    stressed_value: float
    pnl: float
    pnl_percent: float
    impacts: list[dict[str, Any]]


class ChartPoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    date: str | None = None
    name: str | None = None
    value: float
    var95: float | None = None
    cvar95: float | None = None
    var99: float | None = None
    cvar99: float | None = None


class RiskReport(BaseModel):
    portfolio_id: int
    portfolio_name: str
    generated_at: datetime
    analytics_engine: dict[str, Any] = Field(default_factory=dict)
    metrics: list[RiskMetric]
    var_cvar: list[ChartPoint]
    drawdown: list[ChartPoint]
    factor_exposure: list[ChartPoint]
    largest_contributors: list[dict[str, Any]]
    stress_results: list[ScenarioResult]
    positions: list[dict[str, Any]]
    optimization: dict[str, Any] = Field(default_factory=dict)


class GenerateRunRequest(BaseModel):
    start_date: date | None = None
    as_of_date: date | None = None
    force: bool = False


class GeneratedRun(BaseModel):
    portfolio_id: int
    run_id: str
    start_date: date
    as_of_date: date
    generated_at: datetime
    cache_hit: bool
    report: RiskReport
    charts: list[dict[str, str]]
    diagnostics: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RunSummary(BaseModel):
    portfolio_id: int
    run_id: str
    start_date: date
    as_of_date: date
    generated_at: datetime
    analytics_engine: dict[str, Any] = Field(default_factory=dict)
    diagnostics: dict[str, Any] = Field(default_factory=dict)


class RunDiagnostics(BaseModel):
    functions_executed: list[str] = Field(default_factory=list)
    runtime_ms_by_stage: dict[str, float] = Field(default_factory=dict)
    fallback_used: bool = False
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    generated_code: dict[str, str] = Field(default_factory=dict)


class LibraryMetadata(BaseModel):
    package_name: str
    installed_version: str | None = None
    import_source: str | None = None
    installed: bool
    local_checkout_override_active: bool
    python_version: str
    platform_engine_version: str
    platform_version: str


class LibraryCapability(BaseModel):
    module: str
    name: str
    category: str
    surfaced_in_platform: bool
    demo_endpoint: str | None = None
    ui_module: str | None = None
    description: str
    example_code: str


class ExampleRunRequest(BaseModel):
    example: str = Field(
        pattern="^(black_scholes_price|greeks|implied_volatility|var_cvar|volatility_estimator|optimizer|merton_pd|sofr_curve|sample_data)$"
    )


class ExampleRunResponse(BaseModel):
    example: str
    title: str
    inputs: dict[str, Any]
    result: dict[str, Any]
    generated_code: str
    diagnostics: RunDiagnostics


class RatesQuote(BaseModel):
    quote_id: str
    instrument_type: str
    start_date: str | None = None
    end_date: str | None = None
    maturity_date: str | None = None
    rate: float | None = None
    price: float | None = None
    convexity_adjustment_bps: float | None = None
    payment_frequency: int | None = None


class RatesCurvePoint(BaseModel):
    tenor: float
    tenor_label: str
    zero_rate: float
    forward_rate: float
    discount_factor: float
    par_swap_rate: float


class RatesCalibrationRow(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    quote_id: str
    instrument_type: str
    start_date: str
    end_date: str
    market_rate: float
    model_rate: float
    error_bps: float


class RatesKeyRateDv01(BaseModel):
    key_tenor: float
    tenor_label: str
    dv01: float
    contribution_percent: float


class RatesJacobianRow(BaseModel):
    output_tenor: float
    output_tenor_label: str
    sensitivities: dict[str, float]


class RatesWorkbenchResponse(BaseModel):
    valuation_date: date
    curve_name: str
    library_version: str | None = None
    summary: dict[str, Any]
    quotes: list[RatesQuote]
    curve_points: list[RatesCurvePoint]
    calibration: list[RatesCalibrationRow]
    key_rate_dv01: list[RatesKeyRateDv01]
    jacobian: list[RatesJacobianRow]
    generated_code: str
    diagnostics: RunDiagnostics


class OptionsWorkbenchResponse(BaseModel):
    portfolio_id: int
    underlying_symbol: str
    spot: float
    valuation_date: date
    expiries: list[str]
    strikes: list[float]
    option_chain: list[dict[str, Any]]
    aggregate_greeks: dict[str, float]
    iv_surface: list[dict[str, Any]]
    scenario_grid: list[dict[str, Any]]
    event_straddle_analysis: list[dict[str, Any]]
    generated_code: str
    diagnostics: RunDiagnostics


class BacktestRunRequest(BaseModel):
    start_date: date | None = None
    as_of_date: date | None = None
    strategy_type: str = "sma_crossover"
    short_window: int = Field(default=20, ge=2, le=120)
    long_window: int = Field(default=50, ge=3, le=260)
    rebalance_rule: str = "D"
    initial_cash: float | None = None
    spread_bps: float = Field(default=2.0, ge=0.0, le=100.0)
    slippage_bps: float = Field(default=0.0, ge=0.0, le=100.0)
    stop_loss: float | None = Field(default=0.05, ge=0.0, le=1.0)
    take_profit: float | None = Field(default=0.10, ge=0.0, le=2.0)


class BacktestRunResponse(BaseModel):
    portfolio_id: int
    strategy_name: str
    parameters: dict[str, Any]
    equity_curve: list[dict[str, Any]]
    drawdown_curve: list[dict[str, Any]]
    trades: list[dict[str, Any]]
    turnover: float
    final_value: float
    total_return: float
    annualized_return: float
    annualized_volatility: float
    sharpe: float
    sortino: float
    max_drawdown: float
    win_rate: float
    comparisons: list[dict[str, Any]]
    generated_code: str
    diagnostics: RunDiagnostics
