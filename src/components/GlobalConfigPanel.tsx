import { useState } from "react";
import { useDashboard } from "../state/DashboardContext";
import { getEditableTeam, MIN_ONCALL_FTE, ORGANIZATION_VIEW } from "../engine/teams";
import { DEFAULT_CAPACITY_EFFICIENCY_FACTOR } from "../engine/calculations";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function GlobalConfigPanel() {
  const { state, dispatch } = useDashboard();
  const teams = state.teams ?? [];
  const selectedTeam = getEditableTeam(state);
  const isOrgView = !selectedTeam;
  const [newTeamName, setNewTeamName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [renameValue, setRenameValue] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reassignTo, setReassignTo] = useState("");

  const otherTeams = teams.filter((team) => team.id !== selectedTeam?.id);
  const reassignTarget = otherTeams.some((team) => team.id === reassignTo) ? reassignTo : otherTeams[0]?.id ?? "";
  const ownedServices = selectedTeam
    ? state.services.filter((service) => service.teamId === selectedTeam.id).length
    : 0;
  const understaffed = teams.filter((team) => team.fteCount < MIN_ONCALL_FTE);

  const closeEditors = () => {
    setIsAdding(false);
    setRenameValue(null);
    setIsDeleting(false);
  };

  return (
    <section className="dashboard-card global-config-panel" aria-label="Team Configuration">
      <h2>Team Configuration</h2>
      {teams.length > 0 && (
        <div className="team-manager">
          <div className="team-manager__row">
            <label htmlFor="team-selector">Team</label>
            <select
              id="team-selector"
              value={selectedTeam?.id ?? ORGANIZATION_VIEW}
              onChange={(e) => {
                closeEditors();
                dispatch({ type: "SELECT_TEAM", teamId: e.target.value });
              }}
            >
              <option value={ORGANIZATION_VIEW}>All teams (Organization)</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => { closeEditors(); setIsAdding(true); }}>
              Add Team
            </button>
            {selectedTeam && (
              <>
                <button type="button" onClick={() => { closeEditors(); setRenameValue(selectedTeam.name); }}>
                  Rename Team
                </button>
                <button
                  type="button"
                  disabled={teams.length <= 1}
                  title={teams.length <= 1 ? "The last remaining team cannot be deleted" : undefined}
                  onClick={() => { closeEditors(); setIsDeleting(true); }}
                >
                  Delete Team
                </button>
              </>
            )}
          </div>
          {isAdding && (
            <form
              className="team-manager__row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTeamName.trim()) return;
                dispatch({ type: "ADD_TEAM", name: newTeamName });
                setNewTeamName("");
                setIsAdding(false);
              }}
            >
              <input
                aria-label="New team name"
                placeholder="e.g. Observability"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                autoFocus
              />
              <button type="submit" disabled={!newTeamName.trim()}>Create Team</button>
              <button type="button" onClick={closeEditors}>Cancel</button>
            </form>
          )}
          {selectedTeam && renameValue !== null && (
            <form
              className="team-manager__row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!renameValue.trim()) return;
                dispatch({ type: "RENAME_TEAM", teamId: selectedTeam.id, name: renameValue });
                setRenameValue(null);
              }}
            >
              <input
                aria-label="Team name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
              />
              <button type="submit" disabled={!renameValue.trim()}>Save Name</button>
              <button type="button" onClick={closeEditors}>Cancel</button>
            </form>
          )}
          {selectedTeam && isDeleting && teams.length > 1 && (
            <div className="team-manager__row" role="group" aria-label="Confirm team deletion">
              <span>
                Delete <strong>{selectedTeam.name}</strong>? Its {ownedServices} service
                {ownedServices === 1 ? "" : "s"} will be reassigned to:
              </span>
              <select
                aria-label="Reassign services to"
                value={reassignTarget}
                onChange={(e) => setReassignTo(e.target.value)}
              >
                {otherTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "DELETE_TEAM", teamId: selectedTeam.id, reassignToTeamId: reassignTarget });
                  closeEditors();
                }}
              >
                Confirm Delete
              </button>
              <button type="button" onClick={closeEditors}>Cancel</button>
            </div>
          )}
          {isOrgView && (
            <div className="team-manager__summary" data-testid="org-team-summary">
              <p>Showing the combined organization capacity. Select a team to edit its parameters.</p>
              <ul>
                {teams.map((team) => (
                  <li key={team.id}>
                    {team.name}: {team.fteCount} FTE
                    {team.fteCount < MIN_ONCALL_FTE ? " (below on-call minimum)" : ""}
                  </li>
                ))}
              </ul>
              {understaffed.length > 0 && <p>{understaffed.length} team(s) breach the on-call guardrail.</p>}
            </div>
          )}
        </div>
      )}
      {!isOrgView && <TeamConfigFields key={selectedTeam?.id} />}
    </section>
  );
}

function TeamConfigFields() {
  const { state, dispatch } = useDashboard();
  const { globalConfig } = state;
  const [fteInput, setFteInput] = useState(String(globalConfig.fteCount));
  const [salaryInput, setSalaryInput] = useState(currencyFormatter.format(globalConfig.annualSalary));

  const capacityPercent =
    (globalConfig.capacityEfficiencyFactor ?? DEFAULT_CAPACITY_EFFICIENCY_FACTOR) * 100;
  const updateSalary = (value: string) => {
    setSalaryInput(value);
    const digits = value.replace(/\D/g, "");
    if (digits) {
      dispatch({ type: "UPDATE_GLOBAL_CONFIG", payload: { annualSalary: Number(digits) } });
    }
  };
  const updateFte = (value: string) => {
    setFteInput(value);
    if (value === "") return;
    dispatch({
      type: "UPDATE_GLOBAL_CONFIG",
      payload: { fteCount: Math.min(50, Math.max(1, Number(value) || 1)) },
    });
  };

  return (
    <>
      <div className="config-control" id="search-target-fte-count">
        <label htmlFor="fte-count">FTE Count</label>
        <div className="config-control__range-row">
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={globalConfig.fteCount}
            onChange={(e) => {
              setFteInput(e.target.value);
              dispatch({ type: "UPDATE_GLOBAL_CONFIG", payload: { fteCount: Number(e.target.value) } });
            }}
            aria-label="FTE Count slider"
          />
          <input
            id="fte-count"
            type="number"
            min={1}
            max={50}
            step={1}
            value={fteInput}
            onChange={(e) => updateFte(e.target.value)}
            onBlur={() => {
              const value = Math.min(50, Math.max(1, Number(fteInput) || globalConfig.fteCount));
              setFteInput(String(value));
              dispatch({ type: "UPDATE_GLOBAL_CONFIG", payload: { fteCount: value } });
            }}
          />
        </div>
      </div>

      <div className="config-control" id="search-target-weekly-hours">
        <label htmlFor="weekly-hours">Weekly Hours per FTE</label>
        <input
          id="weekly-hours"
          type="range"
          min={20}
          max={60}
          step={1}
          value={globalConfig.weeklyHours}
          onChange={(e) =>
            dispatch({ type: "UPDATE_GLOBAL_CONFIG", payload: { weeklyHours: Number(e.target.value) } })
          }
        />
        <output htmlFor="weekly-hours">{globalConfig.weeklyHours} hrs/wk</output>
      </div>

      <div id="search-target-effective-capacity" className={`config-control config-control--capacity ${capacityPercent > 50 ? "config-control--over-half" : ""}`}>
        <label htmlFor="effective-capacity">Effective Capacity (%)</label>
        <input
          id="effective-capacity"
          type="range"
          min={0}
          max={100}
          step={1}
          value={capacityPercent}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_GLOBAL_CONFIG",
              payload: { capacityEfficiencyFactor: Number(e.target.value) / 100 },
            })
          }
        />
        <output htmlFor="effective-capacity">{capacityPercent}%</output>
      </div>

      <div className="config-control" id="search-target-annual-salary">
        <label htmlFor="annual-salary">Annual Salary Baseline ($)</label>
        <input
          id="annual-salary"
          type="text"
          inputMode="numeric"
          value={salaryInput}
          onChange={(e) => updateSalary(e.target.value)}
          onBlur={() => setSalaryInput(currencyFormatter.format(globalConfig.annualSalary))}
        />
      </div>

      <div className="config-control config-control--switch" id="search-target-interrupt-shield">
        <span>Dedicated Interrupt Shield</span>
        <button
          type="button"
          role="switch"
          className={`config-switch ${globalConfig.hasInterruptShield ? "config-switch--enabled" : ""}`}
          aria-label="Dedicated Interrupt Shield"
          aria-checked={Boolean(globalConfig.hasInterruptShield)}
          onClick={() =>
            dispatch({ type: "UPDATE_GLOBAL_CONFIG", payload: { hasInterruptShield: !globalConfig.hasInterruptShield } })
          }
        >
          <span className="config-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>{globalConfig.hasInterruptShield ? "Enabled" : "Disabled"}</span>
        </button>
        <p className="config-control__hint">
          One primary on-call engineer shields the remaining builders from interrupts.
        </p>
      </div>
    </>
  );
}
