import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport, computeScopedReport } from "../engine/calculations";
import { MIN_ONCALL_FTE } from "../engine/teams";

export function WarningBanner() {
  const { state, fullState } = useDashboard();
  const report = computeCapacityReport(state);
  const isOrgView = state.selectedTeamId === "all";
  const orgMetrics = isOrgView ? computeScopedReport(fullState, "all") : null;
  const redZoneTeams = orgMetrics?.teamReports.filter(({ report: teamReport }) => teamReport.isRedZone) ?? [];
  const isRedZone = isOrgView ? (orgMetrics?.teamsInRedZone ?? 0) > 0 : report.isRedZone;
  const understaffedTeams = isOrgView
    ? (fullState.teams ?? []).filter((team) => team.fteCount < MIN_ONCALL_FTE)
    : [];
  const isUnderstaffed = isOrgView && state.teams?.length
    ? understaffedTeams.length > 0
    : state.globalConfig.fteCount < MIN_ONCALL_FTE;

  if (!isRedZone && !isUnderstaffed) return null;

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
      {isRedZone && (
        <div className="warning-banner" role="alert" data-testid="red-zone-alert">
          {isOrgView ? (
            <>
              ⚠ RED ZONE: {redZoneTeams.length} of {orgMetrics?.teamReports.length} teams (
              {redZoneTeams.map(({ team }) => team.name).join(", ")}) {redZoneTeams.length === 1 ? "has" : "have"} crossed
              the 50% capacity threshold — innovation is stalling and the team is losing control of the estate. Reduce toil
              (automate, drop services, or reassign) to recover.
            </>
          ) : (
            <>
              ⚠ RED ZONE: Operational load has crossed the 50% capacity threshold — innovation is stalling and the team is
              losing control of the estate. Reduce toil (automate, drop services, or hire) to recover.
            </>
          )}
        </div>
      )}
    </>
  );
}
