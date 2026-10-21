import { useState } from "react";
import { useDashboard } from "../state/DashboardContext";
import { DEFAULT_CAPACITY_EFFICIENCY_FACTOR } from "../engine/calculations";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function GlobalConfigPanel() {
  const { state, dispatch } = useDashboard();
  const globalConfig = state.teams.find((team) => team.id === state.selectedTeamId) ?? state.teams[0]!;
  const [fteInput, setFteInput] = useState(String(globalConfig.fteCount));
  const [salaryInput, setSalaryInput] = useState(currencyFormatter.format(globalConfig.annualSalaryBaseline));

  const capacityPercent =
    (globalConfig.effectiveCapacityPercentage ?? DEFAULT_CAPACITY_EFFICIENCY_FACTOR) * 100;
  const updateSalary = (value: string) => {
    setSalaryInput(value);
    const digits = value.replace(/\D/g, "");
    if (digits) {
      dispatch({ type: "UPDATE_GLOBAL_CONFIG", payload: { annualSalaryBaseline: Number(digits) } });
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
      <label className="config-control">
        Dashboard Scope
        <select
          aria-label="Dashboard Scope"
          value={state.selectedTeamId}
          onChange={(event) => {
            const teamId = event.target.value;
            const team = state.teams.find((item) => item.id === teamId) ?? state.teams[0];
            if (team) {
              setFteInput(String(team.fteCount));
              setSalaryInput(currencyFormatter.format(team.annualSalaryBaseline));
            }
            dispatch({ type: "SET_SELECTED_TEAM", teamId });
          }}
        >
          <option value="all">All Teams</option>
          {state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          let number = state.teams.length + 1;
          let id = `team-${number}`;
          while (state.teams.some((team) => team.id === id)) {
            number += 1;
            id = `team-${number}`;
          }
          setFteInput("5");
          setSalaryInput(currencyFormatter.format(150_000));
          dispatch({
            type: "ADD_TEAM",
            payload: {
              id,
              name: `Team ${number}`,
              fteCount: 5,
              weeklyHours: 40,
              effectiveCapacityPercentage: DEFAULT_CAPACITY_EFFICIENCY_FACTOR,
              annualSalaryBaseline: 150_000,
            },
          });
        }}
      >
        + Add Team
      </button>
      <p>Editing: {globalConfig.name}</p>
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
              payload: { effectiveCapacityPercentage: Number(e.target.value) / 100 },
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
          onBlur={() => setSalaryInput(currencyFormatter.format(globalConfig.annualSalaryBaseline))}
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
    </section>
  );
}
