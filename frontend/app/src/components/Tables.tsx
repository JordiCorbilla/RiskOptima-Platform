import type { RiskReport } from "../types/api";
import { formatCurrency, formatPercent } from "../utils";

export function StressScenarioTable({ report }: { report: RiskReport }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Stress Scenarios</h2>
        <span>Synthetic scenario P&amp;L</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Stressed Value</th>
              <th>P&amp;L</th>
              <th>P&amp;L %</th>
            </tr>
          </thead>
          <tbody>
            {report.stress_results.map((scenario) => (
              <tr key={scenario.scenario_id}>
                <td>{scenario.scenario_name}</td>
                <td>{formatCurrency(scenario.stressed_value)}</td>
                <td className={scenario.pnl < 0 ? "negative" : "positive"}>{formatCurrency(scenario.pnl)}</td>
                <td className={scenario.pnl_percent < 0 ? "negative" : "positive"}>{formatPercent(scenario.pnl_percent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ContributorsTable({ report }: { report: RiskReport }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Largest Contributors</h2>
        <span>Marginal and component VaR</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Weight</th>
              <th>Marginal VaR</th>
              <th>Component VaR</th>
              <th>Contribution</th>
            </tr>
          </thead>
          <tbody>
            {report.largest_contributors.slice(0, 8).map((row) => (
              <tr key={String(row.symbol)}>
                <td>{row.symbol}</td>
                <td>{formatPercent(Number(row.weight))}</td>
                <td>{formatCurrency(Number(row.marginal_var))}</td>
                <td>{formatCurrency(Number(row.component_var))}</td>
                <td>{formatPercent(Number(row.component_percent))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
