import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport } from "../engine/calculations";

export function WarningBanner() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const teams =
    state.selectedTeamId === "all"
      ? state.teams
      : state.teams.filter((team) => team.id === state.selectedTeamId);
  const hasSmallTeam = teams.some((team) => team.fteCount < 4);

  if (!report.isRedZone && !hasSmallTeam) return null;

  return (
    <>
      {hasSmallTeam && (
        <div className="warning-banner warning-banner--staffing" role="alert" data-testid="staffing-warning">
          Warning: An SRE team with fewer than 4 engineers cannot sustain a healthy 24/7 on-call rotation without
          severe burnout, regardless of service volume.
        </div>
      )}
      {report.isRedZone && (
        <div className="warning-banner" role="alert" data-testid="red-zone-alert">
          ⚠ RED ZONE: Operational load has crossed the 50% capacity threshold — innovation is stalling and the team is
          losing control of the estate. Reduce toil (automate, drop services, or hire) to recover.
        </div>
      )}
    </>
  );
}
