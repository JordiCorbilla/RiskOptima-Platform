import { useState } from "react";
import { Play } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartDownloadButton } from "../../components/ChartDownloadButton";
import { runBacktest } from "../../services/api";
import type { BacktestRunResponse, Portfolio } from "../../types/api";
import { formatCurrency, formatPercent } from "../../utils";

export function BacktestStudio({
  portfolio,
  portfolioId,
  startDate,
  asOfDate,
  shortWindow,
  longWindow
}: {
  portfolio: Portfolio | null;
  portfolioId: number | null;
  startDate: string;
  asOfDate: string;
  shortWindow: number;
  longWindow: number;
}) {
  const [short, setShort] = useState(shortWindow);
  const [long, setLong] = useState(longWindow);
  const [spread, setSpread] = useState(2);
  const [slippage, setSlippage] = useState(0);
  const [result, setResult] = useState<BacktestRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRun() {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(
        await runBacktest(portfolioId, {
          start_date: startDate,
          as_of_date: asOfDate,
          strategy_type: "sma_crossover",
          short_window: short,
          long_window: long,
          rebalance_rule: "D",
          spread_bps: spread,
          slippage_bps: slippage,
          stop_loss: 0.05,
          take_profit: 0.1
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run backtest.");
    } finally {
      setLoading(false);
    }
  }

  if (!portfolioId || !portfolio) {
    return (
      <section className="empty-state">
        <h2>No portfolio selected</h2>
        <p>Load or upload a portfolio before running backtests.</p>
      </section>
    );
  }

  return (
    <section className="module-page">
      <header className="topbar">
        <div>
          <p>Backtest Studio</p>
          <h1>{result ? result.strategy_name : "SMA crossover strategy lab"}</h1>
        </div>
        <button className="icon-button" type="button" onClick={onRun} disabled={loading}>
          <Play size={17} />
          Run backtest
        </button>
      </header>

      {error ? <div className="alert-panel">{error}</div> : null}

      <section className="panel portfolio-editor">
        <div className="panel-heading">
          <div>
            <span>Parameters</span>
            <h2>{portfolio.name}</h2>
          </div>
        </div>
        <div className="editor-grid">
          <label>
            <span>Short SMA</span>
            <input type="number" min={2} max={120} value={short} onChange={(event) => setShort(Number(event.target.value))} />
          </label>
          <label>
            <span>Long SMA</span>
            <input type="number" min={3} max={260} value={long} onChange={(event) => setLong(Number(event.target.value))} />
          </label>
          <label>
            <span>Spread bps</span>
            <input type="number" min={0} max={100} value={spread} onChange={(event) => setSpread(Number(event.target.value))} />
          </label>
          <label>
            <span>Slippage bps</span>
            <input type="number" min={0} max={100} value={slippage} onChange={(event) => setSlippage(Number(event.target.value))} />
          </label>
        </div>
      </section>

      {result ? (
        <>
          <section className="metric-grid">
            <article className="metric-card">
              <div className="metric-card__header">Final Value</div>
              <strong>{formatCurrency(result.final_value)}</strong>
              <p>Total return {formatPercent(result.total_return)}</p>
            </article>
            <article className="metric-card">
              <div className="metric-card__header">Sharpe / Sortino</div>
              <strong>{result.sharpe.toFixed(2)}</strong>
              <p>Sortino {result.sortino.toFixed(2)}</p>
            </article>
            <article className="metric-card">
              <div className="metric-card__header">Volatility</div>
              <strong>{formatPercent(result.annualized_volatility)}</strong>
              <p>Return {formatPercent(result.annualized_return)}</p>
            </article>
            <article className="metric-card">
              <div className="metric-card__header">Max Drawdown</div>
              <strong>{formatPercent(result.max_drawdown)}</strong>
              <p>Win rate {formatPercent(result.win_rate)}</p>
            </article>
          </section>

          <section className="chart-grid">
            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Equity Curve</h2>
                  <span>RiskOptima run_backtest</span>
                </div>
                <ChartDownloadButton filename="riskoptima-backtest-equity-curve" />
              </div>
              <p className="chart-note">
                Shows the strategy account value after synthetic signal execution and transaction-cost assumptions, making compounding and path dependency visible.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={result.equity_curve}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" minTickGap={32} />
                  <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="value" stroke="#1f6feb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Drawdown</h2>
                  <span>Strategy path</span>
                </div>
                <ChartDownloadButton filename="riskoptima-backtest-drawdown" />
              </div>
              <p className="chart-note">
                Tracks the strategy's loss from prior peak value; deeper negative readings identify periods where the SMA logic gave back capital.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={result.drawdown_curve}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" minTickGap={32} />
                  <YAxis tickFormatter={(value) => formatPercent(Number(value))} />
                  <Tooltip formatter={(value: number) => formatPercent(value)} />
                  <Line type="monotone" dataKey="drawdown" stroke="#cf222e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="table-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Strategy Comparison</h2>
                <span>Static vs SMA vs optimized</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Strategy</th>
                      <th>Total Return</th>
                      <th>Volatility</th>
                      <th>Sharpe</th>
                      <th>Max DD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparisons.map((row) => (
                      <tr key={String(row.strategy)}>
                        <td>{row.strategy}</td>
                        <td>{formatPercent(Number(row.total_return))}</td>
                        <td>{formatPercent(Number(row.annualized_volatility))}</td>
                        <td>{Number(row.sharpe).toFixed(2)}</td>
                        <td>{formatPercent(Number(row.max_drawdown))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Trades</h2>
                <span>Latest extracted SMA trades</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>Return</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 12).map((trade, index) => (
                      <tr key={`${trade.ticker}-${trade.exit_date}-${index}`}>
                        <td>{trade.ticker}</td>
                        <td>{trade.entry_date}</td>
                        <td>{trade.exit_date}</td>
                        <td>{formatPercent(trade.return)}</td>
                        <td>{trade.exit_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <section className="code-panel">
            <span>Generated RiskOptima Python</span>
            <pre>{result.generated_code}</pre>
          </section>
        </>
      ) : (
        <section className="empty-state">
          <h2>No backtest run yet</h2>
          <p>Run the strategy to compare static, SMA, and optimized allocations on deterministic synthetic data.</p>
        </section>
      )}
    </section>
  );
}
