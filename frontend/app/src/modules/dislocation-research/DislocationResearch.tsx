import { useMemo, useState } from "react";
import { ArrowDownUp, Search } from "lucide-react";
import { SafeMarkdown } from "../../components/SafeMarkdown";
import { scanDislocation } from "../../services/api";
import type { Portfolio } from "../../types/api";
import type { ResearchResult, ResearchRow } from "./types";

const number = (value: number | null | undefined) => value == null ? "Unavailable" : value.toFixed(2);
const percent = (value: number | null) => value == null ? "Unavailable" : `${(value * 100).toFixed(2)}%`;
type SortKey = "symbol" | "opportunity_score" | "confidence_score" | "classification";

export function DislocationResearch({ portfolio }: { portfolio: Portfolio | null }) {
  const [mode, setMode] = useState("manual");
  const [tickers, setTickers] = useState("MSFT, SPY");
  const [holdings, setHoldings] = useState<string[]>([]);
  const [history, setHistory] = useState("5y");
  const [discount, setDiscount] = useState(9);
  const [terminal, setTerminal] = useState(2.5);
  const [horizon, setHorizon] = useState(5);
  const [markov, setMarkov] = useState(true);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: "opportunity_score", ascending: false });
  const rows = useMemo(() => [...(result?.summary ?? [])].sort((a, b) => {
    const left = a[sort.key], right = b[sort.key];
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    return (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))) * (sort.ascending ? 1 : -1);
  }), [result, sort]);
  const detail = result?.analyses.find(item => item.symbol === selected);
  const selectedRow = result?.summary.find(item => item.symbol === selected);
  const fund = detail && detail.instrument_type !== "EQUITY";

  async function run() {
    const symbols = mode === "manual" ? [...new Set(tickers.split(/[\s,;]+/).filter(Boolean).map(s => s.toUpperCase()))] : holdings;
    if (!symbols.length || symbols.length > 25) { setError("Select between 1 and 25 tickers."); return; }
    setLoading(true); setError(null); setResult(null); setSelected(null);
    try {
      const next = await scanDislocation({ tickers: symbols, ...(mode === "portfolio" ? { portfolio_id: portfolio?.id } : {}), config: {
        history_period: history, discount_rate: discount / 100, terminal_growth: terminal / 100,
        valuation_horizon_years: horizon, use_markov_regime: markov
      } });
      setResult(next); setSelected(next.analyses[0]?.symbol ?? next.summary[0]?.symbol ?? null);
    } catch (err) { setError(err instanceof Error ? err.message : "Research request failed."); }
    finally { setLoading(false); }
  }
  function sortBy(key: SortKey) { setSort(current => ({ key, ascending: current.key === key ? !current.ascending : true })); }
  function heading(key: SortKey, label: string) {
    return <th aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => sortBy(key)}>{label} <ArrowDownUp size={13} /></button></th>;
  }

  return <section className="module-page dislocation-page">
    <header className="topbar"><div><p>Instrument research</p><h1>Dislocation Research</h1></div><span>{result ? `RiskOptima v${result.riskoptima_version}` : "RiskOptima Dislocation"}</span></header>
    <p className="research-notice">Research screen, not an investment recommendation or market-bottom predictor. Each instrument is analyzed independently; this is not an aggregate portfolio valuation.</p>
    <section className="panel research-controls" aria-label="Research inputs">
      <div className="research-fields">
        <label>Instruments<select value={mode} disabled={loading} onChange={e => setMode(e.target.value)}><option value="manual">Manual ticker list</option><option value="portfolio" disabled={!portfolio}>Selected portfolio holdings</option></select></label>
        <label>Price history<select value={history} disabled={loading} onChange={e => setHistory(e.target.value)}>{["1y", "2y", "5y", "10y"].map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Discount rate (%)<input type="number" min="0.1" max="100" step="0.5" value={discount} disabled={loading} onChange={e => setDiscount(Number(e.target.value))} /></label>
        <label>Terminal growth (%)<input type="number" min="-99" max="100" step="0.5" value={terminal} disabled={loading} onChange={e => setTerminal(Number(e.target.value))} /></label>
        <label>Convergence horizon (years)<input type="number" min="1" max="30" value={horizon} disabled={loading} onChange={e => setHorizon(Number(e.target.value))} /></label>
      </div>
      {mode === "manual" ? <label className="research-tickers">Ticker symbols<textarea value={tickers} disabled={loading} onChange={e => setTickers(e.target.value)} rows={2} /></label> : <fieldset disabled={loading}><legend>{portfolio?.name ?? "No portfolio selected"}</legend><div className="research-holdings">{portfolio?.positions.map(({ instrument }) => <label key={instrument.symbol}><input type="checkbox" checked={holdings.includes(instrument.symbol)} onChange={e => setHoldings(current => e.target.checked ? [...current, instrument.symbol] : current.filter(s => s !== instrument.symbol))} />{instrument.symbol} · {instrument.name}</label>)}</div></fieldset>}
      <div className="research-actions"><label><input type="checkbox" checked={markov} disabled={loading} onChange={e => setMarkov(e.target.checked)} /> HMM regime analysis</label><button className="icon-button" disabled={loading} onClick={run}><Search size={16} />{loading ? "Analyzing instruments…" : "Analyze instruments"}</button></div>
    </section>
    {loading && <div role="status" className="status-panel">Retrieving server-side market data and analyzing instruments. Larger lists can take longer.</div>}
    {error && <div role="alert" className="alert-panel">{error}</div>}
    {result && <>
      {result.status !== "success" && <div role="alert" className="alert-panel">{result.status === "failed" ? "Research failed: all tickers returned errors." : "Partial results: some tickers could not be analyzed."} Review the errors below.</div>}
      <section className="summary-strip"><div><span>Analyzed</span><strong>{result.analyses.length} / {result.summary.length}</strong></div><div><span>Source</span><strong>{result.source}</strong></div><div><span>Engine</span><strong>RiskOptima v{result.riskoptima_version}</strong></div></section>
      <section className="panel"><div className="panel-heading"><h2>Instrument results</h2><span>Data Coverage is input completeness, not accuracy probability</span></div><div className="table-scroll"><table className="research-table"><thead><tr>{heading("symbol", "Instrument")}{heading("opportunity_score", "Research score")}{heading("confidence_score", "Data Coverage")}<th>Price</th>{heading("classification", "Classification")}<th>Diagnostics</th></tr></thead><tbody>{rows.map((row: ResearchRow) => <tr key={row.symbol} className={row.symbol === selected ? "research-selected" : ""}><td><button type="button" onClick={() => setSelected(row.symbol)}>{row.symbol}</button><small>{row.name}</small></td><td>{number(row.opportunity_score)}</td><td>{number(row.confidence_score)}</td><td>{number(row.price)} {row.currency}</td><td>{row.classification}</td><td>{row.error ?? "Available in details"}</td></tr>)}</tbody></table></div></section>
      {selectedRow?.error && <section className="panel" role="alert"><h2>{selectedRow.symbol}</h2><p>{selectedRow.error}</p></section>}
      {detail && <section className="panel research-detail"><div className="panel-heading"><h2>{detail.symbol} · {detail.name}</h2><span>RiskOptima v{detail.riskoptima_version}</span></div>
        <p>{detail.instrument_type} · {detail.valuation_mode} · {detail.currency ?? "Currency unavailable"}</p><p>Price date: {detail.as_of} · Generated: {detail.generated_at}</p><p>Source: {result.source}</p>
        <dl className="research-metrics"><div><dt>Dislocation score / 100</dt><dd>{number(detail.dislocation_score)}</dd></div><div><dt>Regime score / 100</dt><dd>{number(detail.regime_score)}</dd></div><div><dt>Data Coverage / 100</dt><dd>{number(detail.confidence_score)}</dd></div>{!fund && <><div><dt>Quality score / 100</dt><dd>{number(detail.quality_score)}</dd></div><div><dt>Valuation score / 100</dt><dd>{number(detail.valuation_score)}</dd></div></>}</dl>
        {detail.research_notice && <p className="research-notice">{detail.research_notice}</p>}
        {fund ? <p className="research-notice">Fund / non-equity: price and regime analysis only. No corporate DCF or measured NAV discount.</p> : <><h3>Equity model valuation</h3><p>Unadjusted positive free cash flow proxy; no net borrowing or normalized FCFE reconciliation. Verify currency, units, share class and reporting period.</p>{detail.intrinsic_value == null ? <p>Model valuation unavailable. Missing or non-positive cash flow or shares cannot support a DCF.</p> : <dl className="research-metrics"><div><dt>Model value per share</dt><dd>{number(detail.intrinsic_value)} {detail.currency}</dd></div><div><dt>Margin of safety</dt><dd>{percent(detail.margin_of_safety)}</dd><small>(Model value − price) / model value</small></div><div><dt>Upside to model value</dt><dd>{percent(detail.upside_to_model_value)}</dd><small>Model value / price − 1</small></div><div><dt>Hypothetical annualized convergence</dt><dd>{percent(detail.implied_annualized_return)}</dd><small>{detail.valuation_horizon_years} years to today's model value; excludes distributions. Not a forecast or total-return IRR.</small></div></dl>}</>}
        <h3>Metrics</h3><dl className="research-metrics">{Object.entries(detail.metrics).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value == null ? "Unavailable" : typeof value === "number" ? number(value) : value}</dd></div>)}</dl>
        <h3>Assumptions</h3><dl className="research-metrics">{Object.entries(result.assumptions).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl><p>252 trading sessions per year. Historical HMM regimes are descriptive, not an out-of-sample trading signal. Missing score components are omitted and available weights renormalized.</p>
        <h3>Diagnostics</h3>{detail.diagnostics.length ? <ul>{detail.diagnostics.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>No additional diagnostics reported. Data Coverage does not establish freshness, valuation quality or predictive skill.</p>}
        <h3>RiskOptima report</h3><SafeMarkdown>{result.reports[detail.symbol] ?? "Report unavailable."}</SafeMarkdown>
      </section>}
    </>}
    {!result && !loading && <section className="empty-state"><Search size={28} /><h2>No research run yet</h2><p>Live provider availability varies. Failed requests are reported explicitly; synthetic data is never substituted.</p></section>}
  </section>;
}
