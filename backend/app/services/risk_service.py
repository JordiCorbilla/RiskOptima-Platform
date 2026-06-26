from datetime import datetime, timezone
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.linear_model import LinearRegression

from app.core.config import get_settings
from app.domain.models import ChartPoint, Portfolio, RiskMetric, RiskReport
from app.services.market_data_service import generate_synthetic_market_data
from app.services.stress_service import DEFAULT_SCENARIOS, run_stress_scenario


def _ensure_riskoptima_path() -> None:
    configured = get_settings().riskoptima_path
    candidates = [
        configured,
        Path(__file__).resolve().parents[4] / "portfolio_risk_kit",
        Path("C:/repo/portfolio_risk_kit"),
    ]
    for candidate in candidates:
        resolved = candidate.resolve()
        if (resolved / "riskoptima").exists() and str(resolved) not in sys.path:
            sys.path.insert(0, str(resolved))
            return


def _build_market_risk_report(returns: pd.DataFrame, weights: pd.Series, benchmark: pd.Series):
    _ensure_riskoptima_path()
    try:
        from riskoptima.reporting import build_market_risk_report

        return build_market_risk_report(
            returns,
            weights=weights,
            benchmark_returns=benchmark,
            confidence_levels=(0.95, 0.99),
        )
    except Exception:
        portfolio = returns.dot(weights).dropna()
        rolling_drawdown = _rolling_drawdown(portfolio)
        metrics = {
            "annualized_return": float((1.0 + portfolio).prod() ** (252 / len(portfolio)) - 1.0),
            "annualized_volatility": float(portfolio.std(ddof=0) * np.sqrt(252)),
            "sharpe": float(portfolio.mean() * 252 / (portfolio.std(ddof=0) * np.sqrt(252))),
            "sortino": float(portfolio.mean() * 252 / (portfolio[portfolio < 0].std(ddof=0) * np.sqrt(252))),
            "max_drawdown": float(rolling_drawdown.min()),
            "historical_var": {0.95: float(-portfolio.quantile(0.05)), 0.99: float(-portfolio.quantile(0.01))},
            "parametric_gaussian_var": {
                0.95: float(-(portfolio.mean() + norm.ppf(0.05) * portfolio.std(ddof=0))),
                0.99: float(-(portfolio.mean() + norm.ppf(0.01) * portfolio.std(ddof=0))),
            },
            "cvar": {},
            "beta": float(np.cov(portfolio, benchmark.loc[portfolio.index], ddof=0)[0, 1] / benchmark.var(ddof=0)),
            "rolling_drawdown": rolling_drawdown,
            "portfolio_returns": portfolio,
        }
        for confidence, value in metrics["historical_var"].items():
            tail = portfolio[portfolio <= -value]
            metrics["cvar"][confidence] = float(-tail.mean()) if not tail.empty else value
        return type("FallbackRiskReport", (), {"metrics": metrics})()


def _rolling_drawdown(returns: pd.Series) -> pd.Series:
    wealth = (1.0 + returns).cumprod()
    return wealth / wealth.cummax() - 1.0


def _factor_exposures(asset_returns: pd.DataFrame, factor_returns: pd.DataFrame, weights: pd.Series) -> pd.Series:
    _ensure_riskoptima_path()
    try:
        from riskoptima.risk import FactorRiskModel

        model = FactorRiskModel(factor_returns=factor_returns).fit(asset_returns)
        exposures = model.exposures.mul(weights.reindex(model.exposures.index), axis=0).sum()
        return exposures
    except Exception:
        rows = {}
        x = factor_returns.values
        for symbol in asset_returns.columns:
            regressor = LinearRegression().fit(x, asset_returns[symbol].values)
            rows[symbol] = regressor.coef_
        exposure_frame = pd.DataFrame(rows, index=factor_returns.columns).T
        return exposure_frame.mul(weights.reindex(exposure_frame.index), axis=0).sum()


def _optimize_portfolio(returns: pd.DataFrame, weights: pd.Series, risk_free_rate: float = 0.0) -> dict:
    expected_returns = returns.mean() * 252
    covariance = returns.cov() * 252
    rng = np.random.default_rng(31_337)
    symbols = list(weights.index)

    def metrics(candidate: pd.Series) -> dict[str, float]:
        candidate = candidate.reindex(symbols).astype(float)
        annual_return = float(candidate.dot(expected_returns.reindex(symbols)))
        volatility = float(np.sqrt(candidate.values.T @ covariance.reindex(index=symbols, columns=symbols).values @ candidate.values))
        sharpe = float((annual_return - risk_free_rate) / volatility) if volatility else 0.0
        return {"return": annual_return, "volatility": volatility, "sharpe": sharpe}

    _ensure_riskoptima_path()
    try:
        from riskoptima import optimize_max_sharpe, optimize_min_variance

        max_sharpe = optimize_max_sharpe(expected_returns.reindex(symbols), covariance.reindex(index=symbols, columns=symbols), risk_free_rate=risk_free_rate)
        min_variance = optimize_min_variance(covariance.reindex(index=symbols, columns=symbols), expected_returns=expected_returns.reindex(symbols))
    except Exception:
        simulated_weights = rng.dirichlet(np.ones(len(symbols)), size=4000)
        simulated_metrics = []
        for row in simulated_weights:
            candidate = pd.Series(row, index=symbols)
            simulated_metrics.append(metrics(candidate))
        max_sharpe = pd.Series(simulated_weights[int(np.argmax([item["sharpe"] for item in simulated_metrics]))], index=symbols)
        min_variance = pd.Series(simulated_weights[int(np.argmin([item["volatility"] for item in simulated_metrics]))], index=symbols)

    frontier = []
    for row in rng.dirichlet(np.ones(len(symbols)), size=1500):
        candidate = pd.Series(row, index=symbols)
        item = metrics(candidate)
        frontier.append({"volatility": item["volatility"], "return": item["return"], "sharpe": item["sharpe"]})

    current_metrics = metrics(weights)
    max_sharpe_metrics = metrics(max_sharpe)
    min_variance_metrics = metrics(min_variance)

    return {
        "summary": {
            "current": current_metrics,
            "max_sharpe": max_sharpe_metrics,
            "min_variance": min_variance_metrics,
        },
        "efficient_frontier": frontier,
        "allocation_comparison": [
            {
                "symbol": symbol,
                "current": float(weights[symbol]),
                "max_sharpe": float(max_sharpe.reindex(symbols)[symbol]),
                "min_variance": float(min_variance.reindex(symbols)[symbol]),
            }
            for symbol in symbols
        ],
        "correlation_matrix": [
            {"x": left, "y": right, "value": float(value)}
            for left, row in returns.reindex(columns=symbols).corr().iterrows()
            for right, value in row.items()
        ],
        "highlight_points": [
            {"name": "Current", **current_metrics},
            {"name": "Max Sharpe", **max_sharpe_metrics},
            {"name": "Min Variance", **min_variance_metrics},
        ],
    }


def _var_contributors(returns: pd.DataFrame, weights: pd.Series, portfolio_value: float, confidence: float = 0.95) -> list[dict[str, float | str]]:
    covariance = returns.cov().reindex(index=weights.index, columns=weights.index).fillna(0.0)
    weights_vector = weights.values
    sigma = float(np.sqrt(weights_vector.T @ covariance.values @ weights_vector))
    if sigma == 0:
        return []
    z_score = float(norm.ppf(confidence))
    portfolio_var = z_score * sigma * portfolio_value
    marginal_risk = covariance.values @ weights_vector / sigma
    component_percent = weights_vector * marginal_risk / sigma
    rows = []
    for idx, symbol in enumerate(weights.index):
        rows.append(
            {
                "symbol": symbol,
                "weight": float(weights_vector[idx]),
                "marginal_var": float(z_score * marginal_risk[idx] * portfolio_value),
                "component_var": float(component_percent[idx] * portfolio_var),
                "component_percent": float(component_percent[idx]),
            }
        )
    return sorted(rows, key=lambda row: abs(float(row["component_var"])), reverse=True)


def _metric(name: str, value: float, unit: str = "ratio", description: str = "", confidence: float | None = None) -> RiskMetric:
    return RiskMetric(name=name, value=float(value), unit=unit, description=description, confidence=confidence)


def build_portfolio_risk_report(portfolio: Portfolio) -> RiskReport:
    returns, factor_returns = generate_synthetic_market_data(portfolio)
    market_values = pd.Series({position.instrument.symbol: position.market_value for position in portfolio.positions})
    weights = market_values / market_values.sum()
    benchmark = factor_returns["Market"].rename("benchmark")
    report = _build_market_risk_report(returns, weights=weights, benchmark=benchmark)
    metrics = report.metrics
    portfolio_returns = metrics["portfolio_returns"]
    losses = -portfolio_returns

    var_cvar = []
    for confidence in (0.95, 0.99):
        var_value = float(metrics["historical_var"][confidence])
        cvar_value = float(metrics["cvar"][confidence])
        var_cvar.append(
            ChartPoint(
                name=f"{int(confidence * 100)}%",
                value=var_value,
                var95=var_value if confidence == 0.95 else None,
                cvar95=cvar_value if confidence == 0.95 else None,
                var99=var_value if confidence == 0.99 else None,
                cvar99=cvar_value if confidence == 0.99 else None,
            )
        )
    distribution_points = [
        ChartPoint(name=f"P{idx + 1}", value=float(value))
        for idx, value in enumerate(np.quantile(losses, np.linspace(0.02, 0.98, 32)))
    ]
    var_cvar.extend(distribution_points)

    rolling_drawdown = metrics["rolling_drawdown"].dropna()
    drawdown = [
        ChartPoint(date=index.strftime("%Y-%m-%d"), value=float(value))
        for index, value in rolling_drawdown.iloc[:: max(1, len(rolling_drawdown) // 120)].items()
    ]
    factor_exposure = [
        ChartPoint(name=factor, value=float(value))
        for factor, value in _factor_exposures(returns, factor_returns, weights).sort_values().items()
    ]

    contributors = _var_contributors(returns, weights, portfolio.market_value)
    stress_results = [run_stress_scenario(portfolio, scenario) for scenario in DEFAULT_SCENARIOS]
    positions = [
        {
            "symbol": position.instrument.symbol,
            "name": position.instrument.name,
            "asset_class": position.instrument.asset_class.value,
            "sector": position.instrument.sector,
            "market_value": position.market_value,
            "weight": float(weights[position.instrument.symbol]),
        }
        for position in portfolio.positions
    ]

    risk_metrics = [
        _metric("Market Value", portfolio.market_value, "currency", "Current gross market value."),
        _metric("Annualized Return", metrics["annualized_return"], "ratio", "Compounded annualized synthetic return."),
        _metric("Annualized Volatility", metrics["annualized_volatility"], "ratio", "Annualized standard deviation."),
        _metric("Historical VaR", metrics["historical_var"][0.95], "ratio", "Historical one-day loss percentile.", 0.95),
        _metric("CVaR", metrics["cvar"][0.95], "ratio", "Expected shortfall beyond VaR.", 0.95),
        _metric("Maximum Drawdown", metrics["max_drawdown"], "ratio", "Largest peak-to-trough loss."),
        _metric("Beta", metrics["beta"], "ratio", "Benchmark-relative sensitivity."),
        _metric("Sharpe Ratio", metrics["sharpe"], "ratio", "Annualized excess return per unit volatility."),
    ]

    return RiskReport(
        portfolio_id=portfolio.id,
        portfolio_name=portfolio.name,
        generated_at=datetime.now(timezone.utc),
        metrics=risk_metrics,
        var_cvar=var_cvar,
        drawdown=drawdown,
        factor_exposure=factor_exposure,
        largest_contributors=contributors,
        stress_results=stress_results,
        positions=positions,
        optimization=_optimize_portfolio(returns, weights),
    )
