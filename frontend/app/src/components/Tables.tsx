import type { RiskReport } from "../types/api";
import { formatCurrency, formatPercent } from "../utils";
import React from "react";

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

export function PortfolioDetailsTable({ report }: { report: RiskReport }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Portfolio Details</h2>
        <span>Uploaded positions</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Asset Class</th>
              <th>Sector</th>
              <th>Market Value</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {report.positions.map((position) => (
              <tr key={String(position.symbol)}>
                <td>{position.symbol}</td>
                <td>{position.name}</td>
                <td>{position.asset_class}</td>
                <td>{position.sector}</td>
                <td>{formatCurrency(Number(position.market_value))}</td>
                <td>{formatPercent(Number(position.weight))}</td>
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

export function CorrelationMatrixTable({ report }: { report: RiskReport }) {
  const symbols = Array.from(new Set(report.optimization.correlation_matrix.map((item) => item.x)));
  const valueFor = (x: string, y: string) =>
    report.optimization.correlation_matrix.find((item) => item.x === x && item.y === y)?.value ?? 0;

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Correlation Matrix</h2>
        <span>Notebook heatmap rendered as data</span>
      </div>
      <div className="correlation-grid" style={{ gridTemplateColumns: `90px repeat(${symbols.length}, minmax(48px, 1fr))` }}>
        <span />
        {symbols.map((symbol) => (
          <strong key={symbol}>{symbol}</strong>
        ))}
        {symbols.map((row) => (
          <React.Fragment key={row}>
            <strong>{row}</strong>
            {symbols.map((column) => {
              const value = valueFor(row, column);
              const alpha = Math.min(1, Math.abs(value));
              const background = value >= 0 ? `rgba(31, 111, 235, ${alpha})` : `rgba(207, 34, 46, ${alpha})`;
              return (
                <span key={`${row}-${column}`} style={{ background }}>
                  {value.toFixed(2)}
                </span>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
