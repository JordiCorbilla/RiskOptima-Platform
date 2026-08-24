# Rates Workbench

The Rates Workbench uses deterministic synthetic money-market and swap quotes to call RiskOptima 2.7.1 institutional rates analytics directly.

Current RiskOptima APIs used:

- `riskoptima.rates.bootstrap_sofr_curve`
- `riskoptima.rates.reprice_sofr_instruments`
- `riskoptima.rates.curve_calibration_jacobian`
- `riskoptima.rates.key_rate_dv01`
- `riskoptima.rates.price_fixed_rate_bond_dates`

The UI shows:

- valuation date control
- synthetic SOFR deposit, FOMC interval, futures, and OIS swap quote table
- zero, forward, and par-swap curve chart
- key-rate DV01 chart
- calibration error table
- quote-to-curve-node Jacobian matrix
- fixed-rate bond pricing summary
- generated RiskOptima code snippet
- diagnostics

Endpoint:

- `GET /api/rates/sofr-curve?valuation_date=2026-07-01`

The module stays local-first and credential-free. It is intended as the first fixed-income market workbench and a foundation for v2 additions such as live curve providers, scenario shocks, portfolio duration overlays, and cash-flow level drilldowns.
