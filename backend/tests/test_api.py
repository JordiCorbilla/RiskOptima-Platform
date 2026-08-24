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

    health_response = client.get(f"{get_settings().api_prefix}/health")
    assert health_response.status_code == 200
    health = health_response.json()
    assert health["status"] == "ok"
    assert health["platform_version"]
    assert health["riskoptima_version"]

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

    samples_response = client.get(f"{get_settings().api_prefix}/portfolio-samples")
    assert samples_response.status_code == 200
    samples = samples_response.json()
    assert any(sample["slug"] == "vanguard_multi_asset_portfolio" for sample in samples)

    metadata_response = client.get(f"{get_settings().api_prefix}/library/metadata")
    assert metadata_response.status_code == 200
    metadata = metadata_response.json()
    assert metadata["package_name"] == "riskoptima"
    assert metadata["platform_version"]

    capabilities_response = client.get(f"{get_settings().api_prefix}/library/capabilities")
    assert capabilities_response.status_code == 200
    capabilities = capabilities_response.json()
    assert any(item["category"] == "options" and item["surfaced_in_platform"] for item in capabilities)
    assert any(item["category"] == "rates" and item["ui_module"] == "Rates Workbench" for item in capabilities)
    assert any(item["category"] == "sample data" and item["ui_module"] == "RiskOptima Explorer" for item in capabilities)

    example_response = client.post(
        f"{get_settings().api_prefix}/library/run-example",
        json={"example": "black_scholes_price"},
    )
    assert example_response.status_code == 200
    assert example_response.json()["result"]["price"] > 0

    repeated_example_response = client.post(
        f"{get_settings().api_prefix}/library/run-example",
        json={"example": "black_scholes_price"},
    )
    assert repeated_example_response.status_code == 200
    assert repeated_example_response.json()["result"] == example_response.json()["result"]

    rates_response = client.get(f"{get_settings().api_prefix}/rates/sofr-curve")
    assert rates_response.status_code == 200
    rates = rates_response.json()
    assert rates["library_version"] == "2.7.1"
    assert rates["curve_points"]
    assert rates["calibration"]
    assert rates["key_rate_dv01"]
    assert rates["jacobian"]
    assert "riskoptima.rates.bootstrap_sofr_curve" in rates["diagnostics"]["functions_executed"]

    rates_example_response = client.post(
        f"{get_settings().api_prefix}/library/run-example",
        json={"example": "sofr_curve"},
    )
    assert rates_example_response.status_code == 200
    assert rates_example_response.json()["result"]["five_year_par_swap_rate"] == rates["summary"]["five_year_par_swap_rate"]

    sample_data_example_response = client.post(
        f"{get_settings().api_prefix}/library/run-example",
        json={"example": "sample_data"},
    )
    assert sample_data_example_response.status_code == 200
    assert sample_data_example_response.json()["result"]["credit_expected_loss"] > 0

    sample_load_response = client.post(f"{get_settings().api_prefix}/portfolio-samples/vanguard_multi_asset_portfolio/load")
    assert sample_load_response.status_code == 201
    assert sample_load_response.json()["name"] == "Vanguard Multi-Asset Model"
    assert len(sample_load_response.json()["positions"]) == 11

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

    options_response = client.get(
        f"{get_settings().api_prefix}/portfolios/{portfolio_id}/options-workbench",
        params={"symbol": "AAA", "start_date": "2024-06-26", "as_of_date": "2026-06-28"},
    )
    assert options_response.status_code == 200
    options = options_response.json()
    assert options["underlying_symbol"] == "AAA"
    assert options["option_chain"]
    assert options["iv_surface"]
    assert options["scenario_grid"]
    assert options["generated_code"]

    backtest_response = client.post(
        f"{get_settings().api_prefix}/portfolios/{portfolio_id}/backtests/run",
        json={
            "start_date": "2024-06-26",
            "as_of_date": "2026-06-28",
            "short_window": 10,
            "long_window": 30,
            "rebalance_rule": "D",
            "spread_bps": 2,
            "slippage_bps": 0,
        },
    )
    assert backtest_response.status_code == 200
    backtest = backtest_response.json()
    assert backtest["equity_curve"]
    assert backtest["drawdown_curve"]
    assert len(backtest["comparisons"]) >= 3
    assert "riskoptima.backtest.run_backtest" in backtest["diagnostics"]["functions_executed"]

    scenarios_response = client.get(f"{get_settings().api_prefix}/scenarios")
    assert scenarios_response.status_code == 200
    scenario_id = scenarios_response.json()[0]["id"]

    run_response = client.post(
        f"{get_settings().api_prefix}/scenarios/run",
        json={"portfolio_id": portfolio_id, "scenario_id": scenario_id},
    )
    assert run_response.status_code == 200
    assert run_response.json()["scenario_id"] == scenario_id
