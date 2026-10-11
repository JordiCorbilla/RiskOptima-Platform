import json
from typing import TYPE_CHECKING

from app.domain.dislocation import ResearchRequest, ResearchResponse
from app.services.risk_service import _ensure_riskoptima_path, riskoptima_import_version

if TYPE_CHECKING:
    from riskoptima.dislocation import MarketDataProvider


def run_research(
    request: ResearchRequest,
    instruments: list[tuple[str, str]],
    provider: "MarketDataProvider | None" = None,
) -> ResearchResponse:
    _ensure_riskoptima_path()
    try:
        from riskoptima.dislocation import (
            DislocationConfig, analyze_symbol, scan_universe, generate_markdown_report,
        )
    except ImportError as exc:
        raise RuntimeError("Dislocation Research requires RiskOptima 2.8.0. Configure the local library checkout and restart the API.") from exc

    config = DislocationConfig(**request.config.model_dump())
    if len(instruments) == 1:
        symbol, name = instruments[0]
        try:
            analysis = analyze_symbol(symbol, name=name, config=config, provider=provider)
            analyses = [analysis]
            payload = analysis.as_dict()
            rows = [{**payload, "error": None}]
        except Exception as exc:
            analyses = []
            rows = [{"symbol": symbol, "name": name, "classification": "ERROR", "error": str(exc)}]
    else:
        summary, analyses = scan_universe(instruments, config=config, provider=provider, continue_on_error=True)
        rows = json.loads(summary.to_json(orient="records"))

    successes = len(analyses)
    return ResearchResponse(
        status="failed" if not successes else "success" if successes == len(instruments) else "partial",
        riskoptima_version=riskoptima_import_version() or "unknown",
        assumptions=request.config.model_dump(),
        summary=rows,
        analyses=[analysis.as_dict() for analysis in analyses],
        reports={analysis.symbol: generate_markdown_report(analysis) for analysis in analyses},
    )
