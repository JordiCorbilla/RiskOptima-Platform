from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.db.session import get_portfolio_repository
from app.domain.models import (
    GenerateRunRequest,
    GeneratedRun,
    Portfolio,
    PortfolioSummary,
    PortfolioUpdateRequest,
    RiskReport,
    ScenarioResult,
    ScenarioRunRequest,
    StressScenario,
)
from app.repositories.portfolio_repository import PortfolioRepository
from app.services.portfolio_service import parse_portfolio_csv
from app.services.generation_service import generate_portfolio_run
from app.services.render_service import build_rendered_charts
from app.services.risk_service import build_portfolio_risk_report
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


@router.get("/portfolios/{portfolio_id}/renders")
def get_portfolio_renders(
    portfolio_id: int,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> dict[str, list[dict[str, str]]]:
    portfolio = repository.get(portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"charts": build_rendered_charts(portfolio)}


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
