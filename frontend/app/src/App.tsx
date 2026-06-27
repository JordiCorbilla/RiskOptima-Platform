import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, RefreshCw, Save, Trash2, UploadCloud } from "lucide-react";
import { ContributorsTable, CorrelationMatrixTable, PortfolioDetailsTable, StressScenarioTable } from "./components/Tables";
import { MetricCard } from "./components/MetricCard";
import { NotebookWorkbench } from "./components/NotebookWorkbench";
import { RenderedChartGallery } from "./components/RenderedChartGallery";
import { RiskCharts } from "./components/RiskCharts";
import { SignalWorkbench } from "./components/SignalWorkbench";
import { generatePortfolioRun, getNotebookWorkbench, getPortfolio, getPortfolioSignals, listPortfolios, updatePortfolio, uploadPortfolio } from "./services/api";
import type { NotebookWorkbench as NotebookWorkbenchPayload, Portfolio, PortfolioSignalReport, PortfolioSummary, RenderedChart, RiskReport } from "./types/api";
import { formatCurrency } from "./utils";

const assetClasses = ["Equity", "Fixed Income", "Credit", "Commodity", "Cash", "Alternative"];

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
    } catch (error) {
      setPortfolioDetail(null);
      setStatus(error instanceof Error ? error.message : "Unable to load portfolio details.");
    }
  }

  async function generateRun(portfolioId: number, force = false) {
    setLoading(true);
    try {
      const run = await generatePortfolioRun(portfolioId, {
        start_date: startDate,
        as_of_date: asOfDate,
        force
      });
      const signals = await getPortfolioSignals(portfolioId, {
        start_date: run.start_date,
        as_of_date: run.as_of_date,
        short_window: shortWindow,
        long_window: longWindow,
        stop_loss: 0.05,
        take_profit: 0.1
      });
      const notebooks = await getNotebookWorkbench(portfolioId, {
        start_date: run.start_date,
        as_of_date: run.as_of_date
      });
      setReport(run.report);
      setRenderedCharts(run.charts);
      setSignalReport(signals);
      setNotebookWorkbench(notebooks);
      setSelectedSignalSymbol(signals.summary[0]?.symbol ?? null);
      setStatus(
        `${run.cache_hit ? "Loaded cached" : "Generated"} run ${run.run_id} for ${run.start_date} to ${run.as_of_date}.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to generate portfolio run.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshPortfolios().catch(() => setStatus("API is not reachable. Start the FastAPI backend on port 8000."));
  }, []);

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedId),
    [portfolios, selectedId]
  );

  async function onUpload(file: File | null) {
    if (!file) return;
    setLoading(true);
    try {
      const portfolio = await uploadPortfolio(file, uploadName);
      await refreshPortfolios(portfolio.id);
      setStatus(`Uploaded ${file.name}. Save any edits, then generate the dated run.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onSavePortfolio() {
    if (!portfolioDetail) return;
    setLoading(true);
    try {
      const saved = await updatePortfolio(portfolioDetail);
      setPortfolioDetail(saved);
      await refreshPortfolios(saved.id);
      setStatus("Portfolio details saved. Generate will create a new cache key if positions changed.");
    } catch (error) {
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

            <section className="metric-grid">
              {report.metrics.map((metric) => (
                <MetricCard key={`${metric.name}-${metric.confidence ?? "base"}`} metric={metric} />
              ))}
            </section>

            <PortfolioDetailsTable report={report} />
            {signalReport ? (
              <SignalWorkbench
                signalReport={signalReport}
                selectedSymbol={selectedSignalSymbol}
                onSelectSymbol={setSelectedSignalSymbol}
              />
            ) : null}
            {notebookWorkbench ? <NotebookWorkbench workbench={notebookWorkbench} /> : null}
            <RenderedChartGallery charts={renderedCharts} loading={loading && renderedCharts.length === 0} />
            <RiskCharts report={report} />

            <section className="table-grid">
              <StressScenarioTable report={report} />
              <ContributorsTable report={report} />
            </section>
            <CorrelationMatrixTable report={report} />
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
