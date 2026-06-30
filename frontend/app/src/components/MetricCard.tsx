import { Activity, DollarSign, LineChart, TrendingDown } from "lucide-react";
import type { RiskMetric } from "../types/api";
import { formatMetric } from "../utils";

const iconMap: Record<string, JSX.Element> = {
  "Market Value": <DollarSign size={18} />,
  "Annualized Volatility": <Activity size={18} />,
  "Maximum Drawdown": <TrendingDown size={18} />,
  "Historical VaR": <LineChart size={18} />
};

export function MetricCard({ metric }: { metric: RiskMetric }) {
  return (
    <article className="metric-card">
      <div className="metric-card__header">
        <span className="icon-badge">{iconMap[metric.name] ?? <Activity size={18} />}</span>
        <span>{metric.name}</span>
      </div>
      <strong>{formatMetric(metric.value, metric.unit)}</strong>
      <p>{metric.description}</p>
    </article>
  );
}
