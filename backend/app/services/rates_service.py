from __future__ import annotations

from datetime import date
from functools import lru_cache
from time import perf_counter
from typing import Any

import numpy as np
import pandas as pd

from app.domain.models import (
    RatesCalibrationRow,
    RatesCurvePoint,
    RatesJacobianRow,
    RatesKeyRateDv01,
    RatesQuote,
    RatesWorkbenchResponse,
    RunDiagnostics,
)
from app.services.risk_service import _ensure_riskoptima_path, riskoptima_import_version


DEFAULT_RATES_VALUATION_DATE = date(2026, 7, 1)


def _tenor_label(tenor: float) -> str:
    if tenor < 0.1:
        return f"{max(1, round(tenor * 365))}D"
    if tenor < 1:
        return f"{round(tenor * 12)}M"
    return f"{tenor:.1f}Y"


def _iso_day(value: Any) -> str:
    return pd.Timestamp(value).date().isoformat()


def _date_string(value: pd.Timestamp) -> str:
    return value.date().isoformat()


def _synthetic_sofr_quotes(valuation_date: date) -> pd.DataFrame:
    value_date = pd.Timestamp(valuation_date)
    on_maturity = value_date + pd.offsets.BusinessDay(1)
    fomc_sep = on_maturity + pd.DateOffset(days=77)
    fomc_oct = fomc_sep + pd.DateOffset(days=42)
    future_end = fomc_oct + pd.DateOffset(months=3)
    swap_2y = value_date + pd.DateOffset(years=2, days=2)
    swap_5y = value_date + pd.DateOffset(years=5, days=2)

    return pd.DataFrame(
        [
            {
                "quote_id": "ON",
                "instrument_type": "deposit",
                "maturity_date": _date_string(on_maturity),
                "rate": 0.0430,
            },
            {
                "quote_id": "FOMC-1",
                "instrument_type": "fomc",
                "start_date": _date_string(on_maturity),
                "end_date": _date_string(fomc_sep),
                "rate": 0.0425,
            },
            {
                "quote_id": "FOMC-2",
                "instrument_type": "fomc",
                "start_date": _date_string(fomc_sep),
                "end_date": _date_string(fomc_oct),
                "rate": 0.0415,
            },
            {
                "quote_id": "SR3-H7",
                "instrument_type": "future",
                "start_date": _date_string(fomc_oct),
                "end_date": _date_string(future_end),
                "price": 95.95,
                "convexity_adjustment_bps": 0.5,
            },
            {
                "quote_id": "OIS-2Y",
                "instrument_type": "swap",
                "maturity_date": _date_string(swap_2y),
                "rate": 0.0390,
                "payment_frequency": 1,
            },
            {
                "quote_id": "OIS-5Y",
                "instrument_type": "swap",
                "maturity_date": _date_string(swap_5y),
                "rate": 0.0375,
                "payment_frequency": 1,
            },
        ]
    )


def _package_version() -> str | None:
    return riskoptima_import_version()


def _quote_models(quotes: pd.DataFrame) -> list[RatesQuote]:
    rows = quotes.replace({np.nan: None}).to_dict(orient="records")
    return [RatesQuote(**row) for row in rows]


@lru_cache(maxsize=32)
def build_rates_workbench(valuation_date: date | None = None) -> RatesWorkbenchResponse:
    _ensure_riskoptima_path()
    from riskoptima.rates import (
        bootstrap_sofr_curve,
        curve_calibration_jacobian,
        key_rate_dv01,
        price_fixed_rate_bond_dates,
        reprice_sofr_instruments,
    )

    value_date = valuation_date or DEFAULT_RATES_VALUATION_DATE
    diagnostics = RunDiagnostics(
        functions_executed=[
            "riskoptima.rates.bootstrap_sofr_curve",
            "riskoptima.rates.reprice_sofr_instruments",
            "riskoptima.rates.curve_calibration_jacobian",
            "riskoptima.rates.key_rate_dv01",
            "riskoptima.rates.price_fixed_rate_bond_dates",
        ],
        fallback_used=False,
    )

    timings: dict[str, float] = {}

    started = perf_counter()
    quotes = _synthetic_sofr_quotes(value_date)
    curve = bootstrap_sofr_curve(quotes, valuation_date=value_date.isoformat(), name="Synthetic USD SOFR OIS curve")
    timings["bootstrap_sofr_curve"] = round((perf_counter() - started) * 1000, 2)

    started = perf_counter()
    calibration = reprice_sofr_instruments(curve, quotes)
    timings["reprice_sofr_instruments"] = round((perf_counter() - started) * 1000, 2)

    started = perf_counter()
    jacobian = curve_calibration_jacobian(
        quotes,
        curve_builder=bootstrap_sofr_curve,
        builder_kwargs={"valuation_date": value_date.isoformat(), "name": "Synthetic USD SOFR OIS curve"},
    )
    timings["curve_calibration_jacobian"] = round((perf_counter() - started) * 1000, 2)

    curve_points: list[RatesCurvePoint] = []
    for tenor in [0.25, 0.5, 1.0, 2.0, 3.0, 5.0]:
        start_tenor = max(1 / 365, tenor - 0.25)
        curve_points.append(
            RatesCurvePoint(
                tenor=tenor,
                tenor_label=_tenor_label(tenor),
                zero_rate=float(curve.zero_rate(tenor)),
                forward_rate=float(curve.forward_rate(start_tenor, tenor)),
                discount_factor=float(curve.discount_factor(tenor)),
                par_swap_rate=float(curve.par_swap_rate(tenor, payment_frequency=1)),
            )
        )

    started = perf_counter()
    bond_price = float(
        price_fixed_rate_bond_dates(
            curve,
            value_date.isoformat(),
            (pd.Timestamp(value_date) + pd.DateOffset(years=5)).date().isoformat(),
            0.045,
            face_value=100,
            payment_frequency=2,
        )
    )
    timings["price_fixed_rate_bond_dates"] = round((perf_counter() - started) * 1000, 2)

    cash_flows = np.array([2.25, 2.25, 2.25, 2.25, 102.25])
    payment_times = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    started = perf_counter()
    key_dv01_series = key_rate_dv01(curve, cash_flows, payment_times)
    timings["key_rate_dv01"] = round((perf_counter() - started) * 1000, 2)
    total_dv01 = float(key_dv01_series.sum())
    key_rate_dv01_rows = [
        RatesKeyRateDv01(
            key_tenor=float(tenor),
            tenor_label=_tenor_label(float(tenor)),
            dv01=float(value),
            contribution_percent=float(value / total_dv01) if total_dv01 else 0.0,
        )
        for tenor, value in key_dv01_series.items()
    ]

    quote_ids = quotes["quote_id"].tolist()
    calibration_rows = []
    for index, row in calibration.iterrows():
        calibration_rows.append(
            RatesCalibrationRow(
                quote_id=str(quote_ids[index]),
                instrument_type=str(row["instrument_type"]),
                start_date=_iso_day(row["start_date"]),
                end_date=_iso_day(row["end_date"]),
                market_rate=float(row["market_rate"]),
                model_rate=float(row["model_rate"]),
                error_bps=float(row["error_bps"]),
            )
        )

    jacobian_rows = [
        RatesJacobianRow(
            output_tenor=float(output_tenor),
            output_tenor_label=_tenor_label(float(output_tenor)),
            sensitivities={str(column): float(value) for column, value in row.items()},
        )
        for output_tenor, row in jacobian.iterrows()
    ]

    diagnostics.runtime_ms_by_stage = timings
    diagnostics.generated_code["rates_workbench"] = _rates_generated_code(value_date)

    max_calibration_error = max((abs(row.error_bps) for row in calibration_rows), default=0.0)
    summary = {
        "quote_count": int(len(quotes)),
        "five_year_zero_rate": curve_points[-1].zero_rate,
        "five_year_par_swap_rate": curve_points[-1].par_swap_rate,
        "two_year_par_swap_rate": next(point.par_swap_rate for point in curve_points if point.tenor == 2.0),
        "fixed_rate_bond_price": bond_price,
        "total_key_rate_dv01": total_dv01,
        "max_calibration_error_bps": float(max_calibration_error),
    }

    return RatesWorkbenchResponse(
        valuation_date=value_date,
        curve_name=curve.name,
        library_version=_package_version(),
        summary=summary,
        quotes=_quote_models(quotes),
        curve_points=curve_points,
        calibration=calibration_rows,
        key_rate_dv01=key_rate_dv01_rows,
        jacobian=jacobian_rows,
        generated_code=_rates_generated_code(value_date),
        diagnostics=diagnostics,
    )


def _rates_generated_code(valuation_date: date) -> str:
    quote_rows = _synthetic_sofr_quotes(valuation_date).replace({np.nan: None}).to_dict(orient="records")
    bond_maturity = (pd.Timestamp(valuation_date) + pd.DateOffset(years=5)).date().isoformat()
    return f"""import pandas as pd
import numpy as np
from riskoptima.rates import (
    bootstrap_sofr_curve,
    curve_calibration_jacobian,
    key_rate_dv01,
    price_fixed_rate_bond_dates,
    reprice_sofr_instruments,
)

quotes = pd.DataFrame({quote_rows!r})

curve = bootstrap_sofr_curve(quotes, valuation_date="{valuation_date.isoformat()}", name="Synthetic USD SOFR OIS curve")
calibration = reprice_sofr_instruments(curve, quotes)
jacobian = curve_calibration_jacobian(
    quotes,
    curve_builder=bootstrap_sofr_curve,
    builder_kwargs={{"valuation_date": "{valuation_date.isoformat()}", "name": "Synthetic USD SOFR OIS curve"}},
)
dv01 = key_rate_dv01(curve, np.array([2.25, 2.25, 2.25, 2.25, 102.25]), np.array([1, 2, 3, 4, 5]))
bond_price = price_fixed_rate_bond_dates(curve, "{valuation_date.isoformat()}", "{bond_maturity}", 0.045, face_value=100, payment_frequency=2)
"""
