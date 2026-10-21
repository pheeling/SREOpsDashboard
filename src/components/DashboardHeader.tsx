import { ALL_TEAMS_ID } from "../engine/types";
import { useDashboard } from "../state/DashboardContext";

export function DashboardHeader() {
  const { teams, selectedTeamId, dispatch } = useDashboard();

  return (
    <header className="dashboard__header">
      <h1>SRE Infrastructure Complexity &amp; Operational Capacity Calculator</h1>
      <p>Quantify operational toil and keep it under the 50% SRE capacity threshold.</p>
      <label className="dashboard__view-filter">
        View
        <select
          value={selectedTeamId}
          onChange={(e) => dispatch({ type: "SET_SELECTED_TEAM", teamId: e.target.value })}
          aria-label="Dashboard view"
          data-testid="team-view-filter"
        >
          <option value={ALL_TEAMS_ID}>All Teams (Organization View)</option>
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
