import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { NotebookWorkbench as NotebookWorkbenchPayload } from "../types/api";
import { formatCurrency, formatPercent } from "../utils";
import { ChartDownloadButton } from "./ChartDownloadButton";

export function NotebookWorkbench({ workbench }: { workbench: NotebookWorkbenchPayload }) {
  return (
    <section className="notebook-workbench">
      <div className="section-heading">
        <h2>RiskOptima Notebook Workbench</h2>
        <span>Remaining library angles through {workbench.as_of_date}</span>
      </div>

      <div className="chart-grid">
        <div className="panel chart-panel chart-panel--wide">
          <div className="panel-heading">
            <div>
              <h2>Mean-Variance + ML Optimization</h2>
              <span>Notebook 02</span>
            </div>
            <ChartDownloadButton filename="riskoptima-mean-variance-ml-optimization" />
          </div>
          <p className="chart-note">
            Compares the current portfolio weights with RiskOptima optimization outputs and an ML-adjusted allocation, making allocation drift and concentration changes explicit.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workbench.optimization_ml.weights}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="symbol" />
              <YAxis tickFormatter={formatPercent} />
              <Tooltip formatter={(value: number) => formatPercent(value)} />
              <Legend />
              <Bar dataKey="current" fill="#687385" name="Current" />
              <Bar dataKey="min_variance" fill="#2da44e" name="Min variance" />
              <Bar dataKey="max_sharpe" fill="#1f6feb" name="Max Sharpe" />
              <Bar dataKey="ml_adjusted" fill="#bf8700" name="ML adjusted" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel chart-panel--wide">
          <div className="panel-heading">
            <div>
              <h2>Index / Volatility Divergence</h2>
              <span>Notebook 03</span>
            </div>
            <ChartDownloadButton filename="riskoptima-index-volatility-divergence" />
          </div>
          <p className="chart-note">
            Shows synthetic index level, moving-average bands, and volatility proxy together to surface divergence periods that may precede regime or risk shifts.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={workbench.index_vol_divergence.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" minTickGap={28} />
              <YAxis yAxisId="left" tickFormatter={(value: number) => value.toFixed(0)} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value: number) => value.toFixed(0)} />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="base" stroke="#1f6feb" dot={false} name="Synthetic index" />
              <Line yAxisId="left" type="monotone" dataKey="ma" stroke="#bf8700" dot={false} name="MA" />
              <Line yAxisId="left" type="monotone" dataKey="upper" stroke="#d29922" dot={false} strokeDasharray="4 4" name="Upper band" />
              <Line yAxisId="left" type="monotone" dataKey="lower" stroke="#d29922" dot={false} strokeDasharray="4 4" name="Lower band" />
              <Line yAxisId="right" type="monotone" dataKey="vix" stroke="#2da44e" dot={false} name="Synthetic VIX" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel chart-panel--wide">
          <div className="panel-heading">
            <div>
              <h2>Portfolio Sophistication Methods</h2>
              <span>RiskOptima 2.7.0</span>
            </div>
            <ChartDownloadButton filename="riskoptima-portfolio-sophistication-methods" />
          </div>
          <p className="chart-note">
            Benchmarks construction approaches by return, drawdown, and Sharpe so the trade-off between performance and downside risk is visible in one view.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workbench.portfolio_sophistication.performance}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="method" />
              <YAxis yAxisId="left" tickFormatter={formatPercent} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "sharpe" ? value.toFixed(2) : formatPercent(value)
                }
              />
              <Legend />
              <Bar yAxisId="left" dataKey="annualized_return" fill="#1f6feb" name="Annualized return" />
              <Bar yAxisId="left" dataKey="max_drawdown" fill="#cf222e" name="Max drawdown" />
              <Bar yAxisId="right" dataKey="sharpe" fill="#2da44e" name="Sharpe" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Market Regime Probabilities</h2>
              <span>Current regime {workbench.markov_regimes.current_regime}</span>
            </div>
            <ChartDownloadButton filename="riskoptima-market-regime-probabilities" />
          </div>
          <p className="chart-note">
            Displays hidden-regime probabilities over time; rising probability in a stressed regime is a signal to review exposure and drawdown risk.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={workbench.markov_regimes.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" minTickGap={28} />
              <YAxis tickFormatter={formatPercent} />
              <Tooltip formatter={(value: number) => formatPercent(value)} />
              <Legend />
              <Line type="monotone" dataKey="regime_0_probability" stroke="#1f6feb" dot={false} name="Regime 0" />
              <Line type="monotone" dataKey="regime_1_probability" stroke="#bf8700" dot={false} name="Regime 1" />
              <Line type="monotone" dataKey="regime_2_probability" stroke="#cf222e" dot={false} name="Regime 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Volatility Toolkit</h2>
              <span>Rolling 21D</span>
            </div>
            <ChartDownloadButton filename="riskoptima-volatility-toolkit" />
          </div>
          <p className="chart-note">
            Tracks rolling realized volatility against summary estimates, helping distinguish persistent volatility changes from short-lived noise.
          </p>
          <div className="notebook-kpi-grid notebook-kpi-grid--compact">
            <div><span>Historical</span><strong>{formatPercent(workbench.volatility_toolkit.summary.historical_volatility)}</strong></div>
            <div><span>EWMA</span><strong>{formatPercent(workbench.volatility_toolkit.summary.ewma_volatility)}</strong></div>
            <div><span>Realized 21D</span><strong>{formatPercent(workbench.volatility_toolkit.summary.realized_volatility_21d)}</strong></div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={workbench.volatility_toolkit.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" minTickGap={28} />
              <YAxis tickFormatter={formatPercent} />
              <Tooltip formatter={(value: number) => formatPercent(value)} />
              <Line type="monotone" dataKey="rolling_volatility" stroke="#8250df" strokeWidth={2} dot={false} name="Rolling vol" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>IV Term Structure</h2>
              <span>Notebook 06</span>
            </div>
            <ChartDownloadButton filename="riskoptima-iv-term-structure" />
          </div>
          <p className="chart-note">
            Compares implied volatility by expiry with historical volatility, highlighting where the synthetic option market prices more or less forward uncertainty.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={workbench.options.iv_term_structure}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="expiry_days" />
              <YAxis tickFormatter={formatPercent} />
              <Tooltip formatter={(value: number) => formatPercent(value)} />
              <Line type="monotone" dataKey="iv" stroke="#8250df" strokeWidth={2} name="ATM IV" />
              <Line type="monotone" dataKey="historical_vol" stroke="#cf222e" strokeDasharray="4 4" name="Historical vol" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Greeks Simulator</h2>
              <span>{workbench.options.symbol}</span>
            </div>
            <ChartDownloadButton filename={`riskoptima-greeks-simulator-${workbench.options.symbol}`} />
          </div>
          <p className="chart-note">
            Shows how option sensitivities change by strike, which helps map directional, convexity, time-decay, and volatility exposure for the selected instrument.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={workbench.options.greeks}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="strike" tickFormatter={(value: number) => value.toFixed(0)} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="delta" stroke="#1f6feb" dot={false} />
              <Line type="monotone" dataKey="gamma" stroke="#2da44e" dot={false} />
              <Line type="monotone" dataKey="theta" stroke="#cf222e" dot={false} />
              <Line type="monotone" dataKey="vega" stroke="#8250df" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Credit Loss Distribution</h2>
              <span>Notebook 08</span>
            </div>
            <ChartDownloadButton filename="riskoptima-credit-loss-distribution" />
          </div>
          <p className="chart-note">
            Orders synthetic credit loss buckets to show the portfolio tail-loss shape that feeds expected loss, credit VaR, and credit CVaR.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={workbench.credit.loss_distribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" />
              <YAxis tickFormatter={(value: number) => `$${(value / 1_000_000).toFixed(1)}M`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line type="monotone" dataKey="loss" stroke="#cf222e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Stochastic Volatility</h2>
              <span>Notebook 04</span>
            </div>
            <ChartDownloadButton filename="riskoptima-stochastic-volatility" />
          </div>
          <p className="chart-note">
            Compares Hull-White, Heston, and SABR-style paths so model-driven volatility assumptions can be inspected side by side.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={workbench.stochastic_volatility.paths}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" minTickGap={28} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="hull_white" stroke="#1f6feb" dot={false} />
              <Line type="monotone" dataKey="heston" stroke="#2da44e" dot={false} />
              <Line type="monotone" dataKey="sabr" stroke="#8250df" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section className="table-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Bond Duration</h2>
            <span>Notebook 01</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Symbol</th><th>Yield</th><th>Mac Dur</th><th>Mod Dur</th><th>PVBP</th></tr>
              </thead>
              <tbody>
                {workbench.bonds.bonds.map((bond) => (
                  <tr key={bond.symbol}>
                    <td>{bond.symbol}</td>
                    <td>{formatPercent(bond.yield)}</td>
                    <td>{bond.macaulay_duration.toFixed(2)}</td>
                    <td>{bond.modified_duration.toFixed(2)}</td>
                    <td>{bond.pvbp.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Regime Summary</h2>
            <span>HMM states</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Regime</th><th>Count</th><th>Ann Return</th><th>Ann Vol</th><th>Mean</th></tr></thead>
              <tbody>
                {workbench.markov_regimes.summary.map((row) => (
                  <tr key={row.regime}>
                    <td>{row.regime}</td>
                    <td>{row.count}</td>
                    <td>{formatPercent(row.annualized_return)}</td>
                    <td>{formatPercent(row.annualized_volatility)}</td>
                    <td>{formatPercent(row.mean)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Asset Volatility</h2>
            <span>RiskOptima volatility toolkit</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Symbol</th><th>Historical</th><th>EWMA</th><th>Latest rolling</th></tr></thead>
              <tbody>
                {workbench.volatility_toolkit.assets.slice(0, 10).map((row) => (
                  <tr key={row.symbol}>
                    <td>{row.symbol}</td>
                    <td>{formatPercent(row.historical_volatility)}</td>
                    <td>{formatPercent(row.ewma_volatility)}</td>
                    <td>{formatPercent(row.latest_rolling_volatility)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Credit Summary</h2>
            <span>EL / VaR / Merton</span>
          </div>
          <div className="notebook-kpi-grid">
            <div><span>Expected loss</span><strong>{formatCurrency(workbench.credit.portfolio_expected_loss)}</strong></div>
            <div><span>Credit VaR 99</span><strong>{formatCurrency(workbench.credit.credit_var_99)}</strong></div>
            <div><span>Credit CVaR 99</span><strong>{formatCurrency(workbench.credit.credit_cvar_99)}</strong></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Symbol</th><th>Rating</th><th>PD</th><th>LGD</th><th>EL</th></tr></thead>
              <tbody>
                {workbench.credit.obligors.slice(0, 8).map((row) => (
                  <tr key={row.symbol}>
                    <td>{row.symbol}</td>
                    <td>{row.rating}</td>
                    <td>{formatPercent(row.pd)}</td>
                    <td>{formatPercent(row.lgd)}</td>
                    <td>{formatCurrency(row.expected_loss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  );
}
