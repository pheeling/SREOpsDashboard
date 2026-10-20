import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport } from "../engine/calculations";

const BUCKET_META = [
  { key: "innovation" as const, label: "New Features / Innovation & Toil Reduction", color: "#2f855a" },
  { key: "maintenance" as const, label: "Routine Operations & Maintenance Toil", color: "#c53030" },
  { key: "emergencyResponse" as const, label: "Emergency Response & Troubleshooting", color: "#dd6b20" },
  { key: "testingScaling" as const, label: "Testing & Scaling / User Growth", color: "#3182ce" },
  { key: "securityCompliance" as const, label: "Security & Patching / Compliance", color: "#805ad5" },
  { key: "onCallMonitoring" as const, label: "On-Call & Monitoring", color: "#d69e2e" },
];

export function CapacityBucketsChart() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const { buckets } = report;
  const total = Object.values(buckets).reduce((sum, value) => sum + value, 0);
  const capacity = report.effectiveAvailableHours;
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
            title={`${label}: ${value.toFixed(1)} hrs (${bucketShare.toFixed(1)}% of bucket hours; ${capacityPercent.toFixed(1)}% of effective capacity)`}
            data-testid={`capacity-segment-${key}`}
          />
        ))}
      </div>
      <p className="capacity-chart__overhead" data-testid="cognitive-overhead">
        Lost cognitive overhead (context switching): {report.cognitiveOverheadHours.toFixed(1)} hrs
      </p>
      {report.recoveredInnovationHours > 0 && (
        <p className="capacity-chart__shield" data-testid="recovered-hours">
          Interrupt shield recovers {report.recoveredInnovationHours.toFixed(1)} engineering hrs of context-switching
          overhead.
        </p>
      )}
      <ul className="capacity-chart__legend">
        {bucketMetrics.map(({ key, label, color, value, bucketShare, capacityPercent }) => (
          <li key={key} className="capacity-chart__legend-item">
            <span className="capacity-chart__swatch" style={{ backgroundColor: color }} />
            <span className="capacity-chart__legend-label">{label}</span>
            <span className="capacity-chart__legend-value">
              {value.toFixed(1)} hrs ({bucketShare.toFixed(1)}% of bucket hours;{" "}
              {capacityPercent.toFixed(1)}% of effective capacity)
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
