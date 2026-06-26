from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.session import get_portfolio_repository
from app.main import create_app
from app.repositories.portfolio_repository import SQLitePortfolioRepository


def test_portfolio_upload_risk_and_stress(tmp_path: Path):
    app = create_app()
    repository = SQLitePortfolioRepository(tmp_path / "test.db")
    app.dependency_overrides[get_portfolio_repository] = lambda: repository
    client = TestClient(app)

    csv_payload = (
        "symbol,name,asset_class,sector,quantity,price,currency,beta\n"
        "AAA,Alpha Equity,Equity,Technology,100,50,USD,1.1\n"
        "BBB,Beta Bond,Fixed Income,Rates,200,99,USD,-0.1\n"
        "CCC,Credit Fund,Credit,Credit,150,80,USD,0.4\n"
    )

    upload_response = client.post(
        f"{get_settings().api_prefix}/portfolios/upload",
        data={"name": "Test Portfolio"},
        files={"file": ("portfolio.csv", csv_payload, "text/csv")},
    )
    assert upload_response.status_code == 201
    portfolio_id = upload_response.json()["id"]

    list_response = client.get(f"{get_settings().api_prefix}/portfolios")
    assert list_response.status_code == 200
    assert list_response.json()[0]["position_count"] == 3

    risk_response = client.get(f"{get_settings().api_prefix}/portfolios/{portfolio_id}/risk")
    assert risk_response.status_code == 200
    risk = risk_response.json()
    assert risk["portfolio_name"] == "Test Portfolio"
    assert len(risk["metrics"]) >= 8
    assert risk["drawdown"]
    assert risk["factor_exposure"]
    assert risk["largest_contributors"]

    render_response = client.get(f"{get_settings().api_prefix}/portfolios/{portfolio_id}/renders")
    assert render_response.status_code == 200
    renders = render_response.json()["charts"]
    assert len(renders) == 4
    assert renders[0]["image"].startswith("data:image/png;base64,")

    scenarios_response = client.get(f"{get_settings().api_prefix}/scenarios")
    assert scenarios_response.status_code == 200
    scenario_id = scenarios_response.json()[0]["id"]

    run_response = client.post(
        f"{get_settings().api_prefix}/scenarios/run",
        json={"portfolio_id": portfolio_id, "scenario_id": scenario_id},
    )
    assert run_response.status_code == 200
    assert run_response.json()["scenario_id"] == scenario_id
