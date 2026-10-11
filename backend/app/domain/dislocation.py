from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ResearchConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    history_period: Literal["1y", "2y", "5y", "10y"] = "5y"
    min_observations: int = Field(126, ge=2, le=2520)
    trend_window: int = Field(200, ge=2, le=2520)
    zscore_window: int = Field(126, ge=2, le=2520)
    volatility_window: int = Field(63, ge=2, le=2520)
    valuation_horizon_years: int = Field(5, ge=1, le=30)
    discount_rate: float = Field(0.09, gt=0, le=1)
    terminal_growth: float = Field(0.025, gt=-1, le=1)
    max_growth: float = Field(0.12, gt=-1, le=1)
    min_growth: float = Field(-0.05, gt=-1, le=1)
    use_markov_regime: bool = True
    random_state: int = Field(7, ge=0)


class ResearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tickers: list[str] = Field(default_factory=list, max_length=25)
    portfolio_id: int | None = Field(None, gt=0)
    config: ResearchConfig = Field(default_factory=ResearchConfig)

    @field_validator("tickers")
    @classmethod
    def normalize_tickers(cls, values: list[str]) -> list[str]:
        import re

        normalized = list(dict.fromkeys(value.strip().upper() for value in values))
        if any(not re.fullmatch(r"[A-Z0-9^][A-Z0-9.^=_-]{0,39}", value) for value in normalized):
            raise ValueError("Use valid provider ticker symbols, up to 40 characters")
        return normalized


class ResearchResponse(BaseModel):
    status: Literal["success", "partial", "failed"]
    riskoptima_version: str
    source: str = "Yahoo Finance (adjusted price history; corporate metadata)"
    assumptions: dict[str, Any]
    summary: list[dict[str, Any]]
    analyses: list[dict[str, Any]]
    reports: dict[str, str]
