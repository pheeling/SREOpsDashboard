import { describe, expect, it } from "vitest";
import type { DashboardState } from "../engine/types";
import { DEFAULT_SERVICES, cloneDefaultServices } from "../engine/seedServices";
import { dashboardReducer } from "./dashboardReducer";
import { ensureTeams, ORGANIZATION_VIEW } from "../engine/teams";

function createState(): DashboardState {
  return {
    globalConfig: { fteCount: 1, weeklyHours: 40, annualSalary: 150000 },
    services: cloneDefaultServices(),
  };
}

describe("SLO status state", () => {
  it("seeds every default service with a healthy SLO status", () => {
    expect(DEFAULT_SERVICES.every((service) => service.sloStatus === "healthy")).toBe(true);
    expect(cloneDefaultServices().every((service) => service.sloStatus === "healthy")).toBe(true);
  });

  it("updates and resets a service's SLO status", () => {
    const state = createState();
    const updated = dashboardReducer(state, {
      type: "SET_SLO_STATUS",
      serviceId: "databases",
      sloStatus: "exhausted",
    });
    expect(updated.services.find((service) => service.id === "databases")?.sloStatus).toBe("exhausted");

    const reset = dashboardReducer(updated, { type: "RESET", payload: createState() });
    expect(reset.services.find((service) => service.id === "databases")?.sloStatus).toBe("healthy");

    const restored = dashboardReducer(updated, { type: "RESTORE_DEFAULT_SERVICES" });
    expect(restored.services.every((service) => service.sloStatus === "healthy")).toBe(true);
  });

  it("defaults newly added custom services to healthy", () => {
    const added = dashboardReducer(createState(), {
      type: "ADD_CUSTOM_SERVICE",
      payload: { name: "Message Queue", deployHours: 1, maintenanceHours: 1 },
    });
    expect(added.services.find((service) => service.id === "custom_message_queue")?.sloStatus).toBe("healthy");
  });
});

describe("team management", () => {
  const withTeams = () => ensureTeams(createState());

  it("migrates legacy state to a default team", () => {
    const state = withTeams();
    expect(state.teams).toHaveLength(1);
    expect(state.services.every((s) => s.teamId === state.teams![0].id)).toBe(true);
  });

  it("adds, edits and renames teams, syncing globalConfig", () => {
    let state = dashboardReducer(withTeams(), { type: "ADD_TEAM", name: "Observability" });
    expect(state.teams).toHaveLength(2);
    const added = state.teams![1];
    expect(state.selectedTeamId).toBe(added.id);
    state = dashboardReducer(state, { type: "UPDATE_GLOBAL_CONFIG", payload: { fteCount: 3 } });
    expect(state.teams![1].config.fteCount).toBe(3);
    expect(state.teams![0].config.fteCount).toBe(1);
    state = dashboardReducer(state, { type: "RENAME_TEAM", teamId: added.id, name: "Data SRE" });
    expect(state.teams![1].name).toBe("Data SRE");
    state = dashboardReducer(state, { type: "SELECT_TEAM", teamId: ORGANIZATION_VIEW });
    expect(state.globalConfig.fteCount).toBe(4);
  });

  it("reassigns services on delete and keeps the last team", () => {
    let state = dashboardReducer(withTeams(), { type: "ADD_TEAM", name: "Data SRE" });
    const [first, second] = state.teams!;
    state = dashboardReducer(state, { type: "ADD_CUSTOM_SERVICE", payload: { name: "Q", deployHours: 1, maintenanceHours: 1 } });
    expect(state.services.at(-1)?.teamId).toBe(second.id);
    state = dashboardReducer(state, { type: "DELETE_TEAM", teamId: second.id, reassignToTeamId: first.id });
    expect(state.teams).toHaveLength(1);
    expect(state.services.every((s) => s.teamId === first.id)).toBe(true);
    expect(dashboardReducer(state, { type: "DELETE_TEAM", teamId: first.id })).toBe(state);
  });
});
