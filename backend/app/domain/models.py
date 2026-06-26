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


class PortfolioSummary(BaseModel):
    id: int
    name: str
    base_currency: str
    created_at: datetime
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
    metrics: list[RiskMetric]
    var_cvar: list[ChartPoint]
    drawdown: list[ChartPoint]
    factor_exposure: list[ChartPoint]
    largest_contributors: list[dict[str, Any]]
    stress_results: list[ScenarioResult]
    positions: list[dict[str, Any]]
    optimization: dict[str, Any] = Field(default_factory=dict)
