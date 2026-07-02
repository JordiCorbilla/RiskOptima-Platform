from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from app.domain.models import BacktestRunRequest, BacktestRunResponse, Portfolio, RunDiagnostics
from app.services.market_data_service import as_business_day, default_start_date, generate_price_paths, generate_synthetic_market_data, previous_business_day
from app.services.risk_service import _rolling_drawdown, _ensure_riskoptima_path


def _resolve_dates(start_date: date | None = None, as_of_date: date | None = None) -> tuple[date, date]:
    resolved_as_of = as_business_day(as_of_date) if as_of_date else previous_business_day()
    resolved_start = start_date or default_start_date(resolved_as_of)
    if resolved_start > resolved_as_of:
        raise ValueError("start_date must be on or before as_of_date")
    return resolved_start, resolved_as_of


def _sample_rows(frame: pd.DataFrame, max_points: int = 220) -> pd.DataFrame:
    if frame.empty or len(frame) <= max_points:
        return frame
    return frame.iloc[:: max(1, len(frame) // max_points)].tail(max_points)


def _performance_from_equity(equity: pd.Series) -> dict[str, float]:
    returns = equity.pct_change().dropna()
    drawdown = equity / equity.cummax() - 1.0
    total_return = float(equity.iloc[-1] / equity.iloc[0] - 1.0) if len(equity) > 1 else 0.0
    annualized_return = float((1.0 + total_return) ** (252 / max(len(returns), 1)) - 1.0)
    annualized_vol = float(returns.std(ddof=0) * np.sqrt(252)) if not returns.empty else 0.0
    downside = returns[returns < 0]
    downside_vol = float(downside.std(ddof=0) * np.sqrt(252)) if not downside.empty else 0.0
    return {
        "final_value": float(equity.iloc[-1]),
        "total_return": total_return,
        "annualized_return": annualized_return,
        "annualized_volatility": annualized_vol,
        "sharpe": float(returns.mean() * 252 / annualized_vol) if annualized_vol else 0.0,
        "sortino": float(returns.mean() * 252 / downside_vol) if downside_vol else 0.0,
        "max_drawdown": float(drawdown.min()) if not drawdown.empty else 0.0,
    }


def _static_equity(prices: pd.DataFrame, weights: pd.Series, initial_cash: float) -> pd.Series:
    returns = prices.pct_change().fillna(0.0).reindex(columns=weights.index)
    return initial_cash * (1.0 + returns.dot(weights)).cumprod()


def _trade_rows(prices: pd.DataFrame, short_window: int, long_window: int, stop_loss: float | None, take_profit: float | None) -> list[dict]:
    from riskoptima.backtest import build_sma_signal_frame, trades_from_sma_signals

    rows = []
    for symbol in prices.columns:
        frame = build_sma_signal_frame(prices[[symbol]].rename(columns={symbol: "Close"}), short_window=short_window, long_window=long_window)
        trades = trades_from_sma_signals(frame, ticker=symbol, stop_loss=stop_loss, take_profit=take_profit)
        for row in trades.to_dict("records"):
            rows.append(
                {
                    "ticker": row["Ticker"],
                    "entry_date": pd.Timestamp(row["Entry Date"]).strftime("%Y-%m-%d"),
                    "exit_date": pd.Timestamp(row["Exit Date"]).strftime("%Y-%m-%d"),
                    "entry_price": float(row["Entry Price"]),
                    "exit_price": float(row["Exit Price"]),
                    "return": float(row["Return"]),
                    "exit_reason": row["Exit Reason"],
                }
            )
    return sorted(rows, key=lambda row: row["exit_date"], reverse=True)


def run_backtest_studio(portfolio: Portfolio, request: BacktestRunRequest) -> BacktestRunResponse:
    if request.short_window >= request.long_window:
        raise ValueError("short_window must be smaller than long_window")
    resolved_start, resolved_as_of = _resolve_dates(request.start_date, request.as_of_date)
    returns, _ = generate_synthetic_market_data(portfolio, start_date=resolved_start, as_of_date=resolved_as_of)
    prices = generate_price_paths(portfolio, returns)
    initial_cash = float(request.initial_cash or portfolio.market_value)
    market_values = pd.Series({position.instrument.symbol: position.market_value for position in portfolio.positions})
    current_weights = market_values / market_values.sum()

    _ensure_riskoptima_path()
    from riskoptima.backtest import SMACrossStrategy, run_backtest
    from riskoptima.backtest.engine import BacktestConfig, SimpleCostModel
    from riskoptima.optim import Constraints, optimize_max_sharpe

    diagnostics = RunDiagnostics(
        functions_executed=[
            "riskoptima.backtest.SMACrossStrategy",
            "riskoptima.backtest.run_backtest",
            "riskoptima.backtest.trades_from_sma_signals",
            "riskoptima.optim.optimize_max_sharpe",
        ]
    )
    strategy = SMACrossStrategy(short_window=request.short_window, long_window=request.long_window)
    equity_curve, weights_history = run_backtest(
        prices=prices,
        strategy=strategy,
        config=BacktestConfig(
            start=pd.Timestamp(resolved_start),
            end=pd.Timestamp(resolved_as_of),
            initial_cash=initial_cash,
            rebalance_rule=request.rebalance_rule,
            slippage_bps=request.slippage_bps,
        ),
        cost_model=SimpleCostModel(spread_bps=request.spread_bps, impact_coeff=request.slippage_bps * 1e-4),
    )
    equity = equity_curve["PortfolioValue"].astype(float)
    metrics = _performance_from_equity(equity)
    drawdown = equity / equity.cummax() - 1.0
    trades = _trade_rows(prices, request.short_window, request.long_window, request.stop_loss, request.take_profit)
    win_rate = float(np.mean([row["return"] > 0 for row in trades])) if trades else 0.0

    expected = returns.mean() * 252
    cov = returns.cov() * 252
    optimized_weights = optimize_max_sharpe(expected_returns=expected, cov=cov, constraints=Constraints(weight_bounds=(0.0, 0.65)), risk_free_rate=0.04)
    static_equity = _static_equity(prices, current_weights, initial_cash)
    optimized_equity = _static_equity(prices, optimized_weights.reindex(prices.columns).fillna(0.0), initial_cash)
    comparisons = [
        {"strategy": "Current static portfolio", **_performance_from_equity(static_equity)},
        {"strategy": "SMA crossover", **metrics},
        {"strategy": "Optimized max Sharpe allocation", **_performance_from_equity(optimized_equity)},
    ]

    sampled_equity = _sample_rows(equity_curve)
    sampled_drawdown = _sample_rows(drawdown.to_frame("drawdown"))
    generated_code = f"""from riskoptima.backtest import SMACrossStrategy, run_backtest
from riskoptima.backtest.engine import BacktestConfig, SimpleCostModel
strategy = SMACrossStrategy(short_window={request.short_window}, long_window={request.long_window})
equity_curve, weights = run_backtest(
    prices=synthetic_prices,
    strategy=strategy,
    config=BacktestConfig(start='{resolved_start.isoformat()}', end='{resolved_as_of.isoformat()}', initial_cash={initial_cash:.2f}, rebalance_rule='{request.rebalance_rule}', slippage_bps={request.slippage_bps}),
    cost_model=SimpleCostModel(spread_bps={request.spread_bps}, impact_coeff={request.slippage_bps * 1e-4:.8f}),
)"""

    return BacktestRunResponse(
        portfolio_id=portfolio.id,
        strategy_name="SMA Crossover",
        parameters={
            "start_date": resolved_start.isoformat(),
            "as_of_date": resolved_as_of.isoformat(),
            "strategy_type": request.strategy_type,
            "short_window": request.short_window,
            "long_window": request.long_window,
            "rebalance_rule": request.rebalance_rule,
            "initial_cash": initial_cash,
            "spread_bps": request.spread_bps,
            "slippage_bps": request.slippage_bps,
            "stop_loss": request.stop_loss,
            "take_profit": request.take_profit,
        },
        equity_curve=[
            {
                "date": index.strftime("%Y-%m-%d"),
                "value": float(row["PortfolioValue"]),
                "cash": float(row.get("Cash", 0.0)),
                "costs": float(row.get("Costs", 0.0)),
                "turnover": float(row.get("Turnover", 0.0)),
            }
            for index, row in sampled_equity.iterrows()
        ],
        drawdown_curve=[{"date": index.strftime("%Y-%m-%d"), "drawdown": float(row["drawdown"])} for index, row in sampled_drawdown.iterrows()],
        trades=trades[:250],
        turnover=float(equity_curve["Turnover"].sum()) if "Turnover" in equity_curve else 0.0,
        win_rate=win_rate,
        comparisons=comparisons,
        generated_code=generated_code,
        diagnostics=diagnostics,
        **metrics,
    )
