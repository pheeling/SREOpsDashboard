import { useDashboard } from "../state/DashboardContext";
import { DEFAULT_CAPACITY_EFFICIENCY_FACTOR } from "../engine/calculations";

export function GlobalConfigPanel() {
  const { state, dispatch } = useDashboard();
  const { globalConfig } = state;

  return (
    <section className="dashboard-card global-config-panel" aria-label="Global Configuration">
      <h2>Team Configuration</h2>
      <label>
        FTE Count
        <input
          type="number"
          min={0}
          value={globalConfig.fteCount}
          onChange={(e) =>
            dispatch({ type: "UPDATE_GLOBAL_CONFIG", payload: { fteCount: Number(e.target.value) } })
          }
        />
      </label>
      <label>
        Weekly Hours per FTE
        <input
          type="number"
          min={0}
          value={globalConfig.weeklyHours}
          onChange={(e) =>
            dispatch({ type: "UPDATE_GLOBAL_CONFIG", payload: { weeklyHours: Number(e.target.value) } })
          }
        />
      </label>
      <label>
        Effective Capacity (%)
        <input
          type="number"
          min={0}
          max={100}
          value={(globalConfig.capacityEfficiencyFactor ?? DEFAULT_CAPACITY_EFFICIENCY_FACTOR) * 100}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_GLOBAL_CONFIG",
              payload: { capacityEfficiencyFactor: Number(e.target.value) / 100 },
            })
          }
        />
      </label>
      <label>
        Annual Salary Baseline ($)
        <input
          type="number"
          min={0}
          value={globalConfig.annualSalary}
          onChange={(e) =>
            dispatch({ type: "UPDATE_GLOBAL_CONFIG", payload: { annualSalary: Number(e.target.value) } })
          }
        />
      </label>
    </section>
  );
}
