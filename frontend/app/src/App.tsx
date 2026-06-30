import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ExternalLink, LineChart, Plus, RefreshCw, Save, Trash2, UploadCloud } from "lucide-react";
import { InstrumentDrawer } from "./components/InstrumentDrawer";
import { ContributorsTable, CorrelationMatrixTable, PortfolioDetailsTable, StressScenarioTable } from "./components/Tables";
import { MetricCard } from "./components/MetricCard";
import { NotebookWorkbench } from "./components/NotebookWorkbench";
import { RenderedChartGallery } from "./components/RenderedChartGallery";
import { RiskCharts } from "./components/RiskCharts";
import { SignalWorkbench } from "./components/SignalWorkbench";
import { generatePortfolioRun, getNotebookWorkbench, getPortfolio, getPortfolioSignals, listPortfolioRuns, listPortfolios, updatePortfolio, uploadPortfolio } from "./services/api";
import type { NotebookWorkbench as NotebookWorkbenchPayload, Portfolio, PortfolioSignalReport, PortfolioSummary, RenderedChart, RiskReport, RunSummary } from "./types/api";
import { formatCurrency, formatPercent } from "./utils";

const assetClasses = ["Equity", "Fixed Income", "Credit", "Commodity", "Cash", "Alternative"];
const sections = ["Overview", "Risk", "Optimization", "Signals", "Stress", "Workbench", "Renders"] as const;
const economicCalendarUrl = import.meta.env.VITE_ECONOMIC_CALENDAR_URL ?? "http://127.0.0.1:5177";
type Section = (typeof sections)[number];

function previousBusinessDateString(base = new Date()) {
  const value = new Date(base);
  value.setDate(value.getDate() - 1);
  while (value.getDay() === 0 || value.getDay() === 6) {
    value.setDate(value.getDate() - 1);
  }
  return value.toISOString().slice(0, 10);
}

function defaultStartDateString(asOfDate: string) {
  const value = new Date(`${asOfDate}T00:00:00`);
  value.setFullYear(value.getFullYear() - 2);
  return value.toISOString().slice(0, 10);
}

function blankPortfolioRow(): Portfolio["positions"][number] {
  return {
    instrument: {
      symbol: "NEW",
      name: "New Instrument",
      asset_class: "Equity",
      sector: "Diversified",
      currency: "USD",
      beta: 1
    },
    quantity: 100,
    price: 100
  };
}

export function App() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [portfolioDetail, setPortfolioDetail] = useState<Portfolio | null>(null);
  const [report, setReport] = useState<RiskReport | null>(null);
  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]);
  const [signalReport, setSignalReport] = useState<PortfolioSignalReport | null>(null);
  const [notebookWorkbench, setNotebookWorkbench] = useState<NotebookWorkbenchPayload | null>(null);
  const [selectedSignalSymbol, setSelectedSignalSymbol] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [activeSection, setActiveSection] = useState<Section>("Overview");
  const [runStep, setRunStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("Flagship Institutional Portfolio");
  const [asOfDate, setAsOfDate] = useState(() => previousBusinessDateString());
  const [startDate, setStartDate] = useState(() => defaultStartDateString(previousBusinessDateString()));
  const [shortWindow, setShortWindow] = useState(20);
  const [longWindow, setLongWindow] = useState(50);
  const [status, setStatus] = useState("Load a synthetic CSV portfolio to begin.");
  const [loading, setLoading] = useState(false);

  async function refreshPortfolios(nextId?: number) {
    const data = await listPortfolios();
    setPortfolios(data);
    const targetId = nextId ?? selectedId ?? data[0]?.id ?? null;
    setSelectedId(targetId);
    if (targetId) {
      await loadPortfolio(targetId);
    }
  }

  async function loadPortfolio(portfolioId: number) {
    try {
      const detail = await getPortfolio(portfolioId);
      setPortfolioDetail(detail);
      setRunHistory(await listPortfolioRuns(portfolioId));
      setErrorMessage(null);
    } catch (error) {
      setPortfolioDetail(null);
      setRunHistory([]);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load portfolio details.");
      setStatus(error instanceof Error ? error.message : "Unable to load portfolio details.");
    }
  }

  function validatePortfolio(portfolio: Portfolio | null) {
    const issues: string[] = [];
    if (!portfolio) return ["No portfolio is selected."];
    if (!portfolio.name.trim()) issues.push("Portfolio name is required.");
    if (!portfolio.positions.length) issues.push("At least one position is required.");
    const symbols = portfolio.positions.map((position) => position.instrument.symbol.trim().toUpperCase());
    const duplicates = symbols.filter((symbol, index) => symbol && symbols.indexOf(symbol) !== index);
    if (duplicates.length) issues.push(`Duplicate symbols: ${Array.from(new Set(duplicates)).join(", ")}.`);
    portfolio.positions.forEach((position, index) => {
      const label = position.instrument.symbol || `row ${index + 1}`;
      if (!position.instrument.symbol.trim()) issues.push(`Missing symbol in row ${index + 1}.`);
      if (!position.instrument.name.trim()) issues.push(`${label} is missing a name.`);
      if (!position.instrument.sector.trim()) issues.push(`${label} is missing a sector.`);
      if (!position.instrument.currency.trim()) issues.push(`${label} is missing a currency.`);
      if (!Number.isFinite(position.quantity) || position.quantity <= 0) issues.push(`${label} quantity must be positive.`);
      if (!Number.isFinite(position.price) || position.price <= 0) issues.push(`${label} price must be positive.`);
    });
    if (startDate && asOfDate && startDate > asOfDate) issues.push("Start date must be on or before as-of date.");
    if (shortWindow >= longWindow) issues.push("Short SMA window must be less than long SMA window.");
    return issues;
  }

  async function generateRun(portfolioId: number, force = false, dates = { start: startDate, asOf: asOfDate }) {
    const validationIssues = validatePortfolio(portfolioDetail);
    if (validationIssues.length) {
      setErrorMessage(validationIssues.join(" "));
      setStatus("Resolve portfolio validation issues before generating a run.");
      return;
    }
    setLoading(true);
    setRunStep("Preparing dated request");
    setErrorMessage(null);
    try {
      setRunStep(force ? "Forcing recalculation" : "Checking generated-run cache");
      const run = await generatePortfolioRun(portfolioId, {
        start_date: dates.start,
        as_of_date: dates.asOf,
        force
      });
      setRunStep("Building RiskOptima SMA signal report");
      const signals = await getPortfolioSignals(portfolioId, {
        start_date: run.start_date,
        as_of_date: run.as_of_date,
        short_window: shortWindow,
        long_window: longWindow,
        stop_loss: 0.05,
        take_profit: 0.1
      });
      setRunStep("Building notebook workbench");
      const notebooks = await getNotebookWorkbench(portfolioId, {
        start_date: run.start_date,
        as_of_date: run.as_of_date
      });
      setRunStep("Rendering dashboard");
      setReport(run.report);
      setRenderedCharts(run.charts);
      setSignalReport(signals);
      setNotebookWorkbench(notebooks);
      setSelectedSignalSymbol(signals.summary[0]?.symbol ?? null);
      setActiveSection("Overview");
      setRunHistory(await listPortfolioRuns(portfolioId));
      setStatus(
        `${run.cache_hit ? "Loaded cached" : "Generated"} run ${run.run_id} for ${run.start_date} to ${run.as_of_date}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to generate portfolio run.");
      setStatus(error instanceof Error ? error.message : "Unable to generate portfolio run.");
    } finally {
      setLoading(false);
      setRunStep(null);
    }
  }

  useEffect(() => {
    refreshPortfolios().catch(() => setStatus("API is not reachable. Start the FastAPI backend on port 8000."));
  }, []);

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedId),
    [portfolios, selectedId]
  );
  const validationIssues = useMemo(() => validatePortfolio(portfolioDetail), [portfolioDetail, startDate, asOfDate, shortWindow, longWindow]);
  const portfolioMarketValue = useMemo(
    () => portfolioDetail?.positions.reduce((sum, position) => sum + position.quantity * position.price, 0) ?? 0,
    [portfolioDetail]
  );
  const assetWeights = useMemo(() => {
    if (!portfolioDetail || portfolioMarketValue <= 0) return [];
    const totals = new Map<string, number>();
    portfolioDetail.positions.forEach((position) => {
      const key = position.instrument.asset_class;
      totals.set(key, (totals.get(key) ?? 0) + position.quantity * position.price);
    });
    return Array.from(totals.entries())
      .map(([assetClass, value]) => ({ assetClass, value, weight: value / portfolioMarketValue }))
      .sort((left, right) => right.value - left.value);
  }, [portfolioDetail, portfolioMarketValue]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setLoading(true);
    try {
      const portfolio = await uploadPortfolio(file, uploadName);
      await refreshPortfolios(portfolio.id);
      setErrorMessage(null);
      setStatus(`Uploaded ${file.name}. Save any edits, then generate the dated run.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onSavePortfolio() {
    if (!portfolioDetail) return;
    const validationIssues = validatePortfolio(portfolioDetail);
    if (validationIssues.length) {
      setErrorMessage(validationIssues.join(" "));
      setStatus("Resolve portfolio validation issues before saving.");
      return;
    }
    setLoading(true);
    try {
      const saved = await updatePortfolio(portfolioDetail);
      setPortfolioDetail(saved);
      await refreshPortfolios(saved.id);
      setErrorMessage(null);
      setStatus("Portfolio details saved. Generate will create a new cache key if positions changed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save portfolio.");
      setStatus(error instanceof Error ? error.message : "Unable to save portfolio.");
    } finally {
      setLoading(false);
    }
  }

  function updatePosition(index: number, patch: Partial<Portfolio["positions"][number]>) {
    setPortfolioDetail((current) => {
      if (!current) return current;
      return {
        ...current,
        positions: current.positions.map((position, positionIndex) =>
          positionIndex === index ? { ...position, ...patch } : position
        )
      };
    });
  }

  function updateInstrument(index: number, patch: Partial<Portfolio["positions"][number]["instrument"]>) {
    setPortfolioDetail((current) => {
      if (!current) return current;
      return {
        ...current,
        positions: current.positions.map((position, positionIndex) =>
          positionIndex === index
            ? { ...position, instrument: { ...position.instrument, ...patch } }
            : position
        )
      };
    });
  }

  function removePosition(index: number) {
    setPortfolioDetail((current) => {
      if (!current) return current;
      return { ...current, positions: current.positions.filter((_, positionIndex) => positionIndex !== index) };
    });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>RiskOptima</span>
          <strong>Institutional Risk</strong>
        </div>

        <nav className="platform-menu" aria-label="Platform modules">
          <span className="sidebar-heading">Modules</span>
          <button className="module-link module-link--active" type="button">
            <LineChart size={17} />
            <span>Portfolio Risk</span>
          </button>
          <a className="module-link" href={economicCalendarUrl} target="_blank" rel="noreferrer">
            <CalendarDays size={17} />
            <span>Economic Calendar</span>
            <ExternalLink size={14} />
          </a>
        </nav>

        <label className="field-label" htmlFor="portfolio-name">
          Portfolio name
        </label>
        <input id="portfolio-name" value={uploadName} onChange={(event) => setUploadName(event.target.value)} />
        <label className="upload-zone">
          <UploadCloud size={22} />
          <span>Upload CSV</span>
          <input type="file" accept=".csv" onChange={(event) => onUpload(event.target.files?.[0] ?? null)} />
        </label>

        <div className="portfolio-list">
          <div className="sidebar-heading">Portfolios</div>
          {portfolios.map((portfolio) => (
            <button
              key={portfolio.id}
              className={portfolio.id === selectedId ? "portfolio-button portfolio-button--active" : "portfolio-button"}
              onClick={() => {
                setSelectedId(portfolio.id);
                setReport(null);
                setRenderedCharts([]);
                setSignalReport(null);
                setNotebookWorkbench(null);
                setSelectedSignalSymbol(null);
                setSelectedInstrument(null);
                setActiveSection("Overview");
                loadPortfolio(portfolio.id);
              }}
            >
              <span>{portfolio.name}</span>
              <small>{formatCurrency(portfolio.market_value)}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>Portfolio Risk Dashboard</p>
            <h1>{selectedPortfolio?.name ?? "Synthetic Portfolio Monitor"}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => selectedId && generateRun(selectedId)} disabled={!selectedId || loading}>
              <CalendarDays size={18} />
              Generate
            </button>
            <button className="ghost-button" onClick={() => selectedId && generateRun(selectedId, true)} disabled={!selectedId || loading}>
              <RefreshCw size={18} />
              Force recalc
            </button>
          </div>
        </header>

        <div className="status-line">{status}</div>
        {runStep ? (
          <div className="run-progress">
            <span>{runStep}</span>
            <strong>Run in progress</strong>
          </div>
        ) : null}
        {errorMessage ? <div className="alert-panel">{errorMessage}</div> : null}

        {portfolioDetail ? (
          <section className="panel portfolio-editor">
            <div className="panel-heading">
              <div>
                <span>Portfolio Book</span>
                <h2>Editable positions and run dates</h2>
              </div>
              <button className="icon-button" onClick={onSavePortfolio} disabled={loading || portfolioDetail.positions.length === 0}>
                <Save size={18} />
                Save details
              </button>
            </div>
            <div className="editor-grid">
              <label>
                <span>Name</span>
                <input
                  value={portfolioDetail.name}
                  onChange={(event) => setPortfolioDetail({ ...portfolioDetail, name: event.target.value })}
                />
              </label>
              <label>
                <span>Base currency</span>
                <input
                  value={portfolioDetail.base_currency}
                  onChange={(event) => setPortfolioDetail({ ...portfolioDetail, base_currency: event.target.value.toUpperCase() })}
                />
              </label>
              <label>
                <span>Start date</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label>
                <span>As of date</span>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(event) => {
                    setAsOfDate(event.target.value);
                    if (!startDate) setStartDate(defaultStartDateString(event.target.value));
                  }}
                />
              </label>
              <label>
                <span>Short SMA</span>
                <input type="number" min={2} max={120} value={shortWindow} onChange={(event) => setShortWindow(Number(event.target.value))} />
              </label>
              <label>
                <span>Long SMA</span>
                <input type="number" min={3} max={260} value={longWindow} onChange={(event) => setLongWindow(Number(event.target.value))} />
              </label>
            </div>
            <div className="editor-summary">
              <div>
                <span>Draft market value</span>
                <strong>{formatCurrency(portfolioMarketValue)}</strong>
              </div>
              <div>
                <span>Validation</span>
                <strong>{validationIssues.length ? `${validationIssues.length} issue${validationIssues.length === 1 ? "" : "s"}` : "Ready"}</strong>
              </div>
              {assetWeights.slice(0, 4).map((row) => (
                <div key={row.assetClass}>
                  <span>{row.assetClass}</span>
                  <strong>{formatPercent(row.weight)}</strong>
                </div>
              ))}
            </div>
            {validationIssues.length ? (
              <div className="validation-list">
                {validationIssues.slice(0, 5).map((issue) => (
                  <span key={issue}>{issue}</span>
                ))}
              </div>
            ) : null}
            <div className="table-wrap editable-table">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Asset</th>
                    <th>Sector</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Beta</th>
                    <th>Currency</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {portfolioDetail.positions.map((position, index) => (
                    <tr key={`${position.instrument.symbol}-${index}`}>
                      <td>
                        <input
                          value={position.instrument.symbol}
                          onChange={(event) => updateInstrument(index, { symbol: event.target.value.toUpperCase() })}
                        />
                      </td>
                      <td>
                        <input
                          value={position.instrument.name}
                          onChange={(event) => updateInstrument(index, { name: event.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={position.instrument.asset_class}
                          onChange={(event) => updateInstrument(index, { asset_class: event.target.value })}
                        >
                          {assetClasses.map((assetClass) => (
                            <option key={assetClass} value={assetClass}>
                              {assetClass}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={position.instrument.sector}
                          onChange={(event) => updateInstrument(index, { sector: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={position.quantity}
                          onChange={(event) => updatePosition(index, { quantity: Number(event.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={position.price}
                          onChange={(event) => updatePosition(index, { price: Number(event.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={position.instrument.beta}
                          onChange={(event) => updateInstrument(index, { beta: Number(event.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          value={position.instrument.currency}
                          onChange={(event) => updateInstrument(index, { currency: event.target.value.toUpperCase() })}
                        />
                      </td>
                      <td>
                        <button className="table-icon-button" onClick={() => removePosition(index)} aria-label="Remove position">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="ghost-button"
              onClick={() => setPortfolioDetail({ ...portfolioDetail, positions: [...portfolioDetail.positions, blankPortfolioRow()] })}
            >
              <Plus size={18} />
              Add position
            </button>
          </section>
        ) : null}

        {report ? (
          <>
            <nav className="section-tabs" aria-label="Dashboard sections">
              {sections.map((section) => (
                <button
                  key={section}
                  className={section === activeSection ? "section-tab section-tab--active" : "section-tab"}
                  onClick={() => setActiveSection(section)}
                >
                  {section}
                </button>
              ))}
            </nav>

            <section className="summary-strip">
              <div>
                <span>Total Value</span>
                <strong>{formatCurrency(selectedPortfolio?.market_value ?? report.metrics[0]?.value ?? 0)}</strong>
              </div>
              <div>
                <span>Positions</span>
                <strong>{selectedPortfolio?.position_count ?? report.positions.length}</strong>
              </div>
              <div>
                <span>Base Currency</span>
                <strong>{selectedPortfolio?.base_currency ?? "USD"}</strong>
              </div>
              <div>
                <span>Analytics Engine</span>
                <strong>{report.analytics_engine?.version ? `RiskOptima ${report.analytics_engine.version}` : "RiskOptima"}</strong>
              </div>
            </section>

            {activeSection === "Overview" ? (
              <>
                <section className="metric-grid">
                  {report.metrics.map((metric) => (
                    <MetricCard key={`${metric.name}-${metric.confidence ?? "base"}`} metric={metric} />
                  ))}
                </section>
                <section className="panel run-history">
                  <div className="panel-heading">
                    <h2>Run History</h2>
                    <span>Cached analytics</span>
                  </div>
                  <div className="run-history-list">
                    {runHistory.slice(0, 6).map((run) => (
                      <button
                        key={run.run_id}
                        onClick={() => {
                          setStartDate(run.start_date);
                          setAsOfDate(run.as_of_date);
                          selectedId && generateRun(selectedId, false, { start: run.start_date, asOf: run.as_of_date });
                        }}
                      >
                        <strong>{run.run_id}</strong>
                        <span>
                          {run.start_date} to {run.as_of_date}
                        </span>
                        <small>{run.analytics_engine?.version ? `RiskOptima ${run.analytics_engine.version}` : "RiskOptima"}</small>
                      </button>
                    ))}
                    {!runHistory.length ? <p>No cached runs yet.</p> : null}
                  </div>
                </section>
                <PortfolioDetailsTable report={report} onSelectSymbol={setSelectedInstrument} />
              </>
            ) : null}

            {activeSection === "Risk" ? (
              <>
                <RiskCharts report={report} />
                <CorrelationMatrixTable report={report} />
              </>
            ) : null}

            {activeSection === "Optimization" ? <RiskCharts report={report} /> : null}

            {activeSection === "Signals" && signalReport ? (
              <SignalWorkbench
                signalReport={signalReport}
                selectedSymbol={selectedSignalSymbol}
                onSelectSymbol={(symbol) => {
                  setSelectedSignalSymbol(symbol);
                  setSelectedInstrument(symbol);
                }}
              />
            ) : null}

            {activeSection === "Stress" ? (
              <section className="table-grid">
                <StressScenarioTable report={report} />
                <ContributorsTable report={report} />
              </section>
            ) : null}

            {activeSection === "Workbench" && notebookWorkbench ? <NotebookWorkbench workbench={notebookWorkbench} /> : null}

            {activeSection === "Renders" ? <RenderedChartGallery charts={renderedCharts} loading={loading && renderedCharts.length === 0} /> : null}

            {selectedInstrument ? (
              <InstrumentDrawer
                symbol={selectedInstrument}
                report={report}
                signalReport={signalReport}
                onClose={() => setSelectedInstrument(null)}
              />
            ) : null}
          </>
        ) : (
          <section className="empty-state">
            <UploadCloud size={32} />
            <h2>No portfolio loaded</h2>
            <p>Use one of the CSV files in sample_data to create the first synthetic risk report.</p>
          </section>
        )}
      </section>
    </main>
  );
}
