from __future__ import annotations

from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
from time import perf_counter

from app.core.version import PLATFORM_ENGINE_VERSION, PLATFORM_VERSION
from app.core.config import get_settings
from app.domain.models import GeneratedRun, Portfolio, RunSummary
from app.services.market_data_service import as_business_day, default_start_date, previous_business_day
from app.services.render_service import build_rendered_charts
from app.services.risk_service import build_portfolio_risk_report, riskoptima_engine_metadata


def resolve_run_dates(start_date: date | None = None, as_of_date: date | None = None) -> tuple[date, date]:
    resolved_as_of = as_business_day(as_of_date) if as_of_date else previous_business_day()
    resolved_start = start_date or default_start_date(resolved_as_of)
    if resolved_start > resolved_as_of:
        raise ValueError("start_date must be on or before as_of_date")
    return resolved_start, resolved_as_of


def _run_id(portfolio: Portfolio, start_date: date, as_of_date: date) -> str:
    engine = riskoptima_engine_metadata()
    payload = {
        "portfolio": portfolio.model_dump(mode="json"),
        "start_date": start_date.isoformat(),
        "as_of_date": as_of_date.isoformat(),
        "engine": {
            "platform": PLATFORM_ENGINE_VERSION,
            "riskoptima": engine["version"],
        },
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()[:16]


def _run_folder(portfolio_id: int, run_id: str) -> Path:
    folder = get_settings().generated_data_path / f"portfolio_{portfolio_id}" / run_id
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def list_portfolio_runs(portfolio_id: int) -> list[RunSummary]:
    root = get_settings().generated_data_path / f"portfolio_{portfolio_id}"
    if not root.exists():
        return []
    runs: list[RunSummary] = []
    for metadata_path in root.glob("*/metadata.json"):
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            runs.append(
                RunSummary(
                    portfolio_id=int(metadata["portfolio_id"]),
                    run_id=str(metadata["run_id"]),
                    start_date=date.fromisoformat(metadata["start_date"]),
                    as_of_date=date.fromisoformat(metadata["as_of_date"]),
                    generated_at=datetime.fromisoformat(metadata["generated_at"]),
                    analytics_engine=metadata.get("analytics_engine", {}),
                    diagnostics=metadata.get("diagnostics", {}),
                )
            )
        except (KeyError, ValueError, json.JSONDecodeError):
            continue
    return sorted(runs, key=lambda run: run.generated_at, reverse=True)


def generate_portfolio_run(
    portfolio: Portfolio,
    start_date: date | None = None,
    as_of_date: date | None = None,
    force: bool = False,
) -> GeneratedRun:
    resolved_start, resolved_as_of = resolve_run_dates(start_date, as_of_date)
    run_id = _run_id(portfolio, resolved_start, resolved_as_of)
    folder = _run_folder(portfolio.id, run_id)
    report_path = folder / "report.json"
    charts_path = folder / "charts.json"
    metadata_path = folder / "metadata.json"

    if not force and report_path.exists() and charts_path.exists() and metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        diagnostics = metadata.get("diagnostics", {})
        return GeneratedRun(
            portfolio_id=portfolio.id,
            run_id=run_id,
            start_date=resolved_start,
            as_of_date=resolved_as_of,
            generated_at=datetime.fromisoformat(metadata["generated_at"]),
            cache_hit=True,
            report=json.loads(report_path.read_text(encoding="utf-8")),
            charts=json.loads(charts_path.read_text(encoding="utf-8")),
            diagnostics=diagnostics,
            metadata=metadata,
        )

    generated_at = datetime.now(timezone.utc)
    diagnostics = {
        "functions_executed": [
            "app.services.risk_service.build_portfolio_risk_report",
            "app.services.render_service.build_rendered_charts",
            "riskoptima.reporting.build_market_risk_report",
            "riskoptima.RiskOptima.plot_efficient_frontier_monte_carlo",
        ],
        "runtime_ms_by_stage": {},
        "fallback_used": False,
        "warnings": [],
        "errors": [],
        "generated_code": {
            "risk_report": "from app.services.risk_service import build_portfolio_risk_report\nreport = build_portfolio_risk_report(portfolio, start_date=start_date, as_of_date=as_of_date)",
            "renders": "from app.services.render_service import build_rendered_charts\ncharts = build_rendered_charts(portfolio, start_date=start_date, as_of_date=as_of_date)",
        },
    }
    started = perf_counter()
    report = build_portfolio_risk_report(portfolio, start_date=resolved_start, as_of_date=resolved_as_of)
    diagnostics["runtime_ms_by_stage"]["risk_report"] = round((perf_counter() - started) * 1000, 2)
    started = perf_counter()
    charts = build_rendered_charts(portfolio, start_date=resolved_start, as_of_date=resolved_as_of)
    diagnostics["runtime_ms_by_stage"]["rendered_charts"] = round((perf_counter() - started) * 1000, 2)
    report_path.write_text(report.model_dump_json(), encoding="utf-8")
    charts_path.write_text(json.dumps(charts), encoding="utf-8")
    metadata = {
        "portfolio_id": portfolio.id,
        "run_id": run_id,
        "start_date": resolved_start.isoformat(),
        "as_of_date": resolved_as_of.isoformat(),
        "generated_at": generated_at.isoformat(),
        "cache_hit": False,
        "platform_version": PLATFORM_VERSION,
        "platform_engine_version": PLATFORM_ENGINE_VERSION,
        "analytics_engine": report.analytics_engine,
        "diagnostics": diagnostics,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    return GeneratedRun(
        portfolio_id=portfolio.id,
        run_id=run_id,
        start_date=resolved_start,
        as_of_date=resolved_as_of,
        generated_at=generated_at,
        cache_hit=False,
        report=report,
        charts=charts,
        diagnostics=diagnostics,
        metadata=metadata,
    )
