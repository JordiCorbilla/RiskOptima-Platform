import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { PortfolioSignalReport, RiskReport } from "../types/api";
import { formatCurrency, formatPercent } from "../utils";

interface InstrumentDrawerProps {
  symbol: string;
  report: RiskReport;
  signalReport: PortfolioSignalReport | null;
  onClose: () => void;
}

export function InstrumentDrawer({ symbol, report, signalReport, onClose }: InstrumentDrawerProps) {
  const position = report.positions.find((row) => row.symbol === symbol);
  const contributor = report.largest_contributors.find((row) => row.symbol === symbol);
  const signal = signalReport?.details[symbol];
  const stressImpacts = report.stress_results
    .map((scenario) => ({
      scenario: scenario.scenario_name,
      impact: Number(scenario.impacts.find((impact) => impact.symbol === symbol)?.pnl ?? 0)
    }))
    .filter((row) => row.impact !== 0);

  if (!position) return null;

  return (
    <aside className="drawer" aria-label={`${symbol} instrument detail`}>
      <div className="drawer__header">
        <div>
          <span>Instrument Detail</span>
          <h2>{symbol}</h2>
          <p>{position.name}</p>
        </div>
        <button className="ghost-button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="drawer-kpis">
        <div>
          <span>Market Value</span>
          <strong>{formatCurrency(Number(position.market_value))}</strong>
        </div>
        <div>
          <span>Weight</span>
          <strong>{formatPercent(Number(position.weight))}</strong>
        </div>
        <div>
          <span>Component VaR</span>
          <strong>{contributor ? formatCurrency(Number(contributor.component_var)) : "n/a"}</strong>
        </div>
        <div>
          <span>Signal State</span>
          <strong>{signal?.state ?? "n/a"}</strong>
        </div>
      </div>

      {signal ? (
        <section className="drawer-section">
          <div className="panel-heading">
            <h3>SMA Signal Path</h3>
            <span>{signalReport?.as_of_date}</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={signal.signals}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" minTickGap={28} />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Area type="monotone" dataKey="close" fill="#e8f1ff" stroke="#1f6feb" dot={false} />
              <Line type="monotone" dataKey="sma_short" stroke="#1f7a3f" dot={false} />
              <Line type="monotone" dataKey="sma_long" stroke="#bf8700" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </section>
      ) : null}

      <section className="drawer-section">
        <div className="panel-heading">
          <h3>Stress Impact</h3>
          <span>Position P&amp;L</span>
        </div>
        <div className="table-wrap">
          <table>
            <tbody>
              {stressImpacts.map((row) => (
                <tr key={row.scenario}>
                  <td>{row.scenario}</td>
                  <td className={row.impact < 0 ? "negative" : "positive"}>{formatCurrency(row.impact)}</td>
                </tr>
              ))}
              {stressImpacts.length === 0 ? (
                <tr>
                  <td colSpan={2}>No scenario impact available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </aside>
  );
}
