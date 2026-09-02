import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport } from "../engine/calculations";

const BUCKET_META = [
  { key: "innovation" as const, label: "New Features / Innovation", color: "#2f855a" },
  { key: "maintenance" as const, label: "Maintenance & Eliminating Toil", color: "#c53030" },
  { key: "emergencyResponse" as const, label: "Emergency Response & Troubleshooting", color: "#dd6b20" },
  { key: "testingScaling" as const, label: "Testing & User Scaling", color: "#3182ce" },
];

export function CapacityBucketsChart() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const { buckets } = report;
  const total = Object.values(buckets).reduce((sum, v) => sum + v, 0) || 1;

  return (
    <section className="capacity-chart" aria-label="Error Budget Buckets" data-testid="capacity-chart">
      <h2>Error Budget Buckets</h2>
      <div className="capacity-chart__bar" role="img" aria-label="Stacked bar chart of capacity buckets">
        {BUCKET_META.map(({ key, label, color }) => {
          const value = buckets[key];
          const percent = (value / total) * 100;
          return (
            <div
              key={key}
              className="capacity-chart__segment"
              style={{ width: `${percent}%`, backgroundColor: color }}
              title={`${label}: ${value.toFixed(1)} hrs (${percent.toFixed(1)}%)`}
              data-testid={`capacity-segment-${key}`}
            />
          );
        })}
      </div>
      <ul className="capacity-chart__legend">
        {BUCKET_META.map(({ key, label, color }) => {
          const value = buckets[key];
          const percent = (value / total) * 100;
          return (
            <li key={key} className="capacity-chart__legend-item">
              <span className="capacity-chart__swatch" style={{ backgroundColor: color }} />
              <span className="capacity-chart__legend-label">{label}</span>
              <span className="capacity-chart__legend-value">
                {value.toFixed(1)} hrs ({percent.toFixed(1)}%)
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
