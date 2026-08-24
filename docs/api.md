# API Reference

Base URL: `http://127.0.0.1:8000/api`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Return operational health, platform version, and RiskOptima package version. |
| POST | `/portfolios/upload` | Upload a CSV portfolio. |
| GET | `/portfolios` | List saved portfolios. |
| GET | `/portfolio-samples` | List bundled CSV sample portfolios. |
| POST | `/portfolio-samples/{slug}/load` | Save a bundled sample portfolio into SQLite. |
| GET | `/library/metadata` | Return RiskOptima package, import source, local override, Python, and platform version metadata. |
| GET | `/library/capabilities` | Return the structured RiskOptima capability map surfaced by the platform. |
| POST | `/library/run-example` | Run deterministic RiskOptima examples with generated Python snippets. |
| GET | `/rates/sofr-curve` | Build the deterministic institutional SOFR curve workbench payload. |
| GET | `/portfolios/{id}` | Get editable portfolio details. |
| PUT | `/portfolios/{id}` | Save edited portfolio name, base currency, and positions. |
| GET | `/portfolios/{id}/risk` | Build the full risk dashboard payload. |
| GET | `/portfolios/{id}/renders` | Render RiskOptima notebook-style chart images. |
| POST | `/portfolios/{id}/generate` | Generate or load a cached dated risk run. |
| GET | `/portfolios/{id}/signals` | Build RiskOptima SMA signal and per-instrument drilldown report. |
| GET | `/portfolios/{id}/notebooks` | Build consolidated workbench output for all remaining RiskOptima notebooks. |
| GET | `/portfolios/{id}/options-workbench` | Build option chain, Greeks, IV surface, scenarios, and event straddles for a holding. |
| POST | `/portfolios/{id}/backtests/run` | Run the SMA crossover backtest studio and strategy comparison. |
| GET | `/portfolios/{id}/stress` | Run every built-in scenario. |
| GET | `/scenarios` | List built-in stress scenarios. |
| POST | `/scenarios/run` | Run one scenario for one portfolio. |

## Generate Run

`POST /portfolios/{id}/generate`

```json
{
  "start_date": "2024-06-26",
  "as_of_date": "2026-06-26",
  "force": false
}
```

If dates are omitted, the backend uses a two-year window ending on T-1 business day. Weekend as-of dates are rolled back to Friday. A repeated request with the same portfolio and dates returns `cache_hit: true`; set `force: true` to recalculate and replace the generated artifacts.

Generated runs include `diagnostics` and `metadata` with platform version, RiskOptima package version/source, functions executed, generated code snippets, and stage timings.

## Health

`GET /health`

```json
{
  "status": "ok",
  "platform_version": "0.3.1",
  "riskoptima_version": "2.7.1"
}
```

## Library Explorer

`GET /library/metadata` identifies the installed `riskoptima` package and platform version.

`POST /library/run-example`

```json
{
  "example": "black_scholes_price"
}
```

Supported examples are `black_scholes_price`, `greeks`, `implied_volatility`, `var_cvar`, `volatility_estimator`, `optimizer`, `merton_pd`, `sofr_curve`, and `sample_data`.

## Rates Workbench

`GET /rates/sofr-curve?valuation_date=2026-07-01`

The response includes deterministic SOFR market quotes, zero/forward/par-swap curve points, calibration errors, quote-to-curve-node Jacobian rows, key-rate DV01 attribution, fixed-rate bond pricing, diagnostics, and generated RiskOptima code.

## Signal Report

`GET /portfolios/{id}/signals?start_date=2024-06-26&as_of_date=2026-06-26&short_window=20&long_window=50`

The response includes:

- portfolio-level SMA strategy equity curve
- summary row per holding
- per-symbol close/SMA/signal time series
- buy/sell crossover state
- completed trade logs with stop-loss and take-profit exits
- win rate, cumulative trade return, volatility, and drawdown

## Notebook Workbench

`GET /portfolios/{id}/notebooks?start_date=2024-06-26&as_of_date=2026-06-26`

The response covers the remaining RiskOptima notebooks:

- ML plus mean-variance optimization
- index/volatility divergence entries, exits, and returns
- options IV term structure, Greeks, and event straddles
- credit expected loss, credit VaR/CVaR, migration, and Merton PD
- fixed-income duration, modified duration, PVBP, and convexity
- Hull-White, Heston, and SABR stochastic-volatility paths

## Options Workbench

`GET /portfolios/{id}/options-workbench?symbol=SPY&start_date=2024-06-26&as_of_date=2026-06-26`

The response includes a deterministic synthetic option chain, aggregate Greeks, IV-surface rows, scenario grid, event straddles, diagnostics, and generated RiskOptima code.

## Backtest Studio

`POST /portfolios/{id}/backtests/run`

```json
{
  "start_date": "2024-06-26",
  "as_of_date": "2026-06-26",
  "strategy_type": "sma_crossover",
  "short_window": 20,
  "long_window": 50,
  "rebalance_rule": "D",
  "spread_bps": 2,
  "slippage_bps": 0,
  "stop_loss": 0.05,
  "take_profit": 0.1
}
```

The response includes equity curve, drawdown curve, trade rows, turnover, performance metrics, static/SMA/optimized comparisons, diagnostics, and generated RiskOptima code.

## CSV Format

Required columns:

- `symbol`
- `quantity`
- `price`

Recommended columns:

- `name`
- `asset_class`
- `sector`
- `currency`
- `beta`

See `sample_data/institutional_portfolio.csv` and `sample_data/vanguard_multi_asset_portfolio.csv`.
