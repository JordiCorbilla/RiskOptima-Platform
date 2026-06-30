from __future__ import annotations

from datetime import date, datetime, timezone

import numpy as np
import pandas as pd

from app.domain.models import Portfolio
from app.services.market_data_service import as_business_day, default_start_date, generate_price_paths, generate_synthetic_market_data, previous_business_day
from app.services.risk_service import _ensure_riskoptima_path, _rolling_drawdown


def _resolve_dates(start_date: date | None = None, as_of_date: date | None = None) -> tuple[date, date]:
    resolved_as_of = as_business_day(as_of_date) if as_of_date else previous_business_day()
    resolved_start = start_date or default_start_date(resolved_as_of)
    if resolved_start > resolved_as_of:
        raise ValueError("start_date must be on or before as_of_date")
    return resolved_start, resolved_as_of


def _sample_rows(frame: pd.DataFrame, max_points: int = 180) -> pd.DataFrame:
    if frame.empty or len(frame) <= max_points:
        return frame
    return frame.iloc[:: max(1, len(frame) // max_points)].tail(max_points)


def _signal_label(value: int) -> str:
    if value > 0:
        return "Buy"
    if value < 0:
        return "Sell"
    return "Hold"


def _trade_rows(trades: pd.DataFrame) -> list[dict]:
    if trades.empty:
        return []
    rows = []
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
    return rows


def build_signal_report(
    portfolio: Portfolio,
    start_date: date | None = None,
    as_of_date: date | None = None,
    short_window: int = 20,
    long_window: int = 50,
    stop_loss: float | None = 0.05,
    take_profit: float | None = 0.10,
) -> dict:
    if short_window <= 0 or long_window <= 0 or short_window >= long_window:
        raise ValueError("short_window must be positive and smaller than long_window")

    resolved_start, resolved_as_of = _resolve_dates(start_date, as_of_date)
    returns, _ = generate_synthetic_market_data(portfolio, start_date=resolved_start, as_of_date=resolved_as_of)
    prices = generate_price_paths(portfolio, returns)
    market_values = pd.Series({position.instrument.symbol: position.market_value for position in portfolio.positions})
    weights = market_values / market_values.sum()

    _ensure_riskoptima_path()
    from riskoptima.backtest import SMACrossStrategy, build_sma_signal_frame, run_backtest, trades_from_sma_signals
    from riskoptima.core import BacktestConfig

    summary = []
    details: dict[str, dict] = {}
    all_trades = []

    for position in portfolio.positions:
        symbol = position.instrument.symbol
        signal_frame = build_sma_signal_frame(
            prices[[symbol]].rename(columns={symbol: "Close"}),
            short_window=short_window,
            long_window=long_window,
        )
        trades = trades_from_sma_signals(signal_frame, ticker=symbol, stop_loss=stop_loss, take_profit=take_profit)
        symbol_returns = signal_frame["Close"].pct_change().dropna()
        drawdown = _rolling_drawdown(symbol_returns).dropna()
        latest = signal_frame.dropna().iloc[-1]
        signal_events = signal_frame[signal_frame["Signal"] != 0]
        last_event = signal_events.iloc[-1] if not signal_events.empty else None
        cumulative_trade_return = float((1.0 + trades["Return"]).prod() - 1.0) if not trades.empty else 0.0
        win_rate = float((trades["Return"] > 0).mean()) if not trades.empty else 0.0
        avg_trade_return = float(trades["Return"].mean()) if not trades.empty else 0.0
        sampled = _sample_rows(signal_frame)
        signal_points = [
            {
                "date": index.strftime("%Y-%m-%d"),
                "close": float(row["Close"]),
                "sma_short": None if pd.isna(row[f"SMA{short_window}"]) else float(row[f"SMA{short_window}"]),
                "sma_long": None if pd.isna(row[f"SMA{long_window}"]) else float(row[f"SMA{long_window}"]),
                "signal": int(row["Signal"]),
            }
            for index, row in sampled.iterrows()
        ]
        trade_payload = _trade_rows(trades)
        all_trades.extend(trade_payload)
        state = "Risk-on" if float(latest[f"SMA{short_window}"]) > float(latest[f"SMA{long_window}"]) else "Risk-off"
        summary_row = {
            "symbol": symbol,
            "name": position.instrument.name,
            "asset_class": position.instrument.asset_class.value,
            "sector": position.instrument.sector,
            "weight": float(weights[symbol]),
            "close": float(latest["Close"]),
            "sma_short": float(latest[f"SMA{short_window}"]),
            "sma_long": float(latest[f"SMA{long_window}"]),
            "state": state,
            "latest_signal": _signal_label(int(latest["Signal"])),
            "last_signal": _signal_label(int(last_event["Signal"])) if last_event is not None else "None",
            "last_signal_date": pd.Timestamp(last_event.name).strftime("%Y-%m-%d") if last_event is not None else None,
            "trade_count": int(len(trades)),
            "win_rate": win_rate,
            "average_trade_return": avg_trade_return,
            "cumulative_trade_return": cumulative_trade_return,
            "annualized_volatility": float(symbol_returns.std(ddof=0) * np.sqrt(252)) if not symbol_returns.empty else 0.0,
            "max_drawdown": float(drawdown.min()) if not drawdown.empty else 0.0,
        }
        summary.append(summary_row)
        details[symbol] = {
            **summary_row,
            "signals": signal_points,
            "trades": trade_payload,
        }

    strategy = SMACrossStrategy(short_window=short_window, long_window=long_window)
    equity_curve, weights_history = run_backtest(
        prices=prices,
        strategy=strategy,
        config=BacktestConfig(
            start=pd.Timestamp(resolved_start),
            end=pd.Timestamp(resolved_as_of),
            initial_cash=float(portfolio.market_value),
            rebalance_rule="D",
        ),
    )
    sampled_equity = _sample_rows(equity_curve)
    portfolio_equity = [
        {
            "date": index.strftime("%Y-%m-%d"),
            "value": float(row["PortfolioValue"]),
            "cash": float(row["Cash"]),
            "costs": float(row["Costs"]),
            "turnover": float(row["Turnover"]),
        }
        for index, row in sampled_equity.iterrows()
    ]
    final_weights = weights_history.tail(1).fillna(0.0).to_dict("records")

    summary = sorted(summary, key=lambda row: (row["state"] != "Risk-on", -abs(float(row["weight"]))))
    return {
        "portfolio_id": portfolio.id,
        "portfolio_name": portfolio.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "start_date": resolved_start.isoformat(),
        "as_of_date": resolved_as_of.isoformat(),
        "short_window": short_window,
        "long_window": long_window,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "summary": summary,
        "details": details,
        "portfolio_equity": portfolio_equity,
        "portfolio_final_weights": final_weights[0] if final_weights else {},
        "trades": sorted(all_trades, key=lambda row: row["exit_date"], reverse=True),
    }
