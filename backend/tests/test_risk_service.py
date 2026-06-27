from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings
from app.domain.models import AssetClass, Instrument, Portfolio, Position
from app.services.risk_service import build_portfolio_risk_report


def test_risk_report_contains_requested_sections():
    local_riskoptima = Path("C:/repo/portfolio_risk_kit")
    if local_riskoptima.exists():
        get_settings().riskoptima_path = local_riskoptima

    portfolio = Portfolio(
        id=42,
        name="Synthetic Multi Asset",
        created_at=datetime.now(timezone.utc),
        positions=[
            Position(
                instrument=Instrument(symbol="EQ", name="Equity", asset_class=AssetClass.equity, sector="Core", beta=1.0),
                quantity=100,
                price=100,
            ),
            Position(
                instrument=Instrument(symbol="FI", name="Bond", asset_class=AssetClass.fixed_income, sector="Rates", beta=-0.1),
                quantity=100,
                price=95,
            ),
            Position(
                instrument=Instrument(symbol="CR", name="Credit", asset_class=AssetClass.credit, sector="Credit", beta=0.5),
                quantity=100,
                price=87,
            ),
        ],
    )

    report = build_portfolio_risk_report(portfolio)

    metric_names = {metric.name for metric in report.metrics}
    assert report.analytics_engine["package"] == "riskoptima"
    assert {"Historical VaR", "CVaR", "Maximum Drawdown", "Beta", "Annualized Volatility"} <= metric_names
    assert report.var_cvar
    assert report.drawdown
    assert report.factor_exposure
    assert report.largest_contributors
    assert report.stress_results
    assert report.optimization["efficient_frontier"]
    assert report.optimization["allocation_comparison"]
    assert report.optimization["correlation_matrix"]
