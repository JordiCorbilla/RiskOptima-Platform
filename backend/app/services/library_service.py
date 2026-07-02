from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version
from importlib.util import find_spec
from pathlib import Path
import platform

import numpy as np
import pandas as pd

from app.core.config import get_settings
from app.core.version import PLATFORM_ENGINE_VERSION, PLATFORM_VERSION
from app.domain.models import ExampleRunRequest, ExampleRunResponse, LibraryCapability, LibraryMetadata, RunDiagnostics
from app.services.risk_service import _ensure_riskoptima_path


def get_library_metadata() -> LibraryMetadata:
    _ensure_riskoptima_path()
    spec = find_spec("riskoptima")
    try:
        package_version = version("riskoptima")
    except PackageNotFoundError:
        package_version = None
    source = spec.origin if spec and spec.origin else None
    configured = get_settings().riskoptima_path
    local_override = bool(configured and source and str(configured.resolve()).lower() in str(Path(source).resolve()).lower())
    return LibraryMetadata(
        package_name="riskoptima",
        installed_version=package_version,
        import_source=source,
        installed=spec is not None,
        local_checkout_override_active=local_override,
        python_version=platform.python_version(),
        platform_version=PLATFORM_VERSION,
        platform_engine_version=PLATFORM_ENGINE_VERSION,
    )


def list_library_capabilities() -> list[LibraryCapability]:
    rows = [
        ("riskoptima.reporting", "build_market_risk_report", "portfolio risk", True, "/api/portfolios/{id}/risk", "Portfolio Risk", "Market risk metrics, VaR/CVaR, beta, drawdown, and return streams."),
        ("riskoptima.RiskOptima", "plot_efficient_frontier_monte_carlo", "optimization", True, "/api/portfolios/{id}/generate", "Portfolio Risk", "Efficient frontier, max-Sharpe and min-variance allocation diagnostics."),
        ("riskoptima.risk", "FactorRiskModel", "risk attribution", True, "/api/portfolios/{id}/risk", "Portfolio Risk", "Factor exposure estimation and weighted beta decomposition."),
        ("riskoptima.risk", "component_var / marginal_var", "risk attribution", True, "/api/portfolios/{id}/risk", "Portfolio Risk", "Marginal and component risk contribution calculations."),
        ("riskoptima.volatility", "historical_volatility / ewma_volatility / rolling_volatility", "volatility", True, "/api/portfolios/{id}/notebooks", "RiskOptima Explorer", "Historical, EWMA, realized, and rolling volatility toolkit."),
        ("riskoptima.options", "price_option_chain", "options", True, "/api/portfolios/{id}/options-workbench", "Options Workbench", "Synthetic option chain pricing by strike, expiry, and option type."),
        ("riskoptima.options", "build_implied_vol_surface", "options", True, "/api/portfolios/{id}/options-workbench", "Options Workbench", "Implied-volatility surface from deterministic synthetic chain prices."),
        ("riskoptima.options", "build_greeks_grid", "options", True, "/api/portfolios/{id}/options-workbench", "Options Workbench", "Delta, gamma, theta, vega, and rho-style risk grids across strikes and expiries."),
        ("riskoptima.options", "option_scenario_grid", "options", True, "/api/portfolios/{id}/options-workbench", "Options Workbench", "Spot and volatility shock scenario PnL for a selected contract."),
        ("riskoptima.options", "event_straddle_analysis", "options", True, "/api/portfolios/{id}/options-workbench", "Options Workbench", "Event straddle pricing and breakeven diagnostics."),
        ("riskoptima.backtest", "SMACrossStrategy", "backtesting", True, "/api/portfolios/{id}/backtests/run", "Backtest Studio", "SMA crossover strategy model used by portfolio-level backtests."),
        ("riskoptima.backtest", "run_backtest", "backtesting", True, "/api/portfolios/{id}/backtests/run", "Backtest Studio", "Deterministic synthetic backtest engine for strategy equity, turnover, and costs."),
        ("riskoptima.backtest", "trades_from_sma_signals", "backtesting", True, "/api/portfolios/{id}/backtests/run", "Backtest Studio", "Trade extraction from SMA crossover signals with stop-loss/take-profit exits."),
        ("riskoptima.credit", "expected_loss / credit_var / credit_cvar / merton_pd", "credit", True, "/api/portfolios/{id}/notebooks", "RiskOptima Explorer", "Synthetic credit expected loss, VaR/CVaR, migration, and Merton PD views."),
        ("riskoptima.RiskOptima", "macaulay_duration_v3", "fixed income", True, "/api/portfolios/{id}/notebooks", "RiskOptima Explorer", "Duration, modified duration, PVBP, and convexity measures."),
        ("riskoptima.reporting", "build_markov_regime_report", "regimes", True, "/api/portfolios/{id}/notebooks", "RiskOptima Explorer", "Markov regime probabilities, summaries, and transition matrix."),
        ("riskoptima.risk", "run_scenario_set", "scenarios", True, "/api/portfolios/{id}/stress", "Portfolio Risk", "Scenario shock execution and stress PnL decomposition."),
        ("riskoptima.reporting", "portfolio sophistication reports", "reporting", True, "/api/portfolios/{id}/notebooks", "RiskOptima Explorer", "Comparison of portfolio construction approaches and weights."),
    ]
    return [
        LibraryCapability(
            module=module,
            name=name,
            category=category,
            surfaced_in_platform=surfaced,
            demo_endpoint=endpoint,
            ui_module=ui_module,
            description=description,
            example_code=_capability_code(module, name),
        )
        for module, name, category, surfaced, endpoint, ui_module, description in rows
    ]


def _capability_code(module: str, name: str) -> str:
    return f"from {module} import {name.split(' / ')[0].split()[0]}\n# See the linked platform module for deterministic synthetic inputs."


def run_library_example(request: ExampleRunRequest) -> ExampleRunResponse:
    _ensure_riskoptima_path()
    example = request.example
    diagnostics = RunDiagnostics(fallback_used=False)
    rng = np.random.default_rng(25_052)

    if example == "black_scholes_price":
        from riskoptima.options import black_scholes_price

        inputs = {"S": 100.0, "K": 102.0, "T": 45 / 365, "r": 0.04, "sigma": 0.22, "option_type": "call"}
        result = {"price": float(black_scholes_price(**inputs))}
        code = "from riskoptima.options import black_scholes_price\nprice = black_scholes_price(S=100, K=102, T=45/365, r=0.04, sigma=0.22, option_type='call')"
        diagnostics.functions_executed.append("riskoptima.options.black_scholes_price")
        title = "Black-Scholes Price"
    elif example == "greeks":
        from riskoptima.options import black_scholes_greeks

        inputs = {"S": 100.0, "K": 100.0, "T": 30 / 365, "r": 0.04, "sigma": 0.2, "option_type": "call"}
        greeks = black_scholes_greeks(**inputs)
        result = {key: float(value) for key, value in greeks.items()} if isinstance(greeks, dict) else {
            "delta": float(greeks[0]),
            "gamma": float(greeks[1]),
            "theta": float(greeks[2]),
            "vega": float(greeks[3]),
        }
        code = "from riskoptima.options import black_scholes_greeks\ngreeks = black_scholes_greeks(S=100, K=100, T=30/365, r=0.04, sigma=0.20, option_type='call')"
        diagnostics.functions_executed.append("riskoptima.options.black_scholes_greeks")
        title = "Option Greeks"
    elif example == "implied_volatility":
        from riskoptima.options import black_scholes_price, implied_volatility

        market_price = float(black_scholes_price(100, 100, 60 / 365, 0.04, 0.24, option_type="call"))
        inputs = {"market_price": market_price, "S": 100.0, "K": 100.0, "T": 60 / 365, "r": 0.04, "option_type": "call"}
        result = {"implied_volatility": float(implied_volatility(**inputs))}
        code = "from riskoptima.options import implied_volatility\niv = implied_volatility(market_price=5.10, S=100, K=100, T=60/365, r=0.04, option_type='call')"
        diagnostics.functions_executed.append("riskoptima.options.implied_volatility")
        title = "Implied Volatility"
    elif example == "var_cvar":
        from riskoptima import RiskOptima

        returns = pd.Series(rng.normal(0.0004, 0.012, 504), name="portfolio")
        inputs = {"confidence": 0.95, "observations": len(returns)}
        result = {
            "var_95": float(RiskOptima.var_historic(returns, level=5) if hasattr(RiskOptima, "var_historic") else -returns.quantile(0.05)),
            "cvar_95": float(RiskOptima.cvar_historic(returns, level=5)),
        }
        code = "from riskoptima import RiskOptima\nvar_95 = RiskOptima.var_historic(returns, level=5)\ncvar_95 = RiskOptima.cvar_historic(returns, level=5)"
        diagnostics.functions_executed.extend(["riskoptima.RiskOptima.cvar_historic"])
        if not hasattr(RiskOptima, "var_historic"):
            diagnostics.fallback_used = True
            diagnostics.warnings.append("RiskOptima exposes cvar_historic in 2.5.2; VaR percentile used platform fallback.")
        title = "VaR / CVaR"
    elif example == "volatility_estimator":
        from riskoptima.volatility import ewma_volatility, historical_volatility, rolling_volatility

        returns = pd.Series(rng.normal(0.0003, 0.011, 252), name="asset")
        inputs = {"observations": len(returns), "input_type": "returns"}
        rolling = rolling_volatility(returns, window=21, input_type="returns").dropna()
        result = {
            "historical_volatility": float(historical_volatility(returns, input_type="returns")),
            "ewma_volatility": float(ewma_volatility(returns, input_type="returns")),
            "latest_rolling_21d": float(rolling.iloc[-1]),
        }
        code = "from riskoptima.volatility import historical_volatility, ewma_volatility, rolling_volatility\nhist = historical_volatility(returns, input_type='returns')"
        diagnostics.functions_executed.extend(["riskoptima.volatility.historical_volatility", "riskoptima.volatility.ewma_volatility", "riskoptima.volatility.rolling_volatility"])
        title = "Volatility Estimator"
    elif example == "optimizer":
        from riskoptima.optim import Constraints, optimize_max_sharpe, optimize_min_variance

        returns = pd.DataFrame(rng.normal(0.00035, 0.012, (504, 4)), columns=["SPY", "EFA", "LQD", "GLD"])
        expected = returns.mean() * 252
        cov = returns.cov() * 252
        constraints = Constraints(weight_bounds=(0.05, 0.60))
        max_sharpe = optimize_max_sharpe(expected, cov, constraints=constraints, risk_free_rate=0.04)
        min_var = optimize_min_variance(cov, expected_returns=expected, constraints=constraints)
        inputs = {"assets": list(returns.columns), "risk_free_rate": 0.04}
        result = {
            "max_sharpe_weights": {key: float(value) for key, value in max_sharpe.items()},
            "min_variance_weights": {key: float(value) for key, value in min_var.items()},
        }
        code = "from riskoptima.optim import Constraints, optimize_max_sharpe\nweights = optimize_max_sharpe(expected_returns, covariance, constraints=Constraints(weight_bounds=(0.05, 0.60)), risk_free_rate=0.04)"
        diagnostics.functions_executed.extend(["riskoptima.optim.optimize_max_sharpe", "riskoptima.optim.optimize_min_variance"])
        title = "Optimizer"
    else:
        from riskoptima.credit import merton_pd

        inputs = {"asset_value": 135.0, "debt_face_value": 100.0, "asset_vol": 0.28, "risk_free_rate": 0.04, "maturity": 1.0}
        result = {"probability_of_default": float(merton_pd(**inputs))}
        code = "from riskoptima.credit import merton_pd\npd = merton_pd(asset_value=135, debt_face_value=100, asset_vol=0.28, risk_free_rate=0.04, maturity=1.0)"
        diagnostics.functions_executed.append("riskoptima.credit.merton_pd")
        title = "Merton PD"

    return ExampleRunResponse(example=example, title=title, inputs=inputs, result=result, generated_code=code, diagnostics=diagnostics)
