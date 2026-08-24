# Options Workbench

The Options Workbench uses deterministic synthetic price paths for a selected portfolio holding and calls RiskOptima 2.7.1 option analytics directly.

Current RiskOptima APIs used:

- `riskoptima.options.price_option_chain`
- `riskoptima.options.build_implied_vol_surface`
- `riskoptima.options.build_greeks_grid`
- `riskoptima.options.option_scenario_grid`
- `riskoptima.options.event_straddle_analysis`

The UI shows:

- symbol selector
- theoretical option chain with price, IV, delta, gamma, theta, vega, rho and intrinsic/extrinsic value fields
- aggregate book Greeks
- IV surface rows
- scenario grid for spot and volatility shocks
- event straddle analysis
- generated RiskOptima code snippet
- diagnostics

Endpoint:

- `GET /api/portfolios/{portfolio_id}/options-workbench`

The module stays credential-free and local-first by generating the chain from synthetic portfolio prices.
