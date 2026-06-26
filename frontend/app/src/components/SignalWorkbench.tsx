import {
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { PortfolioSignalReport } from "../types/api";
import { formatCurrency, formatPercent } from "../utils";

export function SignalWorkbench({
  signalReport,
  selectedSymbol,
  onSelectSymbol
}: {
  signalReport: PortfolioSignalReport;
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
}) {
  const activeSymbol = selectedSymbol ?? signalReport.summary[0]?.symbol ?? null;
  const detail = activeSymbol ? signalReport.details[activeSymbol] : null;
  const buySignals = detail?.signals.filter((point) => point.signal > 0) ?? [];
  const sellSignals = detail?.signals.filter((point) => point.signal < 0) ?? [];

  return (
    <section className="panel signal-workbench">
      <div className="panel-heading">
        <div>
          <span>RiskOptima SMA Notebook</span>
          <h2>Signals and stock drilldown</h2>
        </div>
        <span>
          SMA {signalReport.short_window}/{signalReport.long_window} through {signalReport.as_of_date}
        </span>
      </div>

      <div className="signal-layout">
        <div className="signal-list">
          {signalReport.summary.map((row) => (
            <button
              key={row.symbol}
              className={row.symbol === activeSymbol ? "signal-row signal-row--active" : "signal-row"}
              onClick={() => onSelectSymbol(row.symbol)}
            >
              <strong>{row.symbol}</strong>
              <span>{row.state}</span>
              <small>{row.last_signal_date ? `${row.last_signal} ${row.last_signal_date}` : "No crossover"}</small>
              <em>{formatPercent(row.cumulative_trade_return)}</em>
            </button>
          ))}
        </div>

        {detail ? (
          <div className="signal-detail">
            <div className="signal-kpis">
              <div>
                <span>Close</span>
                <strong>{formatCurrency(detail.close)}</strong>
              </div>
              <div>
                <span>Win rate</span>
                <strong>{formatPercent(detail.win_rate)}</strong>
              </div>
              <div>
                <span>Trades</span>
                <strong>{detail.trade_count}</strong>
              </div>
              <div>
                <span>Max drawdown</span>
                <strong className="negative">{formatPercent(detail.max_drawdown)}</strong>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={330}>
              <ComposedChart data={detail.signals}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" minTickGap={28} />
                <YAxis
                  domain={[(value: number) => Math.floor(value * 0.98), (value: number) => Math.ceil(value * 1.02)]}
                  tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                  width={64}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "signal" ? String(value) : formatCurrency(Number(value))
                  }
                />
                <Line type="monotone" dataKey="close" name="Close" stroke="#172033" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sma_short" name={`SMA ${signalReport.short_window}`} stroke="#1f6feb" dot={false} />
                <Line type="monotone" dataKey="sma_long" name={`SMA ${signalReport.long_window}`} stroke="#bf8700" dot={false} />
                {buySignals.map((point) => (
                  <ReferenceDot key={`buy-${point.date}`} x={point.date} y={point.close} r={5} fill="#1f7a3f" stroke="#ffffff" />
                ))}
                {sellSignals.map((point) => (
                  <ReferenceDot key={`sell-${point.date}`} x={point.date} y={point.close} r={5} fill="#cf222e" stroke="#ffffff" />
                ))}
              </ComposedChart>
            </ResponsiveContainer>

            <div className="signal-bottom-grid">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>Return</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.trades.slice(0, 8).map((trade) => (
                      <tr key={`${trade.entry_date}-${trade.exit_date}`}>
                        <td>{trade.entry_date}</td>
                        <td>{trade.exit_date}</td>
                        <td className={trade.return < 0 ? "negative" : "positive"}>{formatPercent(trade.return)}</td>
                        <td>{trade.exit_reason}</td>
                      </tr>
                    ))}
                    {detail.trades.length === 0 ? (
                      <tr>
                        <td colSpan={4}>No completed SMA trades in this window.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={signalReport.portfolio_equity}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" minTickGap={28} />
                  <YAxis domain={["dataMin", "dataMax"]} tickFormatter={(value: number) => `$${(value / 1_000_000).toFixed(1)}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="value" stroke="#2da44e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>

      <div className="signal-legend">
        <span><i className="legend-dot legend-dot--buy" /> Buy crossover</span>
        <span><i className="legend-dot legend-dot--sell" /> Sell crossover</span>
        <span>Stop loss {signalReport.stop_loss == null ? "off" : formatPercent(signalReport.stop_loss)}</span>
        <span>Take profit {signalReport.take_profit == null ? "off" : formatPercent(signalReport.take_profit)}</span>
      </div>
    </section>
  );
}
