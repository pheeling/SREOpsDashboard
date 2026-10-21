import { useState } from "react";
import { useDashboard } from "../state/DashboardContext";
import { DEFAULT_CAPACITY_EFFICIENCY_FACTOR } from "../engine/calculations";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function GlobalConfigPanel() {
  const { state, dispatch, isOrganizationView, selectedTeamName, teams } = useDashboard();
  const { globalConfig } = state;
  const [newTeamName, setNewTeamName] = useState("");
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
    <section className="dashboard-card global-config-panel" aria-label="Team Configuration">
      <h2>Team Configuration</h2>
      {isOrganizationView ? (
        <p className="config-control__hint" data-testid="org-config-summary">
          Organization totals across {teams.length} {teams.length === 1 ? "team" : "teams"}: {globalConfig.fteCount} Total FTEs ·{" "}
          {currencyFormatter.format(globalConfig.annualSalary)} Average Salary · {capacityPercent.toFixed(0)}% Average
          Capacity. Select a team to edit its settings.
        </p>
      ) : (
        <p className="config-control__hint">Editing {selectedTeamName}.</p>
      )}
      <form
        className="config-team-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newTeamName.trim()) return;
          dispatch({ type: "ADD_TEAM", name: newTeamName });
          setNewTeamName("");
        }}
      >
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          aria-label="New team name"
          placeholder="New team name"
        />
        <button type="submit">Add Team</button>
      </form>
      <fieldset className="config-fieldset" disabled={isOrganizationView}>
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
      </fieldset>
    </section>
  );
}
