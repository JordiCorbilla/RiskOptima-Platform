import { useEffect, useMemo, useState } from "react";
import { RefreshCw, UploadCloud } from "lucide-react";
import { ContributorsTable, CorrelationMatrixTable, StressScenarioTable } from "./components/Tables";
import { MetricCard } from "./components/MetricCard";
import { RiskCharts } from "./components/RiskCharts";
import { getRiskReport, listPortfolios, uploadPortfolio } from "./services/api";
import type { PortfolioSummary, RiskReport } from "./types/api";
import { formatCurrency } from "./utils";

export function App() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [report, setReport] = useState<RiskReport | null>(null);
  const [uploadName, setUploadName] = useState("Flagship Institutional Portfolio");
  const [status, setStatus] = useState("Load a synthetic CSV portfolio to begin.");
  const [loading, setLoading] = useState(false);

  async function refreshPortfolios(nextId?: number) {
    const data = await listPortfolios();
    setPortfolios(data);
    const targetId = nextId ?? selectedId ?? data[0]?.id ?? null;
    setSelectedId(targetId);
    if (targetId) {
      await refreshRisk(targetId);
    }
  }

  async function refreshRisk(portfolioId: number) {
    setLoading(true);
    try {
      const nextReport = await getRiskReport(portfolioId);
      setReport(nextReport);
      setStatus(`Risk report generated at ${new Date(nextReport.generated_at).toLocaleString()}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load risk report.");
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
      setStatus(`Uploaded ${file.name} and generated a new risk report.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
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
                refreshRisk(portfolio.id);
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
          <button className="icon-button" onClick={() => selectedId && refreshRisk(selectedId)} disabled={!selectedId || loading}>
            <RefreshCw size={18} />
            Refresh
          </button>
        </header>

        <div className="status-line">{status}</div>

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
            </section>

            <section className="metric-grid">
              {report.metrics.map((metric) => (
                <MetricCard key={`${metric.name}-${metric.confidence ?? "base"}`} metric={metric} />
              ))}
            </section>

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
