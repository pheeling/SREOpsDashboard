import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport, getHandbackCandidates } from "../engine/calculations";

export function HandbackSimulator() {
  const { state, dispatch } = useDashboard();
  const report = computeCapacityReport(state);

  if (!report.isRedZone) return null;

  const candidates = getHandbackCandidates(state.services);

  return (
    <section className="dashboard-card handback-simulator" aria-label="Handback Simulator" data-testid="handback-simulator">
      <h2>Handback Simulator</h2>
      <p data-testid="handback-deficit">
        Shed <strong>{report.deficitHours.toFixed(1)} hrs/wk</strong> of toil back to product development to reach
        &le; 50% operational load without hiring.
      </p>
      {candidates.length > 0 ? (
        <ul className="handback-simulator__list">
          {candidates.map((candidate) => (
            <li key={candidate.serviceId} data-testid={`handback-candidate-${candidate.serviceId}`}>
              {candidate.name} — sheds {candidate.hoursSaved.toFixed(1)} hrs/wk{" "}
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "SET_OWNERSHIP", serviceId: candidate.serviceId, ownershipModel: "dev_owned" })
                }
                aria-label={`Simulate Dev Handback for ${candidate.name}`}
              >
                Simulate Dev Handback
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No remaining services can be handed back.</p>
      )}
    </section>
  );
}
