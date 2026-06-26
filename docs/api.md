# API Reference

Base URL: `http://127.0.0.1:8000/api`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/portfolios/upload` | Upload a CSV portfolio. |
| GET | `/portfolios` | List saved portfolios. |
| GET | `/portfolios/{id}/risk` | Build the full risk dashboard payload. |
| GET | `/portfolios/{id}/stress` | Run every built-in scenario. |
| GET | `/scenarios` | List built-in stress scenarios. |
| POST | `/scenarios/run` | Run one scenario for one portfolio. |

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
