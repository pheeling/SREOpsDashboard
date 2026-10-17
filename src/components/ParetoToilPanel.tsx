import { useState } from "react";
import { useDashboard } from "../state/DashboardContext";
import {
  STABILIZATION_SPRINT_REDUCTION,
  STABILIZATION_SPRINT_WEEKS,
  getParetoToilRanking,
  simulateStabilizationSprint,
} from "../engine/calculations";

const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

export function ParetoToilPanel() {
  const { state, dispatch } = useDashboard();
  const [showScenario, setShowScenario] = useState(false);

  const pareto = getParetoToilRanking(state.services);
  const scenario = showScenario ? simulateStabilizationSprint(state) : null;

  const handleApply = () => {
    if (scenario) dispatch({ type: "APPLY_STABILIZATION_SPRINT", serviceId: scenario.serviceId });
    setShowScenario(false);
  };

  return (
    <div className="pareto-toil" data-testid="pareto-toil-panel">
      <details>
        <summary data-testid="pareto-toil-summary">
          Pareto Toil Breakdown
          {pareto.entries.length > 0 &&
            ` — Top ${pareto.topCount} driver${pareto.topCount === 1 ? "" : "s"} account for ${pct(pareto.topShare)} of all toil`}
        </summary>
        {pareto.entries.length === 0 ? (
          <p>No active services contributing toil.</p>
        ) : (
          <ol className="pareto-toil__list" data-testid="pareto-toil-list">
            {pareto.entries.map((entry) => (
              <li key={entry.id} data-testid={`pareto-row-${entry.id}`}>
                <span>
                  #{entry.rank} {entry.name}
                  {entry.isTopContributor ? " ★" : ""}
                </span>
                <span>
                  {entry.requiredHours.toFixed(1)} hrs/wk ({pct(entry.share)}, cumulative {pct(entry.cumulativeShare)})
                </span>
                <div className="pareto-toil__bar" style={{ width: `${entry.share * 100}%` }} />
              </li>
            ))}
          </ol>
        )}
      </details>

      <button
        type="button"
        onClick={() => setShowScenario((v) => !v)}
        disabled={pareto.entries.length === 0}
        data-testid="model-stabilization-sprint"
      >
        {showScenario ? "Cancel Sprint Model" : "Model 2-Week Stabilization Sprint"}
      </button>

      {scenario && (
        <div className="pareto-toil__scenario" data-testid="stabilization-scenario">
          <p>
            Preview: dedicate 1 FTE for {STABILIZATION_SPRINT_WEEKS} weeks ({scenario.sprintHours.toFixed(0)} hrs) to{" "}
            <strong>{scenario.serviceName}</strong>, cutting its base hours by{" "}
            {(STABILIZATION_SPRINT_REDUCTION * 100).toFixed(0)}% (saves {scenario.hoursSavedPerWeek.toFixed(1)} hrs/wk).
          </p>
          <ul>
            <li data-testid="scenario-load">
              Operational Load: {pct(scenario.before.operationalLoadRatio)} → {pct(scenario.after.operationalLoadRatio)}
            </li>
            <li data-testid="scenario-maintenance">
              Routine Toil Bucket: {scenario.before.buckets.maintenance.toFixed(1)} →{" "}
              {scenario.after.buckets.maintenance.toFixed(1)} hrs
            </li>
            <li data-testid="scenario-innovation">
              Innovation Bucket: {scenario.before.buckets.innovation.toFixed(1)} →{" "}
              {scenario.after.buckets.innovation.toFixed(1)} hrs
            </li>
          </ul>
          <button type="button" onClick={handleApply} data-testid="apply-stabilization-sprint">
            Apply Sprint
          </button>
        </div>
      )}
    </div>
  );
}
