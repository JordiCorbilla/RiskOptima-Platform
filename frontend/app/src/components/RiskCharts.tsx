import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { RiskReport } from "../types/api";
import { formatPercent } from "../utils";

export function RiskCharts({ report }: { report: RiskReport }) {
  const factorColors = ["#1f6feb", "#2da44e", "#bf8700", "#cf222e", "#8250df"];
  const distribution = report.var_cvar.filter((point) => point.name?.startsWith("P"));
  const var95 = report.var_cvar.find((point) => point.name === "95%");
  const var99 = report.var_cvar.find((point) => point.name === "99%");

  return (
    <section className="chart-grid" aria-label="Portfolio risk charts">
      <div className="panel chart-panel">
        <div className="panel-heading">
          <h2>VaR / CVaR Loss Distribution</h2>
          <span>Historical simulation</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={distribution}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" hide />
            <YAxis tickFormatter={formatPercent} />
            <Tooltip formatter={(value: number) => formatPercent(value)} />
            {var95?.var95 && <ReferenceLine y={var95.var95} stroke="#bf8700" strokeDasharray="4 4" label="VaR 95" />}
            {var99?.var99 && <ReferenceLine y={var99.var99} stroke="#cf222e" strokeDasharray="4 4" label="VaR 99" />}
            <Line type="monotone" dataKey="value" stroke="#1f6feb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="panel chart-panel">
        <div className="panel-heading">
          <h2>Drawdown</h2>
          <span>Peak-to-trough path</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={report.drawdown}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" minTickGap={32} />
            <YAxis tickFormatter={formatPercent} />
            <Tooltip formatter={(value: number) => formatPercent(value)} />
            <Line type="monotone" dataKey="value" stroke="#cf222e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="panel chart-panel chart-panel--wide">
        <div className="panel-heading">
          <h2>Factor Exposure</h2>
          <span>Weighted regression betas</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={report.factor_exposure}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value: number) => value.toFixed(3)} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {report.factor_exposure.map((_, index) => (
                <Cell key={index} fill={factorColors[index % factorColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
