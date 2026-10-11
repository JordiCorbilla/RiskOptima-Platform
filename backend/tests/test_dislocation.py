from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.domain.dislocation import ResearchRequest
from app.main import create_app
from app.services import dislocation_service
from app.services.risk_service import _ensure_riskoptima_path


@pytest.fixture
def provider(monkeypatch):
    checkout = Path(__file__).resolve().parents[3] / "portfolio_risk_kit"
    if checkout.exists():
        monkeypatch.setattr(get_settings(), "riskoptima_path", checkout)
    _ensure_riskoptima_path()
    from riskoptima.dislocation import MarketSnapshot

    class FixtureProvider:
        def get_snapshot(self, symbol, period="5y"):
            if symbol.startswith("BAD"):
                raise ValueError(f"No price history returned for {symbol}")
            info = {"quoteType": "ETF" if symbol == "FUND" else "EQUITY", "currency": "USD"}
            if symbol == "VALUED":
                info.update(freeCashflow=1_000_000_000, sharesOutstanding=100_000_000, earningsGrowth=0.04)
            dates = pd.bdate_range("2024-01-01", periods=300)
            return MarketSnapshot(symbol, pd.DataFrame({"Close": 70 + np.linspace(0, 30, 300) + np.sin(np.arange(300))}, index=dates), info)

    return FixtureProvider()


def research(provider, *symbols):
    request = ResearchRequest(tickers=list(symbols), config={"use_markov_regime": False})
    return dislocation_service.run_research(request, [(s, s) for s in symbols], provider)


def test_partial_and_all_error_scan_preserve_json_nulls(provider):
    result = research(provider, "VALUED", "BAD")
    assert result.status == "partial"
    from riskoptima import __version__
    assert result.riskoptima_version == __version__
    assert result.riskoptima_version.startswith("2.8.")
    bad = next(row for row in result.summary if row["symbol"] == "BAD")
    assert bad["price"] is None
    assert bad["classification"] == "ERROR"
    assert "No price history" in bad["error"]
    result.model_dump_json()
    failed = research(provider, "BAD")
    assert failed.status == "failed"
    assert failed.analyses == []
    assert failed.summary[0]["classification"] == "ERROR"
    all_errors = research(provider, "BAD", "BAD2")
    assert all_errors.status == "failed"
    assert len(all_errors.summary) == 2
    assert all(row["price"] is None for row in all_errors.summary)


def test_missing_valuation_and_funds_remain_null(provider):
    result = research(provider, "MISSING", "FUND")
    assert result.status == "success"
    for analysis in result.analyses:
        for key in ("intrinsic_value", "margin_of_safety", "upside_to_model_value", "implied_annualized_return"):
            assert analysis[key] is None
    fund = next(a for a in result.analyses if a["symbol"] == "FUND")
    assert fund["valuation_mode"] == "market_dislocation"


def test_corrected_field_mappings_and_versioned_report(provider):
    result = research(provider, "VALUED")
    analysis = result.analyses[0]
    price, value = analysis["price"], analysis["intrinsic_value"]
    assert analysis["margin_of_safety"] == pytest.approx((value - price) / value)
    assert analysis["upside_to_model_value"] == pytest.approx(value / price - 1)
    assert analysis["implied_annualized_return"] == pytest.approx((value / price) ** (1 / 5) - 1)
    assert f"RiskOptima v{result.riskoptima_version}" in result.reports["VALUED"]
    assert isinstance(analysis["as_of"], str)


def test_api_validation_and_partial_failures(provider, monkeypatch, tmp_path):
    from app.db.session import get_portfolio_repository
    from app.repositories.portfolio_repository import SQLitePortfolioRepository

    original = dislocation_service.run_research
    monkeypatch.setattr(dislocation_service, "run_research", lambda request, instruments: original(request, instruments, provider))
    app = create_app()
    app.dependency_overrides[get_portfolio_repository] = lambda: SQLitePortfolioRepository(tmp_path / "test.db")
    client = TestClient(app)
    assert client.post("/api/dislocation/scan", json={}).status_code == 422
    assert client.post("/api/dislocation/scan", json={"tickers": ["<script>"]}).status_code == 422
    assert client.post("/api/dislocation/scan", json={"tickers": ["VALUED"], "config": {"discount_rate": 0.01, "terminal_growth": 0.02}}).status_code == 422
    response = client.post("/api/dislocation/scan", json={"tickers": ["VALUED", "BAD"], "config": {"use_markov_regime": False}})
    assert response.status_code == 200
    assert response.json()["status"] == "partial"
    assert client.post("/api/dislocation/scan", json={"tickers": ["BAD"]}).json()["status"] == "failed"
    csv = "symbol,name,asset_class,sector,quantity,price,currency,beta\nFUND,Fixture fund,Equity,Funds,10,100,USD,1\n"
    portfolio = client.post("/api/portfolios/upload", data={"name": "Research"}, files={"file": ("fixture.csv", csv, "text/csv")}).json()
    assert client.post("/api/dislocation/scan", json={"portfolio_id": portfolio["id"], "tickers": ["VALUED"]}).status_code == 422
    holdings = client.post("/api/dislocation/scan", json={"portfolio_id": portfolio["id"], "config": {"use_markov_regime": False}})
    assert holdings.json()["analyses"][0]["symbol"] == "FUND"
    assert client.post("/api/dislocation/scan", json={"portfolio_id": 9999}).status_code == 404
