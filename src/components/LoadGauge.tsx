import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport, computeScopedReport } from "../engine/calculations";

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
  const { state, fullState, selectedTeamName } = useDashboard();
  const report = computeCapacityReport(state);
  const loadPercent = Math.min(100, Math.max(0, report.operationalLoadRatio * 100));
  const color = gaugeColor(loadPercent);
  const filledLength = (loadPercent / 100) * CIRCUMFERENCE;

  const isOrgView = !selectedTeamName && (fullState.teams?.length ?? 0) > 0;
  const orgReport = isOrgView ? computeScopedReport(fullState, "all") : null;

  return (
    <section
      className={`dashboard-card load-gauge ${report.isRedZone ? "load-gauge--red-zone" : ""}`}
      aria-label="Operational Load vs Innovation Capacity Gauge"
      data-testid="load-gauge"
      id="search-target-load-gauge"
    >
      <h2>{orgReport ? "Team Health Breakdown" : "Operational Load"}</h2>
      {orgReport && (
        <div className="load-gauge__teams" data-testid="team-health-breakdown">
          <p className="load-gauge__reading" data-testid="teams-in-crisis">
            {orgReport.teamsInRedZone} / {orgReport.teamReports.length} Teams in Crisis
          </p>
          <p data-testid="org-deficit-hours">
            Unhedged operational deficit: <strong>{orgReport.deficitHours.toFixed(1)} hrs/wk</strong>
          </p>
          <ul className="load-gauge__team-list">
            {orgReport.teamReports.map(({ team, report: teamReport }) => {
              const percent = Math.max(0, teamReport.operationalLoadRatio * 100);
              return (
                <li key={team.id} data-testid={`team-health-${team.id}`}>
                  <span>
                    {team.name}: {percent.toFixed(0)}% {teamReport.isRedZone ? "(Red Zone)" : ""}
                  </span>
                  <div
                    role="progressbar"
                    aria-label={`${team.name} operational load`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, Math.round(percent))}
                    style={{ background: "#e2e8f0", height: 8, borderRadius: 4 }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, percent)}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: gaugeColor(percent),
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <h3>Aggregate Workload Volume (Assumes 100% Fungibility)</h3>
        </div>
      )}
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
