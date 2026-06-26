import type { RenderedChart } from "../types/api";

export function RenderedChartGallery({ charts, loading }: { charts: RenderedChart[]; loading: boolean }) {
  return (
    <section className="render-gallery" aria-label="RiskOptima rendered chart gallery">
      <div className="section-heading">
        <h2>RiskOptima Rendered Charts</h2>
        <span>Matplotlib-style outputs from the backend</span>
      </div>
      {loading ? <div className="panel render-placeholder">Rendering charts...</div> : null}
      {charts.map((chart) => (
        <article className="panel rendered-chart" key={chart.title}>
          <div className="panel-heading">
            <h2>{chart.title}</h2>
            <span>{chart.description}</span>
          </div>
          <img src={chart.image} alt={chart.title} />
        </article>
      ))}
    </section>
  );
}
