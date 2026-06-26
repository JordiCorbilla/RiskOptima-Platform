# API Reference

Base URL: `http://127.0.0.1:8000/api`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/portfolios/upload` | Upload a CSV portfolio. |
| GET | `/portfolios` | List saved portfolios. |
| GET | `/portfolios/{id}` | Get editable portfolio details. |
| PUT | `/portfolios/{id}` | Save edited portfolio name, base currency, and positions. |
| GET | `/portfolios/{id}/risk` | Build the full risk dashboard payload. |
| GET | `/portfolios/{id}/renders` | Render RiskOptima notebook-style chart images. |
| POST | `/portfolios/{id}/generate` | Generate or load a cached dated risk run. |
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

See `sample_data/institutional_portfolio.csv`.
