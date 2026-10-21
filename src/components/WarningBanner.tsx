import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport } from "../engine/calculations";
import { getEditableTeam, MIN_ONCALL_FTE } from "../engine/teams";

export function WarningBanner() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const isOrgView = !getEditableTeam(state);
  const understaffedTeams = isOrgView
    ? (state.teams ?? []).filter((team) => team.fteCount < MIN_ONCALL_FTE)
    : [];
  const isUnderstaffed = isOrgView && state.teams?.length
    ? understaffedTeams.length > 0
    : state.globalConfig.fteCount < MIN_ONCALL_FTE;

  if (!report.isRedZone && !isUnderstaffed) return null;

  return (
    <>
      {isUnderstaffed && (
        <div className="warning-banner warning-banner--staffing" role="alert" data-testid="staffing-warning">
          Warning: An SRE team with fewer than 4 engineers cannot sustain a healthy 24/7 on-call rotation without
          severe burnout, regardless of service volume.
          {understaffedTeams.length > 0 && (
            <> Teams below the guardrail: {understaffedTeams.map((team) => team.name).join(", ")}.</>
          )}
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
