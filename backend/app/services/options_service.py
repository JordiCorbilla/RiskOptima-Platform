from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from app.domain.models import OptionsWorkbenchResponse, Portfolio, RunDiagnostics
from app.services.market_data_service import as_business_day, default_start_date, generate_price_paths, generate_synthetic_market_data, previous_business_day
from app.services.risk_service import _ensure_riskoptima_path


def _resolve_dates(start_date: date | None = None, as_of_date: date | None = None) -> tuple[date, date]:
    resolved_as_of = as_business_day(as_of_date) if as_of_date else previous_business_day()
    resolved_start = start_date or default_start_date(resolved_as_of)
    if resolved_start > resolved_as_of:
        raise ValueError("start_date must be on or before as_of_date")
    return resolved_start, resolved_as_of


def _records(frame: pd.DataFrame) -> list[dict]:
    clean = frame.replace([np.inf, -np.inf], np.nan).where(pd.notna(frame), None).copy()
    for column in clean.columns:
        if pd.api.types.is_datetime64_any_dtype(clean[column]):
            clean[column] = clean[column].dt.strftime("%Y-%m-%d")
    return clean.to_dict("records")


def _selected_symbol(portfolio: Portfolio, symbol: str | None) -> str:
    symbols = [position.instrument.symbol for position in portfolio.positions]
    if symbol and symbol in symbols:
        return symbol
    return symbols[0]


def build_options_workbench(
    portfolio: Portfolio,
    symbol: str | None = None,
    start_date: date | None = None,
    as_of_date: date | None = None,
) -> OptionsWorkbenchResponse:
    resolved_start, resolved_as_of = _resolve_dates(start_date, as_of_date)
    selected = _selected_symbol(portfolio, symbol)
    returns, _ = generate_synthetic_market_data(portfolio, start_date=resolved_start, as_of_date=resolved_as_of)
    prices = generate_price_paths(portfolio, returns)
    spot = float(prices[selected].iloc[-1])
    realized_vol = float(prices[selected].pct_change().dropna().std(ddof=0) * np.sqrt(252))
    base_vol = max(realized_vol, 0.08)
    valuation_date = pd.Timestamp(resolved_as_of)
    expiries = [valuation_date + pd.offsets.BDay(days) for days in (20, 45, 90, 135)]
    strikes = [round(float(spot * multiplier), 2) for multiplier in np.linspace(0.85, 1.15, 9)]

    _ensure_riskoptima_path()
    from riskoptima.options import (
        OptionContract,
        build_greeks_grid,
        build_implied_vol_surface,
        event_straddle_analysis,
        option_scenario_grid,
        price_option_chain,
    )

    diagnostics = RunDiagnostics(
        functions_executed=[
            "riskoptima.options.price_option_chain",
            "riskoptima.options.build_implied_vol_surface",
            "riskoptima.options.build_greeks_grid",
            "riskoptima.options.option_scenario_grid",
            "riskoptima.options.event_straddle_analysis",
        ]
    )

    chain_rows = []
    for expiry in expiries:
        days = max((expiry.date() - resolved_as_of).days, 1)
        for strike in strikes:
            moneyness = strike / spot
            volatility = float(base_vol * (1.0 + 0.18 * abs(moneyness - 1.0) + 0.08 * np.exp(-days / 60)))
            for option_type in ("call", "put"):
                chain_rows.append(
                    {
                        "underlying": selected,
                        "symbol": f"{selected}-{expiry.strftime('%Y%m%d')}-{option_type[0].upper()}{int(round(strike * 100)):08d}",
                        "option_type": option_type,
                        "strike": strike,
                        "expiry": expiry,
                        "volatility": volatility,
                        "quantity": 1.0,
                        "multiplier": 100.0,
                    }
                )
    chain = pd.DataFrame(chain_rows)
    valued = price_option_chain(chain, spot, valuation_date, risk_free_rate=0.04)
    surface_input = chain.copy()
    surface_input["market_price"] = valued["price"] * (1.0 + 0.025 * np.sin(surface_input["strike"] / spot))
    surface = build_implied_vol_surface(surface_input, spot, valuation_date, risk_free_rate=0.04)
    greeks = build_greeks_grid(
        spot=spot,
        strikes=strikes,
        expiries=expiries,
        volatility=base_vol,
        risk_free_rate=0.04,
        valuation_date=valuation_date,
        option_type="call",
    )
    contract = OptionContract(
        underlying=selected,
        strike=min(strikes, key=lambda value: abs(value - spot)),
        expiry=expiries[1],
        option_type="call",
        quantity=10.0,
        multiplier=100.0,
        implied_volatility=base_vol,
    )
    scenario = option_scenario_grid(
        contract,
        spot,
        valuation_date,
        risk_free_rate=0.04,
        volatility=base_vol,
        spot_shocks=(-0.10, -0.05, 0.0, 0.05, 0.10),
        volatility_shocks=(-0.05, 0.0, 0.05),
    )
    straddles = []
    for expiry in expiries[:3]:
        analysis = event_straddle_analysis(
            spot=spot,
            strike=contract.strike,
            expiry=expiry,
            valuation_date=valuation_date,
            risk_free_rate=0.04,
            volatility=base_vol,
            quantity=1.0,
            multiplier=100.0,
        )
        implied_move = float(analysis["straddle_price"] / spot)
        realized_move = float(abs(prices[selected].tail(20).pct_change().dropna()).mean() * np.sqrt(20))
        straddles.append(
            {
                "event_date": expiry.strftime("%Y-%m-%d"),
                "entry_price": float(analysis["straddle_price"]),
                "exit_price": float(analysis["straddle_price"] * (1.0 + realized_move - implied_move * 0.35)),
                "implied_move": implied_move,
                "realized_move": realized_move,
                "pnl": float((realized_move - implied_move) * spot * 100.0),
                **{key: float(value) for key, value in analysis.items()},
            }
        )

    aggregate_greeks = {
        key: float(valued[key].sum())
        for key in ("delta_exposure", "gamma_exposure", "theta_exposure", "vega_exposure", "rho_exposure")
        if key in valued
    }
    generated_code = f"""from riskoptima.options import price_option_chain, build_implied_vol_surface, build_greeks_grid, option_scenario_grid
chain = synthetic_option_chain('{selected}', spot={spot:.4f}, valuation_date='{resolved_as_of.isoformat()}')
valued = price_option_chain(chain, spot={spot:.4f}, valuation_date='{resolved_as_of.isoformat()}', risk_free_rate=0.04)
surface = build_implied_vol_surface(chain.assign(market_price=valued['price']), spot={spot:.4f}, valuation_date='{resolved_as_of.isoformat()}', risk_free_rate=0.04)
greeks = build_greeks_grid(spot={spot:.4f}, strikes=strikes, expiries=expiries, volatility={base_vol:.6f}, risk_free_rate=0.04, valuation_date='{resolved_as_of.isoformat()}')"""

    return OptionsWorkbenchResponse(
        portfolio_id=portfolio.id,
        underlying_symbol=selected,
        spot=spot,
        valuation_date=resolved_as_of,
        expiries=[expiry.strftime("%Y-%m-%d") for expiry in expiries],
        strikes=strikes,
        option_chain=_records(valued),
        aggregate_greeks=aggregate_greeks,
        iv_surface=_records(surface),
        scenario_grid=_records(scenario),
        event_straddle_analysis=straddles,
        generated_code=generated_code,
        diagnostics=diagnostics,
    )
