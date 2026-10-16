import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport } from "../engine/calculations";

const RADIUS = 80;
const STROKE = 22;
const CX = 100;
const CY = 100;
const CIRCUMFERENCE = Math.PI * RADIUS;

function gaugeColor(percent: number): string {
  if (percent >= 50) return "#c53030"; // red — degradation / toil crisis
  if (percent >= 40) return "#dd6b20"; // orange — approaching threshold
  return "#2f855a"; // green — healthy innovation zone
}

function gaugeLabel(percent: number): string {
  if (percent >= 50) return "Toil Crisis";
  if (percent >= 40) return "Approaching Limit";
  return "Healthy";
}

export function LoadGauge() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const loadPercent = Math.min(100, Math.max(0, report.operationalLoadRatio * 100));
  const color = gaugeColor(loadPercent);
  const filledLength = (loadPercent / 100) * CIRCUMFERENCE;

  return (
    <section
      className={`dashboard-card load-gauge ${report.isRedZone ? "load-gauge--red-zone" : ""}`}
      aria-label="Operational Load vs Innovation Capacity Gauge"
      data-testid="load-gauge"
    >
      <h2>Operational Load</h2>
      <svg
        className="load-gauge__svg"
        viewBox="0 0 200 110"
        role="img"
        aria-label={`Operational load is ${loadPercent.toFixed(1)} percent`}
      >
        <path
          d={`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          d={`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filledLength} ${CIRCUMFERENCE}`}
          data-testid="load-gauge-arc"
          style={{ transition: "stroke-dasharray 0.4s ease, stroke 0.4s ease" }}
        />
        <text x={CX} y={CY - 5} textAnchor="middle" className="load-gauge__percent" fill={color}>
          {loadPercent.toFixed(0)}%
        </text>
      </svg>
      <p className="load-gauge__reading" data-testid="load-gauge-status" style={{ color }}>
        {gaugeLabel(loadPercent)}
      </p>
      <p className="load-gauge__detail">
        {report.operationalLoadHours.toFixed(1)} / {report.effectiveAvailableHours.toFixed(1)} hrs toward operational work
      </p>
    </section>
  );
}
