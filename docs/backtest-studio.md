# Backtest Studio

The Backtest Studio turns the existing SMA signal work into a dedicated RiskOptima strategy lab.

Current RiskOptima APIs used:

- `riskoptima.backtest.SMACrossStrategy`
- `riskoptima.backtest.run_backtest`
- `riskoptima.backtest.trades_from_sma_signals`
- `riskoptima.backtest.engine.BacktestConfig`
- `riskoptima.backtest.engine.SimpleCostModel`
- `riskoptima.optim.optimize_max_sharpe`

The UI shows:

- strategy parameters
- spread and slippage controls
- equity curve
- drawdown chart
- performance metric cards
- trade table
- static portfolio vs SMA crossover vs optimized max-Sharpe comparison
- generated RiskOptima code snippet
- diagnostics

Endpoint:

- `POST /api/portfolios/{portfolio_id}/backtests/run`

The module uses deterministic synthetic prices by default, so screenshots and tests remain reproducible.
