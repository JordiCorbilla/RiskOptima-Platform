from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd

from app.domain.models import Portfolio
from app.services.market_data_service import as_business_day, default_start_date, generate_price_paths, generate_synthetic_market_data, previous_business_day
from app.services.risk_service import _ensure_riskoptima_path


def _resolve_dates(start_date: date | None = None, as_of_date: date | None = None) -> tuple[date, date]:
    resolved_as_of = as_business_day(as_of_date) if as_of_date else previous_business_day()
    resolved_start = start_date or default_start_date(resolved_as_of)
    if resolved_start > resolved_as_of:
        raise ValueError("start_date must be on or before as_of_date")
    return resolved_start, resolved_as_of


def _sample_series(frame: pd.DataFrame, max_points: int = 180) -> pd.DataFrame:
    if len(frame) <= max_points:
        return frame
    return frame.iloc[:: max(1, len(frame) // max_points)].tail(max_points)


def _asset_table(portfolio: Portfolio) -> pd.DataFrame:
    total = portfolio.market_value
    return pd.DataFrame(
        [
            {
                "Asset": position.instrument.symbol,
                "Weight": position.market_value / total,
                "Label": position.instrument.name,
                "MarketCap": max(position.market_value * 40, 1_000_000),
                "Portfolio": position.market_value,
            }
            for position in portfolio.positions
        ]
    )


def _optimization_ml(portfolio: Portfolio, returns: pd.DataFrame) -> dict:
    _ensure_riskoptima_path()
    from riskoptima.optim import Constraints, optimize_max_sharpe, optimize_min_variance

    symbols = [position.instrument.symbol for position in portfolio.positions]
    annual_returns = returns.reindex(columns=symbols).mean() * 252
    covariance = returns.reindex(columns=symbols).cov() * 252
    constraints = Constraints(weight_bounds=(0.03, 0.35))
    min_var = optimize_min_variance(cov=covariance, expected_returns=annual_returns, constraints=constraints)
    max_sharpe = optimize_max_sharpe(expected_returns=annual_returns, cov=covariance, constraints=constraints, risk_free_rate=0.04)

    momentum = returns.reindex(columns=symbols).tail(63).mean() * 252
    vol = returns.reindex(columns=symbols).tail(126).std() * np.sqrt(252)
    score = (momentum / vol.replace(0, np.nan)).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    shifted = score - score.min() + 0.01
    ml_weights = shifted / shifted.sum()
    ml_weights = ml_weights.clip(lower=0.03, upper=0.35)
    ml_weights = ml_weights / ml_weights.sum()

    current_values = pd.Series({position.instrument.symbol: position.market_value for position in portfolio.positions})
    current = current_values / current_values.sum()

    def perf(weights: pd.Series) -> dict:
        series = returns.reindex(columns=symbols).dot(weights.reindex(symbols).fillna(0.0))
        return {
            "return": float((1 + series).prod() ** (252 / len(series)) - 1),
            "volatility": float(series.std(ddof=0) * np.sqrt(252)),
            "sharpe": float(series.mean() * 252 / (series.std(ddof=0) * np.sqrt(252))) if series.std(ddof=0) else 0.0,
        }

    return {
        "weights": [
            {
                "symbol": symbol,
                "current": float(current[symbol]),
                "min_variance": float(min_var.reindex(symbols)[symbol]),
                "max_sharpe": float(max_sharpe.reindex(symbols)[symbol]),
                "ml_adjusted": float(ml_weights.reindex(symbols)[symbol]),
                "momentum_score": float(score[symbol]),
            }
            for symbol in symbols
        ],
        "metrics": {
            "current": perf(current),
            "min_variance": perf(min_var),
            "max_sharpe": perf(max_sharpe),
            "ml_adjusted": perf(ml_weights),
        },
    }


def _index_vol_divergence(returns: pd.DataFrame) -> dict:
    _ensure_riskoptima_path()
    from riskoptima import RiskOptima

    base_returns = returns.mean(axis=1)
    base = 100 * (1 + base_returns).cumprod()
    rolling_vol = base_returns.rolling(20).std().fillna(base_returns.std()) * np.sqrt(252)
    rng = np.random.default_rng(44_031)
    vix = (14 + rolling_vol * 95 + rng.normal(0, 1.5, len(rolling_vol))).clip(lower=9)
    df = pd.DataFrame({"base_Close": base, "VIX_Close": vix}, index=returns.index)
    df["MA30"] = df["base_Close"].rolling(30).mean()
    df["STD30"] = df["base_Close"].rolling(30).std()
    df["Upper_Band"] = df["MA30"] + 2 * df["STD30"]
    df["Lower_Band"] = df["MA30"] - 2 * df["STD30"]

    signals = []
    minima = [
        i
        for i in range(1, len(df) - 1)
        if df["base_Close"].iloc[i] < df["base_Close"].iloc[i - 1] and df["base_Close"].iloc[i] < df["base_Close"].iloc[i + 1]
    ]
    for first, second in zip(minima[:-1], minima[1:]):
        if (
            df["base_Close"].iloc[second] < df["base_Close"].iloc[first]
            and df["VIX_Close"].iloc[second] > df["VIX_Close"].iloc[first]
            and df["Lower_Band"].iloc[second] <= df["base_Close"].iloc[second] <= df["Upper_Band"].iloc[second]
        ):
            signals.append(
                {
                    "SignalDate": df.index[second],
                    "base_Close": float(df["base_Close"].iloc[second]),
                    "VIX_Close": float(df["VIX_Close"].iloc[second]),
                    "Comment": "Second lower low + higher VIX + within +/-2 sigma",
                }
            )
    df_signals = pd.DataFrame(signals)
    if df_signals.empty:
        df_signals = pd.DataFrame(columns=["SignalDate", "base_Close", "VIX_Close", "Comment"])
    exits = RiskOptima.exit_strategy(df, df_signals, symbol_base="SYN", intraday=False) if not df_signals.empty else pd.DataFrame()
    total_returns = RiskOptima.calculate_total_returns(df_signals, exits) if not exits.empty else pd.DataFrame()

    sampled = _sample_series(df)
    return {
        "series": [
            {
                "date": index.strftime("%Y-%m-%d"),
                "base": float(row["base_Close"]),
                "vix": float(row["VIX_Close"]),
                "ma": None if pd.isna(row["MA30"]) else float(row["MA30"]),
                "upper": None if pd.isna(row["Upper_Band"]) else float(row["Upper_Band"]),
                "lower": None if pd.isna(row["Lower_Band"]) else float(row["Lower_Band"]),
            }
            for index, row in sampled.iterrows()
        ],
        "signals": [
            {
                "date": pd.Timestamp(row["SignalDate"]).strftime("%Y-%m-%d"),
                "base": float(row["base_Close"]),
                "vix": float(row["VIX_Close"]),
                "comment": row["Comment"],
            }
            for row in df_signals.to_dict("records")
        ],
        "exits": [
            {
                "entry_date": pd.Timestamp(row["EntryDate"]).strftime("%Y-%m-%d"),
                "exit_date": pd.Timestamp(row["ExitDate"]).strftime("%Y-%m-%d"),
                "entry_price": float(row["EntryPrice"]),
                "exit_price": float(row["ExitPrice"]),
                "reason": row["Reason"],
            }
            for row in exits.to_dict("records")
        ],
        "returns": [
            {
                "entry_date": pd.Timestamp(row["EntryDate"]).strftime("%Y-%m-%d"),
                "exit_date": pd.Timestamp(row["ExitDate"]).strftime("%Y-%m-%d"),
                "pnl": float(row["PnL"]),
                "total_return": float(row["TotalReturn"]),
            }
            for row in total_returns.to_dict("records")
        ],
    }


def _options_workbench(portfolio: Portfolio, prices: pd.DataFrame) -> dict:
    _ensure_riskoptima_path()
    from riskoptima import RiskOptima

    symbol = portfolio.positions[0].instrument.symbol
    spot = float(prices[symbol].iloc[-1])
    sigma = float(prices[symbol].pct_change().dropna().std(ddof=0) * np.sqrt(252))
    strikes = np.arange(spot * 0.85, spot * 1.16, spot * 0.025)
    greeks = []
    for strike in strikes:
        delta, gamma, theta, vega = RiskOptima.black_scholes_greeks(spot, strike, 30 / 365, 0.04, max(sigma, 0.05), "call")
        greeks.append({"strike": float(strike), "delta": float(delta), "gamma": float(gamma), "theta": float(theta), "vega": float(vega)})

    expiries = [15, 30, 45, 60, 90, 120, 180]
    term = [
        {
            "expiry_days": days,
            "iv": float(max(0.08, sigma * (1 + 0.25 * np.exp(-days / 45)))),
            "historical_vol": sigma,
        }
        for days in expiries
    ]
    event_dates = pd.date_range(end=prices.index[-1], periods=6, freq="63B")
    straddles = []
    for event_date in event_dates:
        before_idx = prices.index.searchsorted(event_date - pd.Timedelta(days=7))
        after_idx = min(len(prices.index) - 1, prices.index.searchsorted(event_date + pd.Timedelta(days=2)))
        if before_idx >= len(prices.index):
            continue
        entry = float(prices[symbol].iloc[before_idx])
        exit_ = float(prices[symbol].iloc[after_idx])
        cost = 0.05 * entry
        straddles.append(
            {
                "event_date": pd.Timestamp(event_date).strftime("%Y-%m-%d"),
                "entry_price": entry,
                "exit_price": exit_,
                "abs_move": abs(exit_ - entry),
                "straddle_cost": cost,
                "profit": abs(exit_ - entry) - cost,
            }
        )
    return {"symbol": symbol, "spot": spot, "historical_vol": sigma, "iv_term_structure": term, "greeks": greeks, "straddles": straddles}


def _credit_workbench(portfolio: Portfolio) -> dict:
    _ensure_riskoptima_path()
    from riskoptima.credit import credit_cvar, credit_var, expected_loss, merton_pd, simulate_credit_losses, simulate_rating_migration

    rows = []
    ratings = []
    rating_cycle = ["AAA", "AA", "A", "BBB", "BB", "B"]
    for idx, position in enumerate(portfolio.positions):
        pd_ = min(0.01 + idx * 0.006 + max(position.instrument.beta, 0) * 0.004, 0.18)
        lgd = 0.35 + 0.05 * (idx % 4)
        ead = position.market_value
        rating = rating_cycle[min(idx % len(rating_cycle), len(rating_cycle) - 1)]
        ratings.append(rating)
        rows.append({"symbol": position.instrument.symbol, "pd": pd_, "lgd": lgd, "ead": ead, "rating": rating, "expected_loss": float(expected_loss(pd_, lgd, ead))})
    credit_df = pd.DataFrame(rows)
    losses = simulate_credit_losses(credit_df, n_sims=4000, random_state=71)
    states = ["AAA", "AA", "A", "BBB", "BB", "B", "D"]
    matrix = pd.DataFrame(np.eye(len(states)) * 0.82, index=states, columns=states)
    for i, state in enumerate(states):
        matrix.iloc[i, i] = 0.82 if state != "D" else 1.0
        if state != "D":
            matrix.iloc[i, min(i + 1, len(states) - 1)] += 0.12
            matrix.iloc[i, max(i - 1, 0)] += 0.06
        matrix.iloc[i] = matrix.iloc[i] / matrix.iloc[i].sum()
    migration = simulate_rating_migration(ratings, matrix, periods=4, random_state=17)
    merton = [
        {
            "symbol": row["symbol"],
            "pd": float(merton_pd(row["ead"] * 1.35, row["ead"], 0.25 + row["pd"], 0.04, 1.0)),
        }
        for row in rows
    ]
    return {
        "obligors": rows,
        "portfolio_expected_loss": float(credit_df["expected_loss"].sum()),
        "credit_var_99": float(credit_var(losses, 0.99)),
        "credit_cvar_99": float(credit_cvar(losses, 0.99)),
        "loss_distribution": [{"bucket": int(q * 100), "loss": float(np.quantile(losses, q))} for q in np.linspace(0.5, 0.99, 20)],
        "migration": migration.astype(str).to_dict(orient="index"),
        "merton": merton,
    }


def _bond_workbench(portfolio: Portfolio) -> dict:
    _ensure_riskoptima_path()
    from riskoptima import RiskOptima

    fixed_income = [p for p in portfolio.positions if p.instrument.asset_class.value in {"Fixed Income", "Credit", "Cash"}] or portfolio.positions[:3]
    rows = []
    for idx, position in enumerate(fixed_income):
        maturity = 4 + idx * 2
        freq = 2
        coupon = 0.035 + 0.007 * idx
        yield_rate = 0.04 + 0.004 * idx
        cash_flows = RiskOptima.bond_cash_flows_v2(maturity * freq, 1000, coupon, freq)
        _, measures = RiskOptima.macaulay_duration_v3(cash_flows, yield_rate, freq)
        rows.append(
            {
                "symbol": position.instrument.symbol,
                "coupon": coupon,
                "yield": yield_rate,
                "maturity_years": maturity,
                "macaulay_duration": float(measures["Macaulay Duration"].iloc[0]),
                "modified_duration": float(measures["Modified Duration"].iloc[0]),
                "pvbp": float(measures["PVBP (DV01)"].iloc[0]),
                "convexity": float(measures["Convexity"].iloc[0]),
            }
        )
    return {"bonds": rows}


def _stochastic_vol() -> dict:
    _ensure_riskoptima_path()
    from riskoptima import RiskOptima

    np.random.seed(21)
    hw_s, hw_v = RiskOptima.simulate_hull_white()
    h_s, h_v = RiskOptima.simulate_heston()
    s_f, s_v = RiskOptima.simulate_sabr()
    dates = pd.date_range(end=pd.Timestamp(previous_business_day()), periods=len(hw_s), freq="B")
    return {
        "paths": [
            {
                "date": dates[i].strftime("%Y-%m-%d"),
                "hull_white": float(hw_s[i]),
                "heston": float(h_s[i]),
                "sabr": float(s_f[i]),
                "hull_white_vol": float(hw_v[i]),
                "heston_vol": float(h_v[i]),
                "sabr_vol": float(s_v[i]),
            }
            for i in range(0, len(dates), 2)
        ]
    }


def build_notebook_workbench(portfolio: Portfolio, start_date: date | None = None, as_of_date: date | None = None) -> dict:
    resolved_start, resolved_as_of = _resolve_dates(start_date, as_of_date)
    returns, _ = generate_synthetic_market_data(portfolio, start_date=resolved_start, as_of_date=resolved_as_of)
    prices = generate_price_paths(portfolio, returns)
    return {
        "portfolio_id": portfolio.id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "start_date": resolved_start.isoformat(),
        "as_of_date": resolved_as_of.isoformat(),
        "optimization_ml": _optimization_ml(portfolio, returns),
        "index_vol_divergence": _index_vol_divergence(returns),
        "options": _options_workbench(portfolio, prices),
        "credit": _credit_workbench(portfolio),
        "bonds": _bond_workbench(portfolio),
        "stochastic_volatility": _stochastic_vol(),
    }
