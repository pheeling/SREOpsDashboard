import { describe, expect, it } from "vitest";
import type { DashboardState } from "../engine/types";
import { DEFAULT_SERVICES, cloneDefaultServices } from "../engine/seedServices";
import { dashboardReducer } from "./dashboardReducer";

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

describe("team scoping", () => {
  function twoTeamState(): DashboardState {
    let state = dashboardReducer(createState(), { type: "ADD_TEAM", name: "Payments" });
    state = dashboardReducer(state, { type: "SET_SERVICE_TEAM", serviceId: "databases", teamId: "team_payments" });
    return state;
  }

  it("assigns services to the first team by default and selects a newly added team", () => {
    const state = twoTeamState();
    expect(state.teams?.map((team) => team.id)).toEqual(["default", "team_payments"]);
    expect(state.selectedTeamId).toBe("team_payments");
    expect(state.services.find((service) => service.id === "databases")?.teamId).toBe("team_payments");
    expect(state.services.find((service) => service.id === "printing")?.teamId).toBe("default");
  });

  it("edits only the selected team's config and aggregates in the organization view", () => {
    let state = dashboardReducer(twoTeamState(), { type: "UPDATE_GLOBAL_CONFIG", payload: { fteCount: 3 } });
    expect(state.globalConfig.fteCount).toBe(3);
    expect(state.teams?.[0].config.fteCount).toBe(1);

    state = dashboardReducer(state, { type: "SET_SELECTED_TEAM", teamId: "all" });
    expect(state.globalConfig.fteCount).toBe(4);
    expect(dashboardReducer(state, { type: "UPDATE_GLOBAL_CONFIG", payload: { fteCount: 9 } }).globalConfig.fteCount).toBe(4);
  });

  it("only deletes the selected team's services", () => {
    const state = dashboardReducer(twoTeamState(), { type: "DELETE_ALL_SERVICES" });
    expect(state.services.map((service) => service.id)).not.toContain("databases");
    const other = dashboardReducer(twoTeamState(), { type: "SET_SELECTED_TEAM", teamId: "default" });
    expect(dashboardReducer(other, { type: "DELETE_ALL_SERVICES" }).services.map((service) => service.id)).toEqual(["databases"]);
  });
});
