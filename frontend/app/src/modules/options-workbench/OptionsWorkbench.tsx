import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getOptionsWorkbench } from "../../services/api";
import type { OptionsWorkbenchResponse, Portfolio } from "../../types/api";
import { formatCurrency, formatPercent } from "../../utils";

function numberValue(row: Record<string, number | string | null>, key: string) {
  const value = row[key];
  return typeof value === "number" ? value : 0;
}

export function OptionsWorkbench({
  portfolio,
  portfolioId,
  startDate,
  asOfDate
}: {
  portfolio: Portfolio | null;
  portfolioId: number | null;
  startDate: string;
  asOfDate: string;
}) {
  const [symbol, setSymbol] = useState<string>("");
  const [workbench, setWorkbench] = useState<OptionsWorkbenchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const symbols = useMemo(() => portfolio?.positions.map((position) => position.instrument.symbol) ?? [], [portfolio]);

  async function load() {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const selected = symbol || symbols[0];
      const response = await getOptionsWorkbench(portfolioId, { symbol: selected, start_date: startDate, as_of_date: asOfDate });
      setWorkbench(response);
      setSymbol(response.underlying_symbol);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load options workbench.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!symbol && symbols[0]) setSymbol(symbols[0]);
  }, [symbols, symbol]);

  useEffect(() => {
    load();
  }, [portfolioId]);

  if (!portfolioId || !portfolio) {
    return (
      <section className="empty-state">
        <h2>No portfolio selected</h2>
        <p>Load or upload a portfolio before opening the options workbench.</p>
      </section>
    );
  }

  const chain = workbench?.option_chain.slice(0, 18) ?? [];
  const surface = workbench?.iv_surface.slice(0, 16) ?? [];

  return (
    <section className="module-page">
      <header className="topbar">
        <div>
          <p>Options Workbench</p>
          <h1>{workbench ? `${workbench.underlying_symbol} options analytics` : "Synthetic option chain analytics"}</h1>
        </div>
        <div className="topbar-actions">
          <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
            {symbols.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="icon-button" type="button" onClick={load} disabled={loading}>
            <RefreshCw size={17} />
            Analyze
          </button>
        </div>
      </header>

      {error ? <div className="alert-panel">{error}</div> : null}

      {workbench ? (
        <>
          <section className="summary-strip">
            <div>
              <span>Underlying</span>
              <strong>{workbench.underlying_symbol}</strong>
            </div>
            <div>
              <span>Spot</span>
              <strong>{formatCurrency(workbench.spot)}</strong>
            </div>
            <div>
              <span>Expiries</span>
              <strong>{workbench.expiries.length}</strong>
            </div>
            <div>
              <span>Contracts</span>
              <strong>{workbench.option_chain.length}</strong>
            </div>
          </section>

          <section className="metric-grid">
            {Object.entries(workbench.aggregate_greeks).map(([key, value]) => (
              <article className="metric-card" key={key}>
                <div className="metric-card__header">{key.replaceAll("_", " ")}</div>
                <strong>{value.toFixed(2)}</strong>
                <p>Aggregate synthetic option book exposure.</p>
              </article>
            ))}
          </section>

          <section className="table-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Option Chain</h2>
                <span>Theoretical prices and Greeks</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Expiry</th>
                      <th>Strike</th>
                      <th>Price</th>
                      <th>IV</th>
                      <th>Delta</th>
                      <th>Gamma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chain.map((row, index) => (
                      <tr key={`${row.symbol}-${index}`}>
                        <td>{row.option_type}</td>
                        <td>{row.expiry}</td>
                        <td>{formatCurrency(numberValue(row, "strike"))}</td>
                        <td>{formatCurrency(numberValue(row, "price"))}</td>
                        <td>{formatPercent(numberValue(row, "implied_volatility"))}</td>
                        <td>{numberValue(row, "delta").toFixed(3)}</td>
                        <td>{numberValue(row, "gamma").toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>IV Surface</h2>
                <span>Implied volatility matrix rows</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Expiry</th>
                      <th>Strike</th>
                      <th>Market</th>
                      <th>IV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surface.map((row, index) => (
                      <tr key={`${row.option_type}-${row.expiry}-${row.strike}-${index}`}>
                        <td>{row.option_type}</td>
                        <td>{row.expiry}</td>
                        <td>{formatCurrency(numberValue(row, "strike"))}</td>
                        <td>{formatCurrency(numberValue(row, "market_price"))}</td>
                        <td>{formatPercent(numberValue(row, "implied_volatility"))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <section className="table-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Scenario Grid</h2>
                <span>Spot and volatility shocks</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Spot shock</th>
                      <th>Vol shock</th>
                      <th>Price</th>
                      <th>PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workbench.scenario_grid.map((row, index) => (
                      <tr key={index}>
                        <td>{formatPercent(numberValue(row, "spot_shock"))}</td>
                        <td>{formatPercent(numberValue(row, "volatility_shock"))}</td>
                        <td>{formatCurrency(numberValue(row, "price"))}</td>
                        <td>{formatCurrency(numberValue(row, "pnl"))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>Event Straddles</h2>
                <span>Implied vs realized move</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Entry</th>
                      <th>Implied</th>
                      <th>Realized</th>
                      <th>PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workbench.event_straddle_analysis.map((row) => (
                      <tr key={String(row.event_date)}>
                        <td>{row.event_date}</td>
                        <td>{formatCurrency(numberValue(row, "entry_price"))}</td>
                        <td>{formatPercent(numberValue(row, "implied_move"))}</td>
                        <td>{formatPercent(numberValue(row, "realized_move"))}</td>
                        <td>{formatCurrency(numberValue(row, "pnl"))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <section className="code-panel">
            <span>Generated RiskOptima Python</span>
            <pre>{workbench.generated_code}</pre>
          </section>
        </>
      ) : (
        <section className="empty-state">
          <h2>Loading options analytics</h2>
          <p>The workbench builds a deterministic synthetic chain from the selected holding.</p>
        </section>
      )}
    </section>
  );
}
