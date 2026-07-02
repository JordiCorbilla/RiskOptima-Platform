import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { getLibraryCapabilities, getLibraryMetadata, runLibraryExample } from "../../services/api";
import type { ExampleRunResponse, LibraryCapability, LibraryExample, LibraryMetadata } from "../../types/api";

const examples: Array<{ value: LibraryExample; label: string }> = [
  { value: "black_scholes_price", label: "Black-Scholes Price" },
  { value: "greeks", label: "Greeks" },
  { value: "implied_volatility", label: "Implied Volatility" },
  { value: "var_cvar", label: "VaR / CVaR" },
  { value: "volatility_estimator", label: "Volatility Estimator" },
  { value: "optimizer", label: "Optimizer" },
  { value: "merton_pd", label: "Merton PD" }
];

function valueText(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(6) : "n/a";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "n/a";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function RiskOptimaExplorer() {
  const [metadata, setMetadata] = useState<LibraryMetadata | null>(null);
  const [capabilities, setCapabilities] = useState<LibraryCapability[]>([]);
  const [selectedExample, setSelectedExample] = useState<LibraryExample>("black_scholes_price");
  const [exampleResult, setExampleResult] = useState<ExampleRunResponse | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getLibraryMetadata(), getLibraryCapabilities()])
      .then(([nextMetadata, nextCapabilities]) => {
        setMetadata(nextMetadata);
        setCapabilities(nextCapabilities);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load library metadata."));
  }, []);

  async function onRunExample() {
    setLoading(true);
    setError(null);
    try {
      setExampleResult(await runLibraryExample(selectedExample));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run example.");
    } finally {
      setLoading(false);
    }
  }

  const filteredCapabilities = useMemo(() => {
    const token = search.trim().toLowerCase();
    if (!token) return capabilities;
    return capabilities.filter((capability) =>
      [capability.module, capability.name, capability.category, capability.description, capability.ui_module]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(token))
    );
  }, [capabilities, search]);

  const surfacedCount = capabilities.filter((capability) => capability.surfaced_in_platform).length;

  return (
    <section className="module-page">
      <header className="topbar">
        <div>
          <p>RiskOptima Library Explorer</p>
          <h1>Library surface, diagnostics, and runnable examples</h1>
        </div>
      </header>

      {error ? <div className="alert-panel">{error}</div> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <div className="metric-card__header">Installed Library</div>
          <strong>{metadata?.installed_version ? `RiskOptima ${metadata.installed_version}` : "Loading"}</strong>
          <p>{metadata?.import_source ?? "Resolving package import source."}</p>
        </article>
        <article className="metric-card">
          <div className="metric-card__header">Platform Version</div>
          <strong>{metadata?.platform_version ?? "0.2.0"}</strong>
          <p>{metadata?.platform_engine_version ?? "riskoptima-platform-0.2.0"}</p>
        </article>
        <article className="metric-card">
          <div className="metric-card__header">Surfaced Capabilities</div>
          <strong>{surfacedCount}</strong>
          <p>{capabilities.length - surfacedCount} tracked capabilities still need direct UI coverage.</p>
        </article>
        <article className="metric-card">
          <div className="metric-card__header">Local Override</div>
          <strong>{metadata?.local_checkout_override_active ? "Active" : "PyPI package"}</strong>
          <p>Python {metadata?.python_version ?? "loading"}</p>
        </article>
      </section>

      <section className="panel explorer-runner">
        <div className="panel-heading">
          <div>
            <span>Runnable Example</span>
            <h2>Deterministic RiskOptima call</h2>
          </div>
          <button className="icon-button" type="button" onClick={onRunExample} disabled={loading}>
            <Play size={17} />
            Run example
          </button>
        </div>
        <div className="editor-grid">
          <label>
            <span>Example</span>
            <select value={selectedExample} onChange={(event) => setSelectedExample(event.target.value as LibraryExample)}>
              {examples.map((example) => (
                <option key={example.value} value={example.value}>
                  {example.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {exampleResult ? (
          <div className="module-grid">
            <div className="code-panel">
              <span>Generated Python</span>
              <pre>{exampleResult.generated_code}</pre>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Result</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(exampleResult.result).map(([key, value]) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>
                        <pre className="inline-json">{valueText(value)}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span>Capability Map</span>
            <h2>RiskOptima APIs currently tracked by the platform</h2>
          </div>
          <input className="compact-input" placeholder="Search capability" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Module</th>
                <th>Function / class</th>
                <th>UI</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredCapabilities.map((capability) => (
                <tr key={`${capability.module}-${capability.name}`}>
                  <td>{capability.category}</td>
                  <td>{capability.module}</td>
                  <td>{capability.name}</td>
                  <td>{capability.ui_module ?? "Adapter"}</td>
                  <td>{capability.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
