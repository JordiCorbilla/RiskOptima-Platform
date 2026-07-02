# RiskOptima Library Explorer

The Library Explorer makes the platform a visible showcase of the installed RiskOptima package instead of hiding the library behind dashboard charts.

It exposes:

- package name, installed version, import source, Python version, local checkout override status, platform version, and platform engine version
- a searchable capability table across portfolio risk, optimization, risk attribution, volatility, options, credit, fixed income, regimes, backtesting, scenarios, and reporting
- deterministic runnable examples for Black-Scholes price, Greeks, implied volatility, VaR/CVaR, volatility estimators, optimizer, and Merton PD
- generated Python snippets for every example
- diagnostics showing which RiskOptima functions were executed and whether a platform fallback was used

Endpoints:

- `GET /api/library/metadata`
- `GET /api/library/capabilities`
- `POST /api/library/run-example`

All examples use deterministic synthetic inputs and require no paid market-data API.
