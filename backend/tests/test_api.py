from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.session import get_portfolio_repository
from app.main import create_app
from app.repositories.portfolio_repository import SQLitePortfolioRepository


def test_portfolio_upload_risk_and_stress(tmp_path: Path):
    app = create_app()
    repository = SQLitePortfolioRepository(tmp_path / "test.db")
    settings = get_settings()
    settings.generated_data_path = tmp_path / "generated_data"
    local_riskoptima = Path("C:/repo/portfolio_risk_kit")
    if local_riskoptima.exists():
        settings.riskoptima_path = local_riskoptima
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

    detail_response = client.get(f"{get_settings().api_prefix}/portfolios/{portfolio_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    detail["name"] = "Edited Portfolio"
    detail["positions"][0]["quantity"] = 125

    update_response = client.put(
        f"{get_settings().api_prefix}/portfolios/{portfolio_id}",
        json={
            "name": detail["name"],
            "base_currency": detail["base_currency"],
            "positions": detail["positions"],
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Edited Portfolio"
    assert update_response.json()["positions"][0]["quantity"] == 125

    risk_response = client.get(f"{get_settings().api_prefix}/portfolios/{portfolio_id}/risk")
    assert risk_response.status_code == 200
    risk = risk_response.json()
    assert risk["portfolio_name"] == "Edited Portfolio"
    assert risk["analytics_engine"]["package"] == "riskoptima"
    assert len(risk["metrics"]) >= 8
    assert risk["drawdown"]
    assert risk["factor_exposure"]
    assert risk["largest_contributors"]

    render_response = client.get(f"{get_settings().api_prefix}/portfolios/{portfolio_id}/renders")
    assert render_response.status_code == 200
    renders = render_response.json()["charts"]
    assert len(renders) == 5
    assert renders[0]["image"].startswith("data:image/png;base64,")

    generate_response = client.post(
        f"{get_settings().api_prefix}/portfolios/{portfolio_id}/generate",
        json={"start_date": "2024-06-26", "as_of_date": "2026-06-28"},
    )
    assert generate_response.status_code == 200
    generated = generate_response.json()
    assert generated["as_of_date"] == "2026-06-26"
    assert generated["report"]["analytics_engine"]["package"] == "riskoptima"
    assert generated["cache_hit"] is False
    assert len(generated["charts"]) == 5

    runs_response = client.get(f"{get_settings().api_prefix}/portfolios/{portfolio_id}/runs")
    assert runs_response.status_code == 200
    runs = runs_response.json()
    assert runs[0]["run_id"] == generated["run_id"]
    assert runs[0]["analytics_engine"]["package"] == "riskoptima"

    cached_response = client.post(
        f"{get_settings().api_prefix}/portfolios/{portfolio_id}/generate",
        json={"start_date": "2024-06-26", "as_of_date": "2026-06-28"},
    )
    assert cached_response.status_code == 200
    assert cached_response.json()["cache_hit"] is True

    forced_response = client.post(
        f"{get_settings().api_prefix}/portfolios/{portfolio_id}/generate",
        json={"start_date": "2024-06-26", "as_of_date": "2026-06-28", "force": True},
    )
    assert forced_response.status_code == 200
    assert forced_response.json()["cache_hit"] is False

    signals_response = client.get(
        f"{get_settings().api_prefix}/portfolios/{portfolio_id}/signals",
        params={"start_date": "2024-06-26", "as_of_date": "2026-06-28", "short_window": 10, "long_window": 30},
    )
    assert signals_response.status_code == 200
    signals = signals_response.json()
    assert signals["as_of_date"] == "2026-06-26"
    assert len(signals["summary"]) == 3
    assert "AAA" in signals["details"]
    assert signals["details"]["AAA"]["signals"]
    assert "portfolio_equity" in signals
    assert signals["portfolio_equity"]

    notebooks_response = client.get(
        f"{get_settings().api_prefix}/portfolios/{portfolio_id}/notebooks",
        params={"start_date": "2024-06-26", "as_of_date": "2026-06-28"},
    )
    assert notebooks_response.status_code == 200
    notebooks = notebooks_response.json()
    assert notebooks["as_of_date"] == "2026-06-26"
    assert notebooks["optimization_ml"]["weights"]
    assert "index_vol_divergence" in notebooks
    assert notebooks["options"]["greeks"]
    assert notebooks["credit"]["obligors"]
    assert notebooks["bonds"]["bonds"]
    assert notebooks["stochastic_volatility"]["paths"]
    assert notebooks["markov_regimes"]["summary"]
    assert notebooks["markov_regimes"]["series"]
    assert notebooks["portfolio_sophistication"]["performance"]
    assert notebooks["portfolio_sophistication"]["weights"]
    assert notebooks["volatility_toolkit"]["series"]
    assert notebooks["volatility_toolkit"]["assets"]

    scenarios_response = client.get(f"{get_settings().api_prefix}/scenarios")
    assert scenarios_response.status_code == 200
    scenario_id = scenarios_response.json()[0]["id"]

    run_response = client.post(
        f"{get_settings().api_prefix}/scenarios/run",
        json={"portfolio_id": portfolio_id, "scenario_id": scenario_id},
    )
    assert run_response.status_code == 200
    assert run_response.json()["scenario_id"] == scenario_id
