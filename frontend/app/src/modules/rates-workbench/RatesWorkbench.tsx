import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartDownloadButton } from "../../components/ChartDownloadButton";
import { getRatesWorkbench } from "../../services/api";
import type { RatesWorkbenchResponse } from "../../types/api";
import { formatCurrency, formatPercent } from "../../utils";

function bps(value: number) {
  return `${value.toFixed(3)} bp`;
}

function rate(value: number) {
  return formatPercent(value);
}

function quoteValue(rateValue: number | null, priceValue: number | null) {
  if (typeof rateValue === "number") return rate(rateValue);
  if (typeof priceValue === "number") return priceValue.toFixed(3);
  return "n/a";
}

export function RatesWorkbench() {
  const [valuationDate, setValuationDate] = useState("2026-07-01");
  const [workbench, setWorkbench] = useState<RatesWorkbenchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setWorkbench(await getRatesWorkbench({ valuation_date: valuationDate }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load rates workbench.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const quoteIds = useMemo(() => workbench?.quotes.map((quote) => quote.quote_id) ?? [], [workbench]);

  return (
    <section className="module-page">
      <header className="topbar">
        <div>
          <p>Rates Workbench</p>
          <h1>{workbench ? workbench.curve_name : "Institutional SOFR curve analytics"}</h1>
        </div>
        <div className="topbar-actions">
          <input type="date" value={valuationDate} onChange={(event) => setValuationDate(event.target.value)} />
          <button className="icon-button" type="button" onClick={load} disabled={loading}>
            <RefreshCw size={17} />
            Rebuild curve
          </button>
        </div>
      </header>

      {error ? <div className="alert-panel">{error}</div> : null}

      {workbench ? (
        <>
          <section className="summary-strip">
            <div>
              <span>Valuation date</span>
              <strong>{workbench.valuation_date}</strong>
            </div>
            <div>
              <span>RiskOptima</span>
              <strong>{workbench.library_version ?? "installed"}</strong>
            </div>
            <div>
              <span>SOFR quotes</span>
              <strong>{workbench.summary.quote_count}</strong>
            </div>
            <div>
              <span>Max calibration error</span>
              <strong>{bps(workbench.summary.max_calibration_error_bps)}</strong>
            </div>
          </section>

          <section className="metric-grid">
            <article className="metric-card">
              <div className="metric-card__header">5Y Zero Rate</div>
              <strong>{rate(workbench.summary.five_year_zero_rate)}</strong>
              <p>Interpolated zero rate from the calibrated SOFR discount curve.</p>
            </article>
            <article className="metric-card">
              <div className="metric-card__header">5Y Par Swap</div>
              <strong>{rate(workbench.summary.five_year_par_swap_rate)}</strong>
              <p>Annual fixed-leg par rate implied by RiskOptima curve bootstrapping.</p>
            </article>
            <article className="metric-card">
              <div className="metric-card__header">Bond Price</div>
              <strong>{formatCurrency(workbench.summary.fixed_rate_bond_price)}</strong>
              <p>Five-year 4.5% fixed-rate bond priced against the SOFR curve.</p>
            </article>
            <article className="metric-card">
              <div className="metric-card__header">Total Key-Rate DV01</div>
              <strong>{workbench.summary.total_key_rate_dv01.toFixed(5)}</strong>
              <p>Present-value sensitivity to a one basis point curve-node shock.</p>
            </article>
          </section>

          <section className="chart-grid">
            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>SOFR Curve</h2>
                  <span>Zero, forward, and par-swap rates</span>
                </div>
                <ChartDownloadButton filename="riskoptima-sofr-curve" />
              </div>
              <p className="chart-note">
                Shows the term structure produced by RiskOptima's dated SOFR bootstrap across synthetic deposits, FOMC intervals, futures, and OIS swaps.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={workbench.curve_points}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="tenor_label" />
                  <YAxis tickFormatter={(value) => `${(Number(value) * 100).toFixed(1)}%`} />
                  <Tooltip formatter={(value: number) => rate(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="zero_rate" name="Zero" stroke="#1f6feb" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="forward_rate" name="Forward" stroke="#bf8700" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="par_swap_rate" name="Par swap" stroke="#1f7a3f" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Key-Rate DV01</h2>
                  <span>Fixed-income curve contribution</span>
                </div>
                <ChartDownloadButton filename="riskoptima-key-rate-dv01" />
              </div>
              <p className="chart-note">
                Attributes a five-year fixed-rate bond's rate sensitivity to calibrated curve nodes, making the dominant duration buckets visible.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workbench.key_rate_dv01}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="tenor_label" />
                  <YAxis tickFormatter={(value) => Number(value).toFixed(3)} />
                  <Tooltip formatter={(value: number) => value.toFixed(6)} />
                  <Bar dataKey="dv01" name="DV01" fill="#1f6feb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="table-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Market Quotes</h2>
                  <span>Deterministic synthetic curve inputs</span>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Quote</th>
                      <th>Type</th>
                      <th>Start</th>
                      <th>End / Maturity</th>
                      <th>Rate / Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workbench.quotes.map((quote) => (
                      <tr key={quote.quote_id}>
                        <td>{quote.quote_id}</td>
                        <td>{quote.instrument_type}</td>
                        <td>{quote.start_date ?? workbench.valuation_date}</td>
                        <td>{quote.end_date ?? quote.maturity_date ?? "n/a"}</td>
                        <td>{quoteValue(quote.rate, quote.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Calibration</h2>
                  <span>Model rate versus market rate</span>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Quote</th>
                      <th>Type</th>
                      <th>Market</th>
                      <th>Model</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workbench.calibration.map((row) => (
                      <tr key={row.quote_id}>
                        <td>{row.quote_id}</td>
                        <td>{row.instrument_type}</td>
                        <td>{rate(row.market_rate)}</td>
                        <td>{rate(row.model_rate)}</td>
                        <td>{bps(row.error_bps)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Calibration Jacobian</h2>
                <span>Output tenor sensitivity to one basis point quote bumps</span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tenor</th>
                    {quoteIds.map((quoteId) => (
                      <th key={quoteId}>{quoteId}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workbench.jacobian.map((row) => (
                    <tr key={row.output_tenor}>
                      <td>{row.output_tenor_label}</td>
                      {quoteIds.map((quoteId) => (
                        <td key={quoteId}>{(row.sensitivities[quoteId] ?? 0).toFixed(4)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="code-panel">
            <span>Generated RiskOptima Python</span>
            <pre>{workbench.generated_code}</pre>
          </section>
        </>
      ) : (
        <section className="empty-state">
          <h2>Loading rates analytics</h2>
          <p>The workbench builds a deterministic SOFR curve from local synthetic data.</p>
        </section>
      )}
    </section>
  );
}
