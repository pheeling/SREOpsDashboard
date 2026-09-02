import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport } from "../engine/calculations";

export function LoadGauge() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const toilPercent = Math.min(100, report.operationalToilRatio * 100);

  return (
    <section
      className={`load-gauge ${report.isRedZone ? "load-gauge--red-zone" : ""}`}
      aria-label="Innovation vs Load Gauge"
      data-testid="load-gauge"
    >
      <h2>Innovation vs. Load Gauge</h2>
      <div className="load-gauge__bar" role="progressbar" aria-valuenow={Math.round(toilPercent)} aria-valuemin={0} aria-valuemax={100}>
        <div className="load-gauge__fill" style={{ width: `${toilPercent}%` }} />
      </div>
      <p className="load-gauge__reading">
        Operational Toil: {toilPercent.toFixed(1)}% of capacity ({report.operationalToilHours.toFixed(1)} /{" "}
        {report.totalAvailableHours.toFixed(1)} hrs)
      </p>
      {report.isRedZone && (
        <p className="load-gauge__alert" role="alert" data-testid="red-zone-alert">
          ⚠ RED ZONE: Operational Death Spiral — innovation is mathematically impossible until toil is reduced
          below 50% of capacity.
        </p>
      )}
    </section>
  );
}
