from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.db.session import get_portfolio_repository
from app.domain.models import (
    GenerateRunRequest,
    GeneratedRun,
    Portfolio,
    SamplePortfolioSummary,
    PortfolioSummary,
    PortfolioUpdateRequest,
    RiskReport,
    RunSummary,
    ScenarioResult,
    ScenarioRunRequest,
    StressScenario,
)
from app.repositories.portfolio_repository import PortfolioRepository
from app.services.portfolio_service import parse_portfolio_csv
from app.services.generation_service import generate_portfolio_run, list_portfolio_runs
from app.services.notebook_service import build_notebook_workbench
from app.services.render_service import build_rendered_charts
from app.services.risk_service import build_portfolio_risk_report
from app.services.sample_portfolio_service import get_sample_portfolio, list_sample_portfolios
from app.services.signal_service import build_signal_report
from app.services.stress_service import get_scenario, list_scenarios, run_stress_scenario

router = APIRouter()


@router.post("/portfolios/upload", response_model=Portfolio, status_code=201)
async def upload_portfolio(
    file: UploadFile = File(...),
    name: str = Form("Institutional Synthetic Portfolio"),
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> Portfolio:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload must be a CSV file")
    try:
        positions = parse_portfolio_csv(await file.read())
        return repository.save(name=name, positions=positions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/portfolios", response_model=list[PortfolioSummary])
def get_portfolios(repository: PortfolioRepository = Depends(get_portfolio_repository)) -> list[PortfolioSummary]:
    return repository.list()


@router.get("/portfolio-samples", response_model=list[SamplePortfolioSummary])
def get_portfolio_samples() -> list[SamplePortfolioSummary]:
    return list_sample_portfolios()


@router.post("/portfolio-samples/{slug}/load", response_model=Portfolio, status_code=201)
def load_sample_portfolio(
    slug: str,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> Portfolio:
    try:
        name, positions = get_sample_portfolio(slug)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return repository.save(name=name, positions=positions)


@router.get("/portfolios/{portfolio_id}", response_model=Portfolio)
def get_portfolio(
    portfolio_id: int,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> Portfolio:
    portfolio = repository.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio


@router.put("/portfolios/{portfolio_id}", response_model=Portfolio)
def update_portfolio(
    portfolio_id: int,
    request: PortfolioUpdateRequest,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> Portfolio:
    portfolio = repository.update(
        portfolio_id=portfolio_id,
        name=request.name,
        base_currency=request.base_currency,
        positions=request.positions,
    )
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio


@router.get("/portfolios/{portfolio_id}/risk", response_model=RiskReport)
def get_portfolio_risk(
    portfolio_id: int,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> RiskReport:
    portfolio = repository.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return build_portfolio_risk_report(portfolio)


@router.post("/portfolios/{portfolio_id}/generate", response_model=GeneratedRun)
def generate_portfolio(
    portfolio_id: int,
    request: GenerateRunRequest,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> GeneratedRun:
    portfolio = repository.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    try:
        return generate_portfolio_run(
            portfolio,
            start_date=request.start_date,
            as_of_date=request.as_of_date,
            force=request.force,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/portfolios/{portfolio_id}/runs", response_model=list[RunSummary])
def get_portfolio_runs(
    portfolio_id: int,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> list[RunSummary]:
    portfolio = repository.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return list_portfolio_runs(portfolio_id)


@router.get("/portfolios/{portfolio_id}/renders")
def get_portfolio_renders(
    portfolio_id: int,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> dict[str, list[dict[str, str]]]:
    portfolio = repository.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"charts": build_rendered_charts(portfolio)}


@router.get("/portfolios/{portfolio_id}/signals")
def get_portfolio_signals(
    portfolio_id: int,
    start_date: date | None = None,
    as_of_date: date | None = None,
    short_window: int = Query(20, ge=2, le=120),
    long_window: int = Query(50, ge=3, le=260),
    stop_loss: float | None = Query(0.05, ge=0.0, le=1.0),
    take_profit: float | None = Query(0.10, ge=0.0, le=2.0),
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> dict:
    portfolio = repository.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    try:
        return build_signal_report(
            portfolio,
            start_date=start_date,
            as_of_date=as_of_date,
            short_window=short_window,
            long_window=long_window,
            stop_loss=stop_loss,
            take_profit=take_profit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/portfolios/{portfolio_id}/notebooks")
def get_portfolio_notebook_workbench(
    portfolio_id: int,
    start_date: date | None = None,
    as_of_date: date | None = None,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> dict:
    portfolio = repository.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    try:
        return build_notebook_workbench(portfolio, start_date=start_date, as_of_date=as_of_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/portfolios/{portfolio_id}/stress", response_model=list[ScenarioResult])
def get_portfolio_stress(
    portfolio_id: int,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> list[ScenarioResult]:
    portfolio = repository.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return [run_stress_scenario(portfolio, scenario) for scenario in list_scenarios()]


@router.get("/scenarios", response_model=list[StressScenario])
def get_stress_scenarios() -> list[StressScenario]:
    return list_scenarios()


@router.post("/scenarios/run", response_model=ScenarioResult)
def run_scenario(
    request: ScenarioRunRequest,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> ScenarioResult:
    portfolio = repository.get(request.portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    try:
        scenario = get_scenario(request.scenario_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return run_stress_scenario(portfolio, scenario)
