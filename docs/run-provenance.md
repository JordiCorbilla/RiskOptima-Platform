# Run Provenance

Generated portfolio runs now carry explicit provenance and diagnostics.

Each run records:

- `run_id`
- `portfolio_id`
- `start_date`
- `as_of_date`
- `generated_at`
- `cache_hit`
- platform version
- platform engine version
- RiskOptima package version
- RiskOptima import source
- functions executed
- runtime duration by stage
- fallback usage
- warnings
- errors
- generated code snippets

Generated artifacts are still written under `backend/generated_data/portfolio_{id}/{run_id}`:

- `report.json`
- `charts.json`
- `metadata.json`

The run id includes the complete portfolio payload, date range, platform engine version, and RiskOptima package version. Upgrading RiskOptima or the platform engine naturally creates new cache keys.
