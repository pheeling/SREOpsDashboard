import { useDashboard } from "../state/DashboardContext";
import { ORGANIZATION_VIEW } from "../engine/teams";

export function DashboardHeader() {
  const { state, dispatch } = useDashboard();
  const teams = state.teams ?? [];

  return (
    <header className="dashboard__header">
      <h1>SRE Infrastructure Complexity &amp; Operational Capacity Calculator</h1>
      <p>Quantify operational toil and keep it under the 50% SRE capacity threshold.</p>
      <label className="dashboard__view-filter">
        View
        <select
          value={state.selectedTeamId ?? ORGANIZATION_VIEW}
          onChange={(e) => dispatch({ type: "SELECT_TEAM", teamId: e.target.value })}
          aria-label="Dashboard view"
          data-testid="team-view-filter"
        >
          <option value={ORGANIZATION_VIEW}>All Teams (Organization View)</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}
