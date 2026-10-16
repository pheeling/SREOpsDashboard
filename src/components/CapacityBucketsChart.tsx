import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport } from "../engine/calculations";

const BUCKET_META = [
  { key: "innovation" as const, label: "New Features / Innovation", color: "#2f855a" },
  { key: "maintenance" as const, label: "Maintenance & Eliminating Toil", color: "#c53030" },
  { key: "emergencyResponse" as const, label: "Emergency Response & Troubleshooting", color: "#dd6b20" },
  { key: "testingScaling" as const, label: "Testing & User Scaling", color: "#3182ce" },
  { key: "securityCompliance" as const, label: "Security & Compliance Patching", color: "#805ad5" },
  { key: "onCallMonitoring" as const, label: "On-Call & Monitoring", color: "#d69e2e" },
];

export function CapacityBucketsChart() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const { buckets } = report;
  const total = Object.values(buckets).reduce((sum, value) => sum + value, 0);
  const capacity = report.totalAvailableHours;
  const bucketMetrics = BUCKET_META.map((bucket) => {
    const value = buckets[bucket.key];
    return {
      ...bucket,
      value,
      capacityPercent: capacity > 0 ? (value / capacity) * 100 : 0,
      bucketShare: total > 0 ? (value / total) * 100 : 0,
    };
  });

  return (
    <section className="dashboard-card capacity-chart" aria-label="Error Budget Buckets" data-testid="capacity-chart">
      <h2>Error Budget Buckets</h2>
      <div
        className="capacity-chart__bar"
        role="img"
        aria-label="Stacked bar showing each bucket's share of the total bucket hours"
      >
        {bucketMetrics.map(({ key, label, color, value, capacityPercent, bucketShare }) => (
          <div
            key={key}
            className="capacity-chart__segment"
            style={{ width: `${bucketShare}%`, backgroundColor: color }}
            title={`${label}: ${value.toFixed(1)} hrs (${bucketShare.toFixed(1)}% of bucket hours; ${capacityPercent.toFixed(1)}% of FTE capacity)`}
            data-testid={`capacity-segment-${key}`}
          />
        ))}
      </div>
      <ul className="capacity-chart__legend">
        {bucketMetrics.map(({ key, label, color, value, capacityPercent }) => (
          <li key={key} className="capacity-chart__legend-item">
            <span className="capacity-chart__swatch" style={{ backgroundColor: color }} />
            <span className="capacity-chart__legend-label">{label}</span>
            <span className="capacity-chart__legend-value">
              {value.toFixed(1)} hrs ({capacityPercent.toFixed(1)}% of FTE capacity)
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
