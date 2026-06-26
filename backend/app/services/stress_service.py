from app.domain.models import Portfolio, ScenarioResult, StressScenario


DEFAULT_SCENARIOS = [
    StressScenario(
        id="equity_selloff",
        name="Global Equity Selloff",
        description="Sharp equity drawdown with modest flight-to-quality support for fixed income.",
        shocks={"Equity": -0.18, "Credit": -0.09, "Fixed Income": 0.025, "Commodity": -0.06, "Alternative": -0.08, "Cash": 0.0},
    ),
    StressScenario(
        id="rates_up_150",
        name="Rates +150 bps",
        description="Parallel upward rates shock pressuring duration and rate-sensitive assets.",
        shocks={"Fixed Income": -0.11, "Credit": -0.045, "Equity": -0.035, "Commodity": 0.015, "Alternative": -0.02, "Cash": 0.0},
    ),
    StressScenario(
        id="credit_widening",
        name="Credit Spread Widening",
        description="Credit spreads gap wider while equities reprice lower.",
        shocks={"Credit": -0.14, "Equity": -0.07, "Fixed Income": -0.025, "Commodity": -0.025, "Alternative": -0.045, "Cash": 0.0},
    ),
    StressScenario(
        id="inflation_shock",
        name="Inflation Shock",
        description="Inflation surprise lifts commodities and pressures bonds and growth equities.",
        shocks={"Commodity": 0.12, "Fixed Income": -0.08, "Equity": -0.055, "Credit": -0.035, "Alternative": 0.01, "Cash": 0.0},
    ),
]


def list_scenarios() -> list[StressScenario]:
    return DEFAULT_SCENARIOS


def get_scenario(scenario_id: str) -> StressScenario:
    for scenario in DEFAULT_SCENARIOS:
        if scenario.id == scenario_id:
            return scenario
    raise ValueError(f"Unknown scenario: {scenario_id}")


def run_stress_scenario(portfolio: Portfolio, scenario: StressScenario) -> ScenarioResult:
    impacts = []
    stressed_value = 0.0
    for position in portfolio.positions:
        asset_class = position.instrument.asset_class.value
        shock = scenario.shocks.get(asset_class, 0.0)
        market_value = position.market_value
        stressed_position_value = market_value * (1.0 + shock)
        stressed_value += stressed_position_value
        impacts.append(
            {
                "symbol": position.instrument.symbol,
                "asset_class": asset_class,
                "market_value": market_value,
                "shock": shock,
                "pnl": stressed_position_value - market_value,
            }
        )
    portfolio_value = portfolio.market_value
    pnl = stressed_value - portfolio_value
    return ScenarioResult(
        scenario_id=scenario.id,
        scenario_name=scenario.name,
        portfolio_value=portfolio_value,
        stressed_value=stressed_value,
        pnl=pnl,
        pnl_percent=pnl / portfolio_value if portfolio_value else 0.0,
        impacts=sorted(impacts, key=lambda item: item["pnl"]),
    )
